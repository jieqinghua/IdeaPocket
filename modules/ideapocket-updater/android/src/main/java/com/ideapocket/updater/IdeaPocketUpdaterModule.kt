package com.ideapocket.updater

import android.Manifest
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

private const val PREFS_NAME = "ideapocket_updater"
private const val PREF_DOWNLOAD_ID = "download_id"
private const val PREF_FILE_NAME = "file_name"
private const val PREF_EXPECTED_SHA256 = "expected_sha256"
private const val PREF_EXPECTED_VERSION_CODE = "expected_version_code"

class IdeaPocketUpdaterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IdeaPocketUpdater")

    AsyncFunction("getCurrentBuildInfoAsync") {
      currentBuildInfo()
    }

    AsyncFunction("getNotificationPermissionsAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(permissionResponse(true))
      } else {
        Permissions.getPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      }
    }

    AsyncFunction("requestNotificationPermissionsAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(permissionResponse(true))
      } else {
        Permissions.askForPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      }
    }

    AsyncFunction("enqueueDownloadAsync") {
        url: String,
        fileName: String,
        expectedSha256: String,
        expectedVersionCode: Long ->
      enqueueDownload(url, fileName, expectedSha256, expectedVersionCode)
    }

    AsyncFunction("getDownloadStateAsync") {
      getDownloadState()
    }

    AsyncFunction("cancelDownloadAsync") {
      cancelDownload()
    }

    AsyncFunction("verifyDownloadedApkAsync") Coroutine { ->
      verifyDownloadedApk()
    }

    AsyncFunction("requestInstallAsync") Coroutine { ->
      requestInstall()
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React Application Context is unavailable" }

  private val preferences
    get() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private val downloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  private fun permissionResponse(granted: Boolean) = mapOf(
    "status" to if (granted) "granted" else "denied",
    "granted" to granted,
    "canAskAgain" to true,
    "expires" to "never"
  )

  @Suppress("DEPRECATION")
  private fun packageInfo(packageName: String): PackageInfo {
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES
    } else {
      PackageManager.GET_SIGNATURES
    }
    return context.packageManager.getPackageInfo(packageName, flags)
  }

  private fun currentBuildInfo(): Map<String, Any?> {
    val info = packageInfo(context.packageName)
    return mapOf(
      "packageName" to info.packageName,
      "versionName" to info.versionName,
      "versionCode" to versionCode(info),
      "signingCertificateSha256" to signerDigests(info).sorted()
    )
  }

  private fun enqueueDownload(
    rawUrl: String,
    rawFileName: String,
    rawExpectedSha256: String,
    expectedVersionCode: Long
  ): Map<String, Any?> {
    val uri = Uri.parse(rawUrl)
    require(uri.scheme == "https") { "更新文件必须使用 HTTPS" }
    require(rawFileName.matches(Regex("^[A-Za-z0-9._-]+\\.apk$"))) { "APK 文件名不安全" }
    val expectedSha256 = rawExpectedSha256.lowercase()
    require(expectedSha256.matches(Regex("^[a-f0-9]{64}$"))) { "SHA-256 格式无效" }
    require(expectedVersionCode > versionCode(packageInfo(context.packageName))) { "更新版本号必须高于当前版本" }

    cancelDownload()
    val destination = File(
      requireNotNull(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)) {
        "设备没有可用的应用下载目录"
      },
      rawFileName
    )
    if (destination.exists()) destination.delete()

    val request = DownloadManager.Request(uri)
      .setTitle("IdeaPocket 应用更新")
      .setDescription(rawFileName)
      .setMimeType("application/octet-stream")
      .setAllowedOverMetered(true)
      .setAllowedOverRoaming(true)
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, rawFileName)
    val downloadId = downloadManager.enqueue(request)
    preferences.edit()
      .putLong(PREF_DOWNLOAD_ID, downloadId)
      .putString(PREF_FILE_NAME, rawFileName)
      .putString(PREF_EXPECTED_SHA256, expectedSha256)
      .putLong(PREF_EXPECTED_VERSION_CODE, expectedVersionCode)
      .apply()
    return mapOf("status" to "pending", "downloadId" to downloadId)
  }

  private fun getDownloadState(): Map<String, Any?> {
    val downloadId = preferences.getLong(PREF_DOWNLOAD_ID, -1L)
    if (downloadId <= 0L) return mapOf("status" to "idle", "progress" to 0)
    downloadManager.query(DownloadManager.Query().setFilterById(downloadId)).use { cursor ->
      if (!cursor.moveToFirst()) return mapOf("status" to "missing", "progress" to 0, "downloadId" to downloadId)
      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
      val progress = if (total > 0L) ((downloaded * 100L) / total).toInt().coerceIn(0, 100) else 0
      val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
      val state = when (status) {
        DownloadManager.STATUS_PENDING -> "pending"
        DownloadManager.STATUS_RUNNING -> "running"
        DownloadManager.STATUS_PAUSED -> "paused"
        DownloadManager.STATUS_SUCCESSFUL -> "successful"
        DownloadManager.STATUS_FAILED -> "failed"
        else -> "unknown"
      }
      return mapOf(
        "status" to state,
        "progress" to if (state == "successful") 100 else progress,
        "downloadId" to downloadId,
        "fileName" to preferences.getString(PREF_FILE_NAME, ""),
        "expectedVersionCode" to preferences.getLong(PREF_EXPECTED_VERSION_CODE, -1L),
        "reason" to reason,
        "bytesDownloaded" to downloaded,
        "totalBytes" to total
      )
    }
  }

  private fun cancelDownload(): Map<String, Any?> {
    val downloadId = preferences.getLong(PREF_DOWNLOAD_ID, -1L)
    if (downloadId > 0L) downloadManager.remove(downloadId)
    downloadedFile()?.let { if (it.exists()) it.delete() }
    preferences.edit().clear().apply()
    return mapOf("status" to "idle")
  }

  private fun downloadedFile(): File? {
    val fileName = preferences.getString(PREF_FILE_NAME, null) ?: return null
    val directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: return null
    return File(directory, fileName)
  }

  @Suppress("DEPRECATION")
  private fun archivePackageInfo(file: File): PackageInfo? {
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES
    } else {
      PackageManager.GET_SIGNATURES
    }
    return context.packageManager.getPackageArchiveInfo(file.absolutePath, flags)
  }

  private fun verifyDownloadedApk(): Map<String, Any?> {
    val state = getDownloadState()
    if (state["status"] != "successful") {
      return failure("download-incomplete", "更新文件尚未下载完成")
    }
    val file = downloadedFile()
    if (file == null || !file.exists()) return failure("file-missing", "找不到已下载的 APK")
    val expectedSha256 = preferences.getString(PREF_EXPECTED_SHA256, "") ?: ""
    val actualSha256 = sha256(file)
    if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
      return failure("checksum-mismatch", "APK 校验和不匹配，已阻止安装")
    }
    val archiveInfo = archivePackageInfo(file)
      ?: return failure("invalid-apk", "下载文件不是有效的 Android APK")
    if (archiveInfo.packageName != context.packageName) {
      return failure("package-mismatch", "APK 包名与当前 IdeaPocket 不一致")
    }
    val currentInfo = packageInfo(context.packageName)
    val archiveVersionCode = versionCode(archiveInfo)
    val currentVersionCode = versionCode(currentInfo)
    val expectedVersionCode = preferences.getLong(PREF_EXPECTED_VERSION_CODE, -1L)
    if (archiveVersionCode != expectedVersionCode || archiveVersionCode <= currentVersionCode) {
      return failure("version-mismatch", "APK 版本号无效或不高于当前版本")
    }
    if (signerDigests(archiveInfo) != signerDigests(currentInfo)) {
      return failure("signature-mismatch", "APK 签名与当前应用不一致，已阻止安装")
    }
    return mapOf(
      "ok" to true,
      "status" to "verified",
      "sha256" to actualSha256,
      "packageName" to archiveInfo.packageName,
      "versionName" to archiveInfo.versionName,
      "versionCode" to archiveVersionCode
    )
  }

  private fun requestInstall(): Map<String, Any?> {
    val verification = verifyDownloadedApk()
    if (verification["ok"] != true) return verification
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      !context.packageManager.canRequestPackageInstalls()
    ) {
      val settingsIntent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(settingsIntent)
      return mapOf("ok" to true, "status" to "permission-required")
    }

    val downloadId = preferences.getLong(PREF_DOWNLOAD_ID, -1L)
    val contentUri = downloadManager.getUriForDownloadedFile(downloadId)
      ?: return failure("content-uri-missing", "系统无法授权读取已下载的 APK")
    val installIntent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(contentUri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(installIntent)
    return mapOf("ok" to true, "status" to "installer-opened")
  }

  private fun failure(code: String, message: String) = mapOf(
    "ok" to false,
    "status" to "failed",
    "code" to code,
    "message" to message
  )

  private fun versionCode(info: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else {
      @Suppress("DEPRECATION")
      info.versionCode.toLong()
    }

  @Suppress("DEPRECATION")
  private fun signerDigests(info: PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      info.signingInfo?.apkContentsSigners ?: emptyArray()
    } else {
      info.signatures ?: emptyArray()
    }
    return signatures.map { signature ->
      MessageDigest.getInstance("SHA-256")
        .digest(signature.toByteArray())
        .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }.toSet()
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
  }
}

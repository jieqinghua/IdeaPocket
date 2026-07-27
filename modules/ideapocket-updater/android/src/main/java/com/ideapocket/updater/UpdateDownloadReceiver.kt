package com.ideapocket.updater

import android.Manifest
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

private const val PREFS_NAME = "ideapocket_updater"
private const val PREF_DOWNLOAD_ID = "download_id"
private const val CHANNEL_ID = "ideapocket_updates"
private const val NOTIFICATION_ID = 7047

class UpdateDownloadReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
    val completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
    val expectedId = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getLong(PREF_DOWNLOAD_ID, -1L)
    if (completedId <= 0L || completedId != expectedId) return

    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "应用更新",
          NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
          description = "IdeaPocket 更新下载完成提醒"
        }
      )
    }

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra("ideapocket_update_download_complete", true)
    } ?: return
    val pendingIntent = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("IdeaPocket 更新已下载")
      .setContentText("点击返回应用，校验数据并安装")
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }
}

import { Platform } from 'react-native';
import IdeaPocketUpdater from '../modules/ideapocket-updater';

export const nativeUpdaterAvailable =
  Platform.OS === 'android' && Boolean(IdeaPocketUpdater);

const requireUpdater = () => {
  if (!nativeUpdaterAvailable) {
    throw new Error('当前安装包不包含 Android 更新模块，请先安装 0.5.0 或更高版本');
  }
  return IdeaPocketUpdater;
};

export const getCurrentBuildInfo = () => requireUpdater().getCurrentBuildInfoAsync();
export const getNativeDownloadState = () => requireUpdater().getDownloadStateAsync();
export const cancelNativeDownload = () => requireUpdater().cancelDownloadAsync();
export const verifyNativeDownload = () => requireUpdater().verifyDownloadedApkAsync();
export const requestNativeInstall = () => requireUpdater().requestInstallAsync();

export async function requestUpdateNotificationPermission() {
  const updater = requireUpdater();
  const current = await updater.getNotificationPermissionsAsync();
  if (current?.granted) return current;
  return updater.requestNotificationPermissionsAsync();
}

export const enqueueNativeDownload = (manifest) =>
  requireUpdater().enqueueDownloadAsync(
    manifest.apkUrl,
    manifest.fileName,
    manifest.sha256,
    manifest.versionCode
  );

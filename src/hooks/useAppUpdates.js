import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { fetchLatestNativeUpdate, isNewerNativeBuild } from '../lib/updateManifest';
import {
  cancelNativeDownload,
  enqueueNativeDownload,
  getCurrentBuildInfo,
  getNativeDownloadState,
  nativeUpdaterAvailable,
  requestNativeInstall,
  requestUpdateNotificationPermission,
  verifyNativeDownload,
} from '../nativeUpdater';
import {
  classifyNativeDownload,
  describeNativeDownload,
  DOWNLOAD_STALL_MS,
  RELEASES_PAGE_URL,
} from '../updateDownload';

const FOREGROUND_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const initialState = {
  phase: 'idle',
  progress: 0,
  bytesDownloaded: 0,
  totalBytes: 0,
  stalled: false,
  error: '',
  nativeManifest: null,
};

const hotUpdatesEnabled = () => !__DEV__ && Updates.isEnabled;

export function useAppUpdates(store) {
  const { prepareForUpdate, ready } = store;
  const [state, setState] = useState(initialState);
  const phaseRef = useRef(state.phase);
  const mountedRef = useRef(true);
  const checkingRef = useRef(false);
  const lastForegroundCheckRef = useRef(0);
  const completionAlertRef = useRef('');
  const manifestRef = useRef(state.nativeManifest);
  const currentVersionCodeRef = useRef(0);
  const pollStartedAtRef = useRef(0);
  const progressMarkRef = useRef({ bytes: 0, at: 0 });
  const lastDownloadRef = useRef(null);
  phaseRef.current = state.phase;
  manifestRef.current = state.nativeManifest;

  const patchState = useCallback((patch) => {
    if (!mountedRef.current) return;
    // 同步记下阶段：开始下载后紧接着的状态查询不能等到重新渲染才知道“正在下载”。
    if (patch.phase) phaseRef.current = patch.phase;
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const prepareForRestartOrInstall = useCallback(async () => {
    patchState({ phase: 'preparing', error: '' });
    const backup = await prepareForUpdate();
    return backup;
  }, [patchState, prepareForUpdate]);

  const installDownloadedUpdate = useCallback(async () => {
    try {
      await prepareForRestartOrInstall();
      const verification = await verifyNativeDownload();
      if (!verification?.ok) throw new Error(verification?.message || 'APK 校验失败');
      const result = await requestNativeInstall();
      if (!result?.ok) throw new Error(result?.message || '无法启动系统安装器');
      if (result.status === 'permission-required') {
        patchState({ phase: 'native-ready' });
        Alert.alert(
          '需要系统授权',
          '请开启“允许来自此来源的应用”，返回 IdeaPocket 后再次点击“检查更新”并立即安装。'
        );
        return;
      }
      patchState({ phase: 'installer-opened' });
    } catch (error) {
      const message = error?.message || '安装更新失败';
      patchState({ phase: 'failed', error: message });
      Alert.alert('无法安装更新', message);
    }
  }, [patchState, prepareForRestartOrInstall]);

  const offerDownloadedUpdate = useCallback((downloadState) => {
    const key = `${downloadState?.downloadId || ''}:${downloadState?.expectedVersionCode || ''}`;
    patchState({ phase: 'native-ready', progress: 100, stalled: false, error: '' });
    if (!key || completionAlertRef.current === key) return;
    completionAlertRef.current = key;
    Alert.alert(
      '更新已下载',
      '安装前会先等待笔记和主题保存完成，并创建一份本地安全备份。',
      [
        { text: '稍后', style: 'cancel' },
        { text: '立即安装', onPress: installDownloadedUpdate },
      ]
    );
  }, [installDownloadedUpdate, patchState]);

  const openDownloadInBrowser = useCallback(() => {
    // 系统下载器不可靠时的兜底：用浏览器下载同一个 APK，手动覆盖安装后旧下载记录会自动清理。
    Linking.openURL(manifestRef.current?.apkUrl || RELEASES_PAGE_URL).catch((error) => {
      Alert.alert('无法打开浏览器', error?.message || RELEASES_PAGE_URL);
    });
  }, []);

  const cancelDownload = useCallback(async () => {
    patchState({ ...initialState });
    try {
      await cancelNativeDownload();
    } catch (error) {
      console.warn('cancel update download failed', error);
    }
  }, [patchState]);

  const refreshDownloadState = useCallback(async () => {
    if (!nativeUpdaterAvailable) return null;
    if (pollStartedAtRef.current) {
      // 上一次原生查询还没返回；若长期不返回，同样标记为无进展，让用户能取消或改用浏览器。
      if (Date.now() - pollStartedAtRef.current > DOWNLOAD_STALL_MS) patchState({ stalled: true });
      return null;
    }
    pollStartedAtRef.current = Date.now();
    try {
      const download = await getNativeDownloadState();
      lastDownloadRef.current = download;
      if (!currentVersionCodeRef.current) {
        const build = await getCurrentBuildInfo().catch(() => null);
        currentVersionCodeRef.current = Number(build?.versionCode) || 0;
      }
      const kind = classifyNativeDownload(download, currentVersionCodeRef.current);
      const wasDownloading = phaseRef.current === 'downloading';
      if (kind === 'active') {
        const bytes = Number(download.bytesDownloaded) || 0;
        const now = Date.now();
        if (!progressMarkRef.current.at || bytes !== progressMarkRef.current.bytes) {
          progressMarkRef.current = { bytes, at: now };
        }
        patchState({
          phase: 'downloading',
          progress: Number(download.progress) || 0,
          bytesDownloaded: bytes,
          totalBytes: Number(download.totalBytes) || 0,
          stalled: now - progressMarkRef.current.at > DOWNLOAD_STALL_MS,
          error: '',
        });
      } else if (kind === 'ready') {
        offerDownloadedUpdate(download);
      } else if (kind === 'failed') {
        patchState({
          phase: 'failed',
          stalled: false,
          error: `系统下载失败（错误码 ${download.reason || '未知'}）`,
        });
      } else if (kind === 'obsolete' || kind === 'lost' || (kind === 'none' && wasDownloading)) {
        await cancelNativeDownload().catch(() => {});
        // 保留清单，浏览器兜底仍能直接下载同一个 APK。
        if (wasDownloading) patchState({ ...initialState, nativeManifest: manifestRef.current });
        if (kind !== 'obsolete' && wasDownloading) {
          Alert.alert(
            '下载任务丢失',
            `系统下载管理器没有返回这次下载的结果。\n${describeNativeDownload(download)}\n\n可以重新检查更新，或改用浏览器下载安装包后手动安装。`,
            [
              { text: '稍后', style: 'cancel' },
              { text: '用浏览器下载', onPress: openDownloadInBrowser },
            ]
          );
        }
      }
      return { ...download, kind };
    } catch (error) {
      patchState({ phase: 'failed', stalled: false, error: error?.message || '读取下载状态失败' });
      return null;
    } finally {
      pollStartedAtRef.current = 0;
    }
  }, [offerDownloadedUpdate, openDownloadInBrowser, patchState]);

  const showDownloadOptions = useCallback(() => {
    const download = lastDownloadRef.current;
    Alert.alert(
      state.stalled ? '下载没有进展' : '正在下载更新',
      `${describeNativeDownload(download)}\n\n可以继续等待；若系统下载长时间不动，可取消后重试，或用浏览器下载安装包手动安装。`,
      [
        { text: '取消下载', style: 'destructive', onPress: cancelDownload },
        { text: '用浏览器下载', onPress: openDownloadInBrowser },
        { text: '继续等待', style: 'cancel' },
      ]
    );
  }, [cancelDownload, openDownloadInBrowser, state.stalled]);

  const beginNativeDownload = useCallback(async (manifest) => {
    try {
      progressMarkRef.current = { bytes: 0, at: Date.now() };
      patchState({
        ...initialState,
        phase: 'downloading',
        nativeManifest: manifest,
      });
      try {
        await requestUpdateNotificationPermission();
      } catch (permissionError) {
        console.warn('update notification permission unavailable', permissionError);
      }
      await enqueueNativeDownload(manifest);
      await refreshDownloadState();
    } catch (error) {
      const message = error?.message || '无法开始下载更新';
      patchState({ phase: 'failed', error: message });
      Alert.alert('下载更新失败', message);
    }
  }, [patchState, refreshDownloadState]);

  const offerNativeUpdate = useCallback((manifest) => {
    patchState({ phase: 'native-available', nativeManifest: manifest, error: '' });
    const notes = manifest.releaseNotes || '包含需要重新安装 APK 的原生能力更新。';
    Alert.alert(
      `发现 IdeaPocket ${manifest.versionName}`,
      notes,
      [
        { text: '稍后', style: 'cancel' },
        { text: '立即更新', onPress: () => beginNativeDownload(manifest) },
      ]
    );
  }, [beginNativeDownload, patchState]);

  const applyHotUpdate = useCallback(async (alreadyDownloaded = false) => {
    try {
      await prepareForRestartOrInstall();
      if (!alreadyDownloaded) await Updates.fetchUpdateAsync();
      patchState({ phase: 'restarting' });
      await Updates.reloadAsync();
    } catch (error) {
      const message = error?.message || '热更新失败';
      patchState({ phase: 'failed', error: message });
      Alert.alert('无法应用热更新', message);
    }
  }, [patchState, prepareForRestartOrInstall]);

  const offerHotUpdate = useCallback((alreadyDownloaded = false) => {
    patchState({ phase: 'hot-ready', error: '' });
    Alert.alert(
      '发现热更新',
      '更新不需要重新安装 APK。应用更新前会保存笔记并创建安全备份，然后重新启动。',
      [
        { text: '稍后', style: 'cancel' },
        { text: '立即更新', onPress: () => applyHotUpdate(alreadyDownloaded) },
      ]
    );
  }, [applyHotUpdate, patchState]);

  const checkForUpdates = useCallback(async () => {
    if (checkingRef.current) return;
    if (state.phase === 'downloading') {
      showDownloadOptions();
      return;
    }
    if (state.phase === 'native-ready') {
      completionAlertRef.current = '';
      offerDownloadedUpdate(await getNativeDownloadState());
      return;
    }
    if (state.phase === 'hot-ready') {
      offerHotUpdate(true);
      return;
    }
    checkingRef.current = true;
    patchState({ phase: 'checking', error: '' });
    let nativeCheckError = null;
    try {
      if (Platform.OS === 'android' && nativeUpdaterAvailable) {
        const persistedDownload = await refreshDownloadState();
        if (persistedDownload?.kind === 'ready' || persistedDownload?.kind === 'active') {
          return;
        }
        try {
          const [currentBuild, manifest] = await Promise.all([
            getCurrentBuildInfo(),
            fetchLatestNativeUpdate(),
          ]);
          if (isNewerNativeBuild(manifest, currentBuild)) {
            offerNativeUpdate(manifest);
            return;
          }
        } catch (error) {
          nativeCheckError = error;
        }
      }

      if (hotUpdatesEnabled()) {
        const hotUpdate = await Updates.checkForUpdateAsync();
        if (hotUpdate.isAvailable) {
          offerHotUpdate(false);
          return;
        }
      }

      if (nativeCheckError) throw nativeCheckError;
      patchState({ phase: 'idle', progress: 0, error: '' });
      Alert.alert('已是最新版本', '当前没有可用更新。');
    } catch (error) {
      const message = error?.message || '检查更新失败';
      patchState({ phase: 'failed', error: message });
      Alert.alert('检查更新失败', message);
    } finally {
      checkingRef.current = false;
    }
  }, [
    offerDownloadedUpdate,
    offerHotUpdate,
    offerNativeUpdate,
    patchState,
    refreshDownloadState,
    showDownloadOptions,
    state.phase,
  ]);

  const silentlyFetchHotUpdate = useCallback(async () => {
    if (!hotUpdatesEnabled() || checkingRef.current) return;
    const now = Date.now();
    if (now - lastForegroundCheckRef.current < FOREGROUND_CHECK_INTERVAL_MS) return;
    lastForegroundCheckRef.current = now;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;
      await Updates.fetchUpdateAsync();
      patchState({ phase: 'hot-ready', error: '' });
    } catch (error) {
      console.warn('silent EAS update check failed', error);
    }
  }, [patchState]);

  useEffect(() => {
    mountedRef.current = true;
    if (!ready) {
      return () => {
        mountedRef.current = false;
      };
    }
    refreshDownloadState();
    silentlyFetchHotUpdate();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      refreshDownloadState();
      silentlyFetchHotUpdate();
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [ready, refreshDownloadState, silentlyFetchHotUpdate]);

  useEffect(() => {
    if (state.phase !== 'downloading') return undefined;
    const timer = setInterval(refreshDownloadState, 1000);
    return () => clearInterval(timer);
  }, [refreshDownloadState, state.phase]);

  return {
    state,
    checkForUpdates,
  };
}

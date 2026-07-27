import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { fetchLatestNativeUpdate, isNewerNativeBuild } from '../lib/updateManifest';
import {
  enqueueNativeDownload,
  getCurrentBuildInfo,
  getNativeDownloadState,
  nativeUpdaterAvailable,
  requestNativeInstall,
  requestUpdateNotificationPermission,
  verifyNativeDownload,
} from '../nativeUpdater';

const FOREGROUND_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const ACTIVE_DOWNLOAD_STATES = new Set(['pending', 'running', 'paused']);

const initialState = {
  phase: 'idle',
  progress: 0,
  error: '',
  nativeManifest: null,
};

const hotUpdatesEnabled = () => !__DEV__ && Updates.isEnabled;

export function useAppUpdates(store) {
  const { prepareForUpdate, ready } = store;
  const [state, setState] = useState(initialState);
  const mountedRef = useRef(true);
  const checkingRef = useRef(false);
  const lastForegroundCheckRef = useRef(0);
  const completionAlertRef = useRef('');

  const patchState = useCallback((patch) => {
    if (!mountedRef.current) return;
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
    patchState({ phase: 'native-ready', progress: 100, error: '' });
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

  const refreshDownloadState = useCallback(async () => {
    if (!nativeUpdaterAvailable) return null;
    try {
      const download = await getNativeDownloadState();
      if (ACTIVE_DOWNLOAD_STATES.has(download?.status)) {
        patchState({
          phase: 'downloading',
          progress: Number(download.progress) || 0,
          error: '',
        });
      } else if (download?.status === 'successful') {
        offerDownloadedUpdate(download);
      } else if (download?.status === 'failed') {
        patchState({
          phase: 'failed',
          error: `系统下载失败（错误码 ${download.reason || '未知'}）`,
        });
      }
      return download;
    } catch (error) {
      patchState({ phase: 'failed', error: error?.message || '读取下载状态失败' });
      return null;
    }
  }, [offerDownloadedUpdate, patchState]);

  const beginNativeDownload = useCallback(async (manifest) => {
    try {
      patchState({
        phase: 'downloading',
        progress: 0,
        error: '',
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
        if (persistedDownload?.status === 'successful' || ACTIVE_DOWNLOAD_STATES.has(persistedDownload?.status)) {
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

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, Linking, Platform } from 'react-native';
import { useAppUpdates } from '../hooks/useAppUpdates';
import * as nativeUpdater from '../nativeUpdater';
import { fetchLatestNativeUpdate } from '../lib/updateManifest';

jest.mock('expo-updates', () => ({ isEnabled: false }));
jest.mock('../nativeUpdater', () => ({
  nativeUpdaterAvailable: true,
  cancelNativeDownload: jest.fn(),
  enqueueNativeDownload: jest.fn(),
  getCurrentBuildInfo: jest.fn(),
  getNativeDownloadState: jest.fn(),
  requestNativeInstall: jest.fn(),
  requestUpdateNotificationPermission: jest.fn(),
  verifyNativeDownload: jest.fn(),
}));
jest.mock('../lib/updateManifest', () => ({
  fetchLatestNativeUpdate: jest.fn(),
  isNewerNativeBuild: (manifest, build) => manifest.versionCode > build.versionCode,
}));

const manifest = {
  versionName: '0.5.1',
  versionCode: 10,
  apkUrl: 'https://github.com/jieqinghua/IdeaPocket/releases/download/v0.5.1/IdeaPocket-v0.5.1.apk',
  fileName: 'IdeaPocket-v0.5.1.apk',
  sha256: 'a'.repeat(64),
};
const store = { ready: true, prepareForUpdate: jest.fn() };
Platform.OS = 'android';

let tree;
let hook;
function Probe() {
  hook = useAppUpdates(store);
  return null;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

// 走一遍“检查更新 → 立即更新”，进入下载中。
async function startDownload() {
  // 挂载和检查更新各读取一次下载状态，此时还没有下载任务。
  nativeUpdater.getNativeDownloadState
    .mockResolvedValueOnce({ status: 'idle' })
    .mockResolvedValueOnce({ status: 'idle' });
  await act(async () => { tree = renderer.create(<Probe />); });
  await act(async () => { await hook.checkForUpdates(); });
  const [, , buttons] = Alert.alert.mock.calls.at(-1);
  await act(async () => { await buttons.find((button) => button.text === '立即更新').onPress(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  nativeUpdater.getCurrentBuildInfo.mockResolvedValue({ versionCode: 6 });
  nativeUpdater.cancelNativeDownload.mockResolvedValue({ status: 'idle' });
  nativeUpdater.enqueueNativeDownload.mockResolvedValue({ status: 'pending' });
  nativeUpdater.requestUpdateNotificationPermission.mockResolvedValue({ granted: true });
  fetchLatestNativeUpdate.mockResolvedValue(manifest);
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('系统丢失下载任务时退出下载中，并提供浏览器下载', async () => {
  nativeUpdater.getNativeDownloadState.mockResolvedValue({ status: 'missing', expectedVersionCode: 10 });
  await startDownload();

  expect(hook.state.phase).toBe('idle');
  expect(nativeUpdater.cancelNativeDownload).toHaveBeenCalled();
  const [title, , buttons] = Alert.alert.mock.calls.at(-1);
  expect(title).toBe('下载任务丢失');
  buttons.find((button) => button.text === '用浏览器下载').onPress();
  expect(Linking.openURL).toHaveBeenCalledWith(manifest.apkUrl);
});

test('下载长时间没有进展时标记为无进展，点按可取消', async () => {
  nativeUpdater.getNativeDownloadState.mockResolvedValue({
    status: 'paused', progress: 0, bytesDownloaded: 0, totalBytes: -1, expectedVersionCode: 10,
  });
  await startDownload();
  expect(hook.state).toMatchObject({ phase: 'downloading', stalled: false });

  await act(async () => { jest.advanceTimersByTime(61_000); });
  await flush();
  expect(hook.state.stalled).toBe(true);

  await act(async () => { await hook.checkForUpdates(); });
  const [title, , buttons] = Alert.alert.mock.calls.at(-1);
  expect(title).toBe('下载没有进展');
  await act(async () => { await buttons.find((button) => button.text === '取消下载').onPress(); });
  expect(hook.state.phase).toBe('idle');
  expect(nativeUpdater.cancelNativeDownload).toHaveBeenCalled();
});

test('原生查询一直不返回时也会标记为无进展', async () => {
  // 挂载和检查更新各读取一次下载状态，此时还没有下载任务。
  nativeUpdater.getNativeDownloadState
    .mockResolvedValueOnce({ status: 'idle' })
    .mockResolvedValueOnce({ status: 'idle' });
  await act(async () => { tree = renderer.create(<Probe />); });
  await act(async () => { await hook.checkForUpdates(); });
  const [, , buttons] = Alert.alert.mock.calls.at(-1);
  nativeUpdater.getNativeDownloadState.mockReturnValue(new Promise(() => {}));
  await act(async () => { buttons.find((button) => button.text === '立即更新').onPress(); });
  await flush();
  expect(hook.state.phase).toBe('downloading');

  await act(async () => { jest.advanceTimersByTime(62_000); });
  await flush();
  expect(hook.state.stalled).toBe(true);
});

test('目标版本已安装后，旧的下载记录被清理而不是弹出安装', async () => {
  nativeUpdater.getCurrentBuildInfo.mockResolvedValue({ versionCode: 10 });
  nativeUpdater.getNativeDownloadState.mockResolvedValue({ status: 'successful', expectedVersionCode: 10 });
  await act(async () => { tree = renderer.create(<Probe />); });
  await flush();

  expect(nativeUpdater.cancelNativeDownload).toHaveBeenCalled();
  expect(hook.state.phase).toBe('idle');
  expect(Alert.alert).not.toHaveBeenCalled();
});

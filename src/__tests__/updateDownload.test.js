import {
  classifyNativeDownload,
  describeNativeDownload,
  formatDownloadProgress,
} from '../updateDownload';

test('下载状态归类覆盖系统返回的所有情况', () => {
  expect(classifyNativeDownload({ status: 'idle' }, 6)).toBe('none');
  expect(classifyNativeDownload(null, 6)).toBe('none');
  expect(classifyNativeDownload({ status: 'running', expectedVersionCode: 10 }, 6)).toBe('active');
  expect(classifyNativeDownload({ status: 'paused', expectedVersionCode: 10 }, 6)).toBe('active');
  expect(classifyNativeDownload({ status: 'successful', expectedVersionCode: 10 }, 6)).toBe('ready');
  expect(classifyNativeDownload({ status: 'failed', expectedVersionCode: 10 }, 6)).toBe('failed');
  expect(classifyNativeDownload({ status: 'missing', expectedVersionCode: 10 }, 6)).toBe('lost');
  expect(classifyNativeDownload({ status: 'unknown' }, 6)).toBe('lost');
});

test('目标版本已经安装后，旧下载记录视为过期', () => {
  expect(classifyNativeDownload({ status: 'successful', expectedVersionCode: 10 }, 10)).toBe('obsolete');
  expect(classifyNativeDownload({ status: 'paused', expectedVersionCode: 10 }, 11)).toBe('obsolete');
  // 读不到当前版本时不做过期判断，交给后续校验。
  expect(classifyNativeDownload({ status: 'running', expectedVersionCode: 10 }, undefined)).toBe('active');
});

test('缺少总大小时显示已下载体积而不是 0%', () => {
  expect(formatDownloadProgress({ progress: 42 })).toBe('42%');
  expect(formatDownloadProgress({ progress: 0, bytesDownloaded: 5 * 1024 * 1024, totalBytes: -1 })).toBe('5.0MB');
  expect(formatDownloadProgress({ progress: 0, bytesDownloaded: 0, totalBytes: -1 })).toBe('0%');
});

test('下载诊断信息包含状态、体积和系统原因码', () => {
  const text = describeNativeDownload({
    status: 'paused',
    bytesDownloaded: 1024 * 1024,
    totalBytes: 70 * 1024 * 1024,
    reason: 1,
  });
  expect(text).toContain('状态：paused');
  expect(text).toContain('1.0MB / 70.0MB');
  expect(text).toContain('系统原因码：1');
});

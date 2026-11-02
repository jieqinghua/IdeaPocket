// 系统 DownloadManager 返回的状态并不总是规范：部分 ROM 会丢失任务、长期停在 pending/paused，
// 或拿不到总大小。这里把原始状态归类成界面能处理的几种结果，任何一种都必须有出口。
export const ACTIVE_DOWNLOAD_STATES = new Set(['pending', 'running', 'paused']);
export const DOWNLOAD_STALL_MS = 60 * 1000;
export const RELEASES_PAGE_URL = 'https://github.com/jieqinghua/IdeaPocket/releases/latest';

export function classifyNativeDownload(download, currentVersionCode) {
  const status = download?.status;
  if (!status || status === 'idle') return 'none';
  const expected = Number(download?.expectedVersionCode);
  const current = Number(currentVersionCode);
  // 已经装上目标版本（例如改用浏览器下载安装）后，旧下载记录不能再弹“更新已下载”或卡住菜单。
  if (expected > 0 && current > 0 && expected <= current) return 'obsolete';
  if (status === 'successful') return 'ready';
  if (status === 'failed') return 'failed';
  if (ACTIVE_DOWNLOAD_STATES.has(status)) return 'active';
  return 'lost';
}

const formatMegabytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

export function formatDownloadProgress({ progress, bytesDownloaded, totalBytes } = {}) {
  const downloaded = Number(bytesDownloaded) || 0;
  const total = Number(totalBytes) || 0;
  // 服务器未返回总大小时百分比恒为 0，改为显示已下载体积，避免看起来像卡住。
  if (total <= 0 && downloaded > 0) return formatMegabytes(downloaded);
  return `${Math.round(Number(progress) || 0)}%`;
}

export function describeNativeDownload(download) {
  if (!download) return '系统没有返回下载状态。';
  const downloaded = Number(download.bytesDownloaded) || 0;
  const total = Number(download.totalBytes) || 0;
  return [
    `状态：${download.status || '未知'}`,
    `已下载：${formatMegabytes(downloaded)}${total > 0 ? ` / ${formatMegabytes(total)}` : ''}`,
    download.reason ? `系统原因码：${download.reason}` : '',
  ].filter(Boolean).join('\n');
}

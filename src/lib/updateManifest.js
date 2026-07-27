export const LATEST_RELEASE_URL =
  'https://api.github.com/repos/jieqinghua/IdeaPocket/releases/latest';

const HTTPS_PROTOCOL = 'https:';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const APK_FILE_PATTERN = /^[A-Za-z0-9._-]+\.apk$/;

const positiveInteger = (value, field) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`更新清单中的 ${field} 必须是正整数`);
  }
  return parsed;
};

const httpsUrl = (value, field) => {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    throw new Error(`更新清单中的 ${field} 不是有效网址`);
  }
  if (parsed.protocol !== HTTPS_PROTOCOL) throw new Error(`${field} 必须使用 HTTPS`);
  return parsed.toString();
};

export function parseUpdateManifest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('更新清单格式无效');
  }
  const versionName = String(payload.versionName || '').trim();
  if (!versionName) throw new Error('更新清单缺少 versionName');
  const versionCode = positiveInteger(payload.versionCode, 'versionCode');
  const runtimeVersion = String(payload.runtimeVersion || versionName).trim();
  const apkUrl = httpsUrl(payload.apkUrl, 'apkUrl');
  const fileName = decodeURIComponent(new URL(apkUrl).pathname.split('/').pop() || '');
  if (!APK_FILE_PATTERN.test(fileName)) throw new Error('APK 文件名无效');
  const sha256 = String(payload.sha256 || '').trim().toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) throw new Error('更新清单中的 SHA-256 无效');
  return {
    schemaVersion: Number(payload.schemaVersion) || 1,
    versionName,
    versionCode,
    runtimeVersion,
    apkUrl,
    fileName,
    sha256,
    releaseNotes: String(payload.releaseNotes || '').trim(),
    publishedAt: String(payload.publishedAt || '').trim(),
  };
}

export function isNewerNativeBuild(manifest, currentBuild) {
  return Number(manifest?.versionCode) > Number(currentBuild?.versionCode || 0);
}

const fetchJson = async (url, fetchImpl, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`更新服务器返回 ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

export async function fetchLatestNativeUpdate(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Number(options.timeoutMs) || 15_000;
  const release = await fetchJson(options.releaseUrl || LATEST_RELEASE_URL, fetchImpl, timeoutMs);
  const manifestAsset = (Array.isArray(release?.assets) ? release.assets : [])
    .find((asset) => asset?.name === 'update.json');
  if (!manifestAsset?.browser_download_url) {
    throw new Error('最新 GitHub Release 中没有 update.json');
  }
  const manifestPayload = await fetchJson(manifestAsset.browser_download_url, fetchImpl, timeoutMs);
  return parseUpdateManifest(manifestPayload);
}

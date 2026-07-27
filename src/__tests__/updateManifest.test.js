import {
  fetchLatestNativeUpdate,
  isNewerNativeBuild,
  parseUpdateManifest,
} from '../lib/updateManifest';

const validManifest = {
  schemaVersion: 1,
  versionName: '0.5.1',
  versionCode: 4,
  runtimeVersion: '0.5.1',
  apkUrl: 'https://github.com/jieqinghua/IdeaPocket/releases/download/v0.5.1/IdeaPocket-v0.5.1.apk',
  sha256: 'a'.repeat(64),
  releaseNotes: '修复更新流程',
  publishedAt: '2026-07-27T00:00:00.000Z',
};

test('解析并规范化合法更新清单', () => {
  expect(parseUpdateManifest(validManifest)).toMatchObject({
    versionName: '0.5.1',
    versionCode: 4,
    fileName: 'IdeaPocket-v0.5.1.apk',
    sha256: 'a'.repeat(64),
  });
});

test.each([
  [{ ...validManifest, apkUrl: 'http://example.com/update.apk' }, 'HTTPS'],
  [{ ...validManifest, apkUrl: 'https://example.com/update.zip' }, 'APK 文件名'],
  [{ ...validManifest, sha256: 'not-a-hash' }, 'SHA-256'],
  [{ ...validManifest, versionCode: 0 }, '正整数'],
])('拒绝不安全或不完整的更新清单', (manifest, message) => {
  expect(() => parseUpdateManifest(manifest)).toThrow(message);
});

test('只把更高 versionCode 识别为原生更新', () => {
  expect(isNewerNativeBuild(validManifest, { versionCode: 3 })).toBe(true);
  expect(isNewerNativeBuild(validManifest, { versionCode: 4 })).toBe(false);
  expect(isNewerNativeBuild(validManifest, { versionCode: 5 })).toBe(false);
});

test('从最新 GitHub Release 的 update.json 读取清单', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: [{
          name: 'update.json',
          browser_download_url: 'https://github.com/update.json',
        }],
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => validManifest });

  await expect(fetchLatestNativeUpdate({ fetchImpl })).resolves.toMatchObject({
    versionCode: 4,
  });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

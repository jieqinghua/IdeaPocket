import { fetchWithTimeout } from '../lib/http';

test('响应正文悬停仍受整轮超时保护', async () => {
  jest.useFakeTimers();
  const fetchImpl = jest.fn(async () => ({ json: () => new Promise(() => {}) }));
  const request = fetchWithTimeout('https://example.test', {}, 500, fetchImpl, (response) => response.json());
  const assertion = expect(request).rejects.toMatchObject({ code: 'timeout' });
  await Promise.resolve(); await Promise.resolve(); jest.advanceTimersByTime(500);
  await assertion;
  jest.useRealTimers();
});

test('请求不响应 Abort 时仍能取消，预先取消不会发送请求', async () => {
  const controller = new AbortController(); const fetchImpl = jest.fn(() => new Promise(() => {}));
  const pending = fetchWithTimeout('https://example.test', { signal: controller.signal }, 5000, fetchImpl);
  const assertion = expect(pending).rejects.toMatchObject({ code: 'aborted' });
  controller.abort(); await assertion;
  fetchImpl.mockClear();
  await expect(fetchWithTimeout('https://example.test', { signal: controller.signal }, 5000, fetchImpl)).rejects.toMatchObject({ code: 'aborted' });
  expect(fetchImpl).not.toHaveBeenCalled();
});

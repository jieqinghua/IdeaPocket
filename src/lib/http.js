export const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch
) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const cancelFromOutside = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener?.('abort', cancelFromOutside, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      const abortedFromOutside = externalSignal?.aborted;
      const requestError = new Error(
        abortedFromOutside ? '请求已取消' : '请求超时，请检查网络后重试'
      );
      requestError.code = abortedFromOutside ? 'aborted' : 'timeout';
      throw requestError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.('abort', cancelFromOutside);
  }
}

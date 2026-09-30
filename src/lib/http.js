export const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  consume = (response) => response
) {
  if (options.signal?.aborted) { const error = new Error("请求已取消"); error.code = "aborted"; throw error; }
  const controller = new AbortController();
  const externalSignal = options.signal;
  const cancelFromOutside = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener?.('abort', cancelFromOutside, { once: true });
  let rejectAbort;
  const abortPromise = new Promise((_, reject) => { rejectAbort = reject; });
  const rejectCancelled = () => {
    const requestError = new Error(externalSignal?.aborted ? '请求已取消' : '请求超时，请检查网络后重试');
    requestError.code = externalSignal?.aborted ? 'aborted' : 'timeout';
    rejectAbort(requestError);
  };
  controller.signal.addEventListener('abort', rejectCancelled, { once: true });
  if (controller.signal.aborted) rejectCancelled();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted) { const error = new Error('请求已取消'); error.code = 'aborted'; throw error; }
        return fetchImpl(url, { ...options, signal: controller.signal });
      }).then(consume),
      abortPromise,
    ]);
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
    controller.signal.removeEventListener('abort', rejectCancelled);
    externalSignal?.removeEventListener?.('abort', cancelFromOutside);
  }
}

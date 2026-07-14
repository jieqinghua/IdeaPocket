import { localTidy, tidyRemote } from '../lib/aiTidy';

test('本地整理去除常见口水词', () => {
  expect(localTidy('嗯 那个那个这是想法。然后呢继续。')).toBe('这是想法。\n继续。');
});

test('本地整理保留明显顺序并转为有序列表', () => {
  expect(localTidy('第一，确定范围。第二，安排访谈。第三，复盘结果。'))
    .toBe('1. 确定范围。\n2. 安排访谈。\n3. 复盘结果。');
});

test('远程整理解析返回文本', async () => {
  let requestBody;
  const result = await tidyRemote('原文', {
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '整理后' } }] }),
      };
    },
  });
  expect(result).toEqual({ text: '整理后', stub: false });
  expect(requestBody.messages[0].content).toContain('有序列表');
  expect(requestBody.messages[0].content).toContain('无序列表');
});

test('远程整理支持主动取消', async () => {
  const controller = new AbortController();
  const fetchImpl = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const pending = tidyRemote('原文', {
    apiKey: 'test-key',
    fetchImpl,
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'aborted' });
});

test('远程整理超时后可恢复', async () => {
  const fetchImpl = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  await expect(
    tidyRemote('原文', { apiKey: 'test-key', fetchImpl, timeoutMs: 1 })
  ).rejects.toMatchObject({ code: 'timeout' });
});

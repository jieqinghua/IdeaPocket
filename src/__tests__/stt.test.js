import {
  TranscriptionError,
  audioUriToDataUrl,
  transcribeDataUrl,
} from '../lib/stt';

const okResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

test('本地 AAC 文件转成 Data URL', async () => {
  const result = await audioUriToDataUrl('file:///recording.aac', () => ({
    base64: async () => 'YWJj',
  }));
  expect(result).toBe('data:audio/aac;base64,YWJj');
});

test('iOS 的 m4a 录音会按 audio/mp4 上传', async () => {
  const result = await audioUriToDataUrl('file:///recording.m4a', () => ({
    base64: async () => 'YWJj',
  }));
  expect(result).toBe('data:audio/mp4;base64,YWJj');
});

test('不支持的录音格式会明确拒绝', async () => {
  await expect(audioUriToDataUrl('file:///recording.xyz')).rejects.toMatchObject({
    code: 'unsupported_audio',
  });
});

test('ASR 使用官方 input_audio 结构并解析文字', async () => {
  const fetchImpl = jest.fn(async () =>
    okResponse({
      choices: [
        { message: { content: '真实转写', annotations: [{ language: 'zh', emotion: 'neutral' }] } },
      ],
    })
  );
  const result = await transcribeDataUrl('data:audio/aac;base64,YWJj', {
    apiKey: 'test-key',
    fetchImpl,
  });
  const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(request.messages[0].content[0]).toEqual({
    type: 'input_audio',
    input_audio: { data: 'data:audio/aac;base64,YWJj' },
  });
  expect(result).toMatchObject({ text: '真实转写', language: 'zh' });
});

test('没有 key 时不返回示例文本', async () => {
  await expect(transcribeDataUrl('data:audio/aac;base64,YWJj', { apiKey: '' })).rejects.toEqual(
    expect.objectContaining({ code: 'missing_key' })
  );
});

test('空识别结果被视为错误', async () => {
  await expect(
    transcribeDataUrl('data:audio/aac;base64,YWJj', {
      apiKey: 'test-key',
      fetchImpl: async () => okResponse({ choices: [{ message: { content: ' ' } }] }),
    })
  ).rejects.toBeInstanceOf(TranscriptionError);
});

test('鉴权失败返回明确错误码', async () => {
  await expect(
    transcribeDataUrl('data:audio/aac;base64,YWJj', {
      apiKey: 'bad-key',
      fetchImpl: async () => ({ ok: false, status: 401 }),
    })
  ).rejects.toMatchObject({ code: 'auth' });
});

test('请求超时会返回可识别错误码', async () => {
  const fetchImpl = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  await expect(
    transcribeDataUrl('data:audio/aac;base64,YWJj', {
      apiKey: 'test-key',
      fetchImpl,
      timeoutMs: 1,
    })
  ).rejects.toMatchObject({ code: 'timeout' });
});

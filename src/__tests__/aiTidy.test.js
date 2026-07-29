import {
  TIDY_STATUS,
  localTidy,
  tidy,
  tidyRemote,
  validateTidyCandidate,
} from '../lib/aiTidy';

const remoteResponse = (payload) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{ message: { content: typeof payload === 'string' ? payload : JSON.stringify(payload) } }],
  }),
});

test('本地整理只去除分句边界的常见口水词', () => {
  expect(localTidy('嗯 那个那个这是想法。然后呢继续。')).toBe('这是想法。\n继续。');
  expect(localTidy('这个方案的问题是这个入口太深。')).toBe('这个方案的问题是这个入口太深。');
  expect(localTidy('他的原话就是说走就走。')).toBe('他的原话就是说走就走。');
});

test('本地整理保留引号内容和强调性重复', () => {
  expect(localTidy('他说“嗯，这个不要删”。')).toBe('他说“嗯，这个不要删”。');
  expect(localTidy('我真的真的不想再加一个提醒。')).toBe('我真的真的不想再加一个提醒。');
});

test('本地整理将显式顺序按实际出现次序转为列表', () => {
  expect(localTidy('第一，确定范围。第二，安排访谈。第三，复盘结果。'))
    .toBe('1. 确定范围。\n2. 安排访谈。\n3. 复盘结果。');
  expect(localTidy('首先，确定范围。最后，复盘结果。'))
    .toBe('1. 确定范围。\n2. 复盘结果。');
  expect(localTidy('主要分三步：第一、确认需求 第二、完成设计 第三、检查结果'))
    .toBe('主要分三步：\n1. 确认需求\n2. 完成设计\n3. 检查结果');
  expect(localTidy('第一、确认需求, 第二、完成设计, 第三、检查结果'))
    .toBe('1. 确认需求,\n2. 完成设计,\n3. 检查结果');
  expect(localTidy('最后再检查一次。')).toBe('最后再检查一次。');
});

test('无 key 的本地路径也返回统一状态并通过安全校验', async () => {
  await expect(tidy('嗯这是想法。')).resolves.toMatchObject({
    text: '这是想法。',
    stub: true,
    status: TIDY_STATUS.CHANGED,
    changes: [],
  });
  await expect(tidy('这个方案已经很清楚。')).resolves.toMatchObject({
    text: '这个方案已经很清楚。',
    stub: true,
    status: TIDY_STATUS.UNCHANGED,
  });
});

test('候选校验允许轻微语病、标点和语序优化', () => {
  expect(validateTidyCandidate(
    '我大概下周三去上海可能住两晚',
    '我大概下周三去上海，可能住两晚。',
    [{ type: 'punctuation', before: '上海可能', after: '上海，可能' }]
  )).toMatchObject({
    status: TIDY_STATUS.CHANGED,
    text: '我大概下周三去上海，可能住两晚。',
  });

  expect(validateTidyCandidate(
    'Vibe coding 到 UI 精修阶段，语言描述效率非常低',
    'Vibe coding 到 UI 精修阶段，语言描述的效率非常低。',
    []
  )).toMatchObject({
    status: TIDY_STATUS.CHANGED,
    text: 'Vibe coding 到 UI 精修阶段，语言描述的效率非常低。',
  });
});

test('候选校验只硬性保护关键事实并拦截明显扩写', () => {
  const source = '周五确认 2.0 版本是不是可能继续用，详情见 https://example.com。';
  [
    '周五确认 3.0 版本是不是可能继续用，详情见 https://example.com。',
    '周五确认 2.0 版本是继续用，详情见 https://example.com。',
    '周五确认 2.0 版本是不是可能继续用，详情见 https://other.example.com。',
  ].forEach((candidate) => {
    expect(validateTidyCandidate(
      source,
      candidate,
      [{ type: 'punctuation', before: source, after: candidate }]
    )).toMatchObject({
      status: TIDY_STATUS.REJECTED,
      text: source,
    });
  });

  expect(validateTidyCandidate(
    '明早十点，南门，带合同。',
    '明早十点在公司南门与客户见面，需要提前联系客户确认会议议程，并准备完整合同和全部项目材料。',
    []
  )).toMatchObject({
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'excessive_expansion',
  });
});

test('远程整理发送忠实润色请求并解析轻度优化候选', async () => {
  let requestBody;
  const payload = {
    revised_text: '我大概下周三去上海，可能住两晚。',
    changes: [{ type: 'punctuation', before: '上海可能', after: '上海，可能' }],
  };
  const result = await tidyRemote('我大概下周三去上海可能住两晚。', {
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return remoteResponse(payload);
    },
  });

  expect(result).toMatchObject({
    text: payload.revised_text,
    stub: false,
    status: TIDY_STATUS.CHANGED,
    changes: payload.changes,
  });
  expect(requestBody).toMatchObject({
    model: 'qwen-flash-2025-07-28',
    temperature: 0,
    seed: 1234,
    enable_thinking: false,
    response_format: { type: 'json_object' },
  });
  expect(requestBody.messages[0].content).toContain('不改变原意');
  expect(requestBody.messages[0].content).toContain('不增加额外信息');
  expect(requestBody.messages[0].content).toContain('第一/第二/第三');
  expect(requestBody.messages[1].content).toContain('<source_text>');
});

test('远程整理在模型漏排版时兜底转换明显顺序结构', async () => {
  const source = '主要分三步：第一、确认需求 第二、完成设计 第三、检查结果';
  const result = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async () => remoteResponse({ revised_text: source, changes: [] }),
  });
  expect(result).toMatchObject({
    text: '主要分三步：\n1. 确认需求\n2. 完成设计\n3. 检查结果',
    status: TIDY_STATUS.CHANGED,
  });
});

test('远程整理把不变文本识别为 unchanged', async () => {
  const source = '我大概下周三去上海，可能住两晚。';
  const result = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async () => remoteResponse({ revised_text: source, changes: [] }),
  });
  expect(result).toEqual({
    text: source,
    stub: false,
    status: TIDY_STATUS.UNCHANGED,
    changes: [],
  });
});

test('远程整理允许省略修改记录，但无效 JSON 或正文缺失时 rejected', async () => {
  const source = '原文';
  const invalidJson = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async () => remoteResponse('不是 JSON'),
  });
  expect(invalidJson).toMatchObject({
    text: source,
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'invalid_json',
  });

  const withoutChanges = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async () => remoteResponse({ revised_text: '原文' }),
  });
  expect(withoutChanges).toEqual({
    text: source,
    stub: false,
    status: TIDY_STATUS.UNCHANGED,
    changes: [],
  });

  const invalidShape = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async () => remoteResponse({ changes: [] }),
  });
  expect(invalidShape).toMatchObject({
    text: source,
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'invalid_json',
  });
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

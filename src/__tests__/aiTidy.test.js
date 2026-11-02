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

const remoteResponseSequence = (...payloads) => {
  let index = 0;
  return async () => {
    const payload = payloads[Math.min(index, payloads.length - 1)];
    index += 1;
    return remoteResponse(payload);
  };
};

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

test('候选校验只判断为空、相同、明显变长和明显变短', () => {
  expect(validateTidyCandidate('原文内容', '')).toMatchObject({
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'empty',
  });
  expect(validateTidyCandidate('原文内容', '原文内容')).toMatchObject({
    status: TIDY_STATUS.UNCHANGED,
  });
  expect(validateTidyCandidate(
    '预算可能是 5 万元。',
    '预算确定是 8 万元。',
    []
  )).toMatchObject({
    status: TIDY_STATUS.CHANGED,
    text: '预算确定是 8 万元。',
  });

  expect(validateTidyCandidate(
    '明早十点，南门，带合同。',
    '明早十点在公司南门与客户见面，需要提前联系客户确认会议议程，并准备完整合同和全部项目材料。',
    []
  )).toMatchObject({
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'excessive_expansion',
  });
  expect(validateTidyCandidate(
    '这是一个需要完整保留全部信息的笔记内容，今天需要完成设计并检查结果。',
    '完成设计。',
    []
  )).toMatchObject({
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'excessive_reduction',
  });
});

test('远程整理发送忠实润色请求并解析轻度优化候选', async () => {
  let requestBody;
  let requestUrl;
  const payload = {
    revised_text: '我大概下周三去上海，可能住两晚。',
    changes: [{ type: 'punctuation', before: '上海可能', after: '上海，可能' }],
  };
  const result = await tidyRemote('我大概下周三去上海可能住两晚。', {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      requestUrl = url;
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
    model: 'deepseek-flash',
    temperature: 0,
    thinking: { type: 'disabled' },
    response_format: { type: 'json_object' },
  });
  expect(requestUrl).toBe('https://api.deepseek.com/chat/completions');
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

test('远程结果明显变长时自动进行一次二次检查', async () => {
  const source = '明早十点，南门，带合同。';
  const firstCandidate =
    '明早十点在公司南门与客户见面，需要提前联系客户确认会议议程，并准备完整合同和全部项目材料。';
  const reviewedCandidate = '明早十点，在南门见，带合同。';
  const requestBodies = [];
  const responses = remoteResponseSequence(
    { revised_text: firstCandidate, changes: [] },
    { revised_text: reviewedCandidate, changes: [] }
  );
  const result = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      requestBodies.push(JSON.parse(options.body));
      return responses();
    },
  });

  expect(result).toMatchObject({
    text: reviewedCandidate,
    status: TIDY_STATUS.CHANGED,
    reviewed: true,
  });
  expect(requestBodies).toHaveLength(2);
  expect(requestBodies[1].messages[1].content).toContain('二次检查');
  expect(requestBodies[1].messages[1].content).toContain('明显变长');
  expect(requestBodies[1].messages[1].content).toContain(firstCandidate);
});

test('二次检查结果仍明显变长时也交给用户确认', async () => {
  const source = '明早十点，南门，带合同。';
  const firstCandidate =
    '明早十点在公司南门与客户见面，需要提前联系客户确认会议议程，并准备完整合同和全部项目材料。';
  const reviewedCandidate =
    '明早十点在南门与客户见面，需要提前确认会议议程，并准备合同和相关项目材料。';
  const result = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: remoteResponseSequence(
      { revised_text: firstCandidate, changes: [] },
      { revised_text: reviewedCandidate, changes: [] }
    ),
  });
  expect(result).toMatchObject({
    text: reviewedCandidate,
    status: TIDY_STATUS.CHANGED,
    reviewed: true,
  });
});

test('远程整理把不变文本识别为 unchanged', async () => {
  const source = '我大概下周三去上海，可能住两晚。';
  let requestCount = 0;
  const result = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: async () => {
      requestCount += 1;
      return remoteResponse({ revised_text: source, changes: [] });
    },
  });
  expect(result).toEqual({
    text: source,
    stub: false,
    status: TIDY_STATUS.UNCHANGED,
    changes: [],
  });
  expect(requestCount).toBe(1);
});

test('首次为空或 JSON 无效时二次检查后返回有效候选', async () => {
  const source = '原文';
  const adjusted = '原文。';
  const fromEmpty = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: remoteResponseSequence(
      { revised_text: '', changes: [] },
      { revised_text: adjusted }
    ),
  });
  expect(fromEmpty).toMatchObject({
    text: adjusted,
    status: TIDY_STATUS.CHANGED,
    reviewed: true,
  });

  const fromInvalidJson = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: remoteResponseSequence(
      '不是 JSON',
      { revised_text: adjusted, changes: [] }
    ),
  });
  expect(fromInvalidJson).toMatchObject({
    text: adjusted,
    status: TIDY_STATUS.CHANGED,
    reviewed: true,
  });
});

test('二次检查仍为空或格式无效时返回明确原因', async () => {
  const source = '原文';
  const secondEmpty = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: remoteResponseSequence(
      { revised_text: '', changes: [] },
      { revised_text: '', changes: [] }
    ),
  });
  expect(secondEmpty).toMatchObject({
    text: source,
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'second_empty',
  });

  const secondInvalid = await tidyRemote(source, {
    apiKey: 'test-key',
    fetchImpl: remoteResponseSequence('不是 JSON', '仍然不是 JSON'),
  });
  expect(secondInvalid).toMatchObject({
    text: source,
    status: TIDY_STATUS.REJECTED,
    rejectionReason: 'second_invalid_json',
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

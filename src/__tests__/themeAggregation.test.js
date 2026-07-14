import {
  aggregateLocally,
  aggregateThemesRemote,
  buildNoteProfiles,
  parseThemeResponse,
} from '../lib/themeAggregation';

const notes = [
  { id: 'n1', text: '语音笔记应该快速记录灵感', createdAt: 1 },
  { id: 'n2', text: '语音笔记需要减少整理负担', createdAt: 2 },
  { id: 'n3', text: '语音笔记可以自动整理内容', createdAt: 3 },
];

test('解析带代码围栏的主题 JSON', () => {
  expect(parseThemeResponse('```json\n{"themes":[{"title":"语音笔记"}]}\n```'))
    .toEqual([{ title: '语音笔记' }]);
});

test('本地聚合只形成至少三条笔记的真实分组', () => {
  const themes = aggregateLocally(notes, 100);
  expect(themes).toHaveLength(1);
  expect(themes[0].noteIds).toEqual(['n1', 'n2', 'n3']);
  expect(themes[0].summary).toContain('语音笔记应该快速记录灵感');
});

test('本地聚合会在全部笔记中识别多个类别', () => {
  const allNotes = [
    { id: 'c1', text: '咖啡烘焙需要记录豆子风味' },
    { id: 'c2', text: '咖啡烘焙温度影响豆子风味' },
    { id: 'c3', text: '咖啡烘焙之后比较豆子风味' },
    { id: 'r1', text: '跑步训练需要观察配速变化' },
    { id: 'r2', text: '跑步训练每周调整配速目标' },
    { id: 'r3', text: '跑步训练之后记录配速感受' },
  ];
  const themes = aggregateLocally(allNotes, 100);
  expect(themes).toHaveLength(2);
  expect(themes.map((theme) => theme.noteIds)).toEqual([
    ['c1', 'c2', 'c3'],
    ['r1', 'r2', 'r3'],
  ]);
});

test('紧凑笔记资料按内容指纹复用并限制摘要长度', () => {
  const longNote = { id: 'long', text: '主题内容'.repeat(80), createdAt: 1 };
  const first = buildNoteProfiles([longNote]);
  const second = buildNoteProfiles([longNote], first);
  expect(first.long.summary.length).toBeLessThanOrEqual(160);
  expect(second.long).toBe(first.long);
});

test('远程聚合解析并校验服务结果', async () => {
  let requestBody;
  const result = await aggregateThemesRemote(notes, {
    apiKey: 'test-key',
    now: 100,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          usage: { prompt_tokens: 120, completion_tokens: 35 },
          choices: [{
            message: {
              content: JSON.stringify({
                themes: [{
                  title: '语音笔记体验',
                  summary: '三条笔记都在讨论语音笔记的记录与整理。',
                  noteIds: ['n0', 'n1', 'n2'],
                  confidence: 0.88,
                }],
              }),
            },
          }],
        }),
      };
    },
  });

  expect(result.themes).toHaveLength(1);
  expect(result.themes[0]).toMatchObject({ title: '语音笔记体验', confidence: 0.88 });
  expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 35 });
  expect(JSON.parse(requestBody.messages[1].content).map((note) => note.ref))
    .toEqual(['n0', 'n1', 'n2']);
  expect(requestBody.messages[0].content)
    .toContain('不要把笔记记录者称为“用户”“作者”“你”或“笔记主人”');
  expect(requestBody.messages[0].content).toContain('用户反馈集中在搜索入口不明显');
});

test('六条以上只得到一个宽泛主题时会二次拆分复核', async () => {
  const sixNotes = [
    { id: 'a1', text: '咖啡豆风味一' },
    { id: 'a2', text: '咖啡豆风味二' },
    { id: 'a3', text: '咖啡豆风味三' },
    { id: 'b1', text: '跑步配速一' },
    { id: 'b2', text: '跑步配速二' },
    { id: 'b3', text: '跑步配速三' },
  ];
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    const themes = callCount === 1
      ? [{
          title: '生活想法',
          summary: '宽泛合并。',
          noteIds: ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'],
          confidence: 0.7,
        }]
      : [
          { title: '咖啡豆风味', summary: '咖啡相关。', noteIds: ['n0', 'n1', 'n2'], confidence: 0.9 },
          { title: '跑步配速', summary: '跑步相关。', noteIds: ['n3', 'n4', 'n5'], confidence: 0.9 },
        ];
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ themes }) } }] }),
    };
  };

  const result = await aggregateThemesRemote(sixNotes, { apiKey: 'test-key', fetchImpl, now: 100 });
  expect(callCount).toBe(2);
  expect(result.themes.map((theme) => theme.title)).toEqual(['咖啡豆风味', '跑步配速']);
});

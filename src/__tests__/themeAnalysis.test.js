import { analyzeThemeState, applyThemeDecisions, pendingThemeSummaryIds } from '../lib/themeAnalysis';
import { buildContentProfiles, coherentLocalGroups, profileText } from '../lib/themeRetrieval';
import { migrateThemeState, setThemeMembership, textHash } from '../themeModel';

jest.mock('../config.ai', () => ({ hasDeepSeekKey: () => false, DEEPSEEK_TEXT_CONFIG: { baseURL: 'https://api.deepseek.com', model: 'deepseek-flash' } }));
const notes = [{ id: 'a', text: '咖啡萃取温度影响苦味' }, { id: 'b', text: '咖啡萃取时间影响酸味' }, { id: 'c', text: '咖啡萃取研磨影响口感' }, { id: 'd', text: '咖啡萃取压力影响香气' }];
const relation = (note) => ({ reason: '讨论咖啡萃取', evidence: note.text, source: 'ai' });
const discover = (members) => ({ title: '咖啡萃取参数', scope: '讨论咖啡萃取参数对风味的影响', noteIds: members.map((note) => note.id), relations: Object.fromEntries(members.map((note) => [note.id, relation(note)])) });
const base = () => migrateThemeState({ themes: [{ id: 't', title: '咖啡萃取参数', scope: '讨论咖啡萃取参数对风味的影响', summary: '温度时间研磨', summarySource: 'ai', noteIds: ['a', 'b', 'c'] }], processed: Object.fromEntries(notes.slice(0, 3).map((note) => [note.id, textHash(note.text)])) });
const assignment = (note, strength = 'strong', themeId = 't') => ({ ...relation(note), themeId, noteId: note.id, strength });
const response = (data) => ({ ok: true, json: async () => ({ usage: { prompt_tokens: 20, completion_tokens: 10 }, choices: [{ message: { content: JSON.stringify(data) } }] }) });

test('两条独立内容形成候选，第三条加入后保持 ID 并成长', () => {
  const first = applyThemeDecisions(migrateThemeState(), { discoveries: [discover(notes.slice(0, 2))] }, notes, ['a', 'b'], 10);
  expect(first.themes[0]).toMatchObject({ status: 'candidate', maturity: 'candidate' });
  const next = applyThemeDecisions(first, { discoveries: [discover(notes.slice(0, 3))] }, notes, ['c'], 20);
  expect(next.themes).toHaveLength(1);
  expect(next.themes[0]).toMatchObject({ id: first.themes[0].id, status: 'current', noteIds: ['a', 'b', 'c'] });
  const duplicate = applyThemeDecisions(migrateThemeState(), { discoveries: [discover([{ id: 'x', text: notes[0].text }, { id: 'y', text: notes[0].text }])] }, [{ id: 'x', text: notes[0].text }, { id: 'y', text: notes[0].text }], ['x', 'y']);
  expect(duplicate.themes).toEqual([]);
});

test('新增只加入相关主题，全库有效空结果不移走稳定旧成员', () => {
  const first = applyThemeDecisions(base(), { assignments: [assignment(notes[3])] }, notes, ['d']);
  expect(first.themes[0].noteIds).toEqual(['a', 'b', 'c', 'd']);
  const unchanged = applyThemeDecisions(first, { assignments: [], discoveries: [] }, notes, notes.map((note) => note.id));
  expect(unchanged).toBe(first);
  expect(unchanged.themes[0].title).toBe(base().themes[0].title);
});

test('弱关联和关闭自动加入只提供建议，隐藏主题不会自动恢复', () => {
  const weak = applyThemeDecisions(base(), { assignments: [assignment(notes[3], 'weak')] }, notes, ['d']);
  expect(weak.themes[0].noteIds).toEqual(['a', 'b', 'c']);
  expect(weak.themes[0].suggestions.d.evidence).toBe(notes[3].text);
  for (const patch of [{ autoJoin: false }, { status: 'dismissed', suppressed: false }]) {
    const state = base(); state.themes[0] = { ...state.themes[0], ...patch };
    const next = applyThemeDecisions(state, { assignments: [assignment(notes[0]), assignment(notes[3])] }, notes, ['a', 'd']);
    expect(next.themes[0].noteIds).toEqual(['a', 'b', 'c']);
    expect(next.themes[0].status).toBe(state.themes[0].status);
    expect(next.themes[0].suggestions.d).toBeDefined();
  }
});

test('排除后重分析及更换生成标题不能回流；手动加入不被正文变化移走', () => {
  const corrected = setThemeMembership(base(), 't', 'c', false, notes);
  const newDirection = { ...discover(notes.slice(0, 3)), title: '完全不同的生成名称', scope: '其他说法' };
  const next = applyThemeDecisions(corrected, { assignments: [assignment(notes[2])], discoveries: [newDirection] }, notes, ['c']);
  expect(next.themes).toHaveLength(1);
  expect(next.themes[0].noteIds).toEqual(['a', 'b']);
  const manual = setThemeMembership(next, 't', 'd', true, notes);
  manual.processed.d = textHash(notes[3].text);
  const edited = notes.map((note) => note.id === 'd' ? { ...note, text: '跑步训练配速' } : note);
  expect(applyThemeDecisions(manual, { assignments: [], discoveries: [] }, edited, ['d']).themes[0].noteIds).toContain('d');
});

test('正文变动仅重新判断该笔记，成熟身份不会因成员减少而退回候选', () => {
  const edited = notes.map((note) => note.id === 'c' ? { ...note, text: '跑步训练配速' } : note);
  const result = applyThemeDecisions(base(), { assignments: [], discoveries: [] }, edited, ['c']);
  expect(result.themes[0]).toMatchObject({ id: 't', status: 'current', maturity: 'established', noteIds: ['a', 'b'], summaryStale: true });
  const suggested = base(); suggested.processed.d = textHash(notes[3].text); suggested.themes[0].suggestions.d = relation(notes[3]);
  const changed = notes.map((note) => note.id === 'd' ? { ...note, text: '另一个无关问题' } : note);
  expect(applyThemeDecisions(suggested, { assignments: [], discoveries: [] }, changed, ['d']).themes[0].suggestions.d).toBeUndefined();
});

test('自动归属最多两处，人工归属不占自动名额', () => {
  const state = migrateThemeState({ themes: ['x', 'y', 'z'].map((id) => ({ id, title: id, scope: '萃取', noteIds: ['a', 'b', 'c'], summary: '旧摘要' })) });
  const result = applyThemeDecisions(state, { assignments: ['x', 'y', 'z'].map((id) => assignment(notes[3], 'strong', id)) }, notes, ['d']);
  expect(result.themes.filter((item) => item.noteIds.includes('d'))).toHaveLength(2);
  expect(result.themes.find((item) => item.id === 'z').suggestions.d).toBeDefined();
});

test('本地全文表示保留尾部，桥接笔记不会串联咖啡和跑步', () => {
  const long = { id: 'long', text: `${'背景。'.repeat(1200)}关键结论：咖啡萃取研磨影响风味。` };
  const profiles = buildContentProfiles([long]);
  expect(profiles.long.tokens).toContain('研磨');
  expect(profileText(profiles.long, '咖啡萃取研磨', 1000)).toContain('关键结论');
  expect(buildContentProfiles([{ ...long, lastTouched: 999, image: {} }], profiles).long).toBe(profiles.long);
  const data = [
    { id: 'c1', text: '咖啡烘焙豆子风味一' }, { id: 'c2', text: '咖啡烘焙豆子风味二' },
    { id: 'bridge', text: '咖啡烘焙豆子风味和跑步训练配速目标' },
    { id: 'r1', text: '跑步训练配速目标一' }, { id: 'r2', text: '跑步训练配速目标二' },
  ];
  const groups = coherentLocalGroups(data);
  expect(groups.length).toBeGreaterThanOrEqual(2);
  expect(groups.some((ids) => ids.includes('c1') && ids.includes('r1'))).toBe(false);
});

test('未归类的新方向可超过五个，按批次继续全库检查', async () => {
  const data = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, text: `unique${i} special${i} content${i}` }));
  const first = await analyzeThemeState(data, migrateThemeState(), { force: true });
  expect(first.lastAnalysis).toMatchObject({ processedCount: 32, remainingCount: 8 });
  expect(first.continueRequested).toBe(true);
  const next = await analyzeThemeState(data, first);
  expect(next.lastAnalysis.remainingCount).toBe(0);
  expect(next.continueRequested).toBe(false);
  const six = Array.from({ length: 6 }, (_, i) => [{ id: `${i}a`, text: `topic${i} subject${i} first` }, { id: `${i}b`, text: `topic${i} subject${i} second` }]);
  const result = applyThemeDecisions(migrateThemeState(), { discoveries: six.map((members, i) => ({ title: `topic${i}`, scope: `subject${i}`, noteIds: members.map((note) => note.id), relations: Object.fromEntries(members.map((note) => [note.id, { reason: '共同问题', evidence: note.text }])) })) }, six.flat(), six.flat().map((note) => note.id));
  expect(result.themes).toHaveLength(6);
});

test('远程归属先更新成员，摘要请求只包含最终有效成员并校验完整来源', async () => {
  const state = setThemeMembership(base(), 't', 'c', false, notes);
  const payloads = [];
  const fetchImpl = jest.fn(async (_, options) => {
    const body = JSON.parse(options.body); const payload = JSON.parse(body.messages[1].content); payloads.push(payload);
    if (payload.targets) {
      const noteRef = payload.notes.find((item) => item.text.includes('压力')).ref;
      return response({ assignments: [{ noteId: noteRef, themeId: 't0', strength: 'strong', ...relation(notes[3]) }], discoveries: [] });
    }
    return response({ summaries: [{ themeId: 't0', summary: '温度时间压力影响萃取', noteIds: payload.themes[0].notes.map((note) => note.ref) }] });
  });
  const result = await analyzeThemeState(notes, state, { apiKey: 'test', fetchImpl });
  expect(result.themes[0]).toMatchObject({ id: 't', noteIds: ['a', 'b', 'd'], summarySource: 'ai', summaryStale: false });
  expect(payloads.at(-1).themes[0].notes.map((note) => note.text).join(' ')).not.toContain('研磨');
  expect(result.lastAnalysis.inputTokens).toBe(40);
});

test('人工摘要只收更新候选，不会反复自动生成同一份候选', async () => {
  const state = base(); state.themes[0] = { ...state.themes[0], summarySource: 'manual', summary: '我的摘要', summaryStale: true };
  const result = await analyzeThemeState(notes.slice(0, 3), state, { onlySummaryIds: ['t'] });
  expect(result.themes[0].summary).toBe('我的摘要');
  expect(result.themes[0].summaryCandidate.source).toBe('local');
  expect(pendingThemeSummaryIds(notes.slice(0, 3), result)).toEqual([]);
  const adopted = { ...result, themes: [{ ...result.themes[0], summary: result.themes[0].summaryCandidate.text, summarySource: 'local', summaryMode: 'manual', summaryCandidate: null, summaryStale: true }] };
  const refreshed = await analyzeThemeState(notes.slice(0, 3), adopted, { onlySummaryIds: ['t'] });
  expect(refreshed.themes[0].summary).toBe(adopted.themes[0].summary);
  expect(refreshed.themes[0].summaryCandidate).not.toBeNull();
});

test('空结果与格式失败区分，错误摘要和服务异常保留原始状态', async () => {
  const state = base(); const saved = JSON.stringify(state);
  await expect(analyzeThemeState(notes, state, { apiKey: 'test', fetchImpl: async () => response({ wrongKey: [] }) })).rejects.toThrow('缺少有效');
  const empty = await analyzeThemeState(notes, state, { apiKey: 'test', fetchImpl: async () => response({ assignments: [], discoveries: [] }) });
  expect(empty.themes).toEqual(state.themes);
  expect(empty.processed.d).toBe(textHash(notes[3].text));
  const stale = { ...state, themes: [{ ...state.themes[0], summaryStale: true }] };
  await expect(analyzeThemeState(notes, stale, { onlySummaryIds: ['t'], apiKey: 'test', fetchImpl: async () => response({ summaries: [{ themeId: 't0', summary: '漏来源', noteIds: ['n0'] }] }) })).rejects.toThrow('来源成员不完整');
  expect(JSON.stringify(state)).toBe(saved);
});

test('摘要缺失保留待更新状态，自动重试不会无限循环', async () => {
  const state = base(); state.themes[0].summaryStale = true;
  const result = await analyzeThemeState(notes.slice(0, 3), state, { onlySummaryIds: ['t'], apiKey: 'test', fetchImpl: async () => response({ summaries: [] }) });
  expect(result.themes[0]).toMatchObject({ summary: '温度时间研磨', summaryStale: true });
  expect(result.themes[0].summaryNotice).toContain('不足');
  expect(pendingThemeSummaryIds(notes.slice(0, 3), result)).toEqual([]);
});

test('关闭自动加入时，新发现的相同方向成为建议，不另建副本', () => {
  const state = base(); state.themes[0].autoJoin = false;
  const newNotes = [4, 5, 6].map((i) => ({ id: `new${i}`, text: `咖啡萃取参数实验${i}` }));
  const next = applyThemeDecisions(state, { discoveries: [discover(newNotes)] }, [...notes, ...newNotes], newNotes.map((note) => note.id));
  expect(next.themes).toHaveLength(1);
  expect(Object.keys(next.themes[0].suggestions)).toEqual(['new4', 'new5', 'new6']);
  expect(next.themes[0].noteIds).toEqual(['a', 'b', 'c']);
});

test('抑制方向的相近新笔记不会再生成副本，人工范围本地只收建议', async () => {
  const state = base(); state.themes[0].suppressed = true;
  const newNotes = [4, 5].map((i) => ({ id: `new${i}`, text: `咖啡萃取参数实验${i}` }));
  expect(applyThemeDecisions(state, { discoveries: [discover(newNotes)] }, [...notes, ...newNotes], newNotes.map((note) => note.id)).themes).toHaveLength(1);
  const user = base(); user.themes[0] = { ...user.themes[0], management: 'user', status: 'retained', autoJoin: true };
  const result = await analyzeThemeState(notes, user);
  expect(result.themes[0].noteIds).not.toContain('d');
  expect(result.themes[0].suggestions.d.source).toBe('local');
});

test('摘要更新有每轮预算，用户请求的全库检查保留后续摘要任务', async () => {
  const data = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, text: `unique${i} topic${i} content${i}` }));
  const state = migrateThemeState({ themes: data.map((note, i) => ({ id: `t${i}`, title: `topic${i}`, scope: `unique${i}`, noteIds: [note.id], summary: '旧摘要', summaryStale: true })) });
  const first = await analyzeThemeState(data, state, { force: true });
  expect(first.lastAnalysis.pendingSummaryCount).toBe(2);
  expect(first.continueRequested).toBe(true);
  const next = await analyzeThemeState(data, first);
  expect(next.lastAnalysis.pendingSummaryCount).toBe(0);
  expect(next.continueRequested).toBe(false);
});

test('相反观点可以属于同一个具体问题', async () => {
  const data = [{ id: 'a', text: 'coffee extraction temperature higher improves taste' }, { id: 'b', text: 'coffee extraction temperature higher worsens taste' }];
  const result = await analyzeThemeState(data, migrateThemeState());
  expect(result.themes.some((item) => item.noteIds.includes('a') && item.noteIds.includes('b'))).toBe(true);
});

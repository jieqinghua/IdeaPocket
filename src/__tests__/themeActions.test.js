import {
  dissolveTheme,
  normalizeGeneratedThemes,
  reconcileGeneratedThemes,
  retainTheme,
  removeDeletedNoteFromThemes,
  removeNoteFromTheme,
  renameTheme,
} from '../themeActions';

const notes = [
  { id: 'n1', text: '一' },
  { id: 'n2', text: '二' },
  { id: 'n3', text: '三' },
  { id: 'n4', text: '四' },
];

test('只接受至少三条已知笔记，并保证单一归属', () => {
  const result = normalizeGeneratedThemes([
    { title: '主题一', summary: '总结一', noteIds: ['n1', 'n2', 'n3'], confidence: 0.9 },
    { title: '主题二', summary: '总结二', noteIds: ['n3', 'n4', 'missing'], confidence: 0.8 },
  ], notes, 100);

  expect(result).toHaveLength(1);
  expect(result[0].noteIds).toEqual(['n1', 'n2', 'n3']);
});

test('同一笔记可以进入最多两个不同主题', () => {
  const allNotes = [...notes, { id: 'n5', text: '五' }, { id: 'n6', text: '六' }];
  const result = normalizeGeneratedThemes([
    { title: '产品设计', summary: '设计', focusKeywords: ['设计'], noteIds: ['n1', 'n2', 'n3'], confidence: 0.9 },
    { title: '用户研究', summary: '研究', focusKeywords: ['研究'], noteIds: ['n1', 'n4', 'n5'], confidence: 0.8 },
    { title: '项目计划', summary: '计划', focusKeywords: ['计划'], noteIds: ['n1', 'n5', 'n6'], confidence: 0.7 },
  ], allNotes, 100);
  expect(result.filter((theme) => theme.noteIds.includes('n1'))).toHaveLength(2);
});

test('一次最多接受五个当前主题', () => {
  const allNotes = Array.from({ length: 18 }, (_, index) => ({ id: `x${index}`, text: `${index}` }));
  const candidates = Array.from({ length: 6 }, (_, index) => ({
    title: `主题${index}`,
    summary: `总结${index}`,
    focusKeywords: [`焦点${index}`],
    noteIds: [`x${index * 3}`, `x${index * 3 + 1}`, `x${index * 3 + 2}`],
    confidence: 0.9 - index * 0.01,
  }));
  expect(normalizeGeneratedThemes(candidates, allNotes, 100)).toHaveLength(5);
});

test('宽泛主题与具体主题重叠时优先保留多个具体主题', () => {
  const sixNotes = [
    ...notes,
    { id: 'n5', text: '五' },
    { id: 'n6', text: '六' },
  ];
  const result = normalizeGeneratedThemes([
    { title: '宽泛总主题', summary: '覆盖全部', noteIds: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'], confidence: 0.7 },
    { title: '具体主题一', summary: '前三条', noteIds: ['n1', 'n2', 'n3'], confidence: 0.9 },
    { title: '具体主题二', summary: '后三条', noteIds: ['n4', 'n5', 'n6'], confidence: 0.88 },
  ], sixNotes, 100);

  expect(result.map((theme) => theme.title)).toEqual(['具体主题一', '具体主题二']);
});

test('增量更新保留用户改名和被移出的笔记', () => {
  const current = [{
    id: 't1',
    title: '我的标题',
    titleEdited: true,
    summary: '旧总结',
    noteIds: ['n1', 'n2', 'n3'],
    excludedNoteIds: ['n3'],
    createdAt: 10,
    updatedAt: 10,
  }];
  const generated = normalizeGeneratedThemes([
    { title: 'AI 标题', summary: '新总结', noteIds: ['n1', 'n2', 'n3', 'n4'], confidence: 0.9 },
  ], notes, 200);
  const result = reconcileGeneratedThemes(current, generated, 300);

  expect(result[0]).toMatchObject({ id: 't1', title: '我的标题', summary: '新总结' });
  expect(result[0].noteIds).toEqual(['n1', 'n2', 'n4']);
});

test('主题纠错不会删除原始笔记', () => {
  const themes = [{ id: 't1', title: '旧名', noteIds: ['n1', 'n2', 'n3'], excludedNoteIds: [] }];
  const renamed = renameTheme(themes, 't1', '新名字', 20);
  const removed = removeNoteFromTheme(renamed, 't1', 'n2', 30);
  const dissolved = dissolveTheme(removed, 't1', 40);

  expect(dissolved[0]).toMatchObject({ title: '新名字', titleEdited: true, dismissed: true });
  expect(dissolved[0].noteIds).toEqual(['n1', 'n3']);
  expect(dissolved[0].excludedNoteIds).toEqual(['n2']);
  expect(notes).toHaveLength(4);
});

test('一次空聚合结果不会静默删除已有主题', () => {
  const themes = [{ id: 't1', title: '已有主题', noteIds: ['n1', 'n2', 'n3'] }];
  expect(reconcileGeneratedThemes(themes, [], 100)).toBe(themes);
});

test('未匹配主题进入历史，保留主题不受重新分析影响', () => {
  const current = [
    { id: 'old', title: '旧主题', summary: '旧', noteIds: ['n1', 'n2', 'n3'], status: 'current' },
    { id: 'kept', title: '固定主题', summary: '固定', noteIds: ['n1', 'n2', 'n4'], status: 'retained' },
  ];
  const generated = normalizeGeneratedThemes([
    { title: '新主题', summary: '新', focusKeywords: ['新'], noteIds: ['n1', 'n3', 'n4'], confidence: 0.9 },
  ], notes, 200);
  const result = reconcileGeneratedThemes(current, generated, 300);
  expect(result.find((theme) => theme.id === 'old').status).toBe('history');
  expect(result.find((theme) => theme.id === 'kept')).toEqual(current[1]);
});

test('历史主题可以被保留', () => {
  const result = retainTheme([{ id: 't1', status: 'history', noteIds: ['n1'] }], 't1', 90);
  expect(result[0]).toMatchObject({ status: 'retained', retainedAt: 90 });
});

test('删除笔记会同步移出所有主题但不解散主题记录', () => {
  const themes = [
    { id: 't1', noteIds: ['n1', 'n2', 'n3'], updatedAt: 10 },
    { id: 't2', noteIds: ['n1', 'n4'], updatedAt: 10 },
  ];
  const result = removeDeletedNoteFromThemes(themes, 'n1', 80);
  expect(result.map((theme) => theme.noteIds)).toEqual([['n2', 'n3'], ['n4']]);
  expect(result.map((theme) => theme.updatedAt)).toEqual([80, 80]);
});

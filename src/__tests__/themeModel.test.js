import { changeTheme, createManualTheme, editThemeField, invalidateNoteThemes, migrateThemeState, setThemeMembers, setThemeMembership, textHash, undoThemeChange } from '../themeModel';

const notes = [{ id: 'a', text: '咖啡萃取温度', rawText: '咖啡原文' }, { id: 'b', text: '咖啡萃取时间' }, { id: 'c', text: '咖啡萃取研磨' }];
const state = () => migrateThemeState({ themes: [{ id: 't', title: '咖啡萃取', summary: '旧摘要', noteIds: ['a', 'b', 'c'] }] });

test('存量生命周期迁移不重排成员，已保留默认关闭自动加入', () => {
  const result = migrateThemeState({ themes: [
    { id: 't', status: 'retained', noteIds: ['a'], excludedNoteIds: ['b'] },
    { id: 'h', status: 'history', noteIds: ['c'] },
    { id: 'd', dismissed: true, noteIds: ['a', 'c'] },
  ] });
  expect(result.settings.autoEnabled).toBe(false);
  expect(result.themes[0]).toMatchObject({ management: 'user', autoJoin: false, noteIds: ['a'] });
  expect(result.rules.t.excludedNoteIds).toEqual(['b']);
  expect(result.themes[1].legacyHistory).toBe(true);
  expect(result.themes[2]).toMatchObject({ status: 'dismissed', suppressed: true });
});

test('人工加入和排除是独立规则，可加回和撤销', () => {
  const removed = setThemeMembership(state(), 't', 'c', false, notes, 10);
  expect(removed.themes[0]).toMatchObject({ noteIds: ['a', 'b'], summaryStale: true, management: 'user' });
  expect(removed.rules.t.excludedNoteIds).toEqual(['c']);
  const added = setThemeMembership(removed, 't', 'c', true, notes, 11);
  expect(added.rules.t).toEqual({ includedNoteIds: ['c'], excludedNoteIds: [] });
  const undone = undoThemeChange(added, 't', notes);
  expect(undone.rules.t).toEqual(removed.rules.t);
  expect(undone.themes[0].noteIds).toEqual(['a', 'b']);
});

test('历史正文独立保存，修改当前正文不会改写此前版本', () => {
  const first = changeTheme(state(), 't', { title: '新名称' }, notes, '改名', { now: 10 });
  const edited = notes.map((note) => note.id === 'a' ? { ...note, text: '跑步训练' } : note);
  const result = invalidateNoteThemes(first, edited);
  const version = result.themes[0].revisions.at(-1);
  expect(result.snapshots[version.sourceRefs.a].text).toBe('咖啡萃取温度');
  expect(result.snapshots[version.sourceRefs.a].rawText).toBe('咖啡原文');
  expect(result.themes[0].summaryStale).toBe(true);
  expect(result.snapshots[result.themes[0].sourceRefs.a].text).toBe('跑步训练');
  expect(result.themes[0].revisions[0].legacyHistory).toBe(true);
});

test('撤销不会复活已删除笔记，也不会把修改前摘要当作最新', () => {
  const first = changeTheme(state(), 't', { title: '新名称' }, notes, '改名');
  const next = editThemeField(first, 't', 'summary', '人工摘要', notes);
  const edited = notes.map((note) => note.id === 'a' ? { ...note, text: '不同正文' } : note.id === 'b' ? { ...note, deletedAt: 20 } : note);
  const result = undoThemeChange(next, 't', edited);
  expect(result.themes[0].noteIds).toEqual(['a', 'c']);
  expect(result.themes[0].summaryStale).toBe(true);
});

test('人工主题可从一条笔记创建，人工摘要有独立来源', () => {
  const first = createManualTheme(migrateThemeState(), '研究问题', '包含咖啡萃取实验', ['a'], notes);
  const item = first.themes[0];
  expect(item).toMatchObject({ noteIds: ['a'], management: 'user', autoJoin: false, maturity: 'established' });
  const result = editThemeField(first, item.id, 'summary', '我的结论', notes);
  expect(result.themes[0]).toMatchObject({ summarySource: 'manual', summaryStale: false });
});

test('图片和时间变化不产生正文失效或新的内容指纹', () => {
  const first = changeTheme(state(), 't', {}, notes, '建立来源');
  const result = invalidateNoteThemes(first, notes.map((note) => ({ ...note, image: { uri: 'new.jpg' }, lastTouched: 999 })));
  expect(result).toBe(first);
  expect(textHash('  咖啡  ')).toBe(textHash('咖啡'));
});

test('多选加入是一项可整批撤销的调整，旧主题正文变化会标记待更新', () => {
  const initial = migrateThemeState({ themes: [{ id: 't', title: '咖啡', noteIds: ['a'], summary: '旧摘要' }] });
  const added = setThemeMembers(initial, 't', ['b', 'c'], true, notes);
  expect(added.undoActions).toHaveLength(1);
  expect(undoThemeChange(added, 't', notes).themes[0].noteIds).toEqual(['a']);
  const edited = notes.map((note) => note.id === 'a' ? { ...note, text: '改后的正文' } : note);
  expect(invalidateNoteThemes(initial, edited, notes).themes[0].summaryStale).toBe(true);
});

test('内容检索可规范化，但历史快照保留空格和全半角的原始正文', () => {
  const first = changeTheme(state(), 't', { summarySource: 'ai' }, notes, '更新摘要');
  const edited = notes.map((note) => note.id === 'a' ? { ...note, text: ` ${note.text} ` } : note);
  const next = changeTheme(first, 't', { title: '新名称' }, edited, '改名');
  expect(next.themes[0].sourceRefs.a).not.toBe(first.themes[0].sourceRefs.a);
  expect(next.snapshots[next.themes[0].sourceRefs.a].text).toBe(` ${notes[0].text} `);
  expect(next.snapshots[first.themes[0].sourceRefs.a].text).toBe(notes[0].text);
});

import { buildBackupJson } from '../lib/backupExport';
import { buildImportState, parseBackupJson } from '../lib/backupImport';
import { changeTheme, createManualTheme, migrateThemeState, setThemeMembership } from '../themeModel';

const notes = [{ id: 'a', text: '咖啡萃取温度', rawText: '咖啡口述' }, { id: 'b', text: '咖啡萃取时间' }, { id: 'c', text: '咖啡萃取研磨', deletedAt: 5 }];
const managed = () => {
  let state = createManualTheme(migrateThemeState(), '研究问题', '咖啡参数', ['a', 'b'], notes);
  const id = state.themes[0].id;
  state = setThemeMembership(state, id, 'b', false, notes);
  state = changeTheme(state, id, { status: 'dismissed', suppressed: true, summary: '人工摘要', summarySource: 'manual' }, notes, '隐藏');
  return { ...state, settings: { autoEnabled: true } };
};

test('完整备份往返恢复主题规则、版本正文、管理设置和撤销', () => {
  const state = managed();
  const payload = parseBackupJson(buildBackupJson(notes, state.themes, { themeState: state }));
  const result = buildImportState([], payload, 'overwrite', 100).themeState;
  expect(result.themes).toMatchObject(state.themes);
  expect(result.rules).toEqual(state.rules);
  expect(result.snapshots).toEqual(state.snapshots);
  expect(result.settings.autoEnabled).toBe(true);
  expect(result.undoActions).toHaveLength(state.undoActions.length);
});

test('合并导入保留本地主题设置，冲突 ID 同步映射规则和历史来源', () => {
  const state = managed(); const id = state.themes[0].id;
  const payload = parseBackupJson(buildBackupJson(notes, state.themes, { themeState: state }));
  const current = migrateThemeState({ themes: [{ id, title: '本地主题', noteIds: ['a'] }] });
  const result = buildImportState([{ id: 'a', text: '本地正文' }], payload, 'merge', 100, current);
  expect(result.themes[0]).toEqual(current.themes[0]);
  expect(result.themeState.settings.autoEnabled).toBe(false);
  const imported = result.themes[1]; const mappedId = result.notes.find((note) => note.text === notes[0].text).id;
  expect(imported.id).not.toBe(id);
  expect(imported.noteIds).toEqual([mappedId]);
  expect(result.themeState.rules[imported.id].includedNoteIds).toContain(mappedId);
  expect(result.themeState.snapshots[imported.sourceRefs[mappedId]].text).toBe(notes[0].text);
  expect(imported.revisions[0].noteIds).toContain(mappedId);
  expect(result.themeState.undoActions.at(-1).themeId).toBe(imported.id);
});

test('已不在当前笔记里的历史正文仍可恢复，合并不误指向本地同 ID', () => {
  let state = createManualTheme(migrateThemeState(), '旧记录', '', ['a'], notes);
  state = changeTheme(state, state.themes[0].id, { noteIds: [], summaryStale: true }, [], '来源移出');
  const payload = parseBackupJson(buildBackupJson([], state.themes, { themeState: state }));
  const result = buildImportState([{ id: 'a', text: '其他本地笔记' }], payload, 'merge', 100);
  const version = result.themes[0].revisions[0]; const id = version.noteIds[0];
  expect(id).not.toBe('a');
  expect(result.themeState.snapshots[version.sourceRefs[id]].text).toBe(notes[0].text);
});

test('排除演示数据同时排除其快照、检索缓存和纠偏引用', () => {
  const demo = { id: 'demo', text: '演示秘密样本', demo: true };
  const all = [...notes, demo];
  let state = createManualTheme(migrateThemeState(), '研究问题', '', ['a', 'demo'], all);
  state = setThemeMembership(state, state.themes[0].id, 'demo', false, all);
  state.noteProfiles = { demo: { summary: demo.text } };
  const payload = parseBackupJson(buildBackupJson(all, state.themes, { themeState: state }));
  expect(JSON.stringify(payload)).not.toContain(demo.text);
  expect(payload.themeState.rules[state.themes[0].id].excludedNoteIds).toEqual([]);
  expect(payload.themeState.noteProfiles).toEqual({});
  expect(payload.themeState.undoActions[0].previous.noteIds).toEqual(['a']);
});

test('旧版备份保留标题、成员、排除约束，拒绝损坏的主题关系', () => {
  const payload = parseBackupJson(JSON.stringify({ app: 'IdeaPocket', backupVersion: 3, notes, themes: [{ id: 'old', title: '旧主题', noteIds: ['a'], status: 'retained', excludedNoteIds: ['b'] }] }));
  const state = buildImportState([], payload, 'overwrite').themeState;
  expect(state.themes[0]).toMatchObject({ title: '旧主题', noteIds: ['a'], autoJoin: false, management: 'user' });
  expect(state.rules.old.excludedNoteIds).toEqual(['b']);
  expect(() => buildImportState([], { ...payload, notes: [notes[0], notes[0]] }, 'overwrite')).toThrow('重复笔记');
});


test('恢复保留正文和原始转写的精确空白，空白笔记仍拒绝', () => {
  const payload = { app: 'IdeaPocket', backupVersion: 4, notes: [{ id: 'a', text: '  Ａ段落\n内容  ', rawText: '  原始口述  ' }], themes: [] };
  const result = buildImportState([], payload, 'overwrite');
  expect(result.notes[0]).toMatchObject({ text: payload.notes[0].text, rawText: payload.notes[0].rawText });
  expect(() => buildImportState([], { ...payload, notes: [{ id: 'a', text: '  ' }] }, 'overwrite')).toThrow('内容为空');
});

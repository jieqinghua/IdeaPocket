import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useNotes } from '../useNotes';
import { analyzeThemeState } from '../lib/themeAnalysis';
import { migrateThemeState, textHash } from '../themeModel';
import { loadNotes, loadThemeState, restoreImportedData, saveNotes, saveThemeState } from '../storage';
import { exportNotesBackup } from '../backupFiles';
import { chooseAndStoreNoteImage, restoreBackupImage, removeStoredNoteImage } from '../noteImages';

jest.mock('../storage', () => ({ loadNotes: jest.fn(), loadThemeState: jest.fn(), restoreImportedData: jest.fn(), saveNotes: jest.fn(), saveThemeState: jest.fn() }));
jest.mock('../backupFiles', () => ({ exportNotesBackup: jest.fn() }));
jest.mock('../noteImages', () => ({ chooseAndStoreNoteImage: jest.fn(), removeStoredNoteImage: jest.fn(), restoreBackupImage: jest.fn() }));
jest.mock('../lib/themeAnalysis', () => ({ ...jest.requireActual('../lib/themeAnalysis'), analyzeThemeState: jest.fn() }));
jest.mock('../config.ai', () => ({ hasDeepSeekKey: () => false, DEEPSEEK_TEXT_CONFIG: {} }));

const initialNotes = [{ id: 'a', text: '咖啡萃取温度影响风味', createdAt: 1 }, { id: 'b', text: '咖啡萃取时间影响口感', createdAt: 2 }, { id: 'welcome', text: '欢迎', welcome: true, createdAt: 3 }, { id: 'demo', text: '演示', demo: true, createdAt: 4 }];
let store; let tree; let appChanged; let errorSpy;
function Harness() { store = useNotes(); return null; }
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const mount = async (state = migrateThemeState(), notes = initialNotes) => {
  loadNotes.mockResolvedValue(notes); loadThemeState.mockResolvedValue(state);
  await act(async () => { tree = renderer.create(<Harness />); });
  await flush();
};
const tick = async () => { await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); }); await flush(); };
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  AppState.currentState = 'active';
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => { appChanged = callback; return { remove: jest.fn() }; });
  saveNotes.mockResolvedValue(); saveThemeState.mockResolvedValue(); restoreImportedData.mockResolvedValue();
  exportNotesBackup.mockResolvedValue({ directoryUri: 'file:///safety-backup' });
  analyzeThemeState.mockImplementation(jest.requireActual('../lib/themeAnalysis').analyzeThemeState);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.useRealTimers(); errorSpy.mockRestore(); jest.restoreAllMocks(); });

test('首次加载不上传，新增先保存；启用后批量分析不包含引导和演示', async () => {
  await mount(); await tick();
  expect(analyzeThemeState).not.toHaveBeenCalled();
  await act(async () => { expect(store.add('咖啡萃取研磨影响苦味')).toBe(true); }); await flush();
  expect(saveNotes.mock.calls.at(-1)[0].some((note) => note.text.includes('研磨'))).toBe(true);
  expect(analyzeThemeState).not.toHaveBeenCalled();
  await act(async () => { store.setAutoThemes(true); }); await tick();
  expect(analyzeThemeState).toHaveBeenCalledTimes(1);
  expect(analyzeThemeState.mock.calls[0][0].every((note) => !note.demo && !note.welcome)).toBe(true);
  expect(store.themes.length).toBeGreaterThan(0);
  expect(saveThemeState.mock.calls.at(-1)[0].settings.autoEnabled).toBe(true);
});

test('运行中修改主题会取消任务，迟到结果不能覆盖用户纠偏', async () => {
  const initial = migrateThemeState({ themes: [{ id: 't', title: '咖啡', noteIds: ['a', 'b'], summary: '旧摘要' }] });
  await mount(initial);
  let resolve; let signal;
  analyzeThemeState.mockImplementation((_, state, options) => { signal = options.signal; return new Promise((done) => { resolve = () => done({ ...state, themes: [{ ...state.themes[0], title: 'AI 迟到标题' }], revision: state.revision + 1, lastAnalysis: { newCount: 0, updatedCount: 1, remainingCount: 0 } }); }); });
  await act(async () => { store.analyzeThemes(); });
  expect(store.themeStatus).toBe('running');
  await act(async () => { store.updateThemeTitle('t', '我的名称'); });
  expect(signal.aborted).toBe(true);
  await act(async () => resolve()); await flush();
  expect(store.themes[0].title).toBe('我的名称');
  expect(store.themes[0].management).toBe('user');
});

test('新增正文不等待分析，旧输入的结果被丢弃；回到前台能继续', async () => {
  await mount();
  let resolve; let signal;
  analyzeThemeState.mockImplementation((_, state, options) => { signal = options.signal; return new Promise((done) => { resolve = () => done({ ...state, themes: [], processed: {}, revision: state.revision + 1, lastAnalysis: { newCount: 0, updatedCount: 0, remainingCount: 2 } }); }); });
  await act(async () => { store.setAutoThemes(true); }); await tick();
  await act(async () => { store.add('跑步训练目标'); }); await flush();
  expect(signal.aborted).toBe(true);
  expect(saveNotes.mock.calls.at(-1)[0][0].text).toBe('跑步训练目标');
  await act(async () => { appChanged('background'); resolve(); }); await flush();
  expect(store.pendingThemeCount).toBe(3);
  analyzeThemeState.mockImplementation(jest.requireActual('../lib/themeAnalysis').analyzeThemeState);
  await act(async () => { appChanged('active'); }); await tick();
  expect(store.pendingThemeCount).toBe(0);
});

test('分析失败保留旧主题并停止重复请求，人工继续可重试', async () => {
  const initial = migrateThemeState({ themes: [{ id: 't', title: '咖啡', noteIds: ['a', 'b'], summary: '已有总结' }], settings: { autoEnabled: true } });
  analyzeThemeState.mockRejectedValue(new Error('服务失败'));
  await mount(initial); await tick(); await tick();
  expect(analyzeThemeState).toHaveBeenCalledTimes(1);
  expect(store.themeError).toBe('服务失败');
  expect(store.themes[0].summary).toBe('已有总结');
  analyzeThemeState.mockImplementation(jest.requireActual('../lib/themeAnalysis').analyzeThemeState);
  await act(async () => { await store.continueThemeAnalysis(); });
  expect(store.themeError).toBe('');
  expect(store.pendingThemeCount).toBe(0);
});

test('关闭自动整理时，明确请求的全库检查仍会分轮完成', async () => {
  const notes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, text: `subject${i} unique${i} item${i}`, createdAt: i + 1 }));
  await mount(migrateThemeState(), notes);
  await act(async () => { await store.analyzeThemes(); });
  expect(store.pendingThemeCount).toBe(8);
  expect(store.autoThemesEnabled).toBe(false);
  await tick();
  expect(store.pendingThemeCount).toBe(0);
  expect(analyzeThemeState).toHaveBeenCalledTimes(2);
});

test('删除来源保留历史并标记摘要，图片与触碰时间不触发增量', async () => {
  const initial = migrateThemeState({ themes: [{ id: 't', title: '咖啡', noteIds: ['a', 'b'], summary: '旧摘要' }], processed: Object.fromEntries(initialNotes.map((note) => [note.id, textHash(note.text)])) });
  await mount(initial, initialNotes.map((note) => note.id === 'a' ? { ...note, image: { uri: 'file:///a.jpg', fileName: 'a.jpg' } } : note));
  await act(async () => { await store.removeImage('a'); }); await flush();
  expect(store.pendingThemeCount).toBe(0);
  expect(store.themes[0].summaryStale).toBe(false);
  await act(async () => { store.remove('b'); }); await flush();
  expect(store.themes[0].noteIds).toEqual(['a']);
  expect(store.themes[0].summaryStale).toBe(true);
  expect(store.themes[0].revisions.at(-1).reason).toContain('删除');
});

test('导入恢复事务待续写时保留图片并封锁写入', async () => {
  await mount();
  restoreBackupImage.mockReturnValue({ uri: 'file:///import.jpg' });
  restoreImportedData.mockRejectedValue(Object.assign(new Error('恢复待完成'), { code: 'restore_pending' }));
  const backup = JSON.stringify({ app: 'IdeaPocket', backupVersion: 4, notes: [{ id: 'new', text: '导入内容', image: { fileName: 'import.jpg' } }], themes: [] });
  await act(async () => { await expect(store.importBackup(backup, 'overwrite', 'file:///backup')).rejects.toThrow('恢复待完成'); });
  expect(removeStoredNoteImage).not.toHaveBeenCalled();
  expect(store.ready).toBe(false);
  expect(store.loadError).toContain('恢复事务');
  expect(store.add('不能写入')).toBe(false);
});

test('存量主题首次编辑正文也会标记摘要待更新，恢复隐藏不带回删除成员', async () => {
  const initial = migrateThemeState({ themes: [{ id: 't', title: '咖啡', noteIds: ['a', 'b'], summary: '旧摘要' }] });
  await mount(initial);
  await act(async () => { store.edit('a', '跑步配速计划'); }); await flush();
  expect(store.themes[0].summaryStale).toBe(true);
  await act(async () => { store.dismissTheme('t'); store.remove('b'); }); await flush();
  await act(async () => { store.restoreTheme('t'); }); await flush();
  expect(store.themes[0].noteIds).toEqual(['a']);
  expect(store.themes[0].summaryStale).toBe(true);
});

test('导入开始后迟到的图片结果会清理，不会附到新导入的同 ID 笔记', async () => {
  await mount(); let resolveImage; let request;
  chooseAndStoreNoteImage.mockImplementation(() => new Promise((resolve) => { resolveImage = resolve; }));
  await act(async () => { request = store.attachImage('a', 'library'); });
  const backup = JSON.stringify({ app: 'IdeaPocket', backupVersion: 4, notes: [{ id: 'a', text: '导入后的同 ID 笔记' }], themes: [] });
  await act(async () => { await store.importBackup(backup, 'overwrite'); }); await flush();
  await act(async () => { resolveImage({ uri: 'file:///late.jpg' }); await request; });
  expect(removeStoredNoteImage).toHaveBeenCalledWith({ uri: 'file:///late.jpg' });
  expect(store.notes[0]).toMatchObject({ text: '导入后的同 ID 笔记' });
  expect(store.notes[0].image).toBeUndefined();
});

test('应用未处于 active 时不启动分析，前台事件到达后再继续', async () => {
  AppState.currentState = 'inactive';
  await mount(migrateThemeState({ settings: { autoEnabled: true } })); await tick();
  expect(analyzeThemeState).not.toHaveBeenCalled();
  await act(async () => appChanged('active')); await tick();
  expect(analyzeThemeState).toHaveBeenCalledTimes(1);
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadNotes, loadThemeState, restoreImportedData, saveNotes, saveThemeState } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiSet: jest.fn(),
  removeItem: jest.fn(),
}));

let warnSpy;

beforeEach(() => {
  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset();
  AsyncStorage.multiSet.mockReset();
  AsyncStorage.removeItem.mockReset();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => warnSpy.mockRestore());

test('读取已有笔记', async () => {
  AsyncStorage.getItem.mockResolvedValue('[{"id":"n1"}]');
  await expect(loadNotes()).resolves.toEqual([{ id: 'n1' }]);
});

test('新安装时返回功能引导笔记，已保存的空列表不会重新加入', async () => {
  AsyncStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce('[]');
  const welcomeNotes = await loadNotes();
  await expect(loadNotes()).resolves.toEqual([]);

  expect(welcomeNotes).toHaveLength(4);
  expect(welcomeNotes.every((note) => note.welcome)).toBe(true);
});

test('读取失败不会伪装成空数据', async () => {
  AsyncStorage.getItem.mockRejectedValue(new Error('disk error'));
  await expect(loadNotes()).rejects.toThrow('读取本地笔记失败');
});

test('保存失败会向上抛出', async () => {
  AsyncStorage.setItem.mockRejectedValue(new Error('disk full'));
  await expect(saveNotes([{ id: 'n1' }])).rejects.toThrow('保存本地笔记失败');
});

test('主题状态独立读取并兼容空数据', async () => {
  AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
    themes: [{ id: 't1' }],
    lastInputFingerprint: 'hash',
  }));
  const state = await loadThemeState();
  expect(state).toMatchObject({ version: 3, lastAnalyzedFingerprint: 'hash', settings: { autoEnabled: false }, snapshots: {}, processed: {} });
  expect(state.themes[0]).toMatchObject({ id: 't1', status: 'current', management: 'auto', autoJoin: true });
  expect(state.rules.t1).toEqual({ includedNoteIds: [], excludedNoteIds: [] });
});

test('保存主题状态', async () => {
  AsyncStorage.setItem.mockResolvedValue();
  await saveThemeState({ themes: [{ id: 't1' }], lastAnalyzedFingerprint: 'hash' });
  const [key, saved] = AsyncStorage.setItem.mock.calls[0];
  expect(key).toBe('ideapocket.themes.v1');
  expect(JSON.parse(saved)).toMatchObject({ version: 3, lastAnalyzedFingerprint: 'hash', snapshots: {}, rules: { t1: { includedNoteIds: [], excludedNoteIds: [] } }, settings: { autoEnabled: false } });
});

test('导入恢复先写事务日志，再一起提交笔记和主题状态', async () => {
  AsyncStorage.setItem.mockResolvedValue();
  AsyncStorage.multiSet.mockResolvedValue();
  AsyncStorage.removeItem.mockResolvedValue();
  await restoreImportedData([{ id: 'n1', text: '恢复' }], { themes: [] });
  expect(AsyncStorage.multiSet).toHaveBeenCalledWith([
    ['ideapocket.notes.v1', JSON.stringify([{ id: 'n1', text: '恢复' }])],
    ['ideapocket.themes.v1', expect.any(String)],
  ]);
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('ideapocket.restore-journal.v1');
});


test('中断的恢复事务会续写同一份笔记和完整主题状态', async () => {
  const nextNotes = JSON.stringify([{ id: 'n1', text: '已恢复' }]);
  const nextThemeState = JSON.stringify({ version: 3, themes: [{ id: 't', noteIds: ['n1'], title: '恢复主题' }], rules: { t: { excludedNoteIds: ['n2'] } }, settings: { autoEnabled: true } });
  AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ nextNotes, nextThemeState })).mockResolvedValueOnce(nextNotes).mockResolvedValueOnce(nextThemeState);
  expect(await loadNotes()).toEqual(JSON.parse(nextNotes));
  expect(AsyncStorage.multiSet).toHaveBeenCalledWith([['ideapocket.notes.v1', nextNotes], ['ideapocket.themes.v1', nextThemeState]]);
  const state = await loadThemeState();
  expect(state.rules.t.excludedNoteIds).toEqual(['n2']);
  expect(state.settings.autoEnabled).toBe(true);
});

test('日志落盘后的恢复失败明确为待续写，保留恢复所需图片', async () => {
  AsyncStorage.setItem.mockResolvedValue();
  AsyncStorage.multiSet.mockRejectedValue(new Error('disk full'));
  await expect(restoreImportedData([{ id: 'n1', text: '恢复' }], { themes: [] })).rejects.toMatchObject({ code: 'restore_pending' });
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

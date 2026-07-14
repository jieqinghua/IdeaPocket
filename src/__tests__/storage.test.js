import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadNotes, loadThemeState, saveNotes, saveThemeState } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

let warnSpy;

beforeEach(() => {
  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => warnSpy.mockRestore());

test('读取已有笔记', async () => {
  AsyncStorage.getItem.mockResolvedValue('[{"id":"n1"}]');
  await expect(loadNotes()).resolves.toEqual([{ id: 'n1' }]);
});

test('新安装时返回功能引导笔记，已保存的空列表不会重新加入', async () => {
  AsyncStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce('[]');
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
  await expect(loadThemeState()).resolves.toEqual({
    themes: [{ id: 't1', status: 'current' }],
    lastAnalyzedFingerprint: 'hash',
    lastAnalysis: null,
    noteProfiles: {},
  });
});

test('保存主题状态', async () => {
  AsyncStorage.setItem.mockResolvedValue();
  await saveThemeState({ themes: [{ id: 't1' }], lastAnalyzedFingerprint: 'hash' });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'ideapocket.themes.v1',
    JSON.stringify({
      version: 2,
      themes: [{ id: 't1' }],
      lastAnalyzedFingerprint: 'hash',
      lastAnalysis: null,
      noteProfiles: {},
    })
  );
});

// 本地优先、单用户：所有笔记就是一坨 JSON，存在设备里。够用到几千条。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWelcomeNotes } from './noteActions';
import { migrateThemeState } from './themeModel';

const NOTES_KEY = 'ideapocket.notes.v1';
const THEMES_KEY = 'ideapocket.themes.v1';
const RESTORE_JOURNAL_KEY = 'ideapocket.restore-journal.v1';

async function recoverInterruptedRestore() {
  const raw = await AsyncStorage.getItem(RESTORE_JOURNAL_KEY);
  if (!raw) return;
  const journal = JSON.parse(raw);
  // 旧版或其它 key 被错误返回时不把正常笔记误判为恢复日志。
  if (!journal?.nextNotes || !journal?.nextThemeState) return;
  await AsyncStorage.multiSet([
    [NOTES_KEY, journal.nextNotes],
    [THEMES_KEY, journal.nextThemeState],
  ]);
  await AsyncStorage.removeItem(RESTORE_JOURNAL_KEY);
}

export async function loadNotes() {
  try {
    await recoverInterruptedRestore();
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    // 仅在从未写入过笔记数据的新安装中加入引导笔记；用户清空后的 [] 保持为空。
    return raw === null ? createWelcomeNotes() : JSON.parse(raw);
  } catch (e) {
    console.warn('loadNotes failed', e);
    const error = new Error('读取本地笔记失败');
    error.cause = e;
    throw error;
  }
}

// AsyncStorage 没有跨 key 的原生事务：先写入恢复日志，再一次提交目标状态。
// 若应用在两步之间退出，下一次启动会根据日志完成同一份目标状态，避免半恢复。
export async function restoreImportedData(notes, themeState) {
  const nextNotes = JSON.stringify(Array.isArray(notes) ? notes : []);
  const nextThemeState = JSON.stringify(migrateThemeState(themeState));
  let journalWritten = false;
  try {
    await AsyncStorage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify({ nextNotes, nextThemeState }));
    journalWritten = true;
    await AsyncStorage.multiSet([[NOTES_KEY, nextNotes], [THEMES_KEY, nextThemeState]]);
    await AsyncStorage.removeItem(RESTORE_JOURNAL_KEY);
  } catch (e) {
    const error = new Error('恢复本地笔记失败；下次启动会自动完成或报出恢复状态。');
    error.cause = e;
    error.code = journalWritten ? 'restore_pending' : 'restore_failed';
    throw error;
  }
}

export async function saveNotes(notes) {
  try {
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn('saveNotes failed', e);
    const error = new Error('保存本地笔记失败');
    error.cause = e;
    throw error;
  }
}

export async function loadThemeState() {
  try {
    const raw = await AsyncStorage.getItem(THEMES_KEY);
    if (!raw) return migrateThemeState();
    const parsed = JSON.parse(raw);
    return migrateThemeState(parsed);
  } catch (e) {
    console.warn('loadThemeState failed', e);
    const error = new Error('读取本地主题失败');
    error.cause = e;
    throw error;
  }
}

export async function saveThemeState(state) {
  try {
    await AsyncStorage.setItem(
      THEMES_KEY,
      JSON.stringify(migrateThemeState(state))
    );
  } catch (e) {
    console.warn('saveThemeState failed', e);
    const error = new Error('保存本地主题失败');
    error.cause = e;
    throw error;
  }
}

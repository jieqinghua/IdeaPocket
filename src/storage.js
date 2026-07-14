// 本地优先、单用户：所有笔记就是一坨 JSON，存在设备里。够用到几千条。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWelcomeNotes } from './noteActions';

const NOTES_KEY = 'ideapocket.notes.v1';
const META_KEY = 'ideapocket.meta.v1';
const THEMES_KEY = 'ideapocket.themes.v1';

export async function loadNotes() {
  try {
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
    if (!raw) return { themes: [], lastAnalyzedFingerprint: '', lastAnalysis: null, noteProfiles: {} };
    const parsed = JSON.parse(raw);
    const themes = (Array.isArray(parsed?.themes) ? parsed.themes : []).map((theme) => ({
      ...theme,
      status: theme.status || (theme.dismissed ? 'dismissed' : 'current'),
    }));
    return {
      themes,
      lastAnalyzedFingerprint: String(parsed?.lastAnalyzedFingerprint || parsed?.lastInputFingerprint || ''),
      lastAnalysis: parsed?.lastAnalysis || null,
      noteProfiles: parsed?.noteProfiles && typeof parsed.noteProfiles === 'object' ? parsed.noteProfiles : {},
    };
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
      JSON.stringify({
        version: 2,
        themes: Array.isArray(state?.themes) ? state.themes : [],
        lastAnalyzedFingerprint: String(state?.lastAnalyzedFingerprint || ''),
        lastAnalysis: state?.lastAnalysis || null,
        noteProfiles: state?.noteProfiles && typeof state.noteProfiles === 'object' ? state.noteProfiles : {},
      })
    );
  } catch (e) {
    console.warn('saveThemeState failed', e);
    const error = new Error('保存本地主题失败');
    error.cause = e;
    throw error;
  }
}

export async function loadMeta() {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function saveMeta(meta) {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('saveMeta failed', e);
  }
}

// 状态 + 动作。加载完成前禁止写入，所有保存按顺序落盘。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSerialQueue } from './lib/serialQueue';
import {
  aggregateThemes as generateThemes,
  THEME_ANALYSIS_VERSION,
} from './lib/themeAggregation';
import {
  addNote,
  applyTidyToNote,
  clearDemoNotes,
  deleteNote,
  editNote,
  removeNoteImage,
  plantNote,
  seedDemoNotes,
  setNoteImage,
  waterNote,
} from './noteActions';
import { chooseAndStoreNoteImage, removeStoredNoteImage, restoreBackupImage } from './noteImages';
import { loadNotes, loadThemeState, restoreImportedData, saveNotes, saveThemeState } from './storage';
import {
  dissolveTheme,
  noteFingerprint,
  reconcileGeneratedThemes,
  retainTheme,
  removeNoteFromTheme,
  removeDeletedNoteFromThemes,
  renameTheme,
} from './themeActions';
import { exportNotesBackup } from './backupFiles';
import { buildImportState, parseBackupJson, previewBackup } from './lib/backupImport';

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [themes, setThemes] = useState([]);
  const [lastAnalyzedFingerprint, setLastAnalyzedFingerprint] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [noteProfiles, setNoteProfiles] = useState({});
  const [themeStatus, setThemeStatus] = useState('idle');
  const [themeError, setThemeError] = useState('');
  const [themeNotice, setThemeNotice] = useState('');
  const [themeSource, setThemeSource] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [backupStatus, setBackupStatus] = useState('idle');
  const [importStatus, setImportStatus] = useState('idle');
  const aliveRef = useRef(true);
  const saveQueueRef = useRef(null);
  const themeSaveQueueRef = useRef(null);
  const themeControllerRef = useRef(null);
  const activeNotes = useMemo(() => notes.filter((note) => !note.deletedAt), [notes]);
  const activeNotesRef = useRef(activeNotes);
  activeNotesRef.current = activeNotes;
  const currentThemeFingerprint = useMemo(
    () => `${THEME_ANALYSIS_VERSION}:${noteFingerprint(activeNotes)}`,
    [activeNotes]
  );

  if (!saveQueueRef.current) {
    saveQueueRef.current = createSerialQueue(saveNotes, () => {
      if (aliveRef.current) setSaveError('保存失败，最近的改动可能尚未落盘');
    });
  }

  if (!themeSaveQueueRef.current) {
    themeSaveQueueRef.current = createSerialQueue(saveThemeState, () => {
      if (aliveRef.current) setSaveError('保存失败，最近的主题改动可能尚未落盘');
    });
  }

  const hydrate = useCallback(async () => {
    setReady(false);
    setLoadError('');
    try {
      // loadNotes 会先完成可能中断的恢复事务，主题必须随后读取，避免得到旧状态。
      const loaded = await loadNotes();
      const themeState = await loadThemeState();
      if (!aliveRef.current) return;
      setNotes(loaded);
      setThemes(themeState.themes);
      setLastAnalyzedFingerprint(themeState.lastAnalyzedFingerprint);
      setLastAnalysis(themeState.lastAnalysis);
      setNoteProfiles(themeState.noteProfiles);
      setThemeSource(themeState.lastAnalysis?.source || '');
      setReady(true);
    } catch (error) {
      if (!aliveRef.current) return;
      setLoadError(error?.message || '读取本地笔记失败');
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    hydrate();
    return () => {
      aliveRef.current = false;
      themeControllerRef.current?.abort();
    };
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    setSaveError('');
    saveQueueRef.current.enqueue(notes);
  }, [notes, ready]);

  useEffect(() => {
    if (!ready) return;
    setSaveError('');
    themeSaveQueueRef.current.enqueue({ themes, lastAnalyzedFingerprint, lastAnalysis, noteProfiles });
  }, [themes, lastAnalyzedFingerprint, lastAnalysis, noteProfiles, ready]);

  const analyzeThemes = useCallback(
    async () => {
      if (!ready || activeNotes.length < 3) return false;
      const fingerprint = `${THEME_ANALYSIS_VERSION}:${noteFingerprint(activeNotes)}`;
      const startedAt = Date.now();
      const analysisRunId = `run-${startedAt.toString(36)}`;

      themeControllerRef.current?.abort();
      const controller = new AbortController();
      themeControllerRef.current = controller;
      setThemeStatus('running');
      setThemeError('');
      setThemeNotice('');
      try {
        const result = await generateThemes(activeNotes, {
          signal: controller.signal,
          analysisRunId,
          noteProfiles,
          timeoutMs: 60_000,
        });
        if (!aliveRef.current || controller.signal.aborted) return false;
        const latestFingerprint = `${THEME_ANALYSIS_VERSION}:${noteFingerprint(activeNotesRef.current)}`;
        if (latestFingerprint !== fingerprint) {
          setThemeStatus('error');
          setThemeError('分析期间笔记发生了变化，请重新分析');
          return false;
        }
        if (result.themes.length) {
          setThemes((current) => reconcileGeneratedThemes(current, result.themes, Date.now(), { analysisRunId }));
        }
        setNoteProfiles(result.noteProfiles || {});
        setLastAnalyzedFingerprint(fingerprint);
        setLastAnalysis({
          runId: analysisRunId,
          generatedAt: Date.now(),
          noteCount: activeNotes.length,
          source: result.stub ? 'local' : 'ai',
          mode: result.mode,
          inputTokens: result.usage?.inputTokens || 0,
          outputTokens: result.usage?.outputTokens || 0,
        });
        setThemeSource(result.stub ? 'local' : 'ai');
        setThemeStatus('ready');
        if (!result.themes.length) setThemeNotice('未发现新的聚合主题');
        return true;
      } catch (error) {
        if (error?.code === 'aborted') return false;
        if (!aliveRef.current) return false;
        setThemeStatus('error');
        setThemeError(error?.message || '主题整理失败，请稍后重试');
        return false;
      } finally {
        if (themeControllerRef.current === controller) themeControllerRef.current = null;
      }
    },
    [activeNotes, noteProfiles, ready]
  );

  const add = useCallback(
    (text, source = 'text') => {
      if (!ready) return false;
      setNotes((current) => addNote(current, text, source));
      return true;
    },
    [ready]
  );

  const water = useCallback(
    (id) => {
      if (!ready) return false;
      setNotes((current) => waterNote(current, id));
      return true;
    },
    [ready]
  );

  const plant = useCallback(
    (id) => {
      if (!ready) return false;
      setNotes((current) => plantNote(current, id));
      return true;
    },
    [ready]
  );

  const edit = useCallback(
    (id, text) => {
      if (!ready) return false;
      setNotes((current) => editNote(current, id, text));
      return true;
    },
    [ready]
  );

  const applyTidy = useCallback(
    (id, tidiedText) => {
      if (!ready) return false;
      setNotes((current) => applyTidyToNote(current, id, tidiedText));
      return true;
    },
    [ready]
  );

  const attachImage = useCallback(
    async (id, source) => {
      if (!ready) return false;
      const previousImage = notes.find((note) => note.id === id)?.image || null;
      const image = await chooseAndStoreNoteImage(id, source);
      if (!image) return false;
      setNotes((current) => setNoteImage(current, id, image));
      if (previousImage?.uri) {
        try {
          removeStoredNoteImage(previousImage);
        } catch (error) {
          console.warn('could not remove replaced note image', error);
        }
      }
      return true;
    },
    [notes, ready]
  );

  const removeImage = useCallback(
    async (id) => {
      if (!ready) return false;
      const image = notes.find((note) => note.id === id)?.image;
      if (!image) return false;
      removeStoredNoteImage(image);
      setNotes((current) => removeNoteImage(current, id));
      return true;
    },
    [notes, ready]
  );

  const remove = useCallback(
    (id) => {
      if (!ready) return false;
      setNotes((current) => deleteNote(current, id));
      setThemes((current) => removeDeletedNoteFromThemes(current, id));
      return true;
    },
    [ready]
  );

  const seedDemo = useCallback(() => {
    if (!ready) return false;
    setNotes((current) => seedDemoNotes(current));
    return true;
  }, [ready]);

  const clearDemo = useCallback(() => {
    if (!ready) return false;
    setNotes((current) => clearDemoNotes(current));
    return true;
  }, [ready]);

  const updateThemeTitle = useCallback(
    (id, title) => {
      if (!ready) return false;
      setThemes((current) => renameTheme(current, id, title));
      return true;
    },
    [ready]
  );

  const removeThemeNote = useCallback(
    (themeId, noteId) => {
      if (!ready) return false;
      setThemes((current) => removeNoteFromTheme(current, themeId, noteId));
      return true;
    },
    [ready]
  );

  const dismissTheme = useCallback(
    (id) => {
      if (!ready) return false;
      setThemes((current) => dissolveTheme(current, id));
      return true;
    },
    [ready]
  );

  const keepTheme = useCallback(
    (id) => {
      if (!ready) return false;
      setThemes((current) => retainTheme(current, id));
      return true;
    },
    [ready]
  );

  const exportBackup = useCallback(async () => {
    if (!ready) throw new Error('本地笔记还没有读取完成');
    setBackupStatus('running');
    try {
      const result = await exportNotesBackup(notes, themes);
      if (aliveRef.current) setBackupStatus('ready');
      return result;
    } catch (error) {
      if (aliveRef.current) setBackupStatus('error');
      throw error;
    }
  }, [notes, ready, themes]);

  const previewImport = useCallback((contents) => previewBackup(parseBackupJson(contents)), []);

  const importBackup = useCallback(async (contents, mode, imageDirectory) => {
    if (!ready) throw new Error('本地笔记还没有读取完成');
    const payload = parseBackupJson(contents);
    const next = buildImportState(notes, payload, mode);
    if (next.images.length && !imageDirectory) throw new Error('请选择包含 images 文件夹的完整备份目录。');
    setImportStatus('running');
    const restoredImages = [];
    try {
      const safetyBackup = await exportNotesBackup(notes, themes, { preferAppDirectory: true });
      for (const item of next.images) {
        const image = restoreBackupImage(imageDirectory, item.image, item.note.id);
        item.note.image = image;
        restoredImages.push(image);
      }
      await restoreImportedData(next.notes, { themes: next.themes });
      if (!aliveRef.current) return { safetyBackup, imported: 0 };
      setNotes(next.notes);
      setThemes(next.themes);
      setLastAnalyzedFingerprint('');
      setLastAnalysis(null);
      setNoteProfiles({});
      setThemeSource('');
      setThemeStatus('idle');
      setImportStatus('ready');
      return { safetyBackup, imported: payload.notes.length };
    } catch (error) {
      restoredImages.forEach((image) => {
        try { removeStoredNoteImage(image); } catch (cleanupError) { console.warn('could not clean failed import image', cleanupError); }
      });
      if (aliveRef.current) setImportStatus('error');
      throw error;
    }
  }, [notes, ready, themes]);

  return {
    notes: activeNotes,
    themes,
    themeStatus,
    themeError,
    themeNotice,
    themeSource,
    themeIsStale: currentThemeFingerprint !== lastAnalyzedFingerprint,
    lastAnalysis,
    ready,
    loadError,
    saveError,
    backupStatus,
    importStatus,
    retryLoad: hydrate,
    clearSaveError: () => setSaveError(''),
    exportBackup,
    previewImport,
    importBackup,
    add,
    water,
    plant,
    edit,
    attachImage,
    removeImage,
    applyTidy,
    remove,
    seedDemo,
    clearDemo,
    analyzeThemes,
    refreshThemes: analyzeThemes,
    retainTheme: keepTheme,
    updateThemeTitle,
    removeThemeNote,
    dismissTheme,
  };
}

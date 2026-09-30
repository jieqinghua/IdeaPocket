// 笔记先保存；自动主题任务只在前台处理，结果与人工规则作为一份状态提交。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createSerialQueue } from './lib/serialQueue';
import { analyzeThemeState, pendingThemeNoteIds, pendingThemeSummaryIds, summaryInputHash } from './lib/themeAnalysis';
import { changeTheme, createManualTheme, editThemeField, invalidateNoteThemes, migrateThemeState,
  setThemeMembers, setThemeMembership, textHash, undoThemeChange } from './themeModel';
import { addNote, applyTidyToNote, clearDemoNotes, deleteNote, editNote, removeNoteImage,
  plantNote, seedDemoNotes, setNoteImage, waterNote } from './noteActions';
import { chooseAndStoreNoteImage, removeStoredNoteImage, restoreBackupImage } from './noteImages';
import { loadNotes, loadThemeState, restoreImportedData, saveNotes, saveThemeState } from './storage';
import { exportNotesBackup } from './backupFiles';
import { buildImportState, parseBackupJson, previewBackup } from './lib/backupImport';
import { prepareUpdateSafety } from './lib/updateSafety';

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [themeState, setThemeState] = useState(() => migrateThemeState());
  const [themeStatus, setThemeStatus] = useState('idle');
  const [themeError, setThemeError] = useState('');
  const [themeNotice, setThemeNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [backupStatus, setBackupStatus] = useState('idle');
  const [importStatus, setImportStatus] = useState('idle');
  const [foregroundEpoch, setForegroundEpoch] = useState(0);
  const aliveRef = useRef(true);
  const importingRef = useRef(false);
  const importEpochRef = useRef(0);
  const previousNotesRef = useRef([]);
  const appActiveRef = useRef(AppState.currentState == null || AppState.currentState === 'active');
  const saveQueueRef = useRef(null);
  const themeSaveQueueRef = useRef(null);
  const noteSaveFailureRef = useRef(null);
  const themeSaveFailureRef = useRef(null);
  const themeControllerRef = useRef(null);
  const lastAttemptRef = useRef('');
  const notesRef = useRef(notes); notesRef.current = notes;
  const stateRef = useRef(themeState); stateRef.current = themeState;
  const activeNotes = useMemo(() => notes.filter((note) => !note.deletedAt), [notes]);
  const analysisNotes = useMemo(() => activeNotes.filter((note) => !note.welcome && !note.demo), [activeNotes]);
  const analysisRef = useRef(analysisNotes); analysisRef.current = analysisNotes;
  const contentFingerprint = useMemo(() => textHash(analysisNotes.map((note) => `${note.id}:${textHash(note.text)}`).sort().join('|')), [analysisNotes]);
  const pendingIds = useMemo(() => [...new Set([...(themeState.reviewQueue || []), ...pendingThemeNoteIds(analysisNotes, themeState)])], [analysisNotes, themeState.processed, themeState.reviewQueue]);

  const pendingSummaryIds = useMemo(() => pendingThemeSummaryIds(analysisNotes, themeState), [analysisNotes, themeState]);

  if (!saveQueueRef.current) saveQueueRef.current = createSerialQueue(saveNotes,
    (error) => { noteSaveFailureRef.current = error; if (aliveRef.current) setSaveError('保存失败，最近的改动可能尚未落盘'); },
    () => { noteSaveFailureRef.current = null; });
  if (!themeSaveQueueRef.current) themeSaveQueueRef.current = createSerialQueue(saveThemeState,
    (error) => { themeSaveFailureRef.current = error; if (aliveRef.current) setSaveError('保存失败，最近的主题改动可能尚未落盘'); },
    () => { themeSaveFailureRef.current = null; });

  const hydrate = useCallback(async () => {
    setReady(false); setLoadError('');
    try {
      const loaded = await loadNotes();
      const loadedThemes = await loadThemeState();
      if (!aliveRef.current) return;
      setNotes(loaded); setThemeState(loadedThemes); setReady(true);
    } catch (error) { if (aliveRef.current) setLoadError(error?.message || '读取本地笔记失败'); }
  }, []);
  useEffect(() => {
    aliveRef.current = true; hydrate();
    const subscription = AppState.addEventListener('change', (value) => {
      appActiveRef.current = value === 'active';
      if (value !== 'active') themeControllerRef.current?.controller.abort();
      else { lastAttemptRef.current = ''; setForegroundEpoch((value) => value + 1); }
    });
    return () => { aliveRef.current = false; themeControllerRef.current?.controller.abort(); subscription.remove(); };
  }, [hydrate]);
  useEffect(() => {
    if (!ready) return;
    saveQueueRef.current.enqueue(notes);
    const previous = previousNotesRef.current;
    setThemeState((current) => invalidateNoteThemes(current, notes, previous));
    previousNotesRef.current = notes;
  }, [notes, ready]);
  useEffect(() => {
    if (ready) themeSaveQueueRef.current.enqueue(themeState);
  }, [themeState, ready]);
  useEffect(() => {
    const job = themeControllerRef.current;
    if (job && (job.fingerprint !== contentFingerprint || job.revision !== themeState.revision)) job.controller.abort();
  }, [contentFingerprint, themeState.revision]);

  const runThemeAnalysis = useCallback(async (force = false, onlySummaryIds) => {
    if (!ready || importingRef.current || !appActiveRef.current || themeControllerRef.current) return false;
    const base = stateRef.current;
    const source = analysisRef.current;
    const fingerprint = textHash(source.map((note) => `${note.id}:${textHash(note.text)}`).sort().join('|'));
    const controller = new AbortController();
    const job = { controller, revision: base.revision, fingerprint };
    themeControllerRef.current = job;
    lastAttemptRef.current = `${fingerprint}:${base.revision}`;
    setThemeStatus('running'); setThemeError(''); setThemeNotice('');
    try {
      const result = await analyzeThemeState(source, base, { signal: controller.signal, force, onlySummaryIds });
      if (!aliveRef.current || controller.signal.aborted || stateRef.current.revision !== base.revision ||
        fingerprint !== textHash(analysisRef.current.map((note) => `${note.id}:${textHash(note.text)}`).sort().join('|'))) return false;
      setThemeState(result); setThemeStatus('ready');
      const report = result.lastAnalysis;
      setThemeNotice(`本轮新增 ${report.newCount} 个主题，更新 ${report.updatedCount} 个；${report.remainingCount || report.pendingSummaryCount ? `还有 ${report.remainingCount} 条笔记、${report.pendingSummaryCount} 份摘要待处理` : '整理已完成'}。`);
      return true;
    } catch (error) {
      if (aliveRef.current && error?.code !== 'aborted') {
        setThemeStatus('error'); setThemeError(error?.message || '主题分析失败，请重试');
      }
      return false;
    } finally {
      if (themeControllerRef.current === job) {
        themeControllerRef.current = null;
        if (aliveRef.current && controller.signal.aborted) { setThemeStatus('idle'); setThemeNotice('本轮已暂停，未完成的笔记可以继续处理'); }
      }
    }
  }, [ready]);

  useEffect(() => {
    if (!ready || (!themeState.settings.autoEnabled && !themeState.reviewQueue.length && !themeState.continueRequested) || themeStatus === 'running' || (!pendingIds.length && !pendingSummaryIds.length) || !appActiveRef.current) return;
    if (lastAttemptRef.current === `${contentFingerprint}:${themeState.revision}`) return;
    const timer = setTimeout(() => runThemeAnalysis(false), 1500);
    return () => clearTimeout(timer);
  }, [ready, themeState.settings.autoEnabled, themeState.reviewQueue.length, themeState.continueRequested, themeState.revision, contentFingerprint, pendingIds.length, pendingSummaryIds.length, themeStatus, foregroundEpoch, runThemeAnalysis]);

  const updateTheme = useCallback((id, patch, reason, options) => {
    if (!ready || importingRef.current) return false;
    setThemeState((current) => changeTheme(current, id, patch, notesRef.current, reason, options));
    setThemeNotice(''); return true;
  }, [ready]);
  const updateThemeField = useCallback((id, field, value) => {
    if (!ready || importingRef.current) return false;
    setThemeState((current) => editThemeField(current, id, field, value, notesRef.current));
    setThemeNotice(''); return true;
  }, [ready]);
  const changeMembership = useCallback((id, noteId, include) => {
    if (!ready || importingRef.current) return false;
    setThemeState((current) => setThemeMembership(current, id, noteId, include, notesRef.current));
    setThemeNotice(''); return true;
  }, [ready]);
  const setAutoThemes = useCallback((enabled) => {
    if (!ready || importingRef.current) return false;
    if (!enabled) themeControllerRef.current?.controller.abort();
    lastAttemptRef.current = '';
    setThemeState((current) => ({ ...current, revision: current.revision + 1,
      reviewQueue: enabled ? current.reviewQueue : [], continueRequested: enabled && current.continueRequested,
      settings: { ...current.settings, autoEnabled: !!enabled } }));
    setThemeError(''); setThemeNotice(enabled ? '将自动整理新增或修改的笔记' : '自动整理已暂停，仍可手动检查');
    return true;
  }, [ready]);
  const add = useCallback(
    (text, source = 'text') => {
      if (!ready || importingRef.current) return false;
      setNotes((current) => addNote(current, text, source));
      return true;
    },
    [ready]
  );

  const water = useCallback(
    (id) => {
      if (!ready || importingRef.current) return false;
      setNotes((current) => waterNote(current, id));
      return true;
    },
    [ready]
  );

  const plant = useCallback(
    (id) => {
      if (!ready || importingRef.current) return false;
      setNotes((current) => plantNote(current, id));
      return true;
    },
    [ready]
  );

  const edit = useCallback(
    (id, text) => {
      if (!ready || importingRef.current) return false;
      setNotes((current) => editNote(current, id, text));
      return true;
    },
    [ready]
  );

  const applyTidy = useCallback(
    (id, tidiedText) => {
      if (!ready || importingRef.current) return false;
      setNotes((current) => applyTidyToNote(current, id, tidiedText));
      return true;
    },
    [ready]
  );

  const attachImage = useCallback(
    async (id, source) => {
      if (!ready || importingRef.current) return false;
      const importEpoch = importEpochRef.current;
      const previousImage = notes.find((note) => note.id === id)?.image || null;
      const image = await chooseAndStoreNoteImage(id, source);
      if (!image) return false;
      if (!aliveRef.current || importingRef.current || importEpoch !== importEpochRef.current || !notesRef.current.some((note) => note.id === id && !note.deletedAt)) { removeStoredNoteImage(image); return false; }
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
      if (!ready || importingRef.current) return false;
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
      if (!ready || importingRef.current) return false;
      setNotes((current) => deleteNote(current, id));
      return true;
    },
    [ready]
  );

  const seedDemo = useCallback(() => {
    if (!ready || importingRef.current) return false;
    setNotes((current) => seedDemoNotes(current));
    return true;
  }, [ready]);

  const clearDemo = useCallback(() => {
    if (!ready || importingRef.current) return false;
    setNotes((current) => clearDemoNotes(current));
    return true;
  }, [ready]);


  const exportBackup = useCallback(async () => {
    if (!ready || importingRef.current) throw new Error('本地数据尚不可导出');
    setBackupStatus('running');
    try {
      await Promise.all([saveQueueRef.current.idle(), themeSaveQueueRef.current.idle()]);
      const result = await exportNotesBackup(notesRef.current, stateRef.current.themes, { themeState: stateRef.current });
      if (aliveRef.current) setBackupStatus('ready');
      return result;
    } catch (error) { if (aliveRef.current) setBackupStatus('error'); throw error; }
  }, [ready]);
  const previewImport = useCallback((contents) => previewBackup(parseBackupJson(contents)), []);
  const importBackup = useCallback(async (contents, mode, imageDirectory) => {
    if (!ready || importingRef.current) throw new Error('本地数据尚不可导入');
    const payload = parseBackupJson(contents);
    importingRef.current = true; importEpochRef.current += 1; themeControllerRef.current?.controller.abort(); setImportStatus('running');
    const restoredImages = []; let commitPending = false;
    try {
      await Promise.all([saveQueueRef.current.idle(), themeSaveQueueRef.current.idle()]);
      if (noteSaveFailureRef.current || themeSaveFailureRef.current) throw new Error('请先解决当前保存失败，再导入备份');
      const next = buildImportState(notesRef.current, payload, mode, Date.now(), stateRef.current);
      if (next.images.length && !imageDirectory) throw new Error('请选择包含 images 文件夹的完整备份目录。');
      const safetyBackup = await exportNotesBackup(notesRef.current, stateRef.current.themes,
        { preferAppDirectory: true, themeState: stateRef.current });
      for (const item of next.images) {
        const image = restoreBackupImage(imageDirectory, item.image, item.note.id);
        item.note.image = image; restoredImages.push(image);
      }
      try { await restoreImportedData(next.notes, next.themeState); }
      catch (error) { commitPending = error.code === 'restore_pending'; throw error; }
      if (!aliveRef.current) return { safetyBackup, imported: 0 };
      setNotes(next.notes); setThemeState(next.themeState); setThemeStatus('idle');
      setThemeError(''); setThemeNotice(''); lastAttemptRef.current = ''; setImportStatus('ready');
      return { safetyBackup, imported: payload.notes.length, themes: next.themes.length };
    } catch (error) {
      if (!commitPending) restoredImages.forEach((image) => { try { removeStoredNoteImage(image); } catch {} });
      else { setReady(false); setLoadError('恢复尚未完成，请重试读取以完成恢复事务'); }
      if (aliveRef.current) setImportStatus('error'); throw error;
    } finally { importingRef.current = false; }
  }, [ready]);
  const prepareForUpdate = useCallback(async () => prepareUpdateSafety({
    ready: ready && !importingRef.current, noteQueue: saveQueueRef.current, themeQueue: themeSaveQueueRef.current,
    getSaveFailure: () => noteSaveFailureRef.current || themeSaveFailureRef.current,
    createBackup: () => exportNotesBackup(notesRef.current, stateRef.current.themes,
      { preferAppDirectory: true, themeState: stateRef.current }),
  }), [ready]);

  return {
    notes: activeNotes, themes: themeState.themes, themeSnapshots: themeState.snapshots, themeRules: themeState.rules,
    themeStatus, themeError, themeNotice, themeSource: themeState.lastAnalysis?.source || '',
    themeIsStale: pendingIds.length > 0, pendingThemeCount: pendingIds.length, pendingThemeSummaryCount: pendingSummaryIds.length,
    analysisNoteCount: analysisNotes.length, autoThemesEnabled: themeState.settings.autoEnabled,
    lastAnalysis: themeState.lastAnalysis, themeUndoActions: themeState.undoActions,
    ready, loadError, saveError, backupStatus, importStatus, retryLoad: hydrate,
    clearSaveError: () => setSaveError(''), exportBackup, previewImport, importBackup, prepareForUpdate,
    add, water, plant, edit, attachImage, removeImage, applyTidy, remove, seedDemo, clearDemo,
    analyzeThemes: () => runThemeAnalysis(true), continueThemeAnalysis: () => { lastAttemptRef.current = ''; return runThemeAnalysis(false); },
    refreshThemes: () => runThemeAnalysis(true), refreshThemeSummary: (id) => runThemeAnalysis(false, [id]),
    setAutoThemes, cancelThemeAnalysis: () => setAutoThemes(false),
    retainTheme: (id) => {
      const current = stateRef.current.themes.find((theme) => theme.id === id);
      return updateTheme(id, { management: 'user', maturity: 'established', status: 'retained', dismissed: false,
        noteIds: (current?.noteIds || []).filter((noteId) => notesRef.current.some((note) => note.id === noteId && !note.deletedAt)),
        summaryStale: current?.summaryStale || current?.status === 'history', summaryCandidate: null }, '保留主题');
    },
    updateThemeTitle: (id, value) => updateThemeField(id, 'title', value),
    updateThemeScope: (id, value) => updateThemeField(id, 'scope', value),
    updateThemeSummary: (id, value) => updateThemeField(id, 'summary', value),
    removeThemeNote: (id, noteId) => changeMembership(id, noteId, false),
    addThemeNote: (id, noteId) => changeMembership(id, noteId, true),
    addThemeNotes: (id, ids) => { if (ready && !importingRef.current) setThemeState((current) => setThemeMembers(current, id, ids, true, notesRef.current)); },
    dismissTheme: (id) => updateTheme(id, { status: 'dismissed', dismissed: true, suppressed: false }, '隐藏主题'),
    restoreTheme: (id) => {
      const current = stateRef.current.themes.find((theme) => theme.id === id);
      return updateTheme(id, { status: current?.management === 'user' ? 'retained' : current?.maturity === 'candidate' ? 'candidate' : 'current', dismissed: false, suppressed: false, summaryStale: true, summaryCandidate: null,
        noteIds: (current?.noteIds || []).filter((noteId) => notesRef.current.some((note) => note.id === noteId && !note.deletedAt)) }, '恢复主题');
    },
    suppressTheme: (id, enabled) => updateTheme(id, { suppressed: !!enabled }, enabled ? '不再建议此方向' : '允许建议此方向'),
    setThemeAutoJoin: (id, enabled) => updateTheme(id, { management: 'user', status: 'retained', maturity: 'established', autoJoin: !!enabled }, enabled ? '开启自动加入' : '关闭自动加入'),
    undoTheme: (id) => { if (ready && !importingRef.current) setThemeState((current) => undoThemeChange(current, id, notesRef.current)); },
    createTheme: (title, scope, ids) => { if (ready && !importingRef.current) setThemeState((current) => createManualTheme(current, title, scope, ids, notesRef.current)); },
    adoptThemeSummary: (id) => {
      const theme = stateRef.current.themes.find((item) => item.id === id); const candidate = theme?.summaryCandidate;
      if (!candidate || candidate.inputHash !== summaryInputHash(theme, analysisRef.current)) { setThemeNotice('来源已变化，请重新生成摘要候选'); return false; }
      return updateTheme(id, { summary: candidate.text, summarySource: candidate.source, summaryMode: 'manual', summaryStale: false, summaryCandidate: null }, '采用摘要候选');
    },
  };
}

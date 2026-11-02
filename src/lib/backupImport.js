import { migrateThemeState, normalizeRules, textHash, uniqueIds } from '../themeModel';

const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2, 3, 4]);

const asTimestamp = (value, fallback) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
};

const cleanText = (value) => String(value || '').trim();

export function parseBackupJson(contents) {
  let payload;
  try {
    payload = JSON.parse(contents);
  } catch {
    throw new Error('所选文件不是有效的 JSON 备份。');
  }
  if (!payload || payload.app !== 'IdeaPocket' || !SUPPORTED_BACKUP_VERSIONS.has(Number(payload.backupVersion))) {
    throw new Error('这不是受支持的 IdeaPocket 备份文件。');
  }
  if (!Array.isArray(payload.notes)) throw new Error('备份文件中没有可导入的笔记。');
  if ((payload.themes && !Array.isArray(payload.themes)) || (payload.themeState && !Array.isArray(payload.themeState.themes))) throw new Error('备份主题格式无效。');
  return payload;
}

export function previewBackup(payload) {
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  return {
    noteCount: notes.length,
    imageCount: notes.filter((note) => note?.image?.fileName).length,
    themeCount: (payload?.themeState?.themes || payload?.themes || []).length,
    exportedAt: payload?.exportedAt || '',
  };
}

const makeImportedId = (index, now) => `import-${now.toString(36)}-${index.toString(36)}`;

export function normalizeImportedNotes(payload, now = Date.now()) {
  const usedIds = new Set();
  return payload.notes.map((rawNote, index) => {
    const text = typeof rawNote?.text === 'string' ? rawNote.text : '';
    if (!text.trim()) throw new Error(`第 ${index + 1} 条笔记内容为空，无法安全导入。`);
    let id = cleanText(rawNote?.id) || makeImportedId(index, now);
    while (usedIds.has(id)) id = makeImportedId(index + usedIds.size, now);
    usedIds.add(id);
    const createdAt = asTimestamp(rawNote?.createdAt, now + index);
    const updatedAt = asTimestamp(rawNote?.updatedAt, createdAt);
    return {
      id,
      text,
      rawText: typeof rawNote?.rawText === 'string' ? rawNote.rawText : '',
      source: cleanText(rawNote?.source) || 'text',
      strength: Number(rawNote?.strength) || 1,
      createdAt,
      lastTouched: updatedAt,
      ...(asTimestamp(rawNote?.deletedAt, 0) ? { deletedAt: asTimestamp(rawNote.deletedAt, 0) } : {}),
    };
  });
}

const makeUniqueId = (id, usedIds, now, index) => {
  let nextId = id || makeImportedId(index, now);
  let suffix = 1;
  while (usedIds.has(nextId)) {
    nextId = `${id || makeImportedId(index, now)}-imported-${suffix}`;
    suffix += 1;
  }
  usedIds.add(nextId);
  return nextId;
};

export function buildImportState(currentNotes, payload, mode, now = Date.now(), currentThemeState = {}) {
  const importedNotes = normalizeImportedNotes(payload, now);
  const images = (Array.isArray(payload.notes) ? payload.notes : []).map((note, index) => ({
    note: importedNotes[index],
    image: note?.image || null,
  })).filter((item) => item.image?.fileName);
  if (!['overwrite', 'merge'].includes(mode)) throw new Error('请选择合并或覆盖导入。');
  const existingNotes = Array.isArray(currentNotes) ? currentNotes : [];
  const usedIds = new Set(existingNotes.map((note) => note.id));
  const mergedImported = mode === 'overwrite' ? importedNotes : importedNotes.map((note, index) => ({
    ...note,
    id: makeUniqueId(note.id, usedIds, now, index),
  }));
  const noteIds = new Map();
  payload.notes.forEach((note, index) => {
    if (noteIds.has(note.id) && (payload.themes?.length || payload.themeState?.themes?.length)) throw new Error('备份含重复笔记 ID，无法安全恢复主题关系。');
    noteIds.set(note.id, mergedImported[index].id);
  });
  const current = migrateThemeState(currentThemeState);
  const imported = migrateThemeState(payload.themeState || { themes: payload.themes || [] });
  const usedThemes = new Set(mode === 'merge' ? current.themes.map((theme) => theme.id) : []);
  const themeIds = new Map();
  imported.themes.forEach((theme, index) => {
    if (themeIds.has(theme.id)) throw new Error('备份含重复主题 ID，无法安全恢复。');
    themeIds.set(theme.id, makeUniqueId(theme.id, usedThemes, now, index));
  });
  // 历史来源可能已不在当前笔记中，仍需保留独立身份，避免错误关联到本地同 ID 笔记。
  const reservedNoteIds = new Set([...usedIds, ...mergedImported.map((note) => note.id)]);
  const reserveSource = (id) => { if (typeof id === 'string' && !noteIds.has(id)) noteIds.set(id, mode === 'merge' ? makeUniqueId(id, reservedNoteIds, now, noteIds.size) : id); };
  Object.values(imported.snapshots).forEach((source) => reserveSource(source?.id));
  Object.values(imported.rules).forEach((rule) => [...rule.includedNoteIds, ...rule.excludedNoteIds].forEach(reserveSource));
  const snapshots = {};
  const snapshotIds = new Map();
  Object.entries(imported.snapshots).forEach(([key, snapshot]) => {
    if (!snapshot || !noteIds.has(snapshot.id)) return;
    const id = noteIds.get(snapshot.id);
    const nextKey = `${id}:${textHash(`${snapshot.text || ''}\u0000${snapshot.rawText || ''}`, true)}`;
    snapshotIds.set(key, nextKey); snapshots[nextKey] = { ...snapshot, id };
  });
  const mapIds = (ids) => uniqueIds(ids).map((id) => noteIds.get(id)).filter(Boolean);
  const mapRecord = (record = {}) => Object.fromEntries(Object.entries(record).filter(([id]) => noteIds.has(id)).map(([id, value]) => [noteIds.get(id), value]));
  const mapRules = (rule) => {
    const value = normalizeRules(rule);
    return { includedNoteIds: mapIds(value.includedNoteIds), excludedNoteIds: mapIds(value.excludedNoteIds) };
  };
  const mapTheme = (theme) => ({ ...theme, id: themeIds.get(theme.id) || theme.id,
    noteIds: mapIds(theme.noteIds), excludedNoteIds: mapIds(theme.excludedNoteIds),
    sourceRefs: Object.fromEntries(Object.entries(theme.sourceRefs || {}).filter(([id, key]) => noteIds.has(id) && snapshotIds.has(key)).map(([id, key]) => [noteIds.get(id), snapshotIds.get(key)])),
    relations: mapRecord(theme.relations), suggestions: mapRecord(theme.suggestions),
    revisions: (theme.revisions || []).map((version) => ({ ...mapTheme({ ...version, revisions: [] }), rules: mapRules(version.rules) })),
    // 更换 ID 后的摘要候选需重新核对来源，不能直接采用旧输入指纹。
    summaryCandidate: null,
  });
  const themes = imported.themes.map(mapTheme);
  const rules = Object.fromEntries(imported.themes.map((theme) => [themeIds.get(theme.id), mapRules(imported.rules[theme.id])]));
  const restored = { ...imported, themes, rules, snapshots, processed: mapRecord(imported.processed), reviewQueue: [], continueRequested: false, noteProfiles: {},
    undoActions: imported.undoActions.filter((action) => themeIds.has(action.themeId)).map((action) => ({ ...action,
      themeId: themeIds.get(action.themeId), previous: mapTheme(action.previous), rules: mapRules(action.rules) })) };
  const themeState = mode === 'overwrite' ? restored : { ...current,
    themes: [...current.themes, ...themes], rules: { ...current.rules, ...rules }, snapshots: { ...current.snapshots, ...snapshots },
    processed: { ...current.processed, ...restored.processed }, noteProfiles: {},
    undoActions: [...current.undoActions, ...restored.undoActions].slice(-20), revision: current.revision + 1 };
  return {
    notes: mode === 'overwrite' ? mergedImported : [...existingNotes, ...mergedImported],
    themes: themeState.themes,
    themeState,
    images: images.map((item) => ({
      ...item,
      note: mergedImported[importedNotes.indexOf(item.note)],
    })),
  };
}

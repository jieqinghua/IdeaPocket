const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2, 3]);

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
  return payload;
}

export function previewBackup(payload) {
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  return {
    noteCount: notes.length,
    imageCount: notes.filter((note) => note?.image?.fileName).length,
    exportedAt: payload?.exportedAt || '',
  };
}

const makeImportedId = (index, now) => `import-${now.toString(36)}-${index.toString(36)}`;

export function normalizeImportedNotes(payload, now = Date.now()) {
  const usedIds = new Set();
  return payload.notes.map((rawNote, index) => {
    const text = cleanText(rawNote?.text);
    if (!text) throw new Error(`第 ${index + 1} 条笔记内容为空，无法安全导入。`);
    let id = cleanText(rawNote?.id) || makeImportedId(index, now);
    while (usedIds.has(id)) id = makeImportedId(index + usedIds.size, now);
    usedIds.add(id);
    const createdAt = asTimestamp(rawNote?.createdAt, now + index);
    const updatedAt = asTimestamp(rawNote?.updatedAt, createdAt);
    return {
      id,
      text,
      rawText: cleanText(rawNote?.rawText),
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

export function buildImportState(currentNotes, payload, mode, now = Date.now()) {
  const importedNotes = normalizeImportedNotes(payload, now);
  const images = (Array.isArray(payload.notes) ? payload.notes : []).map((note, index) => ({
    note: importedNotes[index],
    image: note?.image || null,
  })).filter((item) => item.image?.fileName);
  if (mode === 'overwrite') return { notes: importedNotes, themes: [], images };
  if (mode !== 'merge') throw new Error('请选择合并或覆盖导入。');
  const existingNotes = Array.isArray(currentNotes) ? currentNotes : [];
  const usedIds = new Set(existingNotes.map((note) => note.id));
  const mergedImported = importedNotes.map((note, index) => ({
    ...note,
    id: makeUniqueId(note.id, usedIds, now, index),
  }));
  return {
    notes: [...existingNotes, ...mergedImported],
    themes: [],
    images: images.map((item) => ({
      ...item,
      note: mergedImported[importedNotes.indexOf(item.note)],
    })),
  };
}

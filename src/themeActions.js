let themeSequence = 0;

export const THEME_STATUS = Object.freeze({
  CURRENT: 'current',
  RETAINED: 'retained',
  HISTORY: 'history',
  DISMISSED: 'dismissed',
});

export const makeThemeId = (now = Date.now()) =>
  `theme-${now.toString(36)}-${(themeSequence++).toString(36)}`;

const cleanText = (value) => String(value || '').trim();
const uniqueKnownNoteIds = (ids, knownIds) => [...new Set(Array.isArray(ids) ? ids : [])]
  .filter((id) => knownIds.has(id));

const textTokens = (value) => {
  const text = cleanText(value).toLowerCase();
  const latin = text.match(/[a-z0-9]{2,}/g) || [];
  const chinese = text.match(/[\u3400-\u9fff]/g) || [];
  return new Set([...latin, ...chinese]);
};

export const overlapScore = (left = [], right = []) => {
  const a = new Set(left);
  const b = new Set(right);
  const intersection = [...a].filter((id) => b.has(id)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
};

const focusScore = (left, right) => {
  const a = textTokens(`${left?.title || ''} ${(left?.focusKeywords || []).join(' ')}`);
  const b = textTokens(`${right?.title || ''} ${(right?.focusKeywords || []).join(' ')}`);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / Math.min(a.size, b.size);
};

const isSameTheme = (left, right, memberThreshold = 0.8) =>
  overlapScore(left?.noteIds, right?.noteIds) >= memberThreshold && focusScore(left, right) >= 0.5;

export function normalizeGeneratedThemes(candidates, notes, now = Date.now(), options = {}) {
  const knownIds = new Set(notes.map((note) => note.id));
  const maxThemes = options.maxThemes || 5;
  const maxMemberships = options.maxMemberships || 2;
  const analysisRunId = options.analysisRunId || `run-${now.toString(36)}`;
  const prepared = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({
      ...candidate,
      title: cleanText(candidate?.title).slice(0, 18),
      summary: cleanText(candidate?.summary),
      focusKeywords: [...new Set((Array.isArray(candidate?.focusKeywords) ? candidate.focusKeywords : [])
        .map(cleanText).filter(Boolean))].slice(0, 5),
      noteIds: uniqueKnownNoteIds(candidate?.noteIds, knownIds),
      confidence: Math.max(0, Math.min(1, Number(candidate?.confidence) || 0)),
    }))
    .filter((candidate) => candidate.noteIds.length >= 3 && candidate.title && candidate.summary)
    .sort((a, b) => a.noteIds.length - b.noteIds.length || b.confidence - a.confidence);

  const deduped = [];
  prepared.forEach((candidate) => {
    if (deduped.some((existing) => isSameTheme(existing, candidate))) return;
    const candidateIds = new Set(candidate.noteIds);
    const containedSpecificThemes = deduped.filter((existing) =>
      existing.noteIds.length < candidate.noteIds.length
      && existing.noteIds.every((id) => candidateIds.has(id)));
    if (containedSpecificThemes.length >= 2) return;
    deduped.push(candidate);
  });

  const memberships = new Map();
  const normalized = [];
  for (const candidate of deduped) {
    if (normalized.length >= maxThemes) break;
    const noteIds = candidate.noteIds.filter((id) => (memberships.get(id) || 0) < maxMemberships);
    if (noteIds.length < 3) continue;
    noteIds.forEach((id) => memberships.set(id, (memberships.get(id) || 0) + 1));
    normalized.push({
      id: makeThemeId(now),
      title: candidate.title,
      summary: candidate.summary,
      focusKeywords: candidate.focusKeywords,
      noteIds,
      confidence: candidate.confidence,
      aiStatus: 'ready',
      status: THEME_STATUS.CURRENT,
      analysisRunId,
      createdAt: now,
      updatedAt: now,
      titleEdited: false,
      excludedNoteIds: [],
      dismissed: false,
    });
  }
  return normalized;
}

const visibleStatus = (theme) => theme?.status || (theme?.dismissed ? THEME_STATUS.DISMISSED : THEME_STATUS.CURRENT);
const signature = (theme) => `${cleanText(theme?.title)}|${cleanText(theme?.summary)}|${[...(theme?.noteIds || [])].sort().join(',')}`;

export function reconcileGeneratedThemes(currentThemes, generatedThemes, now = Date.now(), options = {}) {
  const current = Array.isArray(currentThemes) ? currentThemes : [];
  if (!generatedThemes.length) return current;
  const runId = options.analysisRunId || generatedThemes[0]?.analysisRunId || `run-${now.toString(36)}`;
  const retained = current.filter((theme) => visibleStatus(theme) === THEME_STATUS.RETAINED);
  const dismissed = current.filter((theme) => visibleStatus(theme) === THEME_STATUS.DISMISSED);
  const history = current.filter((theme) => visibleStatus(theme) === THEME_STATUS.HISTORY);
  const active = current.filter((theme) => visibleStatus(theme) === THEME_STATUS.CURRENT);
  const usedActiveIds = new Set();

  const accepted = generatedThemes.filter((candidate) => {
    if (retained.some((theme) => isSameTheme(theme, candidate))) return false;
    if (dismissed.some((theme) => isSameTheme(theme, candidate, 0.7))) return false;
    return true;
  });

  const nextCurrent = accepted.map((generated) => {
    const match = active
      .filter((theme) => !usedActiveIds.has(theme.id))
      .map((theme) => ({ theme, members: overlapScore(theme.noteIds, generated.noteIds), focus: focusScore(theme, generated) }))
      .filter((item) => item.members >= 0.7 && item.focus >= 0.35)
      .sort((a, b) => (b.members + b.focus) - (a.members + a.focus))[0];
    if (!match) return { ...generated, status: THEME_STATUS.CURRENT, analysisRunId: runId };
    const previous = match.theme;
    usedActiveIds.add(previous.id);
    const excluded = new Set(previous.excludedNoteIds || []);
    const noteIds = generated.noteIds.filter((id) => !excluded.has(id));
    return {
      ...generated,
      id: previous.id,
      title: previous.title,
      titleEdited: !!previous.titleEdited,
      noteIds: noteIds.length >= 2 ? noteIds : previous.noteIds,
      excludedNoteIds: [...excluded],
      createdAt: previous.createdAt || generated.createdAt,
      updatedAt: now,
      status: THEME_STATUS.CURRENT,
      analysisRunId: runId,
    };
  });

  const archived = active
    .filter((theme) => !usedActiveIds.has(theme.id))
    .map((theme) => ({ ...theme, status: THEME_STATUS.HISTORY, archivedAt: now, updatedAt: now }));
  const historySignatures = new Set(history.map(signature));
  const uniqueArchived = archived.filter((theme) => {
    const key = signature(theme);
    if (historySignatures.has(key)) return false;
    historySignatures.add(key);
    return true;
  });

  return [...nextCurrent, ...retained, ...history, ...uniqueArchived, ...dismissed];
}

export function renameTheme(themes, id, title, now = Date.now()) {
  const value = cleanText(title).slice(0, 18);
  if (!value) return themes;
  return themes.map((theme) => theme.id === id
    ? { ...theme, title: value, titleEdited: true, updatedAt: now }
    : theme);
}

export function retainTheme(themes, id, now = Date.now()) {
  return themes.map((theme) => theme.id === id
    ? { ...theme, status: THEME_STATUS.RETAINED, retainedAt: now, archivedAt: null, dismissed: false, updatedAt: now }
    : theme);
}

export function removeNoteFromTheme(themes, themeId, noteId, now = Date.now()) {
  return themes.map((theme) => {
    if (theme.id !== themeId || !theme.noteIds.includes(noteId)) return theme;
    return {
      ...theme,
      noteIds: theme.noteIds.filter((id) => id !== noteId),
      excludedNoteIds: [...new Set([...(theme.excludedNoteIds || []), noteId])],
      updatedAt: now,
    };
  });
}

export function dissolveTheme(themes, id, now = Date.now()) {
  return themes.map((theme) => theme.id === id
    ? { ...theme, status: THEME_STATUS.DISMISSED, dismissed: true, dismissedAt: now, updatedAt: now }
    : theme);
}

export function removeDeletedNoteFromThemes(themes, noteId, now = Date.now()) {
  return themes.map((theme) => theme.noteIds?.includes(noteId)
    ? { ...theme, noteIds: theme.noteIds.filter((id) => id !== noteId), updatedAt: now }
    : theme);
}

export function noteFingerprint(notes) {
  return [...notes]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((note) => `${note.id}:${note.lastTouched || note.createdAt || 0}:${note.text || ''}`)
    .join('|');
}

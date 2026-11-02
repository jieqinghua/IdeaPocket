// 生成结果与用户规则分开保存；版本引用内容快照，避免历史跟随当前正文变化。
let sequence = 0;
export const THEME_STATE_VERSION = 3;
export const textHash = (text, exact = false) => {
  let hash = 2166136261;
  const value = exact ? String(text || '') : String(text || '').normalize('NFKC').trim();
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${value.length.toString(36)}-${(hash >>> 0).toString(36)}`;
};
export const uniqueIds = (ids) => [...new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [])];
export const themeIsVisible = (theme) => !['history', 'dismissed'].includes(theme.status);
export const normalizeRules = (rule = {}) => ({
  includedNoteIds: uniqueIds(rule.includedNoteIds),
  excludedNoteIds: uniqueIds(rule.excludedNoteIds),
});
export function migrateThemeState(raw = {}) {
  if (!raw || (raw.themes !== undefined && !Array.isArray(raw.themes))) throw new Error('主题状态格式无效');
  const rules = Object.create(null);
  const themes = (Array.isArray(raw.themes) ? raw.themes : []).map((item) => {
    const status = item.status || (item.dismissed ? 'dismissed' : 'current');
    const managed = item.management === 'user' || status === 'retained' || item.titleEdited;
    rules[item.id] = normalizeRules(raw.rules?.[item.id] || {
      includedNoteIds: item.manualNoteIds,
      excludedNoteIds: item.excludedNoteIds,
    });
    return {
      ...item,
      title: String(item.title || "未命名主题"),
      summary: String(item.summary || ""),
      noteIds: uniqueIds(item.noteIds),
      status: managed && !['history', 'dismissed'].includes(status) ? 'retained' : status,
      management: managed ? 'user' : 'auto',
      maturity: item.maturity || (status === 'candidate' ? 'candidate' : 'established'),
      autoJoin: typeof item.autoJoin === 'boolean' ? item.autoJoin : status !== 'retained',
      scope: String(item.scope || item.summary || ''),
      summarySource: item.summarySource || 'legacy',
      summaryMode: item.summaryMode || (item.summarySource === 'manual' ? 'manual' : 'auto'),
      summaryStale: !!item.summaryStale,
      suppressed: typeof item.suppressed === 'boolean' ? item.suppressed : status === 'dismissed',
      relations: item.relations || {},
      suggestions: item.suggestions || {},
      sourceRefs: item.sourceRefs || {},
      revisions: Array.isArray(item.revisions) ? item.revisions : [],
      legacyHistory: item.legacyHistory ?? (status === 'history' && !item.sourceRefs),
    };
  });
  return {
    version: THEME_STATE_VERSION,
    themes,
    rules,
    snapshots: raw.snapshots || {},
    processed: raw.processed || {},
    reviewQueue: uniqueIds(raw.reviewQueue),
    continueRequested: !!raw.continueRequested,
    noteProfiles: raw.noteProfiles || {},
    settings: { ...raw.settings, autoEnabled: raw.settings?.autoEnabled === true },
    undoActions: Array.isArray(raw.undoActions) ? raw.undoActions : [],
    lastAnalyzedFingerprint: String(raw.lastAnalyzedFingerprint || raw.lastInputFingerprint || ''),
    lastAnalysis: raw.lastAnalysis || null,
    revision: Number(raw.revision) || 0,
  };
}

export function captureSources(state, ids, notes) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const snapshots = { ...state.snapshots };
  const refs = {};
  ids.forEach((id) => {
    const note = byId.get(id);
    if (!note) return;
    const key = `${id}:${textHash(`${note.text || ''}\u0000${note.rawText || ''}`, true)}`;
    refs[id] = key;
    if (!snapshots[key]) snapshots[key] = {
      id, text: note.text || '', rawText: note.rawText || '',
      createdAt: note.createdAt || 0, source: note.source || 'text', demo: !!note.demo, welcome: !!note.welcome,
    };
  });
  return { refs, snapshots };
}

export function recordThemeVersion(state, theme, notes, reason, now = Date.now()) {
  const captured = captureSources(state, theme.noteIds, notes);
  const sources = Object.keys(theme.sourceRefs || {}).length ? theme.sourceRefs : captured.refs;
  const { revisions, ...previous } = theme;
  const version = {
    ...previous,
    versionId: `v-${now.toString(36)}-${sequence++}`,
    recordedAt: now,
    reason,
    sourceRefs: sources,
    legacyHistory: !!theme.legacyHistory || (!Object.keys(theme.sourceRefs || {}).length && theme.summarySource === 'legacy'),
    rules: normalizeRules(state.rules[theme.id]),
  };
  return {
    ...state,
    snapshots: captured.snapshots,
    themes: state.themes.map((item) => item.id === theme.id ? { ...item, revisions: [...(revisions || []), version] } : item),
  };
}

export function changeTheme(state, id, patch, notes, reason, options = {}) {
  const previous = state.themes.find((theme) => theme.id === id);
  if (!previous) return state;
  const now = options.now || Date.now();
  let next = recordThemeVersion(state, previous, notes, reason, now);
  const updated = { ...previous, ...patch, updatedAt: now };
  const captured = captureSources(next, updated.noteIds, notes);
  next = {
    ...next,
    snapshots: captured.snapshots,
    revision: state.revision + 1,
    themes: next.themes.map((theme) => theme.id === id ? { ...theme, ...updated, revisions: theme.revisions, sourceRefs: captured.refs } : theme),
  };
  if (options.rules) next.rules = { ...next.rules, [id]: normalizeRules(options.rules) };
  const { revisions: unusedVersions, ...undoPrevious } = previous;
  if (options.undo !== false) next.undoActions = [...state.undoActions, {
    themeId: id, previous: undoPrevious, rules: normalizeRules(state.rules[id]), reason,
  }].slice(-20);
  return next;
}

export function editThemeField(state, id, field, value, notes, now) {
  const allowed = { title: 80, scope: 1200, summary: 3000 };
  if (!allowed[field] || !String(value || '').trim()) return state;
  const patch = { [field]: String(value).trim().slice(0, allowed[field]), management: 'user', status: 'retained', maturity: 'established' };
  if (field === 'title') patch.titleEdited = true;
  if (field === 'scope') patch.summaryStale = true;
  if (field === 'summary') {
    patch.legacyHistory = false; patch.summarySource = 'manual'; patch.summaryMode = 'manual'; patch.summaryStale = false; patch.summaryCandidate = null;
  }
  return changeTheme(state, id, patch, notes, `修改${{ title: '名称', scope: '范围', summary: '摘要' }[field]}`, { now });
}

export function setThemeMembership(state, themeId, noteId, include, notes, now) {
  return setThemeMembers(state, themeId, [noteId], include, notes, now);
}
export function setThemeMembers(state, themeId, noteIds, include, notes, now) {
  const theme = state.themes.find((item) => item.id === themeId);
  const ids = uniqueIds(noteIds).filter((id) => notes.some((note) => note.id === id && !note.deletedAt));
  if (!theme || !ids.length) return state;
  const rule = normalizeRules(state.rules[themeId]);
  const rules = {
    includedNoteIds: include ? uniqueIds([...rule.includedNoteIds, ...ids]) : rule.includedNoteIds.filter((id) => !ids.includes(id)),
    excludedNoteIds: include ? rule.excludedNoteIds.filter((id) => !ids.includes(id)) : uniqueIds([...rule.excludedNoteIds, ...ids]),
  };
  const relations = { ...theme.relations }; const suggestions = { ...theme.suggestions };
  ids.forEach((id) => {
    delete suggestions[id];
    if (include) relations[id] = { source: 'manual', reason: '手动加入', evidence: '' };
    else delete relations[id];
  });
  return changeTheme(state, themeId, {
    noteIds: include ? uniqueIds([...theme.noteIds, ...ids]) : theme.noteIds.filter((id) => !ids.includes(id)),
    relations, suggestions, summaryStale: true, summaryCandidate: null, management: 'user',
    maturity: 'established', status: 'retained', excludedNoteIds: rules.excludedNoteIds,
  }, notes, include ? '加入笔记' : '移出笔记', { now, rules });
}

export function undoThemeChange(state, id, notes) {
  const index = state.undoActions.map((action) => action.themeId).lastIndexOf(id);
  if (index < 0) return state;
  const action = state.undoActions[index];
  const previous = action.previous;
  const known = new Set(notes.filter((note) => !note.deletedAt).map((note) => note.id));
  const ids = previous.noteIds.filter((noteId) => known.has(noteId));
  const changed = ids.length !== previous.noteIds.length || ids.some((noteId) => {
    const saved = state.snapshots[previous.sourceRefs?.[noteId]];
    return !saved || saved.text !== notes.find((note) => note.id === noteId)?.text;
  });
  const next = changeTheme(state, id, { ...previous, noteIds: ids,
    summaryStale: previous.summaryStale || changed, summaryCandidate: changed ? null : previous.summaryCandidate }, notes,
    `撤销${action.reason}`, { rules: action.rules, undo: false });
  return { ...next, undoActions: state.undoActions.filter((_, i) => i !== index) };
}

export function createManualTheme(state, title, scope, noteIds, notes) {
  const ids = uniqueIds(noteIds).filter((id) => notes.some((note) => note.id === id && !note.deletedAt));
  if (!String(title || '').trim() || !ids.length) return state;
  const now = Date.now();
  const id = `theme-user-${now.toString(36)}-${sequence++}`;
  const captured = captureSources(state, ids, notes);
  return { ...state, revision: state.revision + 1, snapshots: captured.snapshots,
    rules: { ...state.rules, [id]: { includedNoteIds: ids, excludedNoteIds: [] } },
    themes: [...state.themes, {
      id, title: String(title).trim().slice(0, 80), scope: String(scope || '').trim().slice(0, 1200),
      noteIds: ids, summary: '', summarySource: 'local', summaryStale: true, sourceRefs: captured.refs,
      status: 'retained', management: 'user', maturity: 'established', autoJoin: false,
      titleEdited: true, createdAt: now, updatedAt: now, revisions: [], relations: Object.fromEntries(ids.map((noteId) => [noteId, { source: 'manual', reason: '手动加入', evidence: '' }])), suggestions: {},
    }],
  };
}

export function invalidateNoteThemes(state, notes, previousNotes = []) {
  const previous = new Map(previousNotes.map((note) => [note.id, note]));
  const byId = new Map(notes.filter((note) => !note.deletedAt).map((note) => [note.id, note]));
  let next = state;
  state.themes.filter(themeIsVisible).forEach((theme) => {
    const removed = theme.noteIds.some((id) => !byId.has(id));
    const edited = theme.noteIds.some((id) => {
      const saved = state.snapshots[theme.sourceRefs?.[id]];
      const prior = saved || previous.get(id);
      return prior && byId.has(id) && prior.text !== byId.get(id).text;
    });
    if (!removed && (!edited || theme.summaryStale)) return;
    next = changeTheme(next, theme.id, {
      noteIds: theme.noteIds.filter((id) => byId.has(id)), summaryStale: true, summaryCandidate: null,
    }, notes, removed ? '来源笔记已删除' : '来源正文已修改', { undo: false });
  });
  return next;
}

export function themeRulesFingerprint(state) {
  return `${state.revision}:${textHash(JSON.stringify(state.rules))}`;
}

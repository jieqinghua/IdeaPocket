const APP_BACKUP_VERSION = 3;

const cleanText = (value) => String(value || '').trim();

const isoTime = (value) => {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  return new Date(timestamp).toISOString();
};

const fileStamp = (date = new Date()) =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:]/g, '-');

const markdownText = (value) => cleanText(value).replace(/\r\n/g, '\n');

const backupImage = (image) => {
  const fileName = cleanText(image?.fileName);
  if (!fileName) return null;
  return {
    path: `images/${fileName}`,
    fileName,
    width: Number(image?.width) || null,
    height: Number(image?.height) || null,
    mimeType: cleanText(image?.mimeType) || 'image/jpeg',
  };
};

const themeLookupForNote = (note, themes) => {
  const matches = (Array.isArray(themes) ? themes : [])
    .filter((theme) => ['current', 'retained'].includes(theme.status || (theme.dismissed ? 'dismissed' : 'current')))
    .filter((theme) => Array.isArray(theme.noteIds) && theme.noteIds.includes(note.id))
    .map((theme) => ({
      id: theme.id,
      title: cleanText(theme.title),
      summary: cleanText(theme.summary),
    }));

  if (!matches.length && (note.themeId || note.themeTitle || note.themeSummary)) {
    matches.push({
      id: note.themeId || '',
      title: cleanText(note.themeTitle),
      summary: cleanText(note.themeSummary),
    });
  }

  return matches;
};

export function normalizeBackupNotes(notes = [], themes = [], options = {}) {
  const { includeDeleted = true, includeDemo = false } = options;
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => includeDemo || !note.demo)
    .filter((note) => includeDeleted || !note.deletedAt)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map((note) => ({
      id: note.id,
      text: note.text || '',
      rawText: note.rawText || '',
      source: note.source || 'text',
      image: backupImage(note.image),
      createdAt: note.createdAt || null,
      createdAtISO: isoTime(note.createdAt),
      updatedAt: note.lastTouched || note.updatedAt || note.createdAt || null,
      updatedAtISO: isoTime(note.lastTouched || note.updatedAt || note.createdAt),
      deletedAt: note.deletedAt || null,
      deletedAtISO: isoTime(note.deletedAt),
      themeId: note.themeId || '',
      themeTitle: note.themeTitle || '',
      themeSummary: note.themeSummary || '',
      themes: themeLookupForNote(note, themes),
    }));
}

export function buildBackupJson(notes = [], themes = [], options = {}) {
  const exportedAt = options.exportedAt || new Date();
  const normalizedNotes = normalizeBackupNotes(notes, themes, options);
  const activeNotes = normalizedNotes.filter((note) => !note.deletedAt);
  const payload = {
    app: 'IdeaPocket',
    backupVersion: APP_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    counts: {
      notes: normalizedNotes.length,
      activeNotes: activeNotes.length,
      deletedNotes: normalizedNotes.length - activeNotes.length,
      themes: Array.isArray(themes) ? themes.length : 0,
      currentThemes: (themes || []).filter((theme) => (theme.status || 'current') === 'current' && !theme.dismissed).length,
      retainedThemes: (themes || []).filter((theme) => theme.status === 'retained').length,
      historicalThemes: (themes || []).filter((theme) => theme.status === 'history').length,
      dismissedThemes: (themes || []).filter((theme) => theme.status === 'dismissed' || theme.dismissed).length,
    },
    notes: normalizedNotes,
    themes: (Array.isArray(themes) ? themes : []).map((theme) => ({
        id: theme.id,
        title: theme.title || '',
        summary: theme.summary || '',
        focusKeywords: Array.isArray(theme.focusKeywords) ? theme.focusKeywords : [],
        noteIds: Array.isArray(theme.noteIds) ? theme.noteIds : [],
        status: theme.status || (theme.dismissed ? 'dismissed' : 'current'),
        analysisRunId: theme.analysisRunId || '',
        archivedAt: theme.archivedAt || null,
        retainedAt: theme.retainedAt || null,
        dismissedAt: theme.dismissedAt || null,
        updatedAt: theme.updatedAt || null,
        updatedAtISO: isoTime(theme.updatedAt),
      })),
  };
  return JSON.stringify(payload, null, 2);
}

export function buildBackupMarkdown(notes = [], themes = [], options = {}) {
  const exportedAt = options.exportedAt || new Date();
  const normalizedNotes = normalizeBackupNotes(notes, themes, options);
  const lines = [
    '# IdeaPocket Backup',
    '',
    `- Exported: ${exportedAt.toISOString()}`,
    `- Notes: ${normalizedNotes.length}`,
    `- Active notes: ${normalizedNotes.filter((note) => !note.deletedAt).length}`,
    '',
  ];

  normalizedNotes.forEach((note, index) => {
    const themeTitles = note.themes.map((item) => item.title).filter(Boolean).join(', ');
    lines.push(`## ${index + 1}. ${note.createdAtISO || 'No time'} · ${note.source || 'text'}`);
    if (note.deletedAtISO) lines.push(`- Deleted: ${note.deletedAtISO}`);
    if (themeTitles) lines.push(`- Themes: ${themeTitles}`);
    if (note.themeTitle && !themeTitles) lines.push(`- Legacy theme: ${note.themeTitle}`);
    if (note.image?.path) lines.push(`- Image: [${note.image.fileName}](${note.image.path})`);
    lines.push('');
    lines.push(markdownText(note.text) || '(empty)');
    if (note.rawText && note.rawText !== note.text) {
      lines.push('');
      lines.push('Original rawText:');
      lines.push('');
      lines.push(markdownText(note.rawText));
    }
    lines.push('');
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function makeBackupFileNames(date = new Date()) {
  const stamp = fileStamp(date);
  return {
    folder: `ideapocket-backup-${stamp}`,
    json: `ideapocket-backup-${stamp}.json`,
    markdown: `ideapocket-backup-${stamp}.md`,
  };
}

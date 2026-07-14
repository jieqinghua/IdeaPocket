import {
  buildBackupJson,
  buildBackupMarkdown,
  makeBackupFileNames,
  normalizeBackupNotes,
} from '../lib/backupExport';

const exportedAt = new Date('2026-07-08T10:20:30.000Z');
const at = (hour) => Date.UTC(2026, 6, 8, hour, 0, 0);
const notes = [
  {
    id: 'demo',
    text: '演示笔记',
    demo: true,
    source: 'text',
    createdAt: 1,
  },
  {
    id: 'n1',
    text: '整理后的笔记',
    rawText: '嗯 原始转写',
    source: 'voice',
    createdAt: at(5),
    lastTouched: at(6),
    image: {
      uri: 'file:///documents/IdeaPocketImages/n1-photo.jpg',
      fileName: 'n1-photo.jpg',
      width: 1600,
      height: 1200,
      mimeType: 'image/jpeg',
    },
  },
  {
    id: 'n2',
    text: '被删除但仍需备份',
    source: 'text',
    createdAt: at(6),
    deletedAt: at(7),
  },
];
const themes = [
  {
    id: 't1',
    title: '产品想法',
    summary: '围绕产品的真实笔记',
    noteIds: ['n1'],
    updatedAt: at(8),
  },
];

test('归一化备份笔记保留 rawText 来源 时间和主题', () => {
  const result = normalizeBackupNotes(notes, themes);
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({
    id: 'n1',
    text: '整理后的笔记',
    rawText: '嗯 原始转写',
    source: 'voice',
    createdAtISO: '2026-07-08T05:00:00.000Z',
    updatedAtISO: '2026-07-08T06:00:00.000Z',
    themes: [{ id: 't1', title: '产品想法', summary: '围绕产品的真实笔记' }],
    image: {
      path: 'images/n1-photo.jpg',
      fileName: 'n1-photo.jpg',
      width: 1600,
      height: 1200,
      mimeType: 'image/jpeg',
    },
  });
});

test('备份 JSON 默认排除演示数据并保留软删除标记', () => {
  const parsed = JSON.parse(buildBackupJson(notes, themes, { exportedAt }));
  expect(parsed.backupVersion).toBe(3);
  expect(parsed.counts).toEqual({
    notes: 2,
    activeNotes: 1,
    deletedNotes: 1,
    themes: 1,
    currentThemes: 1,
    retainedThemes: 0,
    historicalThemes: 0,
    dismissedThemes: 0,
  });
  expect(parsed.notes.map((note) => note.id)).toEqual(['n1', 'n2']);
  expect(parsed.notes[1].deletedAtISO).toBe('2026-07-08T07:00:00.000Z');
});

test('历史主题写入 JSON 但不进入笔记常规主题关联', () => {
  const historical = [{
    id: 'old',
    title: '旧主题',
    summary: '旧总结',
    status: 'history',
    noteIds: ['n1'],
  }];
  const parsed = JSON.parse(buildBackupJson(notes, historical, { exportedAt }));
  expect(parsed.themes[0].status).toBe('history');
  expect(parsed.notes.find((note) => note.id === 'n1').themes).toEqual([]);
});

test('备份 Markdown 可读展示正文 rawText 和主题', () => {
  const markdown = buildBackupMarkdown(notes, themes, { exportedAt });
  expect(markdown).toContain('# IdeaPocket Backup');
  expect(markdown).toContain('- Themes: 产品想法');
  expect(markdown).toContain('整理后的笔记');
  expect(markdown).toContain('Original rawText:');
  expect(markdown).toContain('嗯 原始转写');
  expect(markdown).toContain('[n1-photo.jpg](images/n1-photo.jpg)');
});

test('备份文件名使用安全时间戳', () => {
  expect(makeBackupFileNames(exportedAt)).toEqual({
    folder: 'ideapocket-backup-2026-07-08T10-20-30Z',
    json: 'ideapocket-backup-2026-07-08T10-20-30Z.json',
    markdown: 'ideapocket-backup-2026-07-08T10-20-30Z.md',
  });
});

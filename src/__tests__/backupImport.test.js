import { buildImportState, parseBackupJson, previewBackup } from '../lib/backupImport';

const backup = JSON.stringify({
  app: 'IdeaPocket',
  backupVersion: 3,
  exportedAt: '2026-07-16T00:00:00.000Z',
  notes: [
    { id: 'same', text: '导入笔记', source: 'voice', createdAt: 10, image: { fileName: 'a.jpg' } },
  ],
});

test('备份预览展示笔记和图片数量', () => {
  expect(previewBackup(parseBackupJson(backup))).toMatchObject({ noteCount: 1, imageCount: 1 });
});

test('合并导入会保留现有笔记并为冲突 id 生成新 id', () => {
  const result = buildImportState([{ id: 'same', text: '原笔记' }], parseBackupJson(backup), 'merge', 100);
  expect(result.notes).toHaveLength(2);
  expect(result.notes[1]).toMatchObject({ text: '导入笔记', source: 'voice' });
  expect(result.notes[1].id).not.toBe('same');
  expect(result.themes).toEqual([]);
  expect(result.images[0].note.id).toBe(result.notes[1].id);
});

test('覆盖导入只保留备份中的笔记', () => {
  const result = buildImportState([{ id: 'old', text: '原笔记' }], parseBackupJson(backup), 'overwrite', 100);
  expect(result.notes).toHaveLength(1);
  expect(result.notes[0].id).toBe('same');
});

test('拒绝非 IdeaPocket 备份', () => {
  expect(() => parseBackupJson('{"notes":[]}')).toThrow('IdeaPocket');
});

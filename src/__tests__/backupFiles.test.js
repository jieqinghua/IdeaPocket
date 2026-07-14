const mockCopyStoredNoteImage = jest.fn();

jest.mock('expo-file-system', () => ({
  __esModule: true,
  Directory: class Directory {},
  Paths: { document: { uri: 'file:///documents' } },
}));

jest.mock('../noteImages', () => ({
  __esModule: true,
  copyStoredNoteImage: mockCopyStoredNoteImage,
}));

const { exportNotesBackup } = require('../backupFiles');

const exportedAt = new Date('2026-07-13T04:05:06.789Z');

const makeWritableFile = (uri) => ({
  uri,
  write: jest.fn(),
});

test('Android SAF 备份通过父目录 API 创建子目录和文件', async () => {
  const createdFiles = [];
  const backupDirectory = {
    uri: 'content://picker/ideapocket-backup',
    exists: true,
    createDirectory: jest.fn(),
    createFile: jest.fn((name, mimeType) => {
      const file = makeWritableFile(`${backupDirectory.uri}/${name}`);
      createdFiles.push({ name, mimeType, file });
      return file;
    }),
    delete: jest.fn(),
  };
  const parentDirectory = {
    uri: 'content://picker/root',
    list: jest.fn(() => []),
    createDirectory: jest.fn(() => backupDirectory),
  };

  const result = await exportNotesBackup(
    [{ id: 'n1', text: '需要恢复的笔记', createdAt: 1 }],
    [],
    { directory: parentDirectory, exportedAt }
  );

  expect(parentDirectory.createDirectory).toHaveBeenCalledWith(
    'ideapocket-backup-2026-07-13T04-05-06Z'
  );
  expect(createdFiles.map(({ name, mimeType }) => ({ name, mimeType }))).toEqual([
    {
      name: 'ideapocket-backup-2026-07-13T04-05-06Z.json',
      mimeType: 'application/json',
    },
    {
      name: 'ideapocket-backup-2026-07-13T04-05-06Z.md',
      mimeType: 'text/markdown',
    },
  ]);
  expect(createdFiles[0].file.write).toHaveBeenCalledWith(expect.stringContaining('需要恢复的笔记'));
  expect(result).toMatchObject({ noteCount: 1, imageCount: 0 });
});

test('同秒目录已存在时使用后缀目录且不覆盖旧备份', async () => {
  const backupDirectory = {
    uri: 'content://picker/ideapocket-backup-1',
    exists: true,
    createDirectory: jest.fn(),
    createFile: jest.fn((name) => makeWritableFile(`${backupDirectory.uri}/${name}`)),
    delete: jest.fn(),
  };
  const parentDirectory = {
    uri: 'content://picker/root',
    list: jest.fn(() => [{ name: 'ideapocket-backup-2026-07-13T04-05-06Z' }]),
    createDirectory: jest.fn(() => backupDirectory),
  };

  await exportNotesBackup([], [], { directory: parentDirectory, exportedAt });

  expect(parentDirectory.createDirectory).toHaveBeenCalledWith(
    'ideapocket-backup-2026-07-13T04-05-06Z-1'
  );
});

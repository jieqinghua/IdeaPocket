import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  buildBackupJson,
  buildBackupMarkdown,
  makeBackupFileNames,
} from './lib/backupExport';
import { copyStoredNoteImage } from './noteImages';

const createDirectory = (directory) => {
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
};

const writeFile = (directory, name, mimeType, contents) => {
  const file = directory.createFile(name, mimeType);
  file.write(contents);
  return file.uri;
};

const withSuffix = (name, extension, suffix) =>
  suffix ? `${name.slice(0, -extension.length)}-${suffix}${extension}` : name;

const createAvailableBackupDirectory = (parentDirectory, exportedAt) => {
  const baseNames = makeBackupFileNames(exportedAt);
  const existingNames = new Set(parentDirectory.list().map((entry) => entry.name));
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const names = {
      folder: suffix ? `${baseNames.folder}-${suffix}` : baseNames.folder,
      json: withSuffix(baseNames.json, '.json', suffix),
      markdown: withSuffix(baseNames.markdown, '.md', suffix),
    };
    if (!existingNames.has(names.folder)) {
      return { directory: parentDirectory.createDirectory(names.folder), names };
    }
  }
  throw new Error('备份目录过多，请更换导出位置后重试。');
};

async function resolveBackupDirectory() {
  if (Platform.OS === 'android' && typeof Directory.pickDirectoryAsync === 'function') {
    try {
      const picked = await Directory.pickDirectoryAsync();
      if (picked) return picked;
    } catch (error) {
      if (error?.message?.toLowerCase?.().includes('cancel')) throw error;
      console.warn('pick backup directory failed, falling back to app documents', error);
    }
  }

  const directory = new Directory(Paths.document, 'IdeaPocketBackups');
  createDirectory(directory);
  return directory;
}

export async function exportNotesBackup(notes, themes, options = {}) {
  const exportedAt = options.exportedAt || new Date();
  let stage = 'select-directory';
  let directory = null;
  const copiedImages = [];
  try {
    const parentDirectory = options.directory || await resolveBackupDirectory();
    console.info('[backup:saf-v4] selected directory', { scheme: parentDirectory.uri.split(':')[0] });

    stage = 'create-backup-directory';
    const available = createAvailableBackupDirectory(parentDirectory, exportedAt);
    directory = available.directory;
    const { names } = available;

    const json = buildBackupJson(notes, themes, { ...options, exportedAt });
    const markdown = buildBackupMarkdown(notes, themes, { ...options, exportedAt });
    const backupNotes = JSON.parse(json).notes;
    const sourceNotes = new Map((Array.isArray(notes) ? notes : []).map((note) => [note.id, note]));
    const imageNotes = backupNotes.filter((note) => note.image?.fileName);
    console.info('[backup:saf-v4] prepared payload', {
      notes: backupNotes.length,
      images: imageNotes.length,
    });

    stage = 'validate-images';
    for (const note of imageNotes) {
      const sourceImage = sourceNotes.get(note.id)?.image;
      if (!sourceImage?.uri) throw new Error(`笔记图片不存在：${note.image.fileName}`);
    }

    stage = 'create-image-directory';
    const imageDirectory = imageNotes.length ? directory.createDirectory('images') : null;
    const copiedImageNames = new Set();
    for (const note of imageNotes) {
      const sourceImage = sourceNotes.get(note.id).image;
      if (copiedImageNames.has(note.image.fileName)) continue;
      copiedImageNames.add(note.image.fileName);
      stage = 'write-image';
      copiedImages.push({
        kind: 'image',
        name: `images/${note.image.fileName}`,
        uri: copyStoredNoteImage(sourceImage, imageDirectory, note.image.fileName),
      });
    }

    stage = 'write-json';
    const files = [
      {
        kind: 'json',
        name: names.json,
        uri: writeFile(directory, names.json, 'application/json', json),
      },
      {
        kind: 'markdown',
        name: names.markdown,
        uri: null,
      },
      ...copiedImages,
    ];
    stage = 'write-markdown';
    files[1].uri = writeFile(directory, names.markdown, 'text/markdown', markdown);

    return {
      exportedAt: exportedAt.toISOString(),
      directoryUri: directory.uri,
      files,
      noteCount: JSON.parse(json).counts.notes,
      imageCount: copiedImages.length,
    };
  } catch (error) {
    console.error(`[backup:saf-v4:${stage}]`, error?.message || error, error?.stack || '');
    try {
      if (directory?.exists) directory.delete();
    } catch (cleanupError) {
      console.warn('could not clean failed backup directory', cleanupError);
    }
    const wrapped = new Error(`备份阶段 ${stage} 失败：${error?.message || '未知错误'}`);
    wrapped.cause = error;
    throw wrapped;
  }
}

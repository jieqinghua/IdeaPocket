import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

const IMAGE_DIRECTORY_NAME = 'IdeaPocketImages';
const MAX_IMAGE_EDGE = 2000;
const JPEG_QUALITY = 0.85;

const imageDirectory = () => new Directory(Paths.document, IMAGE_DIRECTORY_NAME);

const ensureImageDirectory = () => {
  const directory = imageDirectory();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
};

const makeImageFileName = (noteId) => `${noteId}-${Date.now().toString(36)}.jpg`;

const pickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 1,
  selectionLimit: 1,
};

const requestPermission = async (source) => {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) return;
  throw new Error(source === 'camera' ? '需要相机权限才能拍照添加图片。' : '需要相册权限才能选择图片。');
};

export async function pickNoteImage(source) {
  await requestPermission(source);
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

export async function storeNoteImage(asset, noteId) {
  if (!asset?.uri || !noteId) throw new Error('无法读取所选图片，请重试。');
  const sourceWidth = Number(asset.width) || 0;
  const sourceHeight = Number(asset.height) || 0;
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  const resize = longestEdge > MAX_IMAGE_EDGE
    ? [{ resize: sourceWidth >= sourceHeight ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE } }]
    : [];
  const processed = await ImageManipulator.manipulateAsync(asset.uri, resize, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const directory = ensureImageDirectory();
  const fileName = makeImageFileName(noteId);
  const destination = new File(directory, fileName);
  new File(processed.uri).copy(destination);
  if (!destination.exists) throw new Error('图片保存失败，请重试。');
  return {
    uri: destination.uri,
    fileName,
    width: processed.width,
    height: processed.height,
    mimeType: 'image/jpeg',
  };
}

export async function chooseAndStoreNoteImage(noteId, source) {
  const asset = await pickNoteImage(source);
  if (!asset) return null;
  return storeNoteImage(asset, noteId);
}

export function removeStoredNoteImage(image) {
  if (!image?.uri) return;
  const file = new File(image.uri);
  if (file.exists) file.delete();
}

export function copyStoredNoteImage(image, directory, targetName = image?.fileName) {
  if (!image?.uri || !targetName) throw new Error('笔记图片信息不完整，无法导出备份。');
  const source = new File(image.uri);
  if (!source.exists) throw new Error(`笔记图片不存在：${targetName}`);
  const destination = directory.createFile(targetName, image.mimeType || 'image/jpeg');
  destination.write(source.bytesSync());
  if (!destination.exists) throw new Error(`笔记图片复制失败：${targetName}`);
  return destination.uri;
}

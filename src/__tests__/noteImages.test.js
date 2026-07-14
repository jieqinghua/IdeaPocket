const mockFiles = new Set();
const mockRequestCameraPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockManipulateAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  requestCameraPermissionsAsync: mockRequestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync: mockRequestMediaLibraryPermissionsAsync,
  launchCameraAsync: mockLaunchCameraAsync,
  launchImageLibraryAsync: mockLaunchImageLibraryAsync,
}));

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: mockManipulateAsync,
}));

jest.mock('expo-file-system', () => {
  const toUri = (parts) => parts.map((part) => typeof part === 'string' ? part : part.uri).join('/');
  class Directory {
    constructor(...parts) { this.uri = toUri(parts); }
    get exists() { return true; }
    create() {}
    createFile(name) {
      const file = new File(this, name);
      mockFiles.add(file.uri);
      return file;
    }
  }
  class File {
    constructor(...parts) { this.uri = toUri(parts); }
    get exists() { return mockFiles.has(this.uri); }
    copy(destination) { mockFiles.add(destination.uri); }
    bytesSync() { return new Uint8Array([1, 2, 3]); }
    write() { mockFiles.add(this.uri); }
    delete() { mockFiles.delete(this.uri); }
  }
  return { __esModule: true, Directory, File, Paths: { document: 'file:///documents' } };
});

const {
  chooseAndStoreNoteImage,
  copyStoredNoteImage,
  pickNoteImage,
  storeNoteImage,
} = require('../noteImages');
const { Directory } = require('expo-file-system');

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
  mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  mockManipulateAsync.mockResolvedValue({
    uri: 'file:///cache/compressed.jpg',
    width: 2000,
    height: 1500,
  });
});

test('相册选择取消时不创建图片附件', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  await expect(chooseAndStoreNoteImage('n1', 'library')).resolves.toBeNull();
  expect(mockManipulateAsync).not.toHaveBeenCalled();
});

test('权限拒绝时显示来源对应的错误', async () => {
  mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  await expect(pickNoteImage('camera')).rejects.toThrow('需要相机权限');
  expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
});

test('大图压缩为 JPEG 并复制到笔记私有目录', async () => {
  const image = await storeNoteImage({ uri: 'file:///picker/source.heic', width: 4000, height: 3000 }, 'n1');
  expect(mockManipulateAsync).toHaveBeenCalledWith(
    'file:///picker/source.heic',
    [{ resize: { width: 2000 } }],
    { compress: 0.85, format: 'jpeg' }
  );
  expect(image).toMatchObject({
    uri: expect.stringMatching(/^file:\/\/\/documents\/IdeaPocketImages\/n1-.+\.jpg$/),
    fileName: expect.stringMatching(/^n1-.+\.jpg$/),
    width: 2000,
    height: 1500,
    mimeType: 'image/jpeg',
  });
});

test('备份图片通过授权目录创建文件并写入内容', () => {
  const sourceUri = 'file:///documents/IdeaPocketImages/n1.jpg';
  mockFiles.add(sourceUri);

  const uri = copyStoredNoteImage(
    { uri: sourceUri, fileName: 'n1.jpg', mimeType: 'image/jpeg' },
    new Directory('content://backup/images')
  );

  expect(uri).toBe('content://backup/images/n1.jpg');
  expect(mockFiles.has(uri)).toBe(true);
});

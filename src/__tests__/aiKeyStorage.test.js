import * as SecureStore from 'expo-secure-store';
import { AI_KEY_SECURE_STORE_NAME, loadAIKey, saveAIKey } from '../aiKeyStorage';
import { AI_CONFIG, hasAIKey, setRuntimeAIKey } from '../config.ai';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

beforeEach(() => {
  SecureStore.isAvailableAsync.mockResolvedValue(true);
  SecureStore.getItemAsync.mockReset();
  SecureStore.setItemAsync.mockReset();
  setRuntimeAIKey('');
});

test('从系统安全存储读取并清理 API Key', async () => {
  SecureStore.getItemAsync.mockResolvedValue('  sk-local-key  ');

  await expect(loadAIKey()).resolves.toBe('sk-local-key');
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
    AI_KEY_SECURE_STORE_NAME,
    expect.objectContaining({
      keychainService: 'com.ideapocket.app.ai-key',
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  );
});

test('API Key 只写入系统安全存储', async () => {
  await expect(saveAIKey('  sk-new-key  ')).resolves.toBe('sk-new-key');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    AI_KEY_SECURE_STORE_NAME,
    'sk-new-key',
    expect.objectContaining({ keychainService: 'com.ideapocket.app.ai-key' })
  );
});

test('拒绝保存空 API Key 或在不支持安全存储时降级到明文', async () => {
  await expect(saveAIKey('   ')).rejects.toThrow('请输入有效的 API Key');
  SecureStore.isAvailableAsync.mockResolvedValue(false);
  await expect(saveAIKey('sk-key')).rejects.toThrow('不支持安全存储');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('AI 调用配置只读取启动后注入的内存 Key', () => {
  expect(AI_CONFIG.apiKey).toBe('');
  expect(hasAIKey()).toBe(false);

  setRuntimeAIKey('  sk-runtime  ');
  expect(AI_CONFIG.apiKey).toBe('sk-runtime');
  expect(hasAIKey()).toBe(true);
});

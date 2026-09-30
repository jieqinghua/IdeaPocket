import * as SecureStore from 'expo-secure-store';
import {
  DASHSCOPE_AI_KEY_SECURE_STORE_NAME,
  DEEPSEEK_AI_KEY_SECURE_STORE_NAME,
  loadDashscopeAIKey,
  loadDeepSeekAIKey,
  saveDashscopeAIKey,
  saveDeepSeekAIKey,
} from '../aiKeyStorage';
import {
  DASHSCOPE_ASR_CONFIG,
  DEEPSEEK_TEXT_CONFIG,
  hasDashscopeKey,
  hasDeepSeekKey,
  setRuntimeDashscopeKey,
  setRuntimeDeepSeekKey,
} from '../config.ai';

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
  setRuntimeDeepSeekKey('');
  setRuntimeDashscopeKey('');
});

test('保留旧百炼安全存储记录并读取其 Key', async () => {
  SecureStore.getItemAsync.mockResolvedValue('  sk-local-key  ');

  await expect(loadDashscopeAIKey()).resolves.toBe('sk-local-key');
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
    DASHSCOPE_AI_KEY_SECURE_STORE_NAME,
    expect.objectContaining({
      keychainService: 'com.ideapocket.app.ai-key',
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  );
});

test('DeepSeek 与百炼 Key 分别写入系统安全存储', async () => {
  await expect(saveDeepSeekAIKey('  sk-deepseek  ')).resolves.toBe('sk-deepseek');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    DEEPSEEK_AI_KEY_SECURE_STORE_NAME,
    'sk-deepseek',
    expect.objectContaining({ keychainService: 'com.ideapocket.app.ai-key.deepseek' })
  );
  await expect(saveDashscopeAIKey('  sk-dashscope  ')).resolves.toBe('sk-dashscope');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    DASHSCOPE_AI_KEY_SECURE_STORE_NAME,
    'sk-dashscope',
    expect.objectContaining({ keychainService: 'com.ideapocket.app.ai-key' })
  );
});

test('DeepSeek Key 使用独立安全存储记录读取', async () => {
  SecureStore.getItemAsync.mockResolvedValue('  sk-deepseek-local  ');

  await expect(loadDeepSeekAIKey()).resolves.toBe('sk-deepseek-local');
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
    DEEPSEEK_AI_KEY_SECURE_STORE_NAME,
    expect.objectContaining({ keychainService: 'com.ideapocket.app.ai-key.deepseek' })
  );
});

test('拒绝保存空 API Key 或在不支持安全存储时降级到明文', async () => {
  await expect(saveDeepSeekAIKey('   ')).rejects.toThrow('请输入有效的 API Key');
  SecureStore.isAvailableAsync.mockResolvedValue(false);
  await expect(saveDashscopeAIKey('sk-key')).rejects.toThrow('不支持安全存储');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('两类 AI 调用只读取各自启动后注入的内存 Key', async () => {
  SecureStore.getItemAsync.mockResolvedValue('  sk-deepseek-local  ');
  await expect(loadDeepSeekAIKey()).resolves.toBe('sk-deepseek-local');
  expect(DEEPSEEK_TEXT_CONFIG.apiKey).toBe('');
  expect(DASHSCOPE_ASR_CONFIG.apiKey).toBe('');
  expect(hasDeepSeekKey()).toBe(false);
  expect(hasDashscopeKey()).toBe(false);

  setRuntimeDeepSeekKey('  sk-deepseek-runtime  ');
  setRuntimeDashscopeKey('  sk-dashscope-runtime  ');
  expect(DEEPSEEK_TEXT_CONFIG.apiKey).toBe('sk-deepseek-runtime');
  expect(DASHSCOPE_ASR_CONFIG.apiKey).toBe('sk-dashscope-runtime');
  expect(hasDeepSeekKey()).toBe(true);
  expect(hasDashscopeKey()).toBe(true);
  expect(DEEPSEEK_TEXT_CONFIG).toMatchObject({
    provider: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-flash',
  });
  expect(DASHSCOPE_ASR_CONFIG).toMatchObject({
    provider: 'dashscope',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-asr-flash',
  });
});

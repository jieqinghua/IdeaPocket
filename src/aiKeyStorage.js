import * as SecureStore from 'expo-secure-store';

// 保持 v1 名称不变，已安装版本保存的百炼 Key 可直接继续用于语音转写。
const DASHSCOPE_AI_KEY_STORAGE_KEY = 'ideapocket.ai.dashscope.api-key.v1';
const DEEPSEEK_AI_KEY_STORAGE_KEY = 'ideapocket.ai.deepseek.api-key.v1';
const DASHSCOPE_SECURE_STORE_OPTIONS = {
  keychainService: 'com.ideapocket.app.ai-key',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const DEEPSEEK_SECURE_STORE_OPTIONS = {
  keychainService: 'com.ideapocket.app.ai-key.deepseek',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function loadKey(storageKey, options) {
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('当前设备不支持安全存储，无法读取 API Key');
  const stored = await SecureStore.getItemAsync(storageKey, options);
  return String(stored || '').trim();
}

async function saveKey(storageKey, options, apiKey) {
  const normalized = String(apiKey || '').trim();
  if (!normalized) throw new Error('请输入有效的 API Key');
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('当前设备不支持安全存储，无法保存 API Key');
  await SecureStore.setItemAsync(storageKey, normalized, options);
  return normalized;
}

export const loadDashscopeAIKey = () => loadKey(DASHSCOPE_AI_KEY_STORAGE_KEY, DASHSCOPE_SECURE_STORE_OPTIONS);
export const saveDashscopeAIKey = (apiKey) =>
  saveKey(DASHSCOPE_AI_KEY_STORAGE_KEY, DASHSCOPE_SECURE_STORE_OPTIONS, apiKey);
export const loadDeepSeekAIKey = () => loadKey(DEEPSEEK_AI_KEY_STORAGE_KEY, DEEPSEEK_SECURE_STORE_OPTIONS);
export const saveDeepSeekAIKey = (apiKey) =>
  saveKey(DEEPSEEK_AI_KEY_STORAGE_KEY, DEEPSEEK_SECURE_STORE_OPTIONS, apiKey);

export const DASHSCOPE_AI_KEY_SECURE_STORE_NAME = DASHSCOPE_AI_KEY_STORAGE_KEY;
export const DEEPSEEK_AI_KEY_SECURE_STORE_NAME = DEEPSEEK_AI_KEY_STORAGE_KEY;

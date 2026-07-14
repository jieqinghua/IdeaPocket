import * as SecureStore from 'expo-secure-store';

const AI_KEY_STORAGE_KEY = 'ideapocket.ai.dashscope.api-key.v1';
const SECURE_STORE_OPTIONS = {
  keychainService: 'com.ideapocket.app.ai-key',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function loadAIKey() {
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('当前设备不支持安全存储，无法读取 API Key');
  const stored = await SecureStore.getItemAsync(AI_KEY_STORAGE_KEY, SECURE_STORE_OPTIONS);
  return String(stored || '').trim();
}

export async function saveAIKey(apiKey) {
  const normalized = String(apiKey || '').trim();
  if (!normalized) throw new Error('请输入有效的 API Key');
  const available = await SecureStore.isAvailableAsync();
  if (!available) throw new Error('当前设备不支持安全存储，无法保存 API Key');
  await SecureStore.setItemAsync(AI_KEY_STORAGE_KEY, normalized, SECURE_STORE_OPTIONS);
  return normalized;
}

export const AI_KEY_SECURE_STORE_NAME = AI_KEY_STORAGE_KEY;

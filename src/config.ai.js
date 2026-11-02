// API Key 只从设备安全存储加载到内存，不读取 EXPO_PUBLIC_*，避免写入客户端 bundle。
let runtimeDeepSeekApiKey = '';
let runtimeDashscopeApiKey = '';

export const DEEPSEEK_TEXT_CONFIG = {
  provider: 'deepseek',
  get apiKey() {
    return runtimeDeepSeekApiKey;
  },
  baseURL: process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  model: process.env.EXPO_PUBLIC_DEEPSEEK_LLM_MODEL || 'deepseek-flash',
};

export const DASHSCOPE_ASR_CONFIG = {
  provider: 'dashscope',
  get apiKey() {
    return runtimeDashscopeApiKey;
  },
  baseURL:
    process.env.EXPO_PUBLIC_DASHSCOPE_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: process.env.EXPO_PUBLIC_DASHSCOPE_ASR_MODEL || 'qwen3-asr-flash',
};

export const setRuntimeDeepSeekKey = (apiKey) => {
  runtimeDeepSeekApiKey = String(apiKey || '').trim();
};

export const setRuntimeDashscopeKey = (apiKey) => {
  runtimeDashscopeApiKey = String(apiKey || '').trim();
};

export const hasDeepSeekKey = () => Boolean(runtimeDeepSeekApiKey);
export const hasDashscopeKey = () => Boolean(runtimeDashscopeApiKey);

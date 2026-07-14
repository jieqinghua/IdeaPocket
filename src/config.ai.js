// API Key 只从设备安全存储加载到内存，不读取 EXPO_PUBLIC_*，避免写入客户端 bundle。
let runtimeApiKey = '';

export const AI_CONFIG = {
  provider: 'dashscope',
  get apiKey() {
    return runtimeApiKey;
  },
  llmBaseURL:
    process.env.EXPO_PUBLIC_DASHSCOPE_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
  llmModel: process.env.EXPO_PUBLIC_DASHSCOPE_LLM_MODEL || 'qwen-flash',
  asrModel: process.env.EXPO_PUBLIC_DASHSCOPE_ASR_MODEL || 'qwen3-asr-flash',
};

export const setRuntimeAIKey = (apiKey) => {
  runtimeApiKey = String(apiKey || '').trim();
};

export const hasAIKey = () => Boolean(runtimeApiKey);

// 百炼 Qwen3-ASR-Flash：本地录音转 Base64 Data URL 后走 OpenAI 兼容接口。
import { File } from 'expo-file-system';
import { AI_CONFIG, hasAIKey } from '../config.ai';
import { DEFAULT_TIMEOUT_MS, fetchWithTimeout } from './http';

const MAX_BASE64_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXTENSION = {
  aac: 'audio/aac',
  amr: 'audio/amr',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

export class TranscriptionError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    this.cause = cause;
  }
}

function extensionOf(uri) {
  return (uri?.split('?')[0].match(/\.([^.\/]+)$/)?.[1] || '').toLowerCase();
}

export async function audioUriToDataUrl(audioUri, fileFactory = (uri) => new File(uri)) {
  if (!audioUri) throw new TranscriptionError('missing_audio', '没有找到录音文件，请重新录制');

  const extension = extensionOf(audioUri);
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) {
    throw new TranscriptionError('unsupported_audio', `暂不支持 .${extension || '未知'} 录音格式`);
  }

  let base64;
  try {
    base64 = await fileFactory(audioUri).base64();
  } catch (error) {
    throw new TranscriptionError('read_audio', '读取录音失败，请重新录制', error);
  }

  if (!base64) throw new TranscriptionError('empty_audio', '录音内容为空，请重新录制');
  if (base64.length > MAX_BASE64_BYTES) {
    throw new TranscriptionError('audio_too_large', '录音超过 10MB，请缩短后重试');
  }
  return `data:${mime};base64,${base64}`;
}

function errorForStatus(status) {
  if (status === 401 || status === 403) return ['auth', 'AI 密钥无效或无权限，请检查本地配置'];
  if (status === 413) return ['audio_too_large', '录音太大，请缩短后重试'];
  if (status === 429) return ['rate_limit', '调用过于频繁或额度不足，请稍后重试'];
  if (status >= 500) return ['service', '语音服务暂时不可用，请稍后重试'];
  return ['request', `语音识别请求失败（${status}）`];
}

export async function transcribeDataUrl(
  dataUrl,
  {
    apiKey = AI_CONFIG.apiKey,
    baseURL = AI_CONFIG.llmBaseURL,
    model = AI_CONFIG.asrModel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
  } = {}
) {
  if (!apiKey?.trim()) {
    throw new TranscriptionError('missing_key', '尚未配置百炼 API key，可先改用打字记录');
  }

  let response;
  try {
    response = await fetchWithTimeout(
      `${baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [{ type: 'input_audio', input_audio: { data: dataUrl } }],
            },
          ],
          stream: false,
          asr_options: { enable_itn: true },
        }),
      },
      timeoutMs,
      fetchImpl
    );
  } catch (error) {
    if (error?.code === 'timeout') throw new TranscriptionError('timeout', error.message, error);
    if (error instanceof TranscriptionError) throw error;
    throw new TranscriptionError('network', '网络连接失败，请检查网络后重试', error);
  }

  if (!response.ok) {
    const [code, message] = errorForStatus(response.status);
    throw new TranscriptionError(code, message);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new TranscriptionError('invalid_response', '语音服务返回了无法解析的结果', error);
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new TranscriptionError('empty_result', '没有识别到文字，请重试或改用打字');

  const annotation = data?.choices?.[0]?.message?.annotations?.[0] || {};
  return { text, language: annotation.language, emotion: annotation.emotion };
}

export async function transcribe(audioUri, options = {}) {
  if (!hasAIKey() && !options.apiKey) {
    throw new TranscriptionError('missing_key', '尚未配置百炼 API key，可先改用打字记录');
  }
  const dataUrl = await audioUriToDataUrl(audioUri, options.fileFactory);
  return transcribeDataUrl(dataUrl, options);
}

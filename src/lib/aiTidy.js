// AI 文字整理：百炼 Qwen；无 key 时使用本地轻量整理。
import { AI_CONFIG, hasAIKey } from '../config.ai';
import { DEFAULT_TIMEOUT_MS, fetchWithTimeout } from './http';

const SYSTEM_PROMPT =
  '你是中文笔记整理助手。把用户口述或潦草的文本整理为清晰段落：' +
  '去除“嗯、呃、那个、这个、就是说、然后那个”等口水词与无意义重复；合理分段、补全标点。' +
  '若原文存在明确的顺序或并列结构（如“第一/第二”“首先/其次”“包括 A、B、C”），必须保留原有信息并改写为逐行列表：有先后顺序时使用“1. 项目”的有序列表，并列事项使用“- 项目”的无序列表。' +
  '不要为了排版凭空创造列表；普通连续叙述仍使用自然段。' +
  '严格保留原意与中英文混用，不要翻译、不要扩写、不要总结、不要添加任何观点或解释。' +
  '只输出整理后的正文本身，不要前后缀说明。';

const FILLERS = /(嗯+|呃+|额+|啊{2,}|那个那个|这个这个|就是说|然后那个|然后呢)/g;

const ORDER_MARKERS = [
  ['第一', '1'], ['第二', '2'], ['第三', '3'], ['第四', '4'], ['第五', '5'],
  ['第六', '6'], ['第七', '7'], ['第八', '8'], ['第九', '9'], ['第十', '10'],
  ['首先', '1'], ['其次', '2'], ['然后', '3'], ['最后', '4'],
];

const formatExplicitOrder = (text) => {
  const matches = ORDER_MARKERS.filter(([marker]) => text.includes(marker));
  if (matches.length < 2) return text;
  let formatted = text;
  ORDER_MARKERS.forEach(([marker, index]) => {
    const pattern = new RegExp(`(^|[，。；;\\n])\\s*${marker}[、，,:：]?\\s*`, 'g');
    formatted = formatted.replace(pattern, (_match, prefix) => {
      if (!prefix) return `${index}. `;
      return `${prefix === '\n' ? '\n' : `${prefix}\n`}${index}. `;
    });
  });
  return formatted.replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n');
};

export function localTidy(text) {
  return formatExplicitOrder(text
    .replace(FILLERS, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([。！？!?])\s*/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

export async function tidyRemote(
  input,
  {
    apiKey = AI_CONFIG.apiKey,
    baseURL = AI_CONFIG.llmBaseURL,
    model = AI_CONFIG.llmModel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    signal,
  } = {}
) {
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
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: input },
          ],
          temperature: 0.3,
        }),
        signal,
      },
      timeoutMs,
      fetchImpl
    );
  } catch (error) {
    if (error?.code === 'aborted') throw error;
    if (error?.code === 'timeout') throw error;
    const networkError = new Error('整理请求网络失败，请稍后重试');
    networkError.code = 'network';
    throw networkError;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`整理失败（${response.status}）${detail ? ` ${detail.slice(0, 80)}` : ''}`);
  }

  const data = await response.json();
  const output = data?.choices?.[0]?.message?.content?.trim();
  if (!output) throw new Error('整理失败：服务返回为空');
  return { text: output, stub: false };
}

export async function tidy(text, options = {}) {
  const input = (text || '').trim();
  if (!input) return { text: '', stub: false };
  if (!hasAIKey() && !options.apiKey) return { text: localTidy(input), stub: true };
  return tidyRemote(input, options);
}

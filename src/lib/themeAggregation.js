import { AI_CONFIG, hasAIKey } from '../config.ai';
import { normalizeGeneratedThemes } from '../themeActions';
import { DEFAULT_TIMEOUT_MS, fetchWithTimeout } from './http';

const SYSTEM_PROMPT = `你是个人灵感笔记的主题整理助手。请对提供的全部笔记做一次全局分析，识别出多个高度相关、焦点明确的主题组。
规则：
1. 每个主题至少包含 3 条笔记；不够相关的笔记保持未归类。
2. 同一条笔记可以属于多个不同视角的主题，但最多进入 2 个主题；不要为了凑数强行归类。
3. 标题简短具体，不超过 18 个汉字，避免“关于……的一些想法”等空话。
4. summary 用一句直接陈述共同内容的中文概括，只能使用笔记已有信息，不补充事实或结论。不要把笔记记录者称为“用户”“作者”“你”或“笔记主人”，也不要使用“这些笔记提到”等元叙事；如果内容本身讨论产品用户、用户研究或用户反馈，“用户”一词可以正常使用。
   错误示例：“用户希望优化语音输入体验。”正确示例：“语音输入需要减少操作步骤并提高识别准确率。”合法示例：“用户反馈集中在搜索入口不明显和结果排序不准确。”
5. 如果一个宽泛主题能够拆成两个各自不少于 3 条的具体主题，必须拆开，不要输出覆盖多个话题的伞形主题。
6. 最多输出 5 个主题；focusKeywords 输出 2–5 个能区分主题视角的关键词。
7. 只输出 JSON，不要 Markdown。格式：{"themes":[{"title":"","summary":"","focusKeywords":[""],"noteIds":["n0"],"confidence":0.0}]}。`;

const SPLIT_REVIEW_PROMPT = `${SYSTEM_PROMPT}
你现在是第二轮拆分审查员。上一轮只识别出零个或一个主题，可能发生了过度合并。
请忽略上一轮标题，重新比较全部笔记的具体对象、问题和使用场景；只要存在两个各自至少 3 条的独立类别，就必须输出为多个主题。`;

export const THEME_ANALYSIS_VERSION = 'manual-overlap-v3';
export const DIRECT_ANALYSIS_CHAR_LIMIT = 70_000;

const stripCodeFence = (value) =>
  String(value || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

export function parseThemeResponse(content) {
  const parsed = JSON.parse(stripCodeFence(content));
  return Array.isArray(parsed) ? parsed : parsed?.themes || [];
}

const STOP_BIGRAMS = new Set([
  '这个', '那个', '一些', '一个', '可以', '应该', '还是', '因为', '所以', '如果', '但是',
  '就是', '觉得', '需要', '可能', '已经', '没有', '什么', '怎么', '时候', '我们', '他们',
]);

function tokensFor(text) {
  const value = String(text || '').toLowerCase();
  const latin = value.match(/[a-z0-9]{2,}/g) || [];
  const chineseRuns = value.match(/[\u3400-\u9fff]{2,}/g) || [];
  const bigrams = [];
  chineseRuns.forEach((run) => {
    for (let index = 0; index < run.length - 1; index += 1) {
      const token = run.slice(index, index + 2);
      if (!STOP_BIGRAMS.has(token)) bigrams.push(token);
    }
  });
  return new Set([...latin, ...bigrams]);
}

function similarity(left, right) {
  const a = tokensFor(left);
  const b = tokensFor(right);
  const shared = [...a].filter((token) => b.has(token)).length;
  const denominator = Math.min(a.size, b.size) || 1;
  return { score: shared / denominator, shared };
}

function localTitle(notes) {
  const counts = new Map();
  notes.forEach((note) => {
    tokensFor(note.text).forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
  });
  const ranked = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token);
  const common = [];
  for (const token of ranked) {
    if (common.some((picked) => [...token].some((char) => picked.includes(char)))) continue;
    common.push(token);
    if (common.length === 2) break;
  }
  return common.length ? common.join('与').slice(0, 18) : '反复出现的想法';
}

function localSummary(notes) {
  const excerpts = notes.slice(0, 3).map((note) => String(note.text || '').trim().slice(0, 48));
  return `${excerpts.join('；')}。`;
}

export function aggregateLocally(notes, now = Date.now()) {
  const eligible = notes.filter((note) => String(note.text || '').trim());
  const parent = eligible.map((_, index) => index);
  const find = (index) => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  for (let left = 0; left < eligible.length; left += 1) {
    for (let right = left + 1; right < eligible.length; right += 1) {
      const match = similarity(eligible[left].text, eligible[right].text);
      if (match.shared >= 2 && match.score >= 0.18) union(left, right);
    }
  }

  const groups = new Map();
  eligible.forEach((note, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), note]);
  });

  const candidates = [...groups.values()]
    .filter((group) => group.length >= 3)
    .map((group) => ({
      title: localTitle(group),
      summary: localSummary(group),
      noteIds: group.map((note) => note.id),
      confidence: 0.62,
    }));

  return normalizeGeneratedThemes(candidates, notes, now);
}

const profileFingerprint = (note) => `${note.lastTouched || note.createdAt || 0}:${String(note.text || '')}`;

export function buildNoteProfiles(notes, currentProfiles = {}) {
  const profiles = {};
  notes.forEach((note) => {
    const fingerprint = profileFingerprint(note);
    const cached = currentProfiles[note.id];
    if (cached?.fingerprint === fingerprint) {
      profiles[note.id] = cached;
      return;
    }
    const text = String(note.text || '').trim();
    const keywords = [...tokensFor(text)].slice(0, 5);
    profiles[note.id] = {
      fingerprint,
      summary: text.length <= 160 ? text : `${text.slice(0, 157)}…`,
      keywords,
    };
  });
  return profiles;
}

const addUsage = (left = {}, right = {}) => ({
  inputTokens: (left.inputTokens || 0) + (right.inputTokens || 0),
  outputTokens: (left.outputTokens || 0) + (right.outputTokens || 0),
});

async function requestRemoteThemes(
  notes,
  {
    apiKey = AI_CONFIG.apiKey,
    baseURL = AI_CONFIG.llmBaseURL,
    model = AI_CONFIG.llmModel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    signal,
    now = Date.now(),
    analysisRunId,
  } = {},
  systemPrompt = SYSTEM_PROMPT
) {
  const idByRef = new Map();
  const requestNotes = notes.map((note, index) => {
    const ref = `n${index}`;
    idByRef.set(ref, note.id);
    return { ref, text: note.text };
  });
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
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: JSON.stringify(requestNotes),
            },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
          max_tokens: 16384,
        }),
        signal,
      },
      timeoutMs,
      fetchImpl
    );
  } catch (error) {
    if (error?.code === 'aborted' || error?.code === 'timeout') throw error;
    const networkError = new Error('主题整理网络失败，请稍后重试');
    networkError.code = 'network';
    throw networkError;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`主题整理失败（${response.status}）${detail ? ` ${detail.slice(0, 80)}` : ''}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('主题整理失败：服务返回为空');

  try {
    const candidates = parseThemeResponse(content).map((candidate) => ({
      ...candidate,
      noteIds: (candidate.noteIds || []).map((ref) => idByRef.get(ref)).filter(Boolean),
    }));
    return {
      themes: normalizeGeneratedThemes(candidates, notes, now, { analysisRunId }),
      usage: {
        inputTokens: Number(data?.usage?.prompt_tokens || data?.usage?.input_tokens) || 0,
        outputTokens: Number(data?.usage?.completion_tokens || data?.usage?.output_tokens) || 0,
      },
    };
  } catch {
    throw new Error('主题整理失败：返回格式无法识别');
  }
}

export async function aggregateThemesRemote(notes, options = {}) {
  const firstPass = await requestRemoteThemes(notes, options, SYSTEM_PROMPT);
  if (notes.length < 6 || firstPass.themes.length > 1) return firstPass;

  try {
    const splitPass = await requestRemoteThemes(notes, options, SPLIT_REVIEW_PROMPT);
    return {
      ...(splitPass.themes.length > firstPass.themes.length ? splitPass : firstPass),
      usage: addUsage(firstPass.usage, splitPass.usage),
    };
  } catch {
    return firstPass;
  }
}

export async function aggregateThemes(notes, options = {}) {
  const noteProfiles = buildNoteProfiles(notes, options.noteProfiles);
  if (notes.length < 3) return { themes: [], stub: !hasAIKey(), mode: 'none', usage: {}, noteProfiles };
  if (!hasAIKey() && !options.apiKey) {
    return { themes: aggregateLocally(notes, options.now), stub: true, mode: 'local', usage: {}, noteProfiles };
  }
  const rawChars = notes.reduce((total, note) => total + String(note.text || '').length, 0);
  const mode = rawChars <= DIRECT_ANALYSIS_CHAR_LIMIT ? 'direct' : 'profiles';
  const analysisNotes = mode === 'direct' ? notes : notes.map((note) => ({
    ...note,
    text: `${noteProfiles[note.id]?.summary || ''}\n关键词：${(noteProfiles[note.id]?.keywords || []).join('、')}`,
  }));
  const result = await aggregateThemesRemote(analysisNotes, options);
  return { ...result, stub: false, mode, noteProfiles };
}

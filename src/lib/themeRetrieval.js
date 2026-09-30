import { textHash } from '../themeModel';

const STOP = new Set(['这个', '那个', '一些', '一个', '可以', '应该', '还是', '因为', '所以', '如果', '但是', '就是', '觉得', '需要', '可能', '已经', '没有', '什么', '怎么', '时候', '我们', '他们']);
export function contentTokens(text) {
  const value = String(text || '').toLowerCase().normalize('NFKC');
  const counts = new Map();
  const add = (token) => { if (!STOP.has(token)) counts.set(token, (counts.get(token) || 0) + 1); };
  (value.match(/[a-z0-9]{2,}/g) || []).forEach(add);
  (value.match(/[\u3400-\u9fff]{2,}/g) || []).forEach((run) => {
    for (let i = 0; i < run.length - 1; i += 1) add(run.slice(i, i + 2));
  });
  return counts;
}
export function tokenSimilarity(left, right) {
  const a = new Set(left); const b = new Set(right);
  const shared = [...a].filter((word) => b.has(word));
  return { score: shared.length / Math.sqrt((a.size || 1) * (b.size || 1)), shared };
}
export function buildContentProfiles(notes, previous = {}) {
  const profiles = {};
  notes.forEach((note) => {
    const fingerprint = textHash(note.text);
    if (previous[note.id]?.fingerprint === fingerprint && previous[note.id]?.passages) {
      profiles[note.id] = previous[note.id]; return;
    }
    const text = String(note.text || '').trim();
    const counts = contentTokens(text);
    const ranked = [...counts].sort((a, b) => b[1] - a[1]);
    // 全文参与检索；分段保留头、中、尾及高信息量句子，而不是截取开头。
    const passages = [];
    const add = (value) => { if (value && !passages.includes(value)) passages.push(value); };
    for (let i = 0; i < 8; i += 1) {
      const offset = Math.floor(Math.max(0, text.length - 240) * i / 7);
      add(text.slice(offset, offset + 240));
    }
    (text.match(/[^。！？!?\n]+[。！？!?\n]?/g) || []).filter(Boolean)
      .map((value) => ({ value, score: contentTokens(value).size / Math.sqrt(value.length || 1) }))
      .sort((a, b) => b.score - a.score).slice(0, 8).forEach(({ value }) => add(value.slice(0, 240)));
    profiles[note.id] = { fingerprint, tokens: [...counts.keys()], keywords: ranked.slice(0, 12).map(([word]) => word),
      passages, summary: (passages[0] || '').slice(0, 160) };
  });
  return profiles;
}
export function profileText(profile, query = '', limit = 1200) {
  if (!profile) return '';
  const passages = profile.passages || [profile.summary || ''];
  const tokens = [...contentTokens(query).keys()];
  const ranked = passages.map((value) => ({ value, score: tokenSimilarity([...contentTokens(value).keys()], tokens).score }))
    .sort((a, b) => b.score - a.score).map((item) => item.value);
  // 尾部先占一个保留位置，防止长文的结论始终被前置背景挤掉。
  return [...new Set([passages[Math.min(7, passages.length - 1)], ...ranked])].filter(Boolean).join('\n…\n').slice(0, limit);
}
export function buildContentIndex(profiles) {
  const index = new Map();
  Object.entries(profiles).forEach(([id, profile]) => (profile.tokens || []).forEach((word) => {
    if (!index.has(word)) index.set(word, new Set());
    index.get(word).add(id);
  }));
  return index;
}
export function relatedNoteIds(id, profiles, index, limit = 18) {
  const counts = new Map();
  (profiles[id]?.tokens || []).forEach((word) => (index.get(word) || []).forEach((other) => {
    if (other !== id) counts.set(other, (counts.get(other) || 0) + 1 / Math.sqrt(index.get(word).size));
  }));
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([other]) => other);
}
export function coherentLocalGroups(notes, profiles = buildContentProfiles(notes)) {
  const index = buildContentIndex(profiles);
  const groups = []; const memberships = new Map();
  notes.forEach((note) => {
    if ((memberships.get(note.id) || 0) >= 2) return;
    const ids = [note.id];
    relatedNoteIds(note.id, profiles, index).forEach((id) => {
      if ((memberships.get(id) || 0) >= 2) return;
      if (ids.every((member) => {
        const match = tokenSimilarity(profiles[member].tokens, profiles[id].tokens);
        return match.shared.length >= 2 && match.score >= 0.18;
      })) ids.push(id);
    });
    if (ids.length < 2 || groups.some((group) => ids.every((id) => group.includes(id)))) return;
    groups.push(ids);
    ids.forEach((id) => memberships.set(id, (memberships.get(id) || 0) + 1));
  });
  return groups;
}

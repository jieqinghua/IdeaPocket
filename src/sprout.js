export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function selectSprout(pool, day, excludedIds = []) {
  if (!pool.length) return null;
  const excluded = new Set(excludedIds);
  const start = hashString(`${day}:${pool.length}`) % pool.length;

  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(start + offset) % pool.length];
    if (!excluded.has(candidate.id)) return candidate;
  }

  // 所有候选都看过后开始新一轮；只有一条笔记时也能继续展示。
  return pool[start];
}

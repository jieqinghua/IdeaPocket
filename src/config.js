// ── 全部"旋钮"集中在这里。做出来后，凭手感调这几个数就行。──
export const CONFIG = {
  // 随手一记（strength=1）的半衰期，单位：天。越小，遗忘得越快。
  BASE_HALFLIFE_DAYS: 3,

  // heat 低于这个值 → 自动沉入"堆肥"。
  COMPOST_THRESHOLD: 10,

  // heat 高于这个值 → 算"新鲜"（其余为"枯萎"）。
  FRESH_ABOVE: 60,

  // strength 上限：被你"用"得越多，半衰期越长，但最多 ×10。
  STRENGTH_CAP: 10,

  // 卡片最淡也要看得见（不会真的透明到 0）。
  MIN_OPACITY: 0.35,
};

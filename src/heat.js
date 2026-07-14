// ── heat 引擎：整个产品的核心。纯函数，不依赖 UI。──
// heat(now) = 100 × 0.5 ^ ( 距上次接触的天数 / halfLife )
// halfLife  = BASE_HALFLIFE_DAYS × strength
// heat 不入库——每次渲染时按 lastTouched / strength / now 现算，所以不需要后台定时任务。
import { CONFIG } from './config';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(ts, now = Date.now()) {
  return Math.max(0, (now - ts) / DAY_MS);
}

export function heatOf(note, now = Date.now()) {
  if (note.planted) return 100; // 多年生：永不衰减
  const strength = Math.min(note.strength || 1, CONFIG.STRENGTH_CAP);
  const halfLife = CONFIG.BASE_HALFLIFE_DAYS * strength;
  const d = daysSince(note.lastTouched, now);
  return 100 * Math.pow(0.5, d / halfLife);
}

export function isComposted(note, now = Date.now()) {
  return !note.planted && heatOf(note, now) < CONFIG.COMPOST_THRESHOLD;
}

export function stageOf(note, now = Date.now()) {
  if (note.planted) return 'planted';
  const h = heatOf(note, now);
  if (h < CONFIG.COMPOST_THRESHOLD) return 'compost';
  if (h > CONFIG.FRESH_ABOVE) return 'fresh';
  return 'wilting';
}

// heat(0..100) → 透明度(MIN_OPACITY..1)，让卡片随热度自然褪色。
export function opacityOf(note, now = Date.now()) {
  const h = Math.max(0, Math.min(100, heatOf(note, now)));
  return CONFIG.MIN_OPACITY + (1 - CONFIG.MIN_OPACITY) * (h / 100);
}

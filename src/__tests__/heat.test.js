import { CONFIG } from '../config';
import { heatOf, isComposted, opacityOf, stageOf } from '../heat';

const DAY = 24 * 60 * 60 * 1000;
const note = (overrides = {}) => ({
  id: 'n1',
  text: 'test',
  lastTouched: 1_000_000,
  strength: 1,
  planted: false,
  ...overrides,
});

test('一个基础半衰期后热度为 50', () => {
  const item = note();
  expect(heatOf(item, item.lastTouched + CONFIG.BASE_HALFLIFE_DAYS * DAY)).toBeCloseTo(50);
});

test('未来时间戳不会让热度超过 100', () => {
  expect(heatOf(note(), 0)).toBe(100);
});

test('strength 有上限，多年生始终为 100', () => {
  const now = 1_000_000 + CONFIG.BASE_HALFLIFE_DAYS * CONFIG.STRENGTH_CAP * DAY;
  expect(heatOf(note({ strength: 999 }), now)).toBeCloseTo(50);
  expect(heatOf(note({ planted: true }), now + 1000 * DAY)).toBe(100);
  expect(stageOf(note({ planted: true }), now)).toBe('planted');
});

test('低于阈值进入堆肥，透明度不低于配置值', () => {
  const item = note();
  const now = item.lastTouched + 11 * DAY;
  expect(isComposted(item, now)).toBe(true);
  expect(opacityOf(item, now)).toBeGreaterThanOrEqual(CONFIG.MIN_OPACITY);
});

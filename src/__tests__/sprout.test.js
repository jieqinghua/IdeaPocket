import { selectSprout, todayKey } from '../sprout';

const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('同一天同一候选池的选择稳定', () => {
  expect(selectSprout(pool, '2026-7-3')).toEqual(selectSprout(pool, '2026-7-3'));
});

test('再翻一个会跳过已展示的候选', () => {
  const first = selectSprout(pool, '2026-7-3');
  const second = selectSprout(pool, '2026-7-3', [first.id]);
  expect(second.id).not.toBe(first.id);
});

test('只有一个候选时允许重新展示', () => {
  expect(selectSprout([{ id: 'only' }], 'day', ['only']).id).toBe('only');
});

test('日期键使用本地年月日', () => {
  expect(todayKey(new Date(2026, 6, 3, 23, 59))).toBe('2026-7-3');
});

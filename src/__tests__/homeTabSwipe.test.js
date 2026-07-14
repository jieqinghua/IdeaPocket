import {
  resolveHomeTabSwipe,
  shouldClaimHomeTabSwipe,
} from '../homeTabSwipe';

describe('home tab horizontal swipe', () => {
  test('claims only supported, horizontally dominant directions', () => {
    expect(shouldClaimHomeTabSwipe('notes', { dx: -24, dy: 4 })).toBe(true);
    expect(shouldClaimHomeTabSwipe('themes', { dx: 24, dy: 4 })).toBe(true);
    expect(shouldClaimHomeTabSwipe('notes', { dx: 24, dy: 4 })).toBe(false);
    expect(shouldClaimHomeTabSwipe('themes', { dx: -24, dy: 4 })).toBe(false);
    expect(shouldClaimHomeTabSwipe('notes', { dx: -24, dy: 22 })).toBe(false);
  });

  test('does not claim taps or small long-press drift', () => {
    expect(shouldClaimHomeTabSwipe('notes', { dx: -12, dy: 2 })).toBe(false);
    expect(shouldClaimHomeTabSwipe('themes', { dx: 14, dy: 1 })).toBe(false);
  });

  test('switches tabs after the distance threshold', () => {
    expect(resolveHomeTabSwipe('notes', { dx: -72, dy: 8, vx: -0.2 })).toBe('themes');
    expect(resolveHomeTabSwipe('themes', { dx: 72, dy: 8, vx: 0.2 })).toBe('notes');
  });

  test('accepts a deliberate short fling but rejects an incomplete drag', () => {
    expect(resolveHomeTabSwipe('notes', { dx: -30, dy: 4, vx: -0.7 })).toBe('themes');
    expect(resolveHomeTabSwipe('notes', { dx: -30, dy: 4, vx: -0.2 })).toBe('notes');
  });

  test('does not switch for vertical movement or unsupported edge direction', () => {
    expect(resolveHomeTabSwipe('notes', { dx: -60, dy: 80, vx: -0.8 })).toBe('notes');
    expect(resolveHomeTabSwipe('notes', { dx: 80, dy: 2, vx: 0.8 })).toBe('notes');
    expect(resolveHomeTabSwipe('themes', { dx: -80, dy: 2, vx: -0.8 })).toBe('themes');
  });
});

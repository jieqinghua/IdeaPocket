import { darkTheme, lightTheme } from '../theme';

describe('adaptive color themes', () => {
  test('keeps the same semantic color contract in light and dark modes', () => {
    expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort());
    expect(lightTheme.mode).toBe('light');
    expect(darkTheme.mode).toBe('dark');
  });

  test('uses distinct dark surfaces and readable foreground colors', () => {
    expect(darkTheme.bg).not.toBe(lightTheme.bg);
    expect(darkTheme.surface).not.toBe(darkTheme.bg);
    expect(darkTheme.ink).not.toBe(darkTheme.bg);
    expect(darkTheme.brand).not.toBe(darkTheme.bg);
  });
});

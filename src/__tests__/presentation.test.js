import {
  buildThemeCards,
  formatNoteDate,
  formatRelativeThemeDate,
  getThemeCardVisual,
  getThemeGeneratedAt,
  hasAiTidy,
  sortNotesNewestFirst,
} from '../presentation';

describe('V2 presentation helpers', () => {
  test('sorts every note by creation time descending', () => {
    const notes = [
      { id: 'older', createdAt: 10 },
      { id: 'newer', createdAt: 30 },
      { id: 'middle', createdAt: 20 },
    ];
    expect(sortNotesNewestFirst(notes).map((note) => note.id)).toEqual(['newer', 'middle', 'older']);
    expect(notes.map((note) => note.id)).toEqual(['older', 'newer', 'middle']);
  });

  test('formats a local calendar date with time for cards', () => {
    const timestamp = new Date(2026, 6, 5, 12, 0, 0).getTime();
    expect(formatNoteDate(timestamp)).toBe('2026-07-05 12:00');
    expect(formatNoteDate(null)).toBe('');
  });

  test('formats relative theme generation dates', () => {
    const now = new Date(2026, 6, 10, 10, 24, 0).getTime();
    expect(formatRelativeThemeDate(new Date(2026, 6, 10, 8, 5, 0).getTime(), now)).toBe('今天 08:05');
    expect(formatRelativeThemeDate(new Date(2026, 6, 9, 18, 7, 0).getTime(), now)).toBe('昨天 18:07');
    expect(formatRelativeThemeDate(new Date(2026, 5, 3, 12, 0, 0).getTime(), now)).toBe('6月3日');
    expect(formatRelativeThemeDate(new Date(2025, 11, 31, 12, 0, 0).getTime(), now)).toBe('2025年12月31日');
    expect(formatRelativeThemeDate(null, now)).toBe('');
  });

  test('selects stable theme visuals across the 24-category vocabulary', () => {
    const cases = [
      ['产品定位', '策略讨论', 'compass-outline'],
      ['用户访谈', '洞察整理', 'people-outline'],
      ['交互设计', '', 'color-palette-outline'],
      ['前端开发', '', 'code-slash-outline'],
      ['系统架构', '', 'hardware-chip-outline'],
      ['Bug 修复', '', 'bug-outline'],
      ['项目排期', '', 'checkmark-done-circle-outline'],
      ['团队会议', '', 'people-circle-outline'],
      ['数据复盘', '', 'analytics-outline'],
      ['增长运营', '', 'trending-up-outline'],
      ['品牌文案', '', 'megaphone-outline'],
      ['财务预算', '', 'wallet-outline'],
      ['AI 智能体', '', 'sparkles-outline'],
      ['阅读笔记', '', 'book-outline'],
      ['考试复习', '', 'school-outline'],
      ['求职面试', '', 'briefcase-outline'],
      ['创意灵感', '', 'bulb-outline'],
      ['个人计划', '', 'calendar-outline'],
      ['跑步健康', '', 'fitness-outline'],
      ['旅行攻略', '', 'airplane-outline'],
      ['朋友社交', '', 'chatbubbles-outline'],
      ['情绪反思', '', 'heart-outline'],
      ['电影音乐', '', 'musical-notes-outline'],
      ['购物清单', '', 'cart-outline'],
    ];

    cases.forEach(([title, summary, icon]) => {
      expect(getThemeCardVisual(title, summary).icon).toBe(icon);
    });
    expect(getThemeCardVisual('产品', '用户调研').icon).toBe('compass-outline');
    expect(getThemeCardVisual('未知主题', '自由联想').icon).toBe('folder-outline');
  });

  test('uses a theme creation date and falls back to its update date', () => {
    expect(getThemeGeneratedAt({ createdAt: 20, updatedAt: 30 })).toBe(20);
    expect(getThemeGeneratedAt({ updatedAt: 30 })).toBe(30);
    expect(getThemeGeneratedAt({})).toBe(0);
  });

  test('marks a note as AI tidied only when a distinct raw version exists', () => {
    expect(hasAiTidy({ text: '整理后', rawText: '原文' })).toBe(true);
    expect(hasAiTidy({ text: '原文', rawText: '原文' })).toBe(false);
    expect(hasAiTidy({ text: '原文' })).toBe(false);
  });

  test('builds theme cards only from notes with a theme id', () => {
    const themes = buildThemeCards([
      {
        id: 'n1',
        text: '第一条',
        themeId: 'product',
        themeTitle: '产品方向',
        themeSummary: '围绕产品方向的讨论。',
        createdAt: 10,
      },
      { id: 'n2', text: '第二条', themeId: 'product', createdAt: 20, lastTouched: 30 },
      { id: 'n3', text: '未归类', createdAt: 40 },
    ]);

    expect(themes).toHaveLength(1);
    expect(themes[0]).toMatchObject({
      id: 'product',
      title: '产品方向',
      summary: '围绕产品方向的讨论。',
      updatedAt: 30,
    });
    expect(themes[0].notes).toHaveLength(2);
  });

  test('resolves persisted themes to their source notes', () => {
    const themes = buildThemeCards([
      { id: 't1', title: '主题', summary: '总结', noteIds: ['n1', 'n2'], updatedAt: 30 },
      { id: 't2', title: '已解散', summary: '不展示', noteIds: ['n1', 'n2'], dismissed: true },
    ], [
      { id: 'n1', text: '第一条', createdAt: 10 },
      { id: 'n2', text: '第二条', createdAt: 20 },
    ]);

    expect(themes).toHaveLength(1);
    expect(themes[0].notes.map((note) => note.id)).toEqual(['n1', 'n2']);
  });
});

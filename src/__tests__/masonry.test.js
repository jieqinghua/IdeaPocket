import {
  buildMasonryLayout,
  estimateMasonryCardHeight,
  MASONRY_GAP,
  MASONRY_MAX_LINES,
} from '../masonry';

const NOTES = [
  { id: 'newest', text: '短笔记' },
  { id: 'second', text: '这是一条稍长一些、需要占据更多垂直空间的笔记内容。' },
  { id: 'third', text: '第三条笔记' },
  { id: 'fourth', text: '第四条笔记' },
];

describe('masonry layout', () => {
  test('empty input returns an empty zero-height layout', () => {
    expect(buildMasonryLayout([], 160)).toEqual({
      positions: [],
      height: 0,
      columnHeights: [0, 0],
    });
  });

  test('keeps source order while assigning cards to two columns', () => {
    const result = buildMasonryLayout(NOTES, 160);

    expect(result.positions.map((item) => item.id)).toEqual(NOTES.map((note) => note.id));
    expect(new Set(result.positions.map((item) => item.column))).toEqual(new Set([0, 1]));
    expect(result.positions.every((item) => item.width === 160)).toBe(true);
  });

  test('uses measured heights and always places the next card in the shorter column', () => {
    const result = buildMasonryLayout(NOTES.slice(0, 3), 160, {
      newest: 240,
      second: 100,
      third: 80,
    });

    expect(result.positions[0]).toMatchObject({ column: 0, top: 0, height: 240 });
    expect(result.positions[1]).toMatchObject({ column: 1, top: 0, height: 100 });
    expect(result.positions[2]).toMatchObject({ column: 1, top: 100 + MASONRY_GAP, height: 80 });
  });

  test('caps the compact card text estimate at six lines', () => {
    const sixLineHeight = estimateMasonryCardHeight(
      { id: 'six', text: '很长的笔记内容'.repeat(30) },
      160
    );
    const muchLongerHeight = estimateMasonryCardHeight(
      { id: 'longer', text: '很长的笔记内容'.repeat(100) },
      160
    );

    expect(MASONRY_MAX_LINES).toBe(6);
    expect(muchLongerHeight).toBe(sixLineHeight);
  });
  test('reserves thumbnail space for a note with an image attachment', () => {
    const plain = estimateMasonryCardHeight({ id: 'plain', text: '带图笔记' }, 160);
    const withImage = estimateMasonryCardHeight({
      id: 'image',
      text: '带图笔记',
      image: { uri: 'file:///documents/IdeaPocketImages/image.jpg' },
    }, 160);
    expect(withImage).toBeGreaterThan(plain + 80);
  });

  test('AI 润色状态不再改变首页卡片的预估高度', () => {
    const plain = estimateMasonryCardHeight({ id: 'plain', text: '同一条笔记正文' }, 160);
    const polished = estimateMasonryCardHeight({
      id: 'polished',
      text: '同一条笔记正文',
      rawText: '润色前的原始笔记',
    }, 160);

    expect(polished).toBe(plain);
  });
});

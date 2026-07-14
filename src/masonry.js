export const MASONRY_COLUMNS = 2;
export const MASONRY_GAP = 12;
export const MASONRY_MAX_LINES = 6;

export function estimateMasonryCardHeight(note, columnWidth) {
  const horizontalPadding = 24;
  const usableWidth = Math.max(1, columnWidth - horizontalPadding);
  const approximateCharactersPerLine = Math.max(5, Math.floor(usableWidth / 15));
  const textLength = Array.from(note?.text || '').length;
  const lines = Math.max(1, Math.min(MASONRY_MAX_LINES, Math.ceil(textLength / approximateCharactersPerLine)));
  const bodyHeight = lines * 22;
  const imageHeight = note?.image?.uri ? Math.round(usableWidth * 0.75) + 12 : 0;
  const footerHeight = 18;
  return horizontalPadding + bodyHeight + imageHeight + 12 + footerHeight;
}

export function buildMasonryLayout(notes, columnWidth, measuredHeights = {}, gap = MASONRY_GAP) {
  const columnHeights = Array(MASONRY_COLUMNS).fill(0);
  const positions = notes.map((note, index) => {
    const column = columnHeights[0] <= columnHeights[1] ? 0 : 1;
    const height = measuredHeights[note.id] || estimateMasonryCardHeight(note, columnWidth);
    const position = {
      id: note.id,
      index,
      column,
      left: column * (columnWidth + gap),
      top: columnHeights[column],
      width: columnWidth,
      height,
    };
    columnHeights[column] += height + gap;
    return position;
  });

  return {
    positions,
    height: notes.length ? Math.max(...columnHeights) - gap : 0,
    columnHeights,
  };
}

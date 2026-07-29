export const LIST_TOP_EPSILON = 1;

export function isListAtTop(offset) {
  return Math.max(0, Number(offset) || 0) <= LIST_TOP_EPSILON;
}

export function isNewFirstNote({
  initialized,
  searchActive,
  searchModeChanged,
  previousCount,
  nextCount,
  previousFirstId,
  nextFirstId,
}) {
  return Boolean(
    initialized
    && !searchActive
    && !searchModeChanged
    && nextCount > previousCount
    && nextFirstId
    && nextFirstId !== previousFirstId
  );
}

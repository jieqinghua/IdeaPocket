export const HOME_TAB_SWIPE_CLAIM_DISTANCE = 18;
export const HOME_TAB_SWIPE_COMMIT_DISTANCE = 56;
export const HOME_TAB_SWIPE_MIN_FLING_DISTANCE = 24;
export const HOME_TAB_SWIPE_COMMIT_VELOCITY = 0.45;
export const HOME_TAB_SWIPE_DOMINANCE_RATIO = 1.4;

const isHorizontal = (dx, dy) =>
  Math.abs(dx) > Math.abs(dy) * HOME_TAB_SWIPE_DOMINANCE_RATIO;

const isSupportedDirection = (currentTab, dx) =>
  (currentTab === 'notes' && dx < 0) || (currentTab === 'themes' && dx > 0);

export function shouldClaimHomeTabSwipe(currentTab, gesture = {}) {
  const dx = Number(gesture.dx) || 0;
  const dy = Number(gesture.dy) || 0;
  return Math.abs(dx) >= HOME_TAB_SWIPE_CLAIM_DISTANCE
    && isHorizontal(dx, dy)
    && isSupportedDirection(currentTab, dx);
}

export function resolveHomeTabSwipe(currentTab, gesture = {}) {
  const dx = Number(gesture.dx) || 0;
  const dy = Number(gesture.dy) || 0;
  const vx = Number(gesture.vx) || 0;
  if (!isHorizontal(dx, dy) || !isSupportedDirection(currentTab, dx)) return currentTab;

  const committedByDistance = Math.abs(dx) >= HOME_TAB_SWIPE_COMMIT_DISTANCE;
  const committedByVelocity = Math.abs(dx) >= HOME_TAB_SWIPE_MIN_FLING_DISTANCE
    && Math.abs(vx) >= HOME_TAB_SWIPE_COMMIT_VELOCITY;
  if (!committedByDistance && !committedByVelocity) return currentTab;

  return currentTab === 'notes' ? 'themes' : 'notes';
}

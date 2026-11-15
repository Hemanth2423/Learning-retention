// Sizing rules for the right panel. Pure so they can be tested.

export const RIGHT_MIN = 360; // px
export const RIGHT_MAX_SHARE = 0.6; // of the window width

export function clampRightWidth(width: number, viewport: number): number {
  const max = Math.max(RIGHT_MIN, Math.floor(viewport * RIGHT_MAX_SHARE));
  return Math.min(max, Math.max(RIGHT_MIN, Math.round(width)));
}

// One third of the window, within the limits.
export function defaultRightWidth(viewport: number): number {
  return clampRightWidth(viewport / 3, viewport);
}

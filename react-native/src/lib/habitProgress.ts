/** Progress fraction for the left→right green fill (0–1; overshoot caps at full). */
export function habitProgressRatio(done: number, target: number): number {
  if (!(target > 0) || !(done > 0)) return 0
  return Math.min(1, done / target)
}

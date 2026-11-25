/** Progress fraction for the left→right green fill (0–1; overshoot caps at full). */
export function habitProgressRatio(done: number, target: number): number {
  if (!(target > 0) || !(done > 0)) return 0
  return Math.min(1, done / target)
}

export type HabitProgressPart = {
  done: number
  target: number
}

/**
 * Section header progress: each habit contributes its frequency (target) as weight.
 * Per-habit overshoot is capped so one finished-early habit cannot overfill the section.
 */
export function habitSectionProgress(parts: HabitProgressPart[]): {
  done: number
  target: number
  ratio: number
  complete: boolean
} {
  let done = 0
  let target = 0
  for (const part of parts) {
    if (!(part.target > 0)) continue
    target += part.target
    done += Math.min(Math.max(0, part.done), part.target)
  }
  return {
    done,
    target,
    ratio: habitProgressRatio(done, target),
    complete: target > 0 && done >= target,
  }
}

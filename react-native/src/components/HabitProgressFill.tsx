import { habitSectionProgress, type HabitProgressPart } from '../lib/habitProgress'
import { useTheme } from '../theme/ThemeProvider'
import { RatioProgressFill } from './RatioProgressFill'

type Props = {
  parts: HabitProgressPart[]
}

/** Absolute left→right green fill from frequency-weighted habit progress. */
export function HabitProgressFill({ parts }: Props) {
  const { colors } = useTheme()
  const { ratio } = habitSectionProgress(parts)
  return <RatioProgressFill ratio={ratio} color={colors.habitCompleteBg} />
}

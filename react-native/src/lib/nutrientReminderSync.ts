/** Load goals + today's progress and refresh local nutrient reminder schedules. */

import {
  loadIntakes,
  loadNutrientGoalMilestones,
  loadNutrientGoals,
} from './gym'
import { localDate } from './localDate'
import { summarizeNutrition } from './nutrition'
import { syncNutrientReminderNotifications } from './nutrientTargetReminderNotifications'

/**
 * Refresh device schedules from the owner's goals and **today's** intake.
 * Always uses the device calendar day — not a Diet date-picker day — so viewing
 * another day cannot poison or freeze today's checkpoint nags.
 */
export async function syncNutrientRemindersForUser(
  userId: string,
  _ignoredDay?: string,
): Promise<void> {
  const today = localDate()
  const [goals, milestones, intakes] = await Promise.all([
    loadNutrientGoals(userId),
    loadNutrientGoalMilestones(userId),
    loadIntakes(userId, today),
  ])
  const progressByNutrientId: Record<string, number> = {}
  for (const line of summarizeNutrition(intakes)) {
    progressByNutrientId[line.id] = line.total
  }
  await syncNutrientReminderNotifications({
    goals,
    milestones,
    progressByNutrientId,
    today,
  })
}

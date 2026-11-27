/** Load goals + today's progress and refresh local nutrient reminder schedules. */

import {
  loadIntakes,
  loadNutrientGoalMilestones,
  loadNutrientGoals,
} from './gym'
import { summarizeNutrition } from './nutrition'
import { syncNutrientReminderNotifications } from './nutrientTargetReminderNotifications'

export async function syncNutrientRemindersForUser(userId: string, day: string): Promise<void> {
  const [goals, milestones, intakes] = await Promise.all([
    loadNutrientGoals(userId),
    loadNutrientGoalMilestones(userId),
    loadIntakes(userId, day),
  ])
  const progressByNutrientId: Record<string, number> = {}
  for (const line of summarizeNutrition(intakes)) {
    progressByNutrientId[line.id] = line.total
  }
  await syncNutrientReminderNotifications({
    goals,
    milestones,
    progressByNutrientId,
  })
}

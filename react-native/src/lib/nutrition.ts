import type { Basis, Measure } from './measure'

export type NutritionFood = {
  name: string
  measure: Measure
  basis: Basis
  nutrients: {
    amount: number
    nutrient: { id: string; name: string; unit: string }
  }[]
}

export type NutritionIntake = {
  amount: number
  food: NutritionFood
}

export type NutritionLine = {
  id: string
  name: string
  unit: string
  total: number
}

export type NutritionContribution = {
  key: string
  foodName: string
  amount: number
  measure: Measure
  total: number
}

/** How many measure units the food's nutrient amounts are defined for. */
export function nutrientBasisSize(measure: Measure, basis: Basis): number {
  if (measure === 'unit') return 1
  if (basis === 'per_kg') return 1000
  return 100
}

export function nutrientFromIntake(
  intakeAmount: number,
  measure: Measure,
  basis: Basis,
  nutrientPerBasis: number,
): number {
  return (intakeAmount / nutrientBasisSize(measure, basis)) * nutrientPerBasis
}

/** Sum each nutrient across intakes. Lines with a zero total are omitted. */
export function summarizeNutrition(intakes: NutritionIntake[]): NutritionLine[] {
  const totals = new Map<string, NutritionLine>()

  for (const intake of intakes) {
    for (const row of intake.food.nutrients) {
      const add = nutrientFromIntake(intake.amount, intake.food.measure, intake.food.basis, row.amount)
      const current = totals.get(row.nutrient.id)
      if (current) {
        current.total += add
      } else {
        totals.set(row.nutrient.id, {
          id: row.nutrient.id,
          name: row.nutrient.name,
          unit: row.nutrient.unit,
          total: add,
        })
      }
    }
  }

  return [...totals.values()]
    .filter((line) => line.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function formatNutrientTotal(total: number): string {
  if (Number.isInteger(total) || Math.abs(total - Math.round(total)) < 1e-6) {
    return String(Math.round(total))
  }
  return total.toFixed(1)
}

export function nutritionSummaryTitle(day: string, today: string): string {
  return day === today ? "Today's Nutrition Summary" : "Day's Nutrition Summary"
}

export type NutritionProgressLine = NutritionLine & {
  goal: number | null
  /** 0–1 fill toward the goal; null when there is no goal. */
  progress: number | null
}

/** Merge logged totals with optional per-nutrient goals for progress rows. */
export function nutritionProgressLines(
  summary: NutritionLine[],
  goals: { nutrient_id: string; amount: number; name: string; unit: string }[],
): NutritionProgressLine[] {
  const byId = new Map(summary.map((line) => [line.id, line]))
  const seen = new Set<string>()
  const lines: NutritionProgressLine[] = []

  for (const goal of goals) {
    seen.add(goal.nutrient_id)
    const current = byId.get(goal.nutrient_id)
    const total = current?.total ?? 0
    lines.push({
      id: goal.nutrient_id,
      name: current?.name ?? goal.name,
      unit: current?.unit ?? goal.unit,
      total,
      goal: goal.amount,
      progress: goal.amount > 0 ? Math.min(1, total / goal.amount) : null,
    })
  }

  for (const line of summary) {
    if (seen.has(line.id)) continue
    lines.push({ ...line, goal: null, progress: null })
  }

  return lines.sort((a, b) => a.name.localeCompare(b.name))
}

/** Nutrients contributed by one logged intake. */
export function intakeNutrition(intake: NutritionIntake): NutritionLine[] {
  return summarizeNutrition([intake])
}

/** Catalog amounts on a food (per its measure basis), not scaled by intake. */
export function foodTypeNutrition(food: NutritionFood): NutritionLine[] {
  return food.nutrients
    .filter((row) => row.amount > 0)
    .map((row) => ({
      id: row.nutrient.id,
      name: row.nutrient.name,
      unit: row.nutrient.unit,
      total: row.amount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function foodBasisLabel(measure: Measure, basis: Basis): string {
  if (measure === 'unit') return 'Per Unit'
  if (basis === 'per_kg') return 'Per kilogram'
  if (measure === 'ml') return 'Per 100 ml'
  return 'Per 100 g'
}

/** How much each intake contributed to one nutrient. */
export function nutrientContributions(
  intakes: NutritionIntake[],
  nutrientId: string,
): NutritionContribution[] {
  const lines: NutritionContribution[] = []

  intakes.forEach((intake, index) => {
    const row = intake.food.nutrients.find((item) => item.nutrient.id === nutrientId)
    if (!row) return
    const total = nutrientFromIntake(intake.amount, intake.food.measure, intake.food.basis, row.amount)
    if (!(total > 0)) return
    lines.push({
      key: `${index}-${nutrientId}`,
      foodName: intake.food.name,
      amount: intake.amount,
      measure: intake.food.measure,
      total,
    })
  })

  return lines
}

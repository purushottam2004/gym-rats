import type { Basis, Measure } from './measure'

export type NutritionFood = {
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

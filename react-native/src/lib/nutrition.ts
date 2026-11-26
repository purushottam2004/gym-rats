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

export type NutrientGoalBounds = {
  nutrient_id: string
  min_amount: number | null
  max_amount: number | null
  name: string
  unit: string
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
  min: number | null
  max: number | null
  /** 0–1 bar width; null when there is no goal band. */
  progress: number | null
  /** Fill: yellow→green to min, then green→orange→red toward max. */
  fillColor: string | null
}

const FILL_YELLOW = { r: 253, g: 230, b: 138 } // #fde68a
const FILL_GREEN = { r: 134, g: 239, b: 172 } // #86efac
const FILL_ORANGE = { r: 253, g: 186, b: 116 } // #fdba74
const FILL_RED = { r: 252, g: 165, b: 165 } // #fca5a5

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function mixRgb(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): string {
  const p = clamp01(t)
  const r = Math.round(from.r + (to.r - from.r) * p)
  const g = Math.round(from.g + (to.g - from.g) * p)
  const b = Math.round(from.b + (to.b - from.b) * p)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

/** After min, warm green→orange→red through the remaining band (not only at max). */
function colorPastMin(t: number): string {
  if (t <= 0.5) return mixRgb(FILL_GREEN, FILL_ORANGE, t / 0.5)
  return mixRgb(FILL_ORANGE, FILL_RED, (t - 0.5) / 0.5)
}

/** Yellow→green toward min; past min, green→orange→red toward max; over max = red. */
export function nutrientBandFill(
  total: number,
  min: number | null,
  max: number | null,
): { progress: number; fillColor: string } | null {
  if (min == null && max == null) return null

  if (max != null && total > max) {
    return { progress: 1, fillColor: mixRgb(FILL_RED, FILL_RED, 1) }
  }

  if (min != null && max != null) {
    const width = clamp01(total / max)
    if (total < min) {
      return { progress: width, fillColor: mixRgb(FILL_YELLOW, FILL_GREEN, total / min) }
    }
    const span = max - min
    const past = span > 0 ? (total - min) / span : 1
    return { progress: width, fillColor: colorPastMin(past) }
  }

  if (min != null) {
    const t = clamp01(total / min)
    return { progress: Math.max(t, total > min ? 1 : t), fillColor: mixRgb(FILL_YELLOW, FILL_GREEN, t) }
  }

  // max only: yellow→green early, then warm toward red before max
  const ceiling = max as number
  const width = clamp01(total / ceiling)
  if (width < 0.5) {
    return { progress: width, fillColor: mixRgb(FILL_YELLOW, FILL_GREEN, width / 0.5) }
  }
  return { progress: width, fillColor: colorPastMin((width - 0.5) / 0.5) }
}

export function formatNutrientGoalMeta(
  total: number,
  min: number | null,
  max: number | null,
  unit: string,
): string {
  const value = formatNutrientTotal(total)
  if (min != null && max != null) {
    return `${value} / ${formatNutrientTotal(min)}–${formatNutrientTotal(max)} ${unit}`
  }
  if (min != null) {
    return `${value} / ${formatNutrientTotal(min)} ${unit}`
  }
  if (max != null) {
    return `${value} / ${formatNutrientTotal(max)} ${unit}`
  }
  return `${value} ${unit}`
}

/** Merge logged totals with optional per-nutrient min/max goals for progress rows. */
export function nutritionProgressLines(
  summary: NutritionLine[],
  goals: NutrientGoalBounds[],
): NutritionProgressLine[] {
  const byId = new Map(summary.map((line) => [line.id, line]))
  const seen = new Set<string>()
  const lines: NutritionProgressLine[] = []

  for (const goal of goals) {
    if (goal.min_amount == null && goal.max_amount == null) continue
    seen.add(goal.nutrient_id)
    const current = byId.get(goal.nutrient_id)
    const total = current?.total ?? 0
    const min = goal.min_amount
    const max = goal.max_amount
    const band = nutrientBandFill(total, min, max)
    lines.push({
      id: goal.nutrient_id,
      name: current?.name ?? goal.name,
      unit: current?.unit ?? goal.unit,
      total,
      min,
      max,
      progress: band?.progress ?? null,
      fillColor: band?.fillColor ?? null,
    })
  }

  for (const line of summary) {
    if (seen.has(line.id)) continue
    lines.push({ ...line, min: null, max: null, progress: null, fillColor: null })
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

export function foodBasisLabel(
  measure: Measure,
  basis: Basis,
  opts?: { isOther?: boolean },
): string {
  if (opts?.isOther) return 'This entry'
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

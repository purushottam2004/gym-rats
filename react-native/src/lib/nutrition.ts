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
  /**
   * Fill color: yellow→green while approaching min; only after min does the
   * color warm green→orange→red toward max.
   */
  fillColor: string | null
}

/** Light-theme pastel ramp (default / light habitCompleteBg). */
const FILL_YELLOW_LIGHT = { r: 253, g: 230, b: 138 } // #fde68a
const FILL_ORANGE_LIGHT = { r: 253, g: 186, b: 116 } // #fdba74
const FILL_RED_LIGHT = { r: 252, g: 165, b: 165 } // #fca5a5
/** Dark-theme ramp — stays dark so habitCompleteText stays readable on partial fills. */
const FILL_YELLOW_DARK = { r: 113, g: 63, b: 18 } // #713f12
const FILL_ORANGE_DARK = { r: 154, g: 52, b: 18 } // #9a3412
const FILL_RED_DARK = { r: 153, g: 27, b: 27 } // #991b1b
/** Default complete green — light habitCompleteBg; UI passes theme habitCompleteBg. */
const FILL_GREEN_DEFAULT = { r: 187, g: 247, b: 208 } // #bbf7d0

type Rgb = { r: number; g: number; b: number }

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function parseHexRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

function mixRgb(from: Rgb, to: Rgb, t: number): string {
  const p = clamp01(t)
  const r = Math.round(from.r + (to.r - from.r) * p)
  const g = Math.round(from.g + (to.g - from.g) * p)
  const b = Math.round(from.b + (to.b - from.b) * p)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function rgbLuminance(rgb: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** WCAG relative luminance for choosing text that sits on a fill. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex)
  if (!rgb) return 0.5
  return rgbLuminance(rgb)
}

/**
 * Readable text color for glyphs drawn on top of a nutrient fill.
 * Dark habit greens get light mint; light pastels get deep green.
 */
export function contrastTextForFill(fillHex: string): string {
  return relativeLuminance(fillHex) < 0.45 ? '#bbf7d0' : '#14532d'
}

function fillRamp(green: Rgb): { yellow: Rgb; orange: Rgb; red: Rgb } {
  // Dark completion green (Habits dark) → keep the whole ramp dark.
  if (rgbLuminance(green) < 0.45) {
    return { yellow: FILL_YELLOW_DARK, orange: FILL_ORANGE_DARK, red: FILL_RED_DARK }
  }
  return { yellow: FILL_YELLOW_LIGHT, orange: FILL_ORANGE_LIGHT, red: FILL_RED_LIGHT }
}

/** After min, warm green→orange→red through the remaining band (not only at max). */
function colorPastMin(t: number, green: Rgb, orange: Rgb, red: Rgb): string {
  if (t <= 0.5) return mixRgb(green, orange, t / 0.5)
  return mixRgb(orange, red, (t - 0.5) / 0.5)
}

/**
 * Yellow→green toward min (bar width = total/min). Once min is met the bar stays
 * full and only the color changes (green→orange→red toward max). Over max = red.
 *
 * Pass `completeGreen` (theme habitCompleteBg) so completion matches Habits.
 */
export function nutrientBandFill(
  total: number,
  min: number | null,
  max: number | null,
  completeGreen?: string,
): { progress: number; fillColor: string } | null {
  if (min == null && max == null) return null
  const green = parseHexRgb(completeGreen ?? '') ?? FILL_GREEN_DEFAULT
  const { yellow, orange, red } = fillRamp(green)

  if (max != null && total > max) {
    return { progress: 1, fillColor: mixRgb(red, red, 1) }
  }

  if (min != null && max != null) {
    // Width is always vs min so the bar is full at the lower bound.
    const width = clamp01(total / min)
    if (total < min) {
      return { progress: width, fillColor: mixRgb(yellow, green, total / min) }
    }
    // Past min: bar stays full; color alone tracks position toward max.
    const span = max - min
    const past = span > 0 ? (total - min) / span : 1
    return { progress: 1, fillColor: colorPastMin(past, green, orange, red) }
  }

  if (min != null) {
    const t = clamp01(total / min)
    return { progress: Math.max(t, total > min ? 1 : t), fillColor: mixRgb(yellow, green, t) }
  }

  // max only: yellow→green early, then warm toward red before max
  const ceiling = max as number
  const width = clamp01(total / ceiling)
  if (width < 0.5) {
    return { progress: width, fillColor: mixRgb(yellow, green, width / 0.5) }
  }
  return { progress: width, fillColor: colorPastMin((width - 0.5) / 0.5, green, orange, red) }
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
  /** Theme habitCompleteBg so full bars match Habits completion green. */
  completeGreen?: string,
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
    const band = nutrientBandFill(total, min, max, completeGreen)
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

export const MEASURES = ['g', 'ml', 'unit'] as const

export type Measure = (typeof MEASURES)[number]
export type Basis = 'per_100' | 'per_kg'

export function measureLabel(measure: Measure): string {
  if (measure === 'unit') return 'Unit'
  return measure
}

/** Per-kilogram nutrition is only defined for foods weighed in grams. */
export function basisForMeasure(measure: Measure, basis: Basis): Basis {
  return measure === 'g' ? basis : 'per_100'
}

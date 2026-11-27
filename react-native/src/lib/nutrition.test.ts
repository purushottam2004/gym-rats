import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  contrastTextForFill,
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientGoalMeta,
  formatNutrientTotal,
  nutrientBandFill,
  nutrientBasisSize,
  nutrientContributions,
  nutrientFromIntake,
  nutritionProgressLines,
  nutritionSummaryTitle,
  summarizeNutrition,
} from './nutrition.ts'

const milk = {
  amount: 250,
  food: {
    name: 'Calci+ Milk',
    measure: 'ml' as const,
    basis: 'per_100' as const,
    nutrients: [
      { amount: 120, nutrient: { id: 'energy', name: 'Energy', unit: 'kcal' } },
      { amount: 40, nutrient: { id: 'calcium', name: 'Calcium', unit: 'mg' } },
    ],
  },
}

const eggs = {
  amount: 2,
  food: {
    name: 'Eggs',
    measure: 'unit' as const,
    basis: 'per_100' as const,
    nutrients: [{ amount: 6, nutrient: { id: 'protein', name: 'Protein', unit: 'g' } }],
  },
}

const bar = {
  amount: 50,
  food: {
    name: 'Protein bar',
    measure: 'g' as const,
    basis: 'per_100' as const,
    nutrients: [{ amount: 20, nutrient: { id: 'protein', name: 'Protein', unit: 'g' } }],
  },
}

describe('nutrientBasisSize', () => {
  it('uses one unit, 100 for per_100, and 1000 for per_kg', () => {
    assert.equal(nutrientBasisSize('unit', 'per_100'), 1)
    assert.equal(nutrientBasisSize('ml', 'per_100'), 100)
    assert.equal(nutrientBasisSize('g', 'per_100'), 100)
    assert.equal(nutrientBasisSize('g', 'per_kg'), 1000)
  })
})

describe('nutrientFromIntake', () => {
  it('scales grams per 100 g', () => {
    assert.equal(nutrientFromIntake(50, 'g', 'per_100', 20), 10)
  })

  it('scales grams per kilogram', () => {
    assert.equal(nutrientFromIntake(500, 'g', 'per_kg', 100), 50)
  })

  it('scales millilitres per 100 ml', () => {
    assert.equal(nutrientFromIntake(250, 'ml', 'per_100', 120), 300)
  })

  it('scales unit foods per single unit', () => {
    assert.equal(nutrientFromIntake(2, 'unit', 'per_100', 6), 12)
  })
})

describe('summarizeNutrition', () => {
  it('totals matching nutrients across intakes and sorts by name', () => {
    const lines = summarizeNutrition([milk, eggs, bar])

    assert.deepEqual(
      lines.map((line) => ({ name: line.name, unit: line.unit, total: line.total })),
      [
        { name: 'Calcium', unit: 'mg', total: 100 },
        { name: 'Energy', unit: 'kcal', total: 300 },
        { name: 'Protein', unit: 'g', total: 22 },
      ],
    )
  })

  it('omits zero totals', () => {
    assert.deepEqual(
      summarizeNutrition([
        {
          amount: 100,
          food: {
            name: 'Water',
            measure: 'g',
            basis: 'per_100',
            nutrients: [{ amount: 0, nutrient: { id: 'fat', name: 'Fat', unit: 'g' } }],
          },
        },
      ]),
      [],
    )
  })
})

describe('foodTypeNutrition', () => {
  it('returns catalog amounts for the food type', () => {
    assert.deepEqual(
      foodTypeNutrition(milk.food).map((line) => ({ name: line.name, total: line.total })),
      [
        { name: 'Calcium', total: 40 },
        { name: 'Energy', total: 120 },
      ],
    )
  })
})

describe('foodBasisLabel', () => {
  it('names the food nutrient basis', () => {
    assert.equal(foodBasisLabel('unit', 'per_100'), 'Per Unit')
    assert.equal(foodBasisLabel('ml', 'per_100'), 'Per 100 ml')
    assert.equal(foodBasisLabel('g', 'per_100'), 'Per 100 g')
    assert.equal(foodBasisLabel('g', 'per_kg'), 'Per kilogram')
    assert.equal(foodBasisLabel('unit', 'per_100', { isOther: true }), 'This entry')
  })
})

describe('nutrientContributions', () => {
  it('lists each food that adds to a nutrient', () => {
    assert.deepEqual(
      nutrientContributions([milk, eggs, bar], 'protein').map((line) => ({
        foodName: line.foodName,
        total: line.total,
      })),
      [
        { foodName: 'Eggs', total: 12 },
        { foodName: 'Protein bar', total: 10 },
      ],
    )
  })
})

describe('formatNutrientTotal', () => {
  it('keeps whole numbers and one decimal otherwise', () => {
    assert.equal(formatNutrientTotal(12), '12')
    assert.equal(formatNutrientTotal(12.0), '12')
    assert.equal(formatNutrientTotal(12.25), '12.3')
  })
})

describe('nutritionSummaryTitle', () => {
  it('names today vs another day', () => {
    assert.equal(nutritionSummaryTitle('2026-11-23', '2026-11-23'), "Today's Nutrition Summary")
    assert.equal(nutritionSummaryTitle('2026-11-22', '2026-11-23'), "Day's Nutrition Summary")
  })
})

describe('nutritionProgressLines', () => {
  it('applies min/max bands and keeps goal-less lines', () => {
    const summary = summarizeNutrition([milk, eggs])
    const lines = nutritionProgressLines(summary, [
      { nutrient_id: 'energy', min_amount: 100, max_amount: null, name: 'Energy', unit: 'kcal' },
      { nutrient_id: 'protein', min_amount: 50, max_amount: 80, name: 'Protein', unit: 'g' },
    ])
    const energy = lines.find((line) => line.id === 'energy')
    const protein = lines.find((line) => line.id === 'protein')
    const calcium = lines.find((line) => line.id === 'calcium')
    assert.ok(energy)
    assert.equal(energy.min, 100)
    assert.equal(energy.max, null)
    assert.equal(energy.progress, 1)
    assert.ok(energy.fillColor)
    assert.ok(protein)
    assert.equal(protein.total, 12)
    assert.ok(protein.progress != null && protein.progress < 1)
    assert.ok(calcium)
    assert.equal(calcium.min, null)
    assert.equal(calcium.max, null)
    assert.equal(calcium.fillColor, null)
  })
})

describe('nutrientBandFill', () => {
  it('ramps yellow to green toward a min and warms past min before max', () => {
    const low = nutrientBandFill(25, 100, null)
    const met = nutrientBandFill(100, 100, null)
    const midBand = nutrientBandFill(75, 50, 100)
    const over = nutrientBandFill(120, 50, 100)
    assert.ok(low)
    assert.equal(low.progress, 0.25)
    assert.notEqual(low.fillColor, met?.fillColor)
    assert.ok(met)
    assert.equal(met.progress, 1)
    assert.equal(met.fillColor, '#bbf7d0')
    assert.ok(midBand)
    // Min–max band: width is vs min (full once min is met); color warms past min.
    assert.equal(midBand.progress, 1)
    assert.notEqual(midBand.fillColor, met.fillColor)
    assert.ok(over)
    assert.equal(over.progress, 1)
    assert.equal(over.fillColor, '#fca5a5')
  })

  it('sizes min–max bars against min and only warms color after min', () => {
    const below = nutrientBandFill(50, 100, 1500)
    const atMin = nutrientBandFill(100, 100, 1500)
    const pastMin = nutrientBandFill(342, 100, 1500)
    assert.ok(below)
    assert.equal(below.progress, 0.5)
    assert.ok(atMin)
    assert.equal(atMin.progress, 1)
    assert.equal(atMin.fillColor, '#bbf7d0')
    assert.ok(pastMin)
    assert.equal(pastMin.progress, 1)
    assert.notEqual(pastMin.fillColor, atMin.fillColor)
    assert.notEqual(pastMin.fillColor, below.fillColor)
  })

  it('uses theme habitCompleteBg as the completion green', () => {
    const met = nutrientBandFill(100, 100, null, '#166534')
    assert.ok(met)
    assert.equal(met.fillColor, '#166534')
  })
})

describe('contrastTextForFill', () => {
  it('picks light text on dark habit green and dark text on pastel fills', () => {
    assert.equal(contrastTextForFill('#166534'), '#bbf7d0')
    assert.equal(contrastTextForFill('#bbf7d0'), '#14532d')
    assert.equal(contrastTextForFill('#fde68a'), '#14532d')
  })
})

describe('formatNutrientGoalMeta', () => {
  it('labels min, max, and band without inequality signs', () => {
    assert.equal(formatNutrientGoalMeta(12, 100, null, 'g'), '12 / 100 g')
    assert.equal(formatNutrientGoalMeta(12, null, 100, 'g'), '12 / 100 g')
    assert.equal(formatNutrientGoalMeta(12, 80, 120, 'g'), '12 / 80–120 g')
  })
})

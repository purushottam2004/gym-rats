import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientTotal,
  nutrientBasisSize,
  nutrientContributions,
  nutrientFromIntake,
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

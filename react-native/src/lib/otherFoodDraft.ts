/** In-memory draft so photo estimate can prefill Other without huge route params. */

export type OtherFoodDraft = {
  name: string
  amounts: Record<string, string>
}

let draft: OtherFoodDraft | null = null

export function setOtherFoodDraft(next: OtherFoodDraft): void {
  draft = {
    name: next.name,
    amounts: { ...next.amounts },
  }
}

/** Read and clear the pending draft (once). */
export function consumeOtherFoodDraft(): OtherFoodDraft | null {
  const current = draft
  draft = null
  return current
}

export function formatEstimatedAmount(amount: number): string {
  if (!(amount > 0) || Number.isNaN(amount)) return ''
  if (Number.isInteger(amount) || Math.abs(amount - Math.round(amount)) < 1e-6) {
    return String(Math.round(amount))
  }
  return amount.toFixed(1)
}

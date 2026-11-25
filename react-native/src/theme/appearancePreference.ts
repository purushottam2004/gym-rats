export type AppearancePreference = 'light' | 'dark' | 'system'

export const APPEARANCE_STORAGE_KEY = 'gym-rats-appearance'

export function parseAppearancePreference(raw: string | null | undefined): AppearancePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export function loadAppearancePreference(): AppearancePreference {
  try {
    return parseAppearancePreference(localStorage.getItem(APPEARANCE_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function saveAppearancePreference(preference: AppearancePreference): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, preference)
  } catch {
    // Ignore quota / private-mode failures; preference still applies in-session.
  }
}

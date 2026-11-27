export type ResolvedScheme = 'light' | 'dark'

export type ThemeColors = {
  pageBg: string
  surface: string
  surfaceAlt: string
  border: string
  borderSubtle: string
  text: string
  textBody: string
  textLabel: string
  textMuted: string
  accent: string
  accentText: string
  accentSoft: string
  accentSoftBorder: string
  rowSelected: string
  rowPressed: string
  rowSelectedPressed: string
  danger: string
  dangerSoft: string
  inputBorder: string
  buttonBg: string
  buttonText: string
  secondaryButtonBg: string
  secondaryButtonText: string
  codeBg: string
  codeText: string
  avatarFallback: string
  avatarInitial: string
  nutrientFill: string
  modalBackdrop: string
  setSelectedBg: string
  setBorder: string
  toastSuccessBg: string
  toastSuccessBorder: string
  toastSuccessText: string
  /** Habit row complete fill — a touch greener than toast success, not forest. */
  habitCompleteBg: string
  habitCompleteBorder: string
  habitCompleteText: string
  toastErrorBg: string
  toastErrorBorder: string
  toastErrorText: string
  placeholder: string
  tabInactive: string
  youLabel: string
  resultBg: string
}

export const lightColors: ThemeColors = {
  pageBg: '#f5f5f4',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f4',
  border: '#e7e5e4',
  borderSubtle: '#f0eeeb',
  text: '#1c1917',
  textBody: '#4b5563',
  textLabel: '#374151',
  textMuted: '#78716c',
  accent: '#c2410c',
  accentText: '#9a3412',
  accentSoft: '#fff7ed',
  accentSoftBorder: '#fdba74',
  rowSelected: '#fff7ed',
  rowPressed: '#fafaf9',
  rowSelectedPressed: '#ffedd5',
  danger: '#e5484d',
  dangerSoft: '#fff1f2',
  inputBorder: '#d1d5db',
  buttonBg: '#1c1917',
  buttonText: '#ffffff',
  secondaryButtonBg: '#ffffff',
  secondaryButtonText: '#111827',
  codeBg: '#1c1917',
  codeText: '#fafaf9',
  avatarFallback: '#e7e5e4',
  avatarInitial: '#57534e',
  nutrientFill: '#bbf7d0',
  modalBackdrop: 'rgba(28, 25, 23, 0.45)',
  setSelectedBg: '#2563eb',
  setBorder: '#d1d5db',
  toastSuccessBg: '#ecfdf3',
  toastSuccessBorder: '#bbf7d0',
  toastSuccessText: '#166534',
  habitCompleteBg: '#bbf7d0',
  habitCompleteBorder: '#4ade80',
  habitCompleteText: '#15803d',
  toastErrorBg: '#fef2f2',
  toastErrorBorder: '#fecaca',
  toastErrorText: '#991b1b',
  placeholder: '#a8a29e',
  tabInactive: '#a8a29e',
  youLabel: '#9a3412',
  resultBg: '#f4f4f5',
}

export const darkColors: ThemeColors = {
  pageBg: '#1c1917',
  surface: '#292524',
  surfaceAlt: '#44403c',
  border: '#44403c',
  borderSubtle: '#3f3f46',
  text: '#fafaf9',
  textBody: '#d6d3d1',
  textLabel: '#e7e5e4',
  textMuted: '#a8a29e',
  accent: '#fb923c',
  accentText: '#fdba74',
  accentSoft: '#431407',
  accentSoftBorder: '#c2410c',
  rowSelected: '#431407',
  rowPressed: '#44403c',
  rowSelectedPressed: '#7c2d12',
  danger: '#f87171',
  dangerSoft: '#450a0a',
  inputBorder: '#57534e',
  buttonBg: '#fafaf9',
  buttonText: '#1c1917',
  secondaryButtonBg: '#292524',
  secondaryButtonText: '#fafaf9',
  codeBg: '#0c0a09',
  codeText: '#fafaf9',
  avatarFallback: '#44403c',
  avatarInitial: '#d6d3d1',
  nutrientFill: '#166534',
  modalBackdrop: 'rgba(0, 0, 0, 0.72)',
  setSelectedBg: '#2563eb',
  setBorder: '#57534e',
  toastSuccessBg: '#14532d',
  toastSuccessBorder: '#166534',
  toastSuccessText: '#bbf7d0',
  habitCompleteBg: '#166534',
  habitCompleteBorder: '#22c55e',
  habitCompleteText: '#86efac',
  toastErrorBg: '#7f1d1d',
  toastErrorBorder: '#991b1b',
  toastErrorText: '#fecaca',
  placeholder: '#78716c',
  tabInactive: '#78716c',
  youLabel: '#fdba74',
  resultBg: '#44403c',
}

export function colorsForScheme(scheme: ResolvedScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors
}

import 'expo-sqlite/localStorage/install'
import { StatusBar } from 'expo-status-bar'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { Platform, useColorScheme } from 'react-native'
import { createScreenStyles, type ScreenStyles } from '../components/screenStyles'
import {
  loadAppearancePreference,
  saveAppearancePreference,
  type AppearancePreference,
} from './appearancePreference'
import { colorsForScheme, type ResolvedScheme, type ThemeColors } from './colors'

type ThemeContextValue = {
  preference: AppearancePreference
  setPreference: (preference: AppearancePreference) => void
  resolved: ResolvedScheme
  colors: ThemeColors
  screen: ScreenStyles
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const WEB_PLACEHOLDER_STYLE_ID = 'gym-rats-placeholder-style'

function syncWebPlaceholderColor(color: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  let style = document.getElementById(WEB_PLACEHOLDER_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = WEB_PLACEHOLDER_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `
    input::placeholder,
    textarea::placeholder {
      color: ${color} !important;
      font-style: italic !important;
      opacity: 1;
    }
  `
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<AppearancePreference>(() => loadAppearancePreference())

  const resolved: ResolvedScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference

  const colors = useMemo(() => colorsForScheme(resolved), [resolved])
  const screen = useMemo(() => createScreenStyles(colors), [colors])

  function setPreference(next: AppearancePreference) {
    setPreferenceState(next)
    saveAppearancePreference(next)
  }

  useEffect(() => {
    syncWebPlaceholderColor(colors.placeholder)
  }, [colors.placeholder])

  const value = useMemo(
    () => ({ preference, setPreference, resolved, colors, screen }),
    [preference, resolved, colors, screen],
  )

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}

export function useScreenStyles(): ScreenStyles {
  return useTheme().screen
}

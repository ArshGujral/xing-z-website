import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export const THEME_KEY = 'xingz-theme'

const ThemeContext = createContext({ theme: 'dark', toggle: () => {} })

// The site is designed dark first. Light is the visitor's choice, remembered on their device; the inline
// script in index.html applies it before the first paint so the page doesn't flash dark.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3fbfa' : '#050a0a')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Storage can be blocked (private mode); the choice then lasts for this visit only.
    }
  }, [theme])

  const toggle = useCallback(() => {
    const root = document.documentElement
    root.classList.add('theme-switching')
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
    setTimeout(() => root.classList.remove('theme-switching'), 450)
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

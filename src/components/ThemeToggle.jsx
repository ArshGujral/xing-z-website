import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme.jsx'

// Switches between the dark and light themes; shows the theme it switches to.
export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const toLight = theme !== 'light'
  const label = toLight ? 'Switch to light mode' : 'Switch to dark mode'
  const icon = (shown) =>
    `absolute w-[18px] h-[18px] transition-all duration-500 ${shown ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="liquid-glass w-9 h-9 flex-none rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
    >
      <Sun className={icon(toLight)} />
      <Moon className={icon(!toLight)} />
    </button>
  )
}

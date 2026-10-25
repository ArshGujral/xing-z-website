import Home from './pages/Home.jsx'
import { ThemeProvider } from './theme.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <Home />
    </ThemeProvider>
  )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import Configurator from './pages/Configurator.jsx'
import { ThemeProvider } from './theme.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Configurator />
    </ThemeProvider>
  </React.StrictMode>,
)

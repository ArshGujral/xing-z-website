import React from 'react'
import ReactDOM from 'react-dom/client'
import Configurator from './pages/Configurator.jsx'
import { ThemeProvider } from './theme.jsx'
import './index.css'
import { hideLoader } from './loader/hide.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Configurator />
    </ThemeProvider>
  </React.StrictMode>,
)

hideLoader()

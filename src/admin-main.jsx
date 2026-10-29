import React from 'react'
import ReactDOM from 'react-dom/client'
import Admin from './pages/Admin.jsx'
import { ThemeProvider } from './theme.jsx'
import './index.css'
import { hideLoader } from './loader/hide.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Admin />
    </ThemeProvider>
  </React.StrictMode>,
)

hideLoader()

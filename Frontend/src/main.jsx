import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style/tokens.generated.css'
import './style/fonts.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style/tokens.generated.css'
import './style/fonts.css'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './component/common/ErrorBoundary.jsx'

/*
 * The boundary sits OUTSIDE App, so a crash inside GameProvider - which owns
 * every piece of state the game has - is caught too. Inside App it would go
 * down with the tree it was meant to report on.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

/* Tells the boot check in index.html that the bundle arrived and ran. Without
   it, a bundle that 404s leaves a blank page saying nothing at all. */
window.__invasionBooted = true

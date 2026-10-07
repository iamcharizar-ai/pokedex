import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-600.css'
import '@fontsource/lilita-one/latin-400.css'
import './index.css'
import App from './App.tsx'
import { KitPage } from './Kit.tsx'

// ?kit shows the kit page: the pieces of the new look, on stand-in art
const kit = new URLSearchParams(location.search).has('kit')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {kit ? <KitPage /> : <App />}
  </StrictMode>,
)

// Installable and usable offline: the shell and every sprite seen once are cached.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed; carrying on without offline support', err)))
}

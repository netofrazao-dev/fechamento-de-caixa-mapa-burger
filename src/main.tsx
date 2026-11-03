import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AuthProvider from './components/AuthProvider'
import { aplicarTema, lerTemaSalvo } from './lib/theme'
import { escutarInstalacao } from './lib/instalar'

aplicarTema(lerTemaSalvo())
escutarInstalacao()

// App instalável: só em produção (no desenvolvimento atrapalharia as atualizações).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sem service worker o app funciona normal, só não instala/abre offline
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

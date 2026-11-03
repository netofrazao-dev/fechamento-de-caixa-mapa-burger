import { useEffect, useState } from 'react'

/** Evento do Chrome/Android que permite abrir o "Instalar app". */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoGuardado: EventoInstalar | null = null
const ouvintes = new Set<() => void>()

/** Chamado logo ao abrir o app (main.tsx): o evento chega cedo e só uma vez. */
export function escutarInstalacao(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    eventoGuardado = e as EventoInstalar
    ouvintes.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    eventoGuardado = null
    ouvintes.forEach((f) => f())
  })
}

function rodandoComoApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function ehIPhone(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * Estado do "Instalar no celular":
 * - podeInstalar: Android/Chrome com o botão nativo disponível;
 * - instrucaoIPhone: no iPhone é pelo Compartilhar → Adicionar à Tela de Início;
 * - instalado: já está aberto como app.
 */
export function useInstalarApp() {
  const [, forcar] = useState(0)
  useEffect(() => {
    const f = () => forcar((n) => n + 1)
    ouvintes.add(f)
    return () => {
      ouvintes.delete(f)
    }
  }, [])

  const instalado = rodandoComoApp()
  return {
    instalado,
    podeInstalar: !instalado && eventoGuardado !== null,
    instrucaoIPhone: !instalado && ehIPhone(),
    async instalar(): Promise<boolean> {
      const ev = eventoGuardado
      if (!ev) return false
      await ev.prompt()
      const escolha = await ev.userChoice
      eventoGuardado = null
      ouvintes.forEach((f) => f())
      return escolha.outcome === 'accepted'
    },
  }
}

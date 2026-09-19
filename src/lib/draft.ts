/**
 * Rascunho automático em localStorage — pra não perder o que já foi
 * preenchido se a aba fechar, cair energia, ou trocar de página no
 * meio do expediente. Cada tela salva seu próprio rascunho por chave.
 */

interface Envelope<T> {
  dados: T
  salvoEm: string
}

export function salvarRascunho<T>(chave: string, dados: T): void {
  try {
    const envelope: Envelope<T> = { dados, salvoEm: new Date().toISOString() }
    localStorage.setItem(chave, JSON.stringify(envelope))
  } catch {
    // localStorage pode falhar (modo privado, cheio, etc.) — não é crítico, ignora.
  }
}

export function lerRascunho<T>(chave: string): { dados: T; salvoEm: string } | null {
  try {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return null
    return JSON.parse(bruto) as Envelope<T>
  } catch {
    return null
  }
}

export function limparRascunho(chave: string): void {
  try {
    localStorage.removeItem(chave)
  } catch {
    // ignora
  }
}

export function formatarHoraRascunho(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

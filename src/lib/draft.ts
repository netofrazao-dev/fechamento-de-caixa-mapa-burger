/**
 * Rascunho automático em localStorage — pra não perder o que já foi
 * preenchido se a aba fechar, cair energia, ou trocar de página no
 * meio do expediente. Cada tela salva seu próprio rascunho por chave.
 */

interface Envelope<T> {
  dados: T
  salvoEm: string
}

/**
 * Guarda o rascunho no aparelho. Se não couber (memória cheia, ex.: com fotos),
 * tenta de novo com a versão `leve` (sem os campos pesados), pra não perder o texto.
 * Devolve false se não conseguiu guardar nada.
 */
export function salvarRascunho<T>(chave: string, dados: T, salvoEm: string = new Date().toISOString(), leve?: T): boolean {
  try {
    const envelope: Envelope<T> = { dados, salvoEm }
    localStorage.setItem(chave, JSON.stringify(envelope))
    return true
  } catch {
    // localStorage pode falhar (modo privado, cheio, etc.)
    if (leve === undefined) return false
    try {
      localStorage.setItem(chave, JSON.stringify({ dados: leve, salvoEm }))
      return true
    } catch {
      return false
    }
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

/** Quando o rascunho foi salvo: "às 14:05" (hoje) ou "em 03/11 às 14:05" (outro dia). */
export function formatarHoraRascunho(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const mesmoDia = d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate()
  if (mesmoDia) return `às ${hora}`
  const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `em ${dia} às ${hora}`
}

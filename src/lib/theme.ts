export type Tema = 'light' | 'dark'

const CHAVE = 'mapa-burger-tema'

export function lerTemaSalvo(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === 'light' || salvo === 'dark') return salvo
  } catch {
    // armazenamento bloqueado: usa o tema do aparelho
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#0a0a0b' : '#f4f5f7')
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // ignora
  }
}

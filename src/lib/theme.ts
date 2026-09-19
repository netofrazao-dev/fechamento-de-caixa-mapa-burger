export type Tema = 'light' | 'dark'

const CHAVE = 'mapa-burger-tema'

export function lerTemaSalvo(): Tema {
  const salvo = localStorage.getItem(CHAVE)
  if (salvo === 'light' || salvo === 'dark') return salvo
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'dark')
  localStorage.setItem(CHAVE, tema)
}

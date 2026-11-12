import { useEffect, useRef, useState } from 'react'

/**
 * Atualiza a tela sozinha quando a pessoa volta para ela (trocou de aba, de
 * app, desbloqueou o celular, a internet voltou) e, opcionalmente, de tempos
 * em tempos enquanto ela está aberta — assim o que foi feito no outro
 * aparelho aparece sem precisar recarregar.
 */
export function useAtualizarAoVoltar(atualizar: () => void, intervaloMs?: number): void {
  const fn = useRef(atualizar)
  useEffect(() => {
    fn.current = atualizar
  })

  useEffect(() => {
    const relogio = () => performance.now()
    let ultima = relogio()
    const rodar = () => {
      if (document.visibilityState !== 'visible') return
      // Evita duas atualizações seguidas (foco + visibilidade chegam juntos).
      if (relogio() - ultima < 1500) return
      ultima = relogio()
      fn.current()
    }
    document.addEventListener('visibilitychange', rodar)
    window.addEventListener('focus', rodar)
    window.addEventListener('online', rodar)
    const id = intervaloMs ? setInterval(rodar, intervaloMs) : null
    return () => {
      document.removeEventListener('visibilitychange', rodar)
      window.removeEventListener('focus', rodar)
      window.removeEventListener('online', rodar)
      if (id) clearInterval(id)
    }
  }, [intervaloMs])
}

/**
 * Número que aumenta sozinho quando a pessoa volta para a tela (e de tempos em
 * tempos). Coloque nas dependências do efeito que busca os dados; use
 * `veioDaAtualizacao` para saber se foi a atualização automática (aí, se a
 * busca falhar, a tela fica como estava — sem erro e sem apagar nada).
 */
export function useAtualizacaoAutomatica(intervaloMs = 300_000): number {
  const [versao, setVersao] = useState(0)
  useAtualizarAoVoltar(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    setVersao((v) => v + 1)
  }, intervaloMs)
  return versao
}

/** true = esta execução do efeito veio da atualização automática (e guarda a versão vista). */
export function veioDaAtualizacao(vista: { current: number }, versao: number): boolean {
  const veio = vista.current !== versao
  vista.current = versao
  return veio
}

/**
 * Mensagem de "salvo" que veio na navegação: aparece agora, mas não volta se
 * a pessoa recarregar a página (tira do histórico do navegador sem mexer na tela).
 */
export function useEsquecerAvisoDaNavegacao(temAviso: boolean): void {
  useEffect(() => {
    if (!temAviso) return
    try {
      const atual = window.history.state as Record<string, unknown> | null
      if (atual && 'usr' in atual) window.history.replaceState({ ...atual, usr: null }, '')
    } catch {
      // sem acesso ao histórico: nada a fazer
    }
  }, [temAviso])
}

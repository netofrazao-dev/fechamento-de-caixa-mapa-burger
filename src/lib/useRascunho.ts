import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { lerRascunho, limparRascunho, salvarRascunho } from './draft'

/**
 * Rascunho automático de formulário.
 * - Salva na hora no navegador (localStorage) a cada mudança.
 * - Em segundo plano, também salva no Supabase (tabela `rascunhos`), então dá pra
 *   começar a preencher no celular e continuar no computador.
 * - Ao abrir a tela, restaura o rascunho mais recente (local ou remoto).
 * Se a tabela `rascunhos` não existir, tudo continua funcionando só no navegador.
 */

const ATRASO_REMOTO_MS = 1500

async function lerRemoto<T>(chave: string): Promise<{ dados: T; salvoEm: string } | null> {
  try {
    const { data, error } = await supabase
      .from('rascunhos')
      .select('dados, salvo_em')
      .eq('chave', chave)
      .maybeSingle()
    if (error || !data) return null
    return { dados: data.dados as T, salvoEm: data.salvo_em as string }
  } catch {
    return null
  }
}

async function salvarRemoto(chave: string, dados: unknown, salvoEm: string): Promise<void> {
  try {
    await supabase.from('rascunhos').upsert({ chave, dados, salvo_em: salvoEm })
  } catch {
    // sem rede / sem tabela: o rascunho local continua valendo
  }
}

async function limparRemoto(chave: string): Promise<void> {
  try {
    await supabase.from('rascunhos').delete().eq('chave', chave)
  } catch {
    // ignora
  }
}

interface Opcoes<T> {
  chave: string
  dados: T
  /** Joga o rascunho restaurado de volta nos estados do formulário. */
  aplicar: (dados: T) => void
  /** Deixe false enquanto o formulário ainda está carregando do banco. */
  habilitado?: boolean
}

export function useRascunho<T>({ chave, dados, aplicar, habilitado = true }: Opcoes<T>) {
  const [restaurado, setRestaurado] = useState<{ salvoEm: string } | null>(null)
  const [lido, setLido] = useState(false)

  const chaveRef = useRef(chave)
  chaveRef.current = chave
  const aplicarRef = useRef(aplicar)
  aplicarRef.current = aplicar

  const ultimoSalvo = useRef<string | null>(null)
  const cancelado = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendente = useRef<{ dados: T; salvoEm: string } | null>(null)

  const enviarPendente = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const p = pendente.current
    pendente.current = null
    if (p) void salvarRemoto(chaveRef.current, p.dados, p.salvoEm)
  }, [])

  // 1) Ao abrir (ou quando o formulário termina de carregar): restaura o mais recente.
  useEffect(() => {
    if (!habilitado) return
    let ativo = true
    cancelado.current = false
    ultimoSalvo.current = null

    const local = lerRascunho<T>(chave)
    if (local) {
      aplicarRef.current(local.dados)
      setRestaurado({ salvoEm: local.salvoEm })
    } else {
      setRestaurado(null)
    }
    setLido(true)

    void lerRemoto<T>(chave).then((remoto) => {
      if (!ativo || cancelado.current || !remoto) return
      const atual = lerRascunho<T>(chave)
      const tempoLocal = atual ? Date.parse(atual.salvoEm) : 0
      if (Date.parse(remoto.salvoEm) > tempoLocal) {
        aplicarRef.current(remoto.dados)
        setRestaurado({ salvoEm: remoto.salvoEm })
      }
    })

    return () => {
      ativo = false
    }
  }, [chave, habilitado])

  // 2) A cada mudança feita pelo usuário: salva local na hora e remoto com atraso.
  const serializado = JSON.stringify(dados)
  useEffect(() => {
    if (!habilitado || !lido || cancelado.current) return
    if (ultimoSalvo.current === null) {
      ultimoSalvo.current = serializado // estado inicial (já restaurado): ainda não é uma edição
      return
    }
    if (serializado === ultimoSalvo.current) return
    ultimoSalvo.current = serializado

    const salvoEm = new Date().toISOString()
    salvarRascunho(chaveRef.current, dados, salvoEm)
    pendente.current = { dados, salvoEm }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(enviarPendente, ATRASO_REMOTO_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializado, lido, habilitado])

  // 3) Ao sair da tela, não deixa o envio remoto pendente pra trás.
  useEffect(() => () => enviarPendente(), [enviarPendente])

  /** Apaga o rascunho (local e remoto). Use depois de salvar com sucesso. */
  const limpar = useCallback(() => {
    cancelado.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pendente.current = null
    limparRascunho(chaveRef.current)
    void limparRemoto(chaveRef.current)
  }, [])

  /** Descarta o rascunho e recarrega a tela do zero (do banco, ou em branco). */
  const descartar = useCallback(async () => {
    cancelado.current = true
    if (timer.current) clearTimeout(timer.current)
    pendente.current = null
    limparRascunho(chaveRef.current)
    await limparRemoto(chaveRef.current)
    window.location.reload()
  }, [])

  return { restaurado, limpar, descartar }
}

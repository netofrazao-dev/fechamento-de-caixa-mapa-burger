import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, limparDadosLocais, traduzirErroLogin, type EstadoAuth, type Papel } from '../lib/auth'

async function verificarAutorizacao(): Promise<boolean> {
  const { data, error } = await supabase.rpc('usuario_autorizado')
  if (error) {
    // Função ainda não existe (migração v4 não rodou): qualquer login vale.
    // Outros erros (rede): deixa entrar; o banco continua bloqueando o que não pode.
    return true
  }
  return data === true
}

const chavePapel = (usuarioId: string) => `mapa-burger-papel-${usuarioId}`

/** Papel de quem entrou: dono (tudo), cozinha (só lança estragos) ou null (fora da lista). */
async function verificarPapel(usuarioId: string): Promise<Papel | null> {
  const { data, error, status } = await supabase.rpc('papel_usuario')
  if (!error) {
    const papel: Papel | null = data === 'cozinha' ? 'cozinha' : data === 'dono' ? 'dono' : null
    try {
      if (papel) localStorage.setItem(chavePapel(usuarioId), papel)
    } catch {
      // sem armazenamento
    }
    return papel
  }
  // Banco ainda sem a v11 (função não existe): vale a verificação antiga (todos são donos).
  if (status === 404 || ['PGRST202', '42883'].includes(error.code ?? '')) return (await verificarAutorizacao()) ? 'dono' : null
  // Sem internet: o último papel conhecido neste aparelho (o banco bloqueia o resto de qualquer jeito).
  try {
    const guardado = localStorage.getItem(chavePapel(usuarioId))
    if (guardado === 'cozinha' || guardado === 'dono') return guardado
  } catch {
    // sem armazenamento
  }
  return 'dono'
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [papel, setPapel] = useState<Papel | null | undefined>(undefined)

  useEffect(() => {
    let ativo = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (ativo) setSessao(data.session)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, nova) => {
      if (!ativo) return
      setSessao(nova)
      setCarregando(false)
    })
    return () => {
      ativo = false
      inscricao.subscription.unsubscribe()
    }
  }, [])

  const usuarioId = sessao?.user.id ?? null
  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    verificarPapel(usuarioId).then((p) => {
      if (ativo) setPapel(p)
    })
    return () => {
      ativo = false
    }
  }, [usuarioId])

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
    if (error) throw new Error(traduzirErroLogin(error))
  }, [])

  const sair = useCallback(async () => {
    limparDadosLocais()
    setPapel(undefined)
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const trocarSenha = useCallback(async (novaSenha: string) => {
    if (novaSenha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.')
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) throw new Error(traduzirErroLogin(error))
  }, [])

  const enviarRedefinicao = useCallback(async (email: string) => {
    const limpo = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) throw new Error('Digite um e-mail válido.')
    const { error } = await supabase.auth.resetPasswordForEmail(limpo, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    // Por segurança, a tela não diz se o e-mail existe ou não; só repassa limite/erro de rede.
    if (error && /rate|seconds|security purposes|fetch|network/i.test(error.message)) {
      throw new Error(traduzirErroLogin(error))
    }
  }, [])

  const entrarComLinkDeRecuperacao = useCallback(async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) throw new Error(traduzirErroLogin(error))
  }, [])

  const valor = useMemo<EstadoAuth>(
    () => ({
      carregando,
      sessao,
      email: sessao?.user.email ?? null,
      autorizado: sessao && papel !== undefined ? papel !== null : null,
      papel: sessao ? (papel ?? null) : null,
      entrar,
      sair,
      trocarSenha,
      enviarRedefinicao,
      entrarComLinkDeRecuperacao,
    }),
    [carregando, sessao, papel, entrar, sair, trocarSenha, enviarRedefinicao, entrarComLinkDeRecuperacao],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

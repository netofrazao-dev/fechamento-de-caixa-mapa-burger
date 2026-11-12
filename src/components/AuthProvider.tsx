import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, limparDadosLocais, traduzirErroLogin, type EstadoAuth } from '../lib/auth'

async function verificarAutorizacao(): Promise<boolean> {
  const { data, error } = await supabase.rpc('usuario_autorizado')
  if (error) {
    // Função ainda não existe (migração v4 não rodou): qualquer login vale.
    // Outros erros (rede): deixa entrar; o banco continua bloqueando o que não pode.
    return true
  }
  return data === true
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)

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
    verificarAutorizacao().then((ok) => {
      if (ativo) setAutorizado(ok)
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
    setAutorizado(null)
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
      autorizado: sessao ? autorizado : null,
      entrar,
      sair,
      trocarSenha,
      enviarRedefinicao,
      entrarComLinkDeRecuperacao,
    }),
    [carregando, sessao, autorizado, entrar, sair, trocarSenha, enviarRedefinicao, entrarComLinkDeRecuperacao],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

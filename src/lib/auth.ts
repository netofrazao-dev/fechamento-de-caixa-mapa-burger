import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface EstadoAuth {
  /** Ainda verificando se já existe sessão salva. */
  carregando: boolean
  sessao: Session | null
  email: string | null
  /**
   * true = pode usar; false = logado mas fora da lista de autorizados.
   * Antes da migração v4 (sem lista), todo usuário logado é aceito.
   */
  autorizado: boolean | null
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
  trocarSenha: (novaSenha: string) => Promise<void>
  /** Manda o e-mail com o link para criar uma senha nova. */
  enviarRedefinicao: (email: string) => Promise<void>
  /** Entra com o token que veio no link do e-mail de redefinição. */
  entrarComLinkDeRecuperacao: (accessToken: string, refreshToken: string) => Promise<void>
}

export const AuthContext = createContext<EstadoAuth | null>(null)

export function useAuth(): EstadoAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro do AuthProvider')
  return ctx
}

/** Mensagem clara para os erros de login do Supabase. */
export function traduzirErroLogin(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e ? String((e as { message?: string }).message) : ''
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Este e-mail ainda não foi confirmado no Supabase.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com a internet.'
  if (/password should be at least|weak password/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (/same password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (/for security purposes|only request this after|seconds/i.test(msg)) return 'Espere um minuto antes de pedir outro e-mail.'
  if (/expired|invalid.*(token|link)|otp/i.test(msg)) return 'O link expirou ou já foi usado. Peça um novo na tela de login.'
  return msg || 'Não foi possível entrar.'
}

/**
 * Apaga do aparelho os rascunhos (que têm valores do caixa) ao sair,
 * pra o próximo que usar o aparelho não ver nada.
 */
export function limparDadosLocais(): void {
  try {
    const chaves: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('mapa-burger-rascunho')) chaves.push(k)
    }
    chaves.forEach((k) => localStorage.removeItem(k))
  } catch {
    // sem acesso ao armazenamento: nada a limpar
  }
}

export interface ResultadoLinkRecuperacao {
  tipo: 'recuperacao' | 'erro' | 'nenhum'
  accessToken?: string
  refreshToken?: string
  erro?: string
}

/**
 * Lê o que o Supabase põe no endereço quando a pessoa clica no link do e-mail:
 * "#access_token=...&refresh_token=...&type=recovery" ou "#error=...".
 */
export function lerLinkDeRecuperacao(hash: string): ResultadoLinkRecuperacao {
  const p = new URLSearchParams((hash ?? '').replace(/^#/, ''))
  if (p.get('error') || p.get('error_code')) {
    const codigo = p.get('error_code') ?? p.get('error') ?? ''
    return {
      tipo: 'erro',
      erro: /expired/i.test(codigo + (p.get('error_description') ?? ''))
        ? 'Este link expirou. Peça um novo na tela de login.'
        : 'Este link não é válido (pode já ter sido usado). Peça um novo na tela de login.',
    }
  }
  const accessToken = p.get('access_token')
  const refreshToken = p.get('refresh_token')
  if (p.get('type') === 'recovery' && accessToken && refreshToken) {
    return { tipo: 'recuperacao', accessToken, refreshToken }
  }
  return { tipo: 'nenhum' }
}

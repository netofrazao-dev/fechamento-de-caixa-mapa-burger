/**
 * Transforma erros do Supabase/rede em mensagens claras em português.
 * Use `mensagemErro(e, 'Erro ao salvar o fechamento.')` nas telas.
 */

/** Erro cuja mensagem já está pronta (em português) pra mostrar na tela. */
export class ErroAmigavel extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroAmigavel'
  }
}

interface ErroBanco {
  message?: string
  code?: string
  hint?: string | null
  details?: string | null
  status?: number
}

const MIGRACAO =
  'O banco de dados ainda não foi atualizado para esta versão do sistema. ' +
  'Rode os arquivos de migração da pasta supabase/ no SQL Editor (veja o README).'

export function mensagemErro(e: unknown, padrao = 'Algo deu errado. Tente de novo.'): string {
  if (!e) return padrao
  const err = (typeof e === 'object' ? e : {}) as ErroBanco
  const msg = err.message ?? (typeof e === 'string' ? e : '')
  const codigo = err.code ?? ''

  if (e instanceof ErroAmigavel) return e.message

  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) {
    return 'Sem conexão com a internet. Nada foi salvo — confira a conexão e tente de novo.'
  }
  if (codigo === '42501' || /permission denied|row-level security|acesso negado/i.test(msg)) {
    return 'Sem permissão para isso. Saia e entre de novo com um usuário autorizado.'
  }
  if (/jwt expired|invalid jwt|refresh token/i.test(msg) || codigo === 'PGRST301' || codigo === 'PGRST303') {
    return 'Sua sessão expirou. Saia e entre de novo.'
  }
  if (['42703', '42P01', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'].includes(codigo)) {
    return MIGRACAO
  }
  if (codigo === 'PGRST116') return 'Registro não encontrado (pode ter sido excluído).'
  if (codigo === '23505') return 'Já existe um registro igual (por exemplo, na mesma data ou com o mesmo nome).'
  if (codigo === '23514') {
    return 'O banco recusou os valores porque as contas não batem ou há valor inválido. Confira os campos e tente de novo.'
  }
  if (codigo === 'P0001' && msg) return msg

  return msg ? `${padrao} (${msg})` : padrao
}

/** Código do erro do banco, se houver. */
export function codigoErro(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null ? ((e as ErroBanco).code ?? undefined) : undefined
}

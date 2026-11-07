import { supabase } from './supabase'
import { PREFIXO_FOTO } from './mesclagem'
import { ehFalhaDeRede, type ArmazemLocal, type ArmazemRemoto, type EnvelopeRascunho } from './sincronia'

export { ehFalhaDeRede }

/**
 * Onde a sincronia guarda as coisas de verdade: a tabela `rascunhos` do
 * Supabase (rascunho compartilhado do dia + fotos à parte) e o localStorage
 * do aparelho.
 */

/** Fotos ficam em linhas próprias (fora do padrão "mapa-burger-rascunho-%" das listas). */
const PREFIXO_LINHA_FOTO = 'mapa-burger-foto-'
const TEMPO_LIMITE_MS = 15_000

interface RespostaSupabase {
  error: { code?: string; message?: string } | null
  status?: number
}

/** Sinal que cancela a requisição se a internet travar (para não prender o salvar). */
export function tempoLimite(ms = TEMPO_LIMITE_MS): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(ms) : undefined
}

/**
 * Resultado de uma operação na nuvem: undefined = sem internet;
 * outro erro (tabela faltando, permissão) = segue sem rascunho compartilhado.
 */
function falhou(r: RespostaSupabase): 'rede' | 'outro' | null {
  if (!r.error) return null
  return ehFalhaDeRede({ status: r.status, message: r.error.message }) ? 'rede' : 'outro'
}

function linhaFoto(assinatura: string): string {
  return PREFIXO_LINHA_FOTO + assinatura.slice(PREFIXO_FOTO.length)
}

function comSinal<T extends { abortSignal: (s: AbortSignal) => T }>(q: T): T {
  const s = tempoLimite()
  return s ? q.abortSignal(s) : q
}

export const remotoSupabase: ArmazemRemoto = {
  async ler(chave) {
    try {
      const r = await comSinal(supabase.from('rascunhos').select('dados').eq('chave', chave)).maybeSingle()
      const f = falhou(r)
      if (f) return f === 'rede' ? undefined : null
      const dados = (r.data as { dados: EnvelopeRascunho } | null)?.dados
      return dados && dados.v === 2 ? dados : null
    } catch {
      return undefined
    }
  },

  async versao(chave) {
    try {
      const r = await comSinal(supabase.from('rascunhos').select('versao:dados->>versao').eq('chave', chave))
        .retry(false)
        .maybeSingle()
      const f = falhou(r)
      if (f) return f === 'rede' ? undefined : null
      return (r.data as { versao: string | null } | null)?.versao ?? null
    } catch {
      return undefined
    }
  },

  async gravar(chave, env, esperado) {
    try {
      if (esperado === null) {
        const r = await comSinal(supabase.from('rascunhos').insert({ chave, dados: env, salvo_em: env.salvoEm }))
        if (!r.error) return true
        if (r.error.code === '23505') return false // alguém criou antes
        // Sem a tabela de rascunhos: segue só com o banco (não trava a tela).
        return falhou(r) === 'rede' ? undefined : 'indisponivel'
      }
      const r = await comSinal(
        supabase
          .from('rascunhos')
          .update({ dados: env, salvo_em: env.salvoEm })
          .eq('chave', chave)
          .eq('dados->>versao', esperado)
          .select('chave'),
      )
      const f = falhou(r)
      if (f) return f === 'rede' ? undefined : 'indisponivel'
      return ((r.data as unknown[] | null)?.length ?? 0) > 0
    } catch {
      return undefined
    }
  },

  async apagar(chave, esperado) {
    try {
      let q = supabase.from('rascunhos').delete().eq('chave', chave)
      if (esperado !== null) q = q.eq('dados->>versao', esperado)
      const r = await comSinal(q.select('chave'))
      const f = falhou(r)
      if (f) return f === 'rede' ? undefined : true
      return esperado === null || ((r.data as unknown[] | null)?.length ?? 0) > 0
    } catch {
      return undefined
    }
  },

  async lerFoto(assinatura) {
    try {
      const r = await comSinal(supabase.from('rascunhos').select('dados').eq('chave', linhaFoto(assinatura))).maybeSingle()
      const f = falhou(r)
      if (f) return f === 'rede' ? undefined : null
      const imagem = (r.data as { dados: { imagem?: string } } | null)?.dados?.imagem
      return typeof imagem === 'string' && imagem.startsWith('data:image/') ? imagem : null
    } catch {
      return undefined
    }
  },

  async gravarFoto(assinatura, dataUrl) {
    try {
      const r = await supabase
        .from('rascunhos')
        .upsert({ chave: linhaFoto(assinatura), dados: { imagem: dataUrl }, salvo_em: new Date().toISOString() })
        .abortSignal(tempoLimite(60_000) ?? new AbortController().signal)
      return !r.error
    } catch {
      return false
    }
  },

  async apagarFoto(assinatura) {
    try {
      await supabase.from('rascunhos').delete().eq('chave', linhaFoto(assinatura))
    } catch {
      // fica para depois; não atrapalha nada
    }
  },
}

export const localNavegador: ArmazemLocal = {
  ler(chave) {
    try {
      const bruto = localStorage.getItem(chave)
      return bruto ? JSON.parse(bruto) : null
    } catch {
      return null
    }
  },
  gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor))
      return true
    } catch {
      return false
    }
  },
  apagar(chave) {
    try {
      localStorage.removeItem(chave)
    } catch {
      // sem acesso ao armazenamento
    }
  },
}

/** Identificação deste aparelho/navegador (só para saber o que veio "do outro aparelho"). */
export function idDoAparelho(): string {
  const CHAVE = 'mapa-burger-aparelho'
  try {
    const atual = localStorage.getItem(CHAVE)
    if (atual) return atual
    const novo = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(CHAVE, novo)
    return novo
  } catch {
    return 'aparelho'
  }
}

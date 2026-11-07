import { supabase } from './supabase'
import { lerRascunho, limparRascunho } from './draft'
import { temConteudo } from './rascunhosAbertos'
import { completarFechamento, completarRelatorio, type ConteudoFechamento, type ConteudoRelatorio } from './mesclagem'
import type { RascunhoLegado } from './sincronia'

/**
 * Rascunhos do formato antigo (antes da sincronia entre aparelhos). Na
 * primeira vez que a tela abre com a versão nova, o que estava guardado
 * neste aparelho passa para o rascunho novo do dia e o antigo é apagado.
 */

function pegar<C>(
  chaves: string[],
  dia: string,
  edicao: boolean,
  completar: (d: Record<string, unknown>) => C,
): RascunhoLegado<C> | null {
  for (const chave of chaves) {
    const r = lerRascunho<Record<string, unknown>>(chave)
    if (!r?.dados || typeof r.dados !== 'object') continue
    // O rascunho "sem dia" antigo era o do formulário aberto sem link: vale só para o dia dele.
    if (!edicao && !/\d{4}-\d{2}-\d{2}$/.test(chave) && r.dados.data !== dia) continue
    limparRascunho(chave)
    void Promise.resolve(supabase.from('rascunhos').delete().eq('chave', chave)).catch(() => undefined)
    if (!temConteudo(r.dados)) continue
    return { conteudo: completar(r.dados), salvoEm: r.salvoEm, edicao, semFotos: !('imagem1' in r.dados) }
  }
  return null
}

export function legadoRelatorio(id: string | undefined, dia: string): RascunhoLegado<ConteudoRelatorio> | null {
  const chaves = id
    ? [`mapa-burger-rascunho-relatorio-${id}`]
    : [`mapa-burger-rascunho-relatorio-novo-${dia}`, 'mapa-burger-rascunho-relatorio-novo']
  return pegar(chaves, dia, Boolean(id), (d) => completarRelatorio(d as Partial<ConteudoRelatorio>, dia))
}

export function legadoFechamento(id: string | undefined, dia: string): RascunhoLegado<ConteudoFechamento> | null {
  const chaves = id ? [`mapa-burger-rascunho-fechamento-${id}`] : [`mapa-burger-rascunho-fechamento-dia-${dia}`, 'mapa-burger-rascunho-fechamento']
  const r = pegar(chaves, dia, Boolean(id), (d) => completarFechamento(d as Partial<ConteudoFechamento>, dia))
  return r ? { ...r, semFotos: false } : null
}

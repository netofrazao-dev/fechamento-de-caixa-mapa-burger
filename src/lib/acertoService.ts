import { supabase } from './supabase'
import { ErroAmigavel } from './erros'
import type { AcertoFechado, ConsumoItem, Funcionario, ResumoAcerto } from '../types/fechamento'
import type { ConsumoDoMes } from './acerto'

interface AcertoRow {
  mes: string
  fechado_em: string
  total: number | string
  total_vales: number | string
  total_consumo: number | string
  resumo: {
    funcionario_id: string | null
    funcionario: string
    vales: number | string
    qtd_vales: number
    consumo: number | string
    qtd_consumo: number
    total: number | string
  }[] | null
  observacao: string | null
  usuario: string | null
}

function paraAcerto(r: AcertoRow): AcertoFechado {
  return {
    mes: r.mes.slice(0, 7),
    fechadoEm: r.fechado_em,
    total: Number(r.total),
    totalVales: Number(r.total_vales),
    totalConsumo: Number(r.total_consumo),
    resumo: (r.resumo ?? []).map<ResumoAcerto>((x) => ({
      funcionarioId: x.funcionario_id,
      funcionario: x.funcionario,
      vales: Number(x.vales),
      qtdVales: x.qtd_vales,
      consumo: Number(x.consumo),
      qtdConsumo: x.qtd_consumo,
      total: Number(x.total),
    })),
    observacao: r.observacao,
    usuario: r.usuario,
  }
}

export class AcertoIndisponivel extends ErroAmigavel {
  constructor() {
    super('O acerto do mês ainda não foi ativado no banco: rode o arquivo supabase/migration_v7_acerto_mes.sql no Supabase.')
  }
}

/** Acerto fechado do mês (YYYY-MM), ou null se está aberto. */
export async function buscarAcerto(mes: string): Promise<AcertoFechado | null> {
  const { data, error } = await supabase.from('acertos_mes').select('*').eq('mes', `${mes}-01`).maybeSingle()
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code ?? '')) throw new AcertoIndisponivel()
    throw error
  }
  return data ? paraAcerto(data as AcertoRow) : null
}

export async function fecharAcerto(mes: string, observacao: string): Promise<AcertoFechado> {
  const { data, error } = await supabase.rpc('fechar_acerto_mes', { p_mes: `${mes}-01`, p_observacao: observacao.trim() || null })
  if (error) {
    if (['42883', 'PGRST202'].includes(error.code ?? '')) throw new AcertoIndisponivel()
    throw error
  }
  return paraAcerto(data as AcertoRow)
}

export async function reabrirAcerto(mes: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroAmigavel('Informe o motivo para reabrir o acerto.')
  const { error } = await supabase.rpc('reabrir_acerto_mes', { p_mes: `${mes}-01`, p_motivo: motivo.trim() })
  if (error) throw error
}

/**
 * Corrige um consumo "sem funcionário": liga o item do relatório ao
 * funcionário escolhido. Confere antes se o item ainda é o mesmo.
 */
export async function atribuirConsumo(consumo: ConsumoDoMes, funcionario: Pick<Funcionario, 'id' | 'nome'>): Promise<void> {
  const { data, error } = await supabase
    .from('relatorios')
    .select('consumo_loja_mensal')
    .eq('id', consumo.relatorioId)
    .single()
  if (error) throw error
  const lista = ((data as { consumo_loja_mensal: ConsumoItem[] | null }).consumo_loja_mensal ?? []).slice()
  const atual = lista[consumo.indice]
  if (!atual || Math.round(Number(atual.valor) * 100) !== Math.round(consumo.valor * 100) || (atual.pessoa ?? '') !== consumo.pessoa) {
    throw new ErroAmigavel('Esse relatório foi alterado enquanto você corrigia. Recarregue a página e tente de novo.')
  }
  lista[consumo.indice] = { ...atual, pessoa: funcionario.nome, funcionarioId: funcionario.id }
  const { data: salvo, error: erroSalvar } = await supabase
    .from('relatorios')
    .update({ consumo_loja_mensal: lista })
    .eq('id', consumo.relatorioId)
    .select('id')
  if (erroSalvar) throw erroSalvar
  if (!salvo || salvo.length === 0) throw new ErroAmigavel('Não consegui salvar a correção (sem permissão?).')
}

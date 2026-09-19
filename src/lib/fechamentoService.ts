import { supabase } from './supabase'
import { calcularResultado } from './calculations'
import type { Fechamento, NovoFechamentoInput } from '../types/fechamento'

// Formato da tabela no Supabase (snake_case, plano).
interface FechamentoRow {
  id: string
  data: string
  turno: 'manha' | 'noite'
  created_at: string
  dinheiro_abertura: number
  dinheiro_fechamento: number
  pix_lc: number
  debito_lc: number
  credito_lc: number
  consumo_loja: number
  a_prazo: number
  ticket: number
  pix_brendi: number
  debito_brendi: number
  credito_brendi: number
  credito_online_brendi: number
  dinheiro_brendi: number
  total_lc: number
  total_brendi: number
  total_caixa: number
  total_lc_sistema: number
  total_sistema: number
  diferenca_original: number
  ajuste_tipo: 'adicionar' | 'remover' | null
  ajuste_valor: number
  ajuste_aplicado: number
  diferenca_final: number
  status: 'fechou' | 'sobrou' | 'faltou'
  observacoes: string | null
  marmitas_vendidas: number
  sangrias?: { id: string; valor: number; motivo: string }[]
}

function rowToFechamento(row: FechamentoRow): Fechamento {
  return {
    id: row.id,
    data: row.data,
    turno: row.turno,
    createdAt: row.created_at,
    lc: {
      dinheiroAbertura: row.dinheiro_abertura,
      dinheiroFechamento: row.dinheiro_fechamento,
      pix: row.pix_lc,
      debito: row.debito_lc,
      credito: row.credito_lc,
      consumoLoja: row.consumo_loja,
      aPrazo: row.a_prazo,
      ticket: row.ticket,
    },
    brendi: {
      pix: row.pix_brendi,
      debito: row.debito_brendi,
      credito: row.credito_brendi,
      creditoOnline: row.credito_online_brendi,
      dinheiro: row.dinheiro_brendi,
    },
    sangrias: (row.sangrias ?? []).map((s) => ({ id: s.id, valor: s.valor, motivo: s.motivo })),
    marmitasVendidas: row.marmitas_vendidas ?? 0,
    totalLCSistema: row.total_lc_sistema,
    ajuste: { tipo: row.ajuste_tipo, valor: row.ajuste_valor },
    observacoes: row.observacoes ?? '',
    resultado: {
      totalLC: row.total_lc,
      totalBrendi: row.total_brendi,
      totalCaixa: row.total_caixa,
      totalSistema: row.total_sistema,
      diferencaOriginal: row.diferenca_original,
      ajusteAplicado: row.ajuste_aplicado,
      diferencaFinal: row.diferenca_final,
      status: row.status,
    },
  }
}

const SELECT_COLUMNS = '*, sangrias(id, valor, motivo)'

/** Salva um novo fechamento (calcula os totais aqui, na hora de gravar). */
export async function criarFechamento(input: NovoFechamentoInput): Promise<Fechamento> {
  const resultado = calcularResultado({
    lc: input.lc,
    brendi: input.brendi,
    totalLCSistema: input.totalLCSistema,
    ajuste: input.ajuste,
  })

  const { data: inserted, error } = await supabase
    .from('fechamentos')
    .insert({
      data: input.data,
      turno: input.turno,
      dinheiro_abertura: input.lc.dinheiroAbertura,
      dinheiro_fechamento: input.lc.dinheiroFechamento,
      pix_lc: input.lc.pix,
      debito_lc: input.lc.debito,
      credito_lc: input.lc.credito,
      consumo_loja: input.lc.consumoLoja,
      a_prazo: input.lc.aPrazo,
      ticket: input.lc.ticket,
      pix_brendi: input.brendi.pix,
      debito_brendi: input.brendi.debito,
      credito_brendi: input.brendi.credito,
      credito_online_brendi: input.brendi.creditoOnline,
      dinheiro_brendi: input.brendi.dinheiro,
      total_lc: resultado.totalLC,
      total_brendi: resultado.totalBrendi,
      total_caixa: resultado.totalCaixa,
      total_lc_sistema: input.totalLCSistema,
      total_sistema: resultado.totalSistema,
      diferenca_original: resultado.diferencaOriginal,
      ajuste_tipo: input.ajuste.tipo,
      ajuste_valor: input.ajuste.valor || 0,
      ajuste_aplicado: resultado.ajusteAplicado,
      diferenca_final: resultado.diferencaFinal,
      status: resultado.status,
      observacoes: input.observacoes || null,
      marmitas_vendidas: input.marmitasVendidas || 0,
    })
    .select('id')
    .single()

  if (error) throw error

  const fechamentoId = inserted.id as string

  if (input.sangrias.length > 0) {
    const { error: sangriaError } = await supabase.from('sangrias').insert(
      input.sangrias.map((s) => ({
        fechamento_id: fechamentoId,
        valor: s.valor,
        motivo: s.motivo,
      })),
    )
    if (sangriaError) throw sangriaError
  }

  return buscarFechamentoPorId(fechamentoId)
}

export async function buscarFechamentoPorId(id: string): Promise<Fechamento> {
  const { data, error } = await supabase
    .from('fechamentos')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .single()
  if (error) throw error
  return rowToFechamento(data as unknown as FechamentoRow)
}

/** Lista fechamentos entre duas datas (inclusive), mais recentes primeiro. */
export async function listarFechamentos(params: {
  dataInicio: string
  dataFim: string
}): Promise<Fechamento[]> {
  const { data, error } = await supabase
    .from('fechamentos')
    .select(SELECT_COLUMNS)
    .gte('data', params.dataInicio)
    .lte('data', params.dataFim)
    .order('data', { ascending: false })
    .order('turno', { ascending: true })

  if (error) throw error
  return (data as unknown as FechamentoRow[]).map(rowToFechamento)
}

/** Verifica se já existe fechamento para essa data + turno. */
export async function existeFechamento(data: string, turno: 'manha' | 'noite'): Promise<boolean> {
  const { count, error } = await supabase
    .from('fechamentos')
    .select('id', { count: 'exact', head: true })
    .eq('data', data)
    .eq('turno', turno)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function excluirFechamento(id: string): Promise<void> {
  const { error } = await supabase.from('fechamentos').delete().eq('id', id)
  if (error) throw error
}

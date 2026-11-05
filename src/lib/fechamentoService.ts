import { supabase } from './supabase'
import { buscarTodasAsPaginas } from './paginacao'
import { calcularResultado } from './calculations'
import { arredondarCentavos } from './moeda'
import { ErroAmigavel } from './erros'
import type { Fechamento, MarmitaItem, NovoFechamentoInput, ResultadoCalculado } from '../types/fechamento'

/** Erro com mensagem pronta pra mostrar na tela. */
export class ErroFechamento extends ErroAmigavel {}

const MSG_DUPLICADO = 'Já existe um fechamento salvo para essa data. Abra-o pelo Histórico para editar.'

function dinheiro(v: number): number {
  return Math.max(0, arredondarCentavos(Number(v) || 0))
}

/**
 * Garante que o que vai pro banco está limpo: nada negativo, só centavos,
 * sangrias com motivo, pratos com quantidade inteira. Os totais são
 * calculados a partir DESTES valores (o banco confere as contas de novo).
 */
export function normalizarFechamento(input: NovoFechamentoInput): NovoFechamentoInput {
  return {
    ...input,
    lc: {
      dinheiroAbertura: dinheiro(input.lc.dinheiroAbertura),
      dinheiroFechamento: dinheiro(input.lc.dinheiroFechamento),
      pix: dinheiro(input.lc.pix),
      debito: dinheiro(input.lc.debito),
      credito: dinheiro(input.lc.credito),
      consumoLoja: dinheiro(input.lc.consumoLoja),
      aPrazo: dinheiro(input.lc.aPrazo),
      ticket: dinheiro(input.lc.ticket),
    },
    brendi: {
      pix: dinheiro(input.brendi.pix),
      debito: dinheiro(input.brendi.debito),
      credito: dinheiro(input.brendi.credito),
      creditoOnline: dinheiro(input.brendi.creditoOnline),
      dinheiro: dinheiro(input.brendi.dinheiro),
    },
    sangrias: input.sangrias
      .map((s) => ({ valor: dinheiro(s.valor), motivo: s.motivo.trim().slice(0, 200) }))
      .filter((s) => s.valor > 0 || s.motivo),
    marmitas: input.marmitas
      .map((m) => ({ prato: m.prato.trim(), quantidade: Math.max(0, Math.floor(Number(m.quantidade) || 0)) }))
      .filter((m) => m.prato && m.quantidade > 0),
    totalLCSistema: dinheiro(input.totalLCSistema),
    ajuste: input.ajuste.tipo ? { tipo: input.ajuste.tipo, valor: dinheiro(input.ajuste.valor) } : { tipo: null, valor: 0 },
    observacoes: input.observacoes.trim().slice(0, 2000),
  }
}

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
  marmitas: MarmitaItem[]
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
    marmitas: row.marmitas ?? [],
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

function montarLinha(input: NovoFechamentoInput, resultado: ResultadoCalculado) {
  return {
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
    marmitas: input.marmitas,
  }
}

const SELECT_COLUMNS = '*, sangrias(id, valor, motivo)'

/** Salva um novo fechamento (calcula os totais aqui, na hora de gravar). */
export async function criarFechamento(entrada: NovoFechamentoInput): Promise<Fechamento> {
  const input = normalizarFechamento(entrada)
  const resultado = calcularResultado({
    lc: input.lc,
    brendi: input.brendi,
    totalLCSistema: input.totalLCSistema,
    ajuste: input.ajuste,
  })

  const { data: inserted, error } = await supabase
    .from('fechamentos')
    .insert(montarLinha(input, resultado))
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new ErroFechamento(MSG_DUPLICADO)
    throw error
  }

  const fechamentoId = inserted.id as string

  if (input.sangrias.length > 0) {
    const { error: sangriaError } = await supabase.from('sangrias').insert(
      input.sangrias.map((s) => ({
        fechamento_id: fechamentoId,
        valor: s.valor,
        motivo: s.motivo,
      })),
    )
    if (sangriaError) {
      // Não deixa um fechamento salvo pela metade (sem as sangrias).
      await supabase.from('fechamentos').delete().eq('id', fechamentoId)
      throw sangriaError
    }
  }

  return buscarFechamentoPorId(fechamentoId)
}

/** Atualiza um fechamento existente (recalcula os totais e troca as sangrias). */
export async function atualizarFechamento(id: string, entrada: NovoFechamentoInput): Promise<Fechamento> {
  const input = normalizarFechamento(entrada)
  const resultado = calcularResultado({
    lc: input.lc,
    brendi: input.brendi,
    totalLCSistema: input.totalLCSistema,
    ajuste: input.ajuste,
  })

  const { data: atualizado, error } = await supabase
    .from('fechamentos')
    .update(montarLinha(input, resultado))
    .eq('id', id)
    .select('id')
  if (error) {
    if (error.code === '23505') throw new ErroFechamento(MSG_DUPLICADO)
    throw error
  }
  if (!atualizado || atualizado.length === 0) {
    throw new ErroFechamento('Este fechamento não existe mais (pode ter sido excluído).')
  }

  // Insere as sangrias novas ANTES de apagar as antigas: se der erro no meio, nada se perde.
  const { data: antigas, error: erroAntigas } = await supabase.from('sangrias').select('id').eq('fechamento_id', id)
  if (erroAntigas) throw erroAntigas

  if (input.sangrias.length > 0) {
    const { error: erroInsert } = await supabase.from('sangrias').insert(
      input.sangrias.map((s) => ({ fechamento_id: id, valor: s.valor, motivo: s.motivo })),
    )
    if (erroInsert) throw erroInsert
  }

  const idsAntigos = (antigas ?? []).map((a) => a.id as string)
  if (idsAntigos.length > 0) {
    const { error: erroDelete } = await supabase.from('sangrias').delete().in('id', idsAntigos)
    if (erroDelete) throw erroDelete
  }

  return buscarFechamentoPorId(id)
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
  const linhas = await buscarTodasAsPaginas<FechamentoRow>((de, ate) =>
    supabase
      .from('fechamentos')
      .select(SELECT_COLUMNS)
      .gte('data', params.dataInicio)
      .lte('data', params.dataFim)
      .order('data', { ascending: false })
      .order('turno', { ascending: true })
      .range(de, ate) as unknown as PromiseLike<{ data: FechamentoRow[] | null; error: unknown }>,
  )
  return linhas.map(rowToFechamento)
}

/** Id do fechamento dessa data + turno (ignorando o que está sendo editado), ou null. */
export async function buscarIdFechamento(
  data: string,
  turno: 'manha' | 'noite',
  ignorarId?: string,
): Promise<string | null> {
  let query = supabase.from('fechamentos').select('id').eq('data', data).eq('turno', turno).limit(1)
  if (ignorarId) query = query.neq('id', ignorarId)
  const { data: linhas, error } = await query
  if (error) throw error
  return (linhas as { id: string }[])[0]?.id ?? null
}

/** Exclui o fechamento (e as sangrias dele). Fica uma cópia na auditoria. */
export async function excluirFechamento(id: string): Promise<void> {
  const { data, error } = await supabase.from('fechamentos').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new ErroFechamento('Não foi possível excluir (já foi excluído ou sem permissão).')
}

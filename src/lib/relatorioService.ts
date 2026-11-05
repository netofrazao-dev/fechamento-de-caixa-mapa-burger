import { supabase } from './supabase'
import { tipoDaSangria } from './sangrias'
import { buscarTodasAsPaginas } from './paginacao'
import { arredondarCentavos } from './moeda'
import type { ConsumoItem, EstoqueSnapshot, RelatorioDiario, RelatorioDiarioInput, Sangria } from '../types/fechamento'

interface RelatorioRow {
  id: string
  data: string
  abertura_caixa: number
  fechamento_caixa: number
  quantidade_vendida: number
  estragou: string[]
  funcionarios_que_comeram: string[]
  consumo_loja_mensal: ConsumoItem[]
  consumo_loja_motoboys: ConsumoItem[]
  cortesia_clientes: ConsumoItem[]
  sangrias: Sangria[]
  estoque_quente: EstoqueSnapshot
  imagem1: string | null
  imagem2: string | null
  created_at: string
  updated_at: string
}

const ESTOQUE_VAZIO: EstoqueSnapshot = { itens: [] }

function rowToRelatorio(row: RelatorioRow): RelatorioDiario {
  return {
    id: row.id,
    data: row.data,
    aberturaCaixa: row.abertura_caixa ?? 0,
    fechamentoCaixa: row.fechamento_caixa ?? 0,
    quantidadeVendida: row.quantidade_vendida ?? 0,
    estragou: row.estragou ?? [],
    funcionariosQueComeram: row.funcionarios_que_comeram ?? [],
    consumoLojaMensal: row.consumo_loja_mensal ?? [],
    consumoLojaMotoboys: row.consumo_loja_motoboys ?? [],
    cortesiaClientes: row.cortesia_clientes ?? [],
    sangrias: (row.sangrias ?? []).map((s) => ({ ...s, tipo: tipoDaSangria(s) })),
    estoqueQuente: row.estoque_quente ?? ESTOQUE_VAZIO,
    imagem1: row.imagem1 ?? null,
    imagem2: row.imagem2 ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Colunas para listas: tudo menos as imagens (que são pesadas). */
const COLUNAS_LISTA =
  'id, data, abertura_caixa, fechamento_caixa, quantidade_vendida, estragou, funcionarios_que_comeram, ' +
  'consumo_loja_mensal, consumo_loja_motoboys, cortesia_clientes, sangrias, estoque_quente, created_at, updated_at'

const dinheiro = (v: number) => Math.max(0, arredondarCentavos(Number(v) || 0))
const inteiro = (v: number) => Math.max(0, Math.floor(Number(v) || 0))
const texto = (v: string, max: number) => (v ?? '').trim().slice(0, max)

function limparConsumo(itens: ConsumoItem[]): ConsumoItem[] {
  return itens
    .map((c) => ({
      pessoa: texto(c.pessoa, 80),
      item: texto(c.item, 120),
      valor: dinheiro(c.valor),
      ...(c.funcionarioId ? { funcionarioId: c.funcionarioId } : {}),
    }))
    .filter((c) => c.pessoa || c.item || c.valor > 0)
}

/** Limpa o relatório antes de gravar (sem negativos, sem linhas vazias, textos com limite). */
export function normalizarRelatorio(input: RelatorioDiarioInput): RelatorioDiarioInput {
  return {
    ...input,
    aberturaCaixa: dinheiro(input.aberturaCaixa),
    fechamentoCaixa: dinheiro(input.fechamentoCaixa),
    quantidadeVendida: inteiro(input.quantidadeVendida),
    estragou: input.estragou.map((e) => texto(e, 200)).filter(Boolean),
    funcionariosQueComeram: input.funcionariosQueComeram.map((f) => texto(f, 80)).filter(Boolean),
    consumoLojaMensal: limparConsumo(input.consumoLojaMensal),
    consumoLojaMotoboys: limparConsumo(input.consumoLojaMotoboys),
    cortesiaClientes: limparConsumo(input.cortesiaClientes),
    sangrias: input.sangrias
      .map((s) => ({ valor: dinheiro(s.valor), motivo: texto(s.motivo, 200), tipo: tipoDaSangria(s) }))
      .filter((s) => s.valor > 0 || s.motivo),
    estoqueQuente: {
      itens: input.estoqueQuente.itens.map((i) => ({ produto: i.produto, quantidade: inteiro(i.quantidade) })),
    },
  }
}

function inputToRow(entrada: RelatorioDiarioInput) {
  const input = normalizarRelatorio(entrada)
  return {
    data: input.data,
    abertura_caixa: input.aberturaCaixa,
    fechamento_caixa: input.fechamentoCaixa,
    quantidade_vendida: input.quantidadeVendida,
    estragou: input.estragou,
    funcionarios_que_comeram: input.funcionariosQueComeram,
    consumo_loja_mensal: input.consumoLojaMensal,
    consumo_loja_motoboys: input.consumoLojaMotoboys,
    cortesia_clientes: input.cortesiaClientes,
    sangrias: input.sangrias,
    estoque_quente: input.estoqueQuente,
    imagem1: input.imagem1 ?? null,
    imagem2: input.imagem2 ?? null,
  }
}

export async function listarRelatorios(params?: { dataInicio: string; dataFim: string }): Promise<RelatorioDiario[]> {
  const linhas = await buscarTodasAsPaginas<RelatorioRow>((de, ate) => {
    let query = supabase.from('relatorios').select(COLUNAS_LISTA)
    if (params) query = query.gte('data', params.dataInicio).lte('data', params.dataFim)
    return query
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .range(de, ate) as unknown as PromiseLike<{ data: RelatorioRow[] | null; error: unknown }>
  })
  return linhas.map(rowToRelatorio)
}

export async function buscarRelatorioPorId(id: string): Promise<RelatorioDiario> {
  const { data, error } = await supabase.from('relatorios').select('*').eq('id', id).single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

/** Relatório de uma data (sem as imagens), ou null se o dia não tem relatório. */
export async function buscarRelatorioDoDia(data: string): Promise<RelatorioDiario | null> {
  const { data: linhas, error } = await supabase.from('relatorios').select(COLUNAS_LISTA).eq('data', data).limit(1)
  if (error) throw error
  const linha = (linhas as unknown as RelatorioRow[])[0]
  return linha ? rowToRelatorio(linha) : null
}

/** Id do relatório de uma data (ignorando o que está sendo editado), ou null. */
export async function buscarIdRelatorioPorData(data: string, ignorarId?: string): Promise<string | null> {
  let query = supabase.from('relatorios').select('id').eq('data', data).limit(1)
  if (ignorarId) query = query.neq('id', ignorarId)
  const { data: rows, error } = await query
  if (error) throw error
  return (rows as { id: string }[])[0]?.id ?? null
}

export async function criarRelatorio(input: RelatorioDiarioInput): Promise<RelatorioDiario> {
  const { data, error } = await supabase.from('relatorios').insert(inputToRow(input)).select('*').single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

export async function atualizarRelatorio(
  id: string,
  input: RelatorioDiarioInput,
  opts?: { manterConsumoFuncionarios?: boolean },
): Promise<RelatorioDiario> {
  const linha: Partial<ReturnType<typeof inputToRow>> = inputToRow(input)
  // Acerto do mês fechado: não reenvia o consumo (o banco recusaria qualquer mudança nele).
  if (opts?.manterConsumoFuncionarios) delete linha.consumo_loja_mensal
  const { data, error } = await supabase
    .from('relatorios')
    .update(linha)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

/** Exclui o relatório. Fica uma cópia (sem as imagens) na auditoria. */
export async function excluirRelatorio(id: string): Promise<void> {
  const { data, error } = await supabase.from('relatorios').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Não foi possível excluir (já foi excluído ou sem permissão).')
}

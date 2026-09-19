import { supabase } from './supabase'
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
    sangrias: row.sangrias ?? [],
    estoqueQuente: row.estoque_quente ?? ESTOQUE_VAZIO,
    imagem1: row.imagem1 ?? null,
    imagem2: row.imagem2 ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function inputToRow(input: RelatorioDiarioInput) {
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
  let query = supabase.from('relatorios').select('*')
  if (params) {
    query = query.gte('data', params.dataInicio).lte('data', params.dataFim)
  }
  const { data, error } = await query.order('data', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as RelatorioRow[]).map(rowToRelatorio)
}

export async function buscarRelatorioPorId(id: string): Promise<RelatorioDiario> {
  const { data, error } = await supabase.from('relatorios').select('*').eq('id', id).single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

export async function buscarRelatorioPorData(data: string): Promise<RelatorioDiario | null> {
  const { data: rows, error } = await supabase.from('relatorios').select('*').eq('data', data).limit(1)
  if (error) throw error
  const row = (rows as unknown as RelatorioRow[])[0]
  return row ? rowToRelatorio(row) : null
}

export async function criarRelatorio(input: RelatorioDiarioInput): Promise<RelatorioDiario> {
  const { data, error } = await supabase.from('relatorios').insert(inputToRow(input)).select('*').single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

export async function atualizarRelatorio(id: string, input: RelatorioDiarioInput): Promise<RelatorioDiario> {
  const { data, error } = await supabase
    .from('relatorios')
    .update(inputToRow(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

export async function excluirRelatorio(id: string): Promise<void> {
  const { error } = await supabase.from('relatorios').delete().eq('id', id)
  if (error) throw error
}

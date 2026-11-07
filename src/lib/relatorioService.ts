import { supabase } from './supabase'
import { tipoDaSangria } from './sangrias'
import { normalizarRelatorio } from './normalizacao'
import { buscarTodasAsPaginas } from './paginacao'
import { ErroAmigavel } from './erros'
import { formatarDataBr } from './datas'
import type { AdaptadorBanco, RegistroBanco } from './sincronia'
import type { ConteudoRelatorio } from './mesclagem'
import type { ConsumoItem, EstoqueSnapshot, RelatorioDiario, RelatorioDiarioInput, Sangria } from '../types/fechamento'

export { normalizarRelatorio }

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

// ─── Sincronia entre aparelhos ────────────────────────────────

/** O que o relatório salvo tem de editável (o que os aparelhos editam juntos). */
export function conteudoDoRelatorio(r: RelatorioDiario): ConteudoRelatorio {
  return {
    data: r.data,
    aberturaCaixa: r.aberturaCaixa,
    fechamentoCaixa: r.fechamentoCaixa,
    quantidadeVendida: r.quantidadeVendida,
    estragou: r.estragou,
    funcionariosQueComeram: r.funcionariosQueComeram,
    consumoLojaMensal: r.consumoLojaMensal,
    consumoLojaMotoboys: r.consumoLojaMotoboys,
    cortesiaClientes: r.cortesiaClientes,
    sangrias: r.sangrias,
    estoqueQuente: r.estoqueQuente,
    imagem1: r.imagem1 ?? null,
    imagem2: r.imagem2 ?? null,
  }
}

function registroDeRow(row: RelatorioRow): RegistroBanco<ConteudoRelatorio> {
  const r = rowToRelatorio(row)
  return { id: r.id, versao: row.updated_at, data: r.data, conteudo: conteudoDoRelatorio(r) }
}

/** Guarda o status HTTP no erro (0 = sem internet). */
function comStatus<E extends object>(erro: E, status: number): E & { status: number } {
  return Object.assign(erro, { status })
}

/** Relatório salvo (com as fotos), no formato da sincronia. */
export async function buscarRegistroRelatorio(id: string): Promise<RegistroBanco<ConteudoRelatorio>> {
  const { data, error, status } = await supabase.from('relatorios').select('*').eq('id', id).single()
  if (error) throw comStatus(error, status)
  return registroDeRow(data as unknown as RelatorioRow)
}

/**
 * Como a sincronia lê e grava o relatório: grava só se a versão (updated_at)
 * ainda for a que o aparelho conhece; se outro aparelho gravou no meio,
 * devolve 'conflito' para juntar e tentar de novo.
 */
export function adaptadorRelatorio(opts: { manterConsumoFuncionarios: boolean }): AdaptadorBanco<ConteudoRelatorio> {
  return {
    async ler(alvo) {
      const q = supabase.from('relatorios').select('*')
      const { data, error, status } = await (alvo.id ? q.eq('id', alvo.id) : q.eq('data', alvo.data)).limit(1)
      if (error) throw comStatus(error, status)
      const row = (data as unknown as RelatorioRow[])[0]
      return row ? registroDeRow(row) : null
    },
    async versao(alvo) {
      const q = supabase.from('relatorios').select('id, updated_at')
      const { data, error, status } = await (alvo.id ? q.eq('id', alvo.id) : q.eq('data', alvo.data)).limit(1).retry(false)
      if (error) throw comStatus(error, status)
      const row = (data as { id: string; updated_at: string }[])[0]
      return row ? { id: row.id, versao: row.updated_at } : null
    },
    async gravar(conteudo, esperado) {
      const linha: Partial<ReturnType<typeof inputToRow>> = inputToRow(conteudo)
      if (!esperado) {
        const { data, error, status } = await supabase.from('relatorios').insert(linha).select('*').single()
        if (error) {
          if (error.code === '23505') return 'conflito' // o outro aparelho criou o relatório do dia antes
          throw comStatus(error, status)
        }
        return registroDeRow(data as unknown as RelatorioRow)
      }
      // Acerto do mês fechado: não reenvia o consumo (o banco recusaria qualquer mudança nele).
      if (opts.manterConsumoFuncionarios) delete linha.consumo_loja_mensal
      const { data, error, status } = await supabase
        .from('relatorios')
        .update(linha)
        .eq('id', esperado.id)
        .eq('updated_at', esperado.versao)
        .select('*')
      if (error) {
        if (error.code === '23505') {
          throw new ErroAmigavel(`Já existe outro relatório em ${formatarDataBr(conteudo.data)}. Troque a data ou abra o relatório desse dia.`)
        }
        throw comStatus(error, status)
      }
      const rows = (data ?? []) as unknown as RelatorioRow[]
      if (rows.length > 0) return registroDeRow(rows[0])
      const existe = await supabase.from('relatorios').select('id').eq('id', esperado.id).maybeSingle()
      if (existe.error) throw comStatus(existe.error, existe.status)
      return existe.data ? 'conflito' : 'excluido'
    },
  }
}


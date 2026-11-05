import { supabase } from './supabase'
import type {
  HistoricoVale,
  MesValesFechado,
  OperacaoHistoricoVale,
  ResumoFechamentoVale,
  Vale,
  ValeInput,
} from '../types/fechamento'
import { limitesDoMes } from './datas'
import { limparNome, mesValido, validarVale } from './vales'
import { ErroAmigavel, mensagemErro } from './erros'
import { buscarTodasAsPaginas } from './paginacao'

// ============================================================
// Erros com mensagem clara (em vez do texto técnico do banco)
// ============================================================

export type TipoErroVale = 'migracao_pendente' | 'mes_fechado' | 'sem_conexao' | 'nao_encontrado' | 'validacao' | 'outro'

export class ErroVale extends ErroAmigavel {
  tipo: TipoErroVale
  constructor(tipo: TipoErroVale, mensagem: string) {
    super(mensagem)
    this.tipo = tipo
  }
}

const MSG_MIGRACAO =
  'O banco de dados ainda não foi atualizado para a nova versão dos vales. ' +
  'Rode o arquivo supabase/migration_vales_v2.sql no SQL Editor do Supabase.'

interface ErroBanco {
  message?: string
  code?: string
  hint?: string | null
  details?: string | null
}

function traduzirErro(e: unknown, padrao: string): ErroVale {
  if (e instanceof ErroVale) return e
  const err = (typeof e === 'object' && e !== null ? e : {}) as ErroBanco
  const msg = err.message ?? (e instanceof Error ? e.message : '')

  // Coluna, tabela, função ou relação que só existem depois da migração v2.
  if (['42703', '42P01', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'].includes(err.code ?? '')) {
    return new ErroVale('migracao_pendente', MSG_MIGRACAO)
  }
  if (err.hint === 'MES_FECHADO') return new ErroVale('mes_fechado', msg)
  if (err.code === '42501' || /permission denied|row-level security|jwt/i.test(msg)) {
    return new ErroVale('outro', mensagemErro(e))
  }
  if (err.code === 'PGRST116') return new ErroVale('nao_encontrado', 'Vale não encontrado (pode ter sido removido).')
  if (err.code === 'P0001' || err.code === '23514') return new ErroVale('validacao', msg)
  if (/failed to fetch|network|load failed|fetch failed/i.test(msg)) {
    return new ErroVale('sem_conexao', 'Sem conexão com a internet (ou com o banco). Nada foi salvo — tente de novo.')
  }
  return new ErroVale('outro', msg ? `${padrao} (${msg})` : padrao)
}

// ============================================================
// Conversão banco <-> app
// ============================================================

const COLUNAS_VALE =
  'id, funcionario, funcionario_id, data, valor, observacao, created_at, updated_at, excluido_em, motivo_exclusao, funcionarios(nome)'

interface ValeRow {
  id: string
  funcionario: string
  funcionario_id: string | null
  data: string
  valor: number | string
  observacao: string | null
  created_at: string
  updated_at: string | null
  excluido_em: string | null
  motivo_exclusao: string | null
  funcionarios?: { nome: string } | { nome: string }[] | null
}

function nomeDoCadastro(row: ValeRow): string | null {
  const f = row.funcionarios
  if (!f) return null
  return Array.isArray(f) ? (f[0]?.nome ?? null) : f.nome
}

function rowToVale(row: ValeRow): Vale {
  return {
    id: row.id,
    funcionarioId: row.funcionario_id ?? null,
    funcionario: nomeDoCadastro(row) ?? row.funcionario,
    data: row.data,
    // numeric pode vir como texto dependendo da configuração da API
    valor: Number(row.valor),
    observacao: row.observacao ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    excluidoEm: row.excluido_em ?? null,
    motivoExclusao: row.motivo_exclusao ?? null,
  }
}

function inputParaRow(input: ValeInput) {
  return {
    funcionario: limparNome(input.funcionario),
    data: input.data,
    valor: Math.round(input.valor * 100) / 100,
    observacao: input.observacao.trim() || null,
  }
}

function garantirValido(input: ValeInput) {
  const erros = validarVale(input)
  if (erros.length > 0) throw new ErroVale('validacao', erros.join(' '))
}

function garantirMes(mes: string) {
  if (!mesValido(mes)) throw new ErroVale('validacao', 'Mês inválido.')
}

// ============================================================
// Vales
// ============================================================

/**
 * Todos os vales do mês (YYYY-MM), inclusive os excluídos
 * (marcados com excluidoEm), mais antigos primeiro.
 */
export async function listarValesDoMes(mes: string): Promise<Vale[]> {
  garantirMes(mes)
  const { inicio, fim } = limitesDoMes(mes)
  try {
    const { data, error } = await supabase
      .from('vales')
      .select(COLUNAS_VALE)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })
      .range(0, 9999)
    if (error) throw error
    return ((data ?? []) as unknown as ValeRow[]).map(rowToVale)
  } catch (e) {
    throw traduzirErro(e, 'Erro ao carregar os vales.')
  }
}

/** Vales (não excluídos) de um período — usados na busca do Histórico. */
export async function listarValesDoPeriodo(inicio: string, fim: string): Promise<Vale[]> {
  try {
    const linhas = await buscarTodasAsPaginas<ValeRow>((de, ate) =>
      supabase
        .from('vales')
        .select(COLUNAS_VALE)
        .gte('data', inicio)
        .lte('data', fim)
        .is('excluido_em', null)
        .order('data', { ascending: true })
        .order('created_at', { ascending: true })
        .range(de, ate) as unknown as PromiseLike<{ data: ValeRow[] | null; error: unknown }>,
    )
    return linhas.map(rowToVale)
  } catch (e) {
    throw traduzirErro(e, 'Erro ao carregar os vales.')
  }
}

/** Vales (não excluídos) de um dia — usados como sangrias no relatório desse dia. */
export async function listarValesDoDia(data: string): Promise<Vale[]> {
  try {
    const { data: linhas, error } = await supabase
      .from('vales')
      .select(COLUNAS_VALE)
      .eq('data', data)
      .is('excluido_em', null)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((linhas ?? []) as unknown as ValeRow[]).map(rowToVale)
  } catch (e) {
    throw traduzirErro(e, 'Erro ao carregar os vales do dia.')
  }
}

export async function buscarValePorId(id: string): Promise<Vale> {
  try {
    const { data, error } = await supabase.from('vales').select(COLUNAS_VALE).eq('id', id).single()
    if (error) throw error
    return rowToVale(data as unknown as ValeRow)
  } catch (e) {
    throw traduzirErro(e, 'Erro ao carregar o vale.')
  }
}

export async function criarVale(input: ValeInput): Promise<Vale> {
  garantirValido(input)
  try {
    const { data, error } = await supabase
      .from('vales')
      .insert(inputParaRow(input))
      .select(COLUNAS_VALE)
      .single()
    if (error) throw error
    return rowToVale(data as unknown as ValeRow)
  } catch (e) {
    throw traduzirErro(e, 'Erro ao salvar o vale.')
  }
}

export async function atualizarVale(id: string, input: ValeInput): Promise<Vale> {
  garantirValido(input)
  try {
    const { data, error } = await supabase
      .from('vales')
      // funcionario_id: null faz o banco ligar de novo ao cadastro pelo nome
      .update({ ...inputParaRow(input), funcionario_id: null })
      .eq('id', id)
      .is('excluido_em', null)
      .select(COLUNAS_VALE)
      .single()
    if (error) throw error
    return rowToVale(data as unknown as ValeRow)
  } catch (e) {
    const erro = traduzirErro(e, 'Erro ao salvar o vale.')
    if (erro.tipo === 'nao_encontrado') {
      throw new ErroVale('nao_encontrado', 'Este vale foi excluído ou não existe mais. Recarregue a lista.')
    }
    throw erro
  }
}

/** Exclui (marca como excluído, com motivo). Dá pra restaurar depois. */
export async function excluirVale(id: string, motivo: string): Promise<Vale> {
  const motivoLimpo = motivo.trim()
  if (!motivoLimpo) throw new ErroVale('validacao', 'Informe o motivo da exclusão.')
  try {
    const { data, error } = await supabase
      .from('vales')
      .update({ excluido_em: new Date().toISOString(), motivo_exclusao: motivoLimpo.slice(0, 300) })
      .eq('id', id)
      .is('excluido_em', null)
      .select(COLUNAS_VALE)
      .single()
    if (error) throw error
    return rowToVale(data as unknown as ValeRow)
  } catch (e) {
    const erro = traduzirErro(e, 'Erro ao excluir o vale.')
    if (erro.tipo === 'nao_encontrado') {
      throw new ErroVale('nao_encontrado', 'Este vale já foi excluído. Recarregue a lista.')
    }
    throw erro
  }
}

export async function restaurarVale(id: string): Promise<Vale> {
  try {
    const { data, error } = await supabase
      .from('vales')
      .update({ excluido_em: null, motivo_exclusao: null })
      .eq('id', id)
      .not('excluido_em', 'is', null)
      .select(COLUNAS_VALE)
      .single()
    if (error) throw error
    return rowToVale(data as unknown as ValeRow)
  } catch (e) {
    const erro = traduzirErro(e, 'Erro ao restaurar o vale.')
    if (erro.tipo === 'nao_encontrado') {
      throw new ErroVale('nao_encontrado', 'Este vale já foi restaurado. Recarregue a lista.')
    }
    throw erro
  }
}

// ============================================================
// Fechamento do mês
// ============================================================

interface MesFechadoRow {
  mes: string
  fechado_em: string
  total: number | string
  quantidade: number
  resumo: { funcionario_id: string | null; funcionario: string; total: number | string; quantidade: number }[] | null
  observacao: string | null
}

function rowToMesFechado(row: MesFechadoRow): MesValesFechado {
  return {
    mes: row.mes.slice(0, 7),
    fechadoEm: row.fechado_em,
    total: Number(row.total),
    quantidade: row.quantidade,
    resumo: (row.resumo ?? []).map<ResumoFechamentoVale>((r) => ({
      funcionarioId: r.funcionario_id ?? null,
      funcionario: r.funcionario,
      total: Number(r.total),
      quantidade: r.quantidade,
    })),
    observacao: row.observacao,
  }
}

/** Fechamento do mês (YYYY-MM), ou null se o mês está aberto. */
export async function buscarFechamentoDoMes(mes: string): Promise<MesValesFechado | null> {
  garantirMes(mes)
  try {
    const { data, error } = await supabase
      .from('vales_meses_fechados')
      .select('*')
      .eq('mes', `${mes}-01`)
      .maybeSingle()
    if (error) throw error
    return data ? rowToMesFechado(data as MesFechadoRow) : null
  } catch (e) {
    throw traduzirErro(e, 'Erro ao verificar se o mês está fechado.')
  }
}

export async function fecharMesVales(mes: string, observacao: string): Promise<MesValesFechado> {
  garantirMes(mes)
  try {
    const { data, error } = await supabase.rpc('fechar_mes_vales', {
      p_mes: `${mes}-01`,
      p_observacao: observacao.trim() || null,
    })
    if (error) throw error
    return rowToMesFechado(data as MesFechadoRow)
  } catch (e) {
    throw traduzirErro(e, 'Erro ao fechar o mês.')
  }
}

export async function reabrirMesVales(mes: string, motivo: string): Promise<void> {
  garantirMes(mes)
  if (!motivo.trim()) throw new ErroVale('validacao', 'Informe o motivo para reabrir o mês.')
  try {
    const { error } = await supabase.rpc('reabrir_mes_vales', { p_mes: `${mes}-01`, p_motivo: motivo.trim() })
    if (error) throw error
  } catch (e) {
    throw traduzirErro(e, 'Erro ao reabrir o mês.')
  }
}

// ============================================================
// Histórico
// ============================================================

interface HistoricoRow {
  id: number
  registrado_em: string
  operacao: OperacaoHistoricoVale
  vale_id: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  detalhe: string | null
}

/** Histórico de alterações dos vales de um mês, mais recentes primeiro. */
export async function listarHistoricoDoMes(mes: string, limite = 200): Promise<HistoricoVale[]> {
  garantirMes(mes)
  try {
    const { data, error } = await supabase
      .from('vales_historico')
      .select('*')
      .eq('mes', `${mes}-01`)
      .order('registrado_em', { ascending: false })
      .order('id', { ascending: false })
      .limit(limite)
    if (error) throw error
    return ((data ?? []) as HistoricoRow[]).map((r) => ({
      id: r.id,
      registradoEm: r.registrado_em,
      operacao: r.operacao,
      valeId: r.vale_id,
      antes: r.antes,
      depois: r.depois,
      detalhe: r.detalhe,
    }))
  } catch (e) {
    throw traduzirErro(e, 'Erro ao carregar o histórico.')
  }
}

/** Mensagem pra mostrar na tela a partir de qualquer erro. */
export function mensagemDeErro(e: unknown, padrao = 'Algo deu errado.'): string {
  return mensagemErro(e, padrao)
}

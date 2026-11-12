import { supabase } from './supabase'
import { buscarTodasAsPaginas } from './paginacao'
import { calcularResultado } from './calculations'
import { normalizarFechamento } from './normalizacao'
import { ErroAmigavel } from './erros'
import { formatarDataBr } from './datas'
import type { AdaptadorBanco, RegistroBanco } from './sincronia'
import type { ConteudoFechamento } from './mesclagem'
import type { Fechamento, MarmitaItem, NovoFechamentoInput, ResultadoCalculado, Turno } from '../types/fechamento'

/** Erro com mensagem pronta pra mostrar na tela. */
export class ErroFechamento extends ErroAmigavel {}

export { normalizarFechamento }

const MSG_DUPLICADO = 'Já existe um fechamento salvo para essa data. Abra-o pelo Histórico para editar.'

// Formato da tabela no Supabase (snake_case, plano).
interface FechamentoRow {
  id: string
  data: string
  turno: 'manha' | 'noite'
  created_at: string
  updated_at?: string
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
  suprimento?: number | null
  suprimento_obs?: string | null
  sangrias?: { id: string; valor: number; motivo: string }[]
}

function rowToFechamento(row: FechamentoRow): Fechamento {
  return {
    id: row.id,
    data: row.data,
    turno: row.turno,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    suprimento: Number(row.suprimento) || 0,
    suprimentoObs: row.suprimento_obs ?? '',
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
    suprimento: input.suprimento || 0,
    suprimento_obs: input.suprimento > 0 ? input.suprimentoObs || null : null,
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

// ─── Sincronia entre aparelhos ────────────────────────────────

/** O que o fechamento salvo tem de editável (o que os aparelhos editam juntos). */
export function conteudoDoFechamento(f: Fechamento): ConteudoFechamento {
  return {
    data: f.data,
    lc: f.lc,
    brendi: f.brendi,
    sangrias: f.sangrias.map((s) => ({ valor: s.valor, motivo: s.motivo })),
    marmitas: f.marmitas,
    totalLCSistema: f.totalLCSistema,
    ajuste: f.ajuste.tipo ? { tipo: f.ajuste.tipo, valor: f.ajuste.valor } : { tipo: null, valor: 0 },
    observacoes: f.observacoes,
    suprimento: f.suprimento,
    suprimentoObs: f.suprimentoObs,
  }
}

function registroDeFechamento(f: Fechamento): RegistroBanco<ConteudoFechamento> {
  return { id: f.id, versao: f.updatedAt ?? f.createdAt, data: f.data, conteudo: conteudoDoFechamento(f) }
}

function comStatus<E extends object>(erro: E, status: number): E & { status: number } {
  return Object.assign(erro, { status })
}

/** Fechamento salvo no formato da sincronia (com a versão). */
export async function buscarRegistroFechamento(id: string): Promise<{ fechamento: Fechamento; registro: RegistroBanco<ConteudoFechamento> }> {
  const { data, error, status } = await supabase.from('fechamentos').select(SELECT_COLUMNS).eq('id', id).single()
  if (error) throw comStatus(error, status)
  const fechamento = rowToFechamento(data as unknown as FechamentoRow)
  return { fechamento, registro: registroDeFechamento(fechamento) }
}

/** Troca as sangrias antigas do fechamento (insere as novas antes de apagar as velhas). */
async function trocarSangrias(id: string, sangrias: NovoFechamentoInput['sangrias']): Promise<void> {
  const { data: antigas, error: erroAntigas } = await supabase.from('sangrias').select('id, valor, motivo').eq('fechamento_id', id)
  if (erroAntigas) throw erroAntigas
  const iguais =
    (antigas ?? []).length === sangrias.length &&
    (antigas ?? []).every((a, i) => Number(a.valor) === sangrias[i].valor && a.motivo === sangrias[i].motivo)
  if (iguais) return
  if (sangrias.length > 0) {
    const { error } = await supabase.from('sangrias').insert(sangrias.map((s) => ({ fechamento_id: id, valor: s.valor, motivo: s.motivo })))
    if (error) throw error
  }
  const idsAntigos = (antigas ?? []).map((a) => a.id as string)
  if (idsAntigos.length > 0) {
    const { error } = await supabase.from('sangrias').delete().in('id', idsAntigos)
    if (error) throw error
  }
}

/**
 * Como a sincronia lê e grava o fechamento de um dia: grava só se a versão
 * (updated_at) ainda for a que o aparelho conhece; se outro aparelho gravou
 * no meio, devolve 'conflito' para juntar e tentar de novo.
 */
export function adaptadorFechamento(turno: Turno): AdaptadorBanco<ConteudoFechamento> {
  return {
    async ler(alvo) {
      const q = supabase.from('fechamentos').select(SELECT_COLUMNS)
      const { data, error, status } = await (alvo.id ? q.eq('id', alvo.id) : q.eq('data', alvo.data).eq('turno', turno)).limit(1)
      if (error) throw comStatus(error, status)
      const row = (data as unknown as FechamentoRow[])[0]
      return row ? registroDeFechamento(rowToFechamento(row)) : null
    },
    async versao(alvo) {
      const q = supabase.from('fechamentos').select('id, updated_at, created_at')
      const { data, error, status } = await (alvo.id ? q.eq('id', alvo.id) : q.eq('data', alvo.data).eq('turno', turno)).limit(1).retry(false)
      if (error) throw comStatus(error, status)
      const row = (data as { id: string; updated_at?: string; created_at: string }[])[0]
      return row ? { id: row.id, versao: row.updated_at ?? row.created_at } : null
    },
    async gravar(conteudo, esperado) {
      const input = normalizarFechamento({ ...conteudo, turno })
      const resultado = calcularResultado({ lc: input.lc, brendi: input.brendi, totalLCSistema: input.totalLCSistema, ajuste: input.ajuste })
      if (!esperado) {
        const { data, error, status } = await supabase.from('fechamentos').insert(montarLinha(input, resultado)).select('id').single()
        if (error) {
          if (error.code === '23505') return 'conflito' // o outro aparelho salvou o fechamento do dia antes
          throw comStatus(error, status)
        }
        const id = data.id as string
        if (input.sangrias.length > 0) {
          const { error: erroSangrias } = await supabase
            .from('sangrias')
            .insert(input.sangrias.map((s) => ({ fechamento_id: id, valor: s.valor, motivo: s.motivo })))
          if (erroSangrias) {
            await supabase.from('fechamentos').delete().eq('id', id)
            throw erroSangrias
          }
        }
        return (await buscarRegistroFechamento(id)).registro
      }
      const { data, error, status } = await supabase
        .from('fechamentos')
        .update(montarLinha(input, resultado))
        .eq('id', esperado.id)
        .eq('updated_at', esperado.versao)
        .select('id')
      if (error) {
        if (error.code === '23505') throw new ErroFechamento(`Já existe outro fechamento em ${formatarDataBr(input.data)}.`)
        throw comStatus(error, status)
      }
      if (!data || data.length === 0) {
        const existe = await supabase.from('fechamentos').select('id').eq('id', esperado.id).maybeSingle()
        if (existe.error) throw comStatus(existe.error, existe.status)
        return existe.data ? 'conflito' : 'excluido'
      }
      await trocarSangrias(esperado.id, input.sangrias)
      return (await buscarRegistroFechamento(esperado.id)).registro
    },
  }
}


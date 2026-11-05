import { supabase } from './supabase'
import { ErroAmigavel } from './erros'

/** Dia em que a loja não abriu (folga, feriado...): não conta como "dia sem fechamento". */
export interface DiaLojaFechada {
  data: string
  motivo: string | null
  marcadoEm: string
  usuario: string | null
}

interface Linha {
  data: string
  motivo: string | null
  marcado_em: string
  usuario: string | null
}

const TABELA_FALTANDO = ['42P01', 'PGRST205']
const MSG_MIGRACAO = 'Para marcar "loja fechada", rode antes o arquivo supabase/migration_v9_loja_fechada.sql no Supabase.'

/** Dias marcados como loja fechada no período. Banco sem a migração v9: lista vazia. */
export async function listarDiasLojaFechada(inicio: string, fim: string): Promise<DiaLojaFechada[]> {
  const { data, error } = await supabase
    .from('dias_loja_fechada')
    .select('data, motivo, marcado_em, usuario')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: true })
  if (error) {
    if (TABELA_FALTANDO.includes(error.code ?? '')) return []
    throw error
  }
  return ((data ?? []) as Linha[]).map((l) => ({ data: l.data, motivo: l.motivo, marcadoEm: l.marcado_em, usuario: l.usuario }))
}

/** Marca o dia como loja fechada (se já estiver marcado, não faz nada). */
export async function marcarLojaFechada(data: string, motivo?: string): Promise<void> {
  const { error } = await supabase.from('dias_loja_fechada').insert({ data, motivo: motivo?.trim() || null })
  if (!error || error.code === '23505') return
  if (TABELA_FALTANDO.includes(error.code ?? '')) throw new ErroAmigavel(MSG_MIGRACAO)
  throw error
}

/** Tira a marca de loja fechada do dia. */
export async function desmarcarLojaFechada(data: string): Promise<void> {
  const { error } = await supabase.from('dias_loja_fechada').delete().eq('data', data)
  if (!error) return
  if (TABELA_FALTANDO.includes(error.code ?? '')) throw new ErroAmigavel(MSG_MIGRACAO)
  throw error
}

/** Tira da lista os dias em que a loja estava fechada. */
export function semDiasFechados(dias: string[], fechados: DiaLojaFechada[]): string[] {
  const marcados = new Set(fechados.map((f) => f.data))
  return dias.filter((d) => !marcados.has(d))
}

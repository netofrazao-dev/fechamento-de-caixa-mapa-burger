import { supabase } from './supabase'
import type { ItemRelatorio, Relatorio, RelatorioInput } from '../types/fechamento'

interface RelatorioRow {
  id: string
  titulo: string
  data: string
  itens: ItemRelatorio[]
  created_at: string
  updated_at: string
}

function rowToRelatorio(row: RelatorioRow): Relatorio {
  return {
    id: row.id,
    titulo: row.titulo,
    data: row.data,
    itens: row.itens ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listarRelatorios(): Promise<Relatorio[]> {
  const { data, error } = await supabase
    .from('relatorios')
    .select('*')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as RelatorioRow[]).map(rowToRelatorio)
}

export async function buscarRelatorioPorId(id: string): Promise<Relatorio> {
  const { data, error } = await supabase.from('relatorios').select('*').eq('id', id).single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

export async function criarRelatorio(input: RelatorioInput): Promise<Relatorio> {
  const { data, error } = await supabase
    .from('relatorios')
    .insert({ titulo: input.titulo, data: input.data, itens: input.itens })
    .select('*')
    .single()
  if (error) throw error
  return rowToRelatorio(data as unknown as RelatorioRow)
}

export async function atualizarRelatorio(id: string, input: RelatorioInput): Promise<Relatorio> {
  const { data, error } = await supabase
    .from('relatorios')
    .update({ titulo: input.titulo, data: input.data, itens: input.itens })
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

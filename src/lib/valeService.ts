import { supabase } from './supabase'
import type { Vale, ValeInput } from '../types/fechamento'

interface ValeRow {
  id: string
  funcionario: string
  data: string
  valor: number
  observacao: string | null
  created_at: string
}

function rowToVale(row: ValeRow): Vale {
  return {
    id: row.id,
    funcionario: row.funcionario,
    data: row.data,
    valor: row.valor,
    observacao: row.observacao ?? '',
    createdAt: row.created_at,
  }
}

/** Lista vales entre duas datas (inclusive), mais recentes primeiro. */
export async function listarVales(params: { dataInicio: string; dataFim: string }): Promise<Vale[]> {
  const { data, error } = await supabase
    .from('vales')
    .select('*')
    .gte('data', params.dataInicio)
    .lte('data', params.dataFim)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ValeRow[]).map(rowToVale)
}

export async function criarVale(input: ValeInput): Promise<Vale> {
  const { data, error } = await supabase
    .from('vales')
    .insert({
      funcionario: input.funcionario,
      data: input.data,
      valor: input.valor,
      observacao: input.observacao || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToVale(data as ValeRow)
}

export async function excluirVale(id: string): Promise<void> {
  const { error } = await supabase.from('vales').delete().eq('id', id)
  if (error) throw error
}

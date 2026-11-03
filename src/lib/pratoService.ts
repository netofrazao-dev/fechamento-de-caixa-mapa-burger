import { supabase } from './supabase'
import type { Prato } from '../types/fechamento'

interface PratoRow {
  id: string
  nome: string
  ativo?: boolean | null
}

const paraPrato = (r: PratoRow): Prato => ({ id: r.id, nome: r.nome, ativo: r.ativo !== false })

/** Pratos em ordem alfabética. Por padrão só os ativos. */
export async function listarPratos(opts?: { incluirInativos?: boolean }): Promise<Prato[]> {
  const { data, error } = await supabase.from('pratos').select('*').order('nome')
  if (error) throw error
  const todos = (data as PratoRow[]).map(paraPrato)
  return opts?.incluirInativos ? todos : todos.filter((p) => p.ativo)
}

export async function criarPrato(nome: string): Promise<Prato> {
  const { data, error } = await supabase
    .from('pratos')
    .insert({ nome: nome.trim().replace(/\s+/g, ' ') })
    .select('*')
    .single()
  if (error) throw error
  return paraPrato(data as PratoRow)
}

export async function atualizarPrato(id: string, campos: { nome?: string; ativo?: boolean }): Promise<Prato> {
  const linha: Record<string, unknown> = {}
  if (campos.nome !== undefined) linha.nome = campos.nome.trim().replace(/\s+/g, ' ')
  if (campos.ativo !== undefined) linha.ativo = campos.ativo
  const { data, error } = await supabase.from('pratos').update(linha).eq('id', id).select('*').single()
  if (error) throw error
  return paraPrato(data as PratoRow)
}

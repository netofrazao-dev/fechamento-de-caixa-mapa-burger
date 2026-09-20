import { supabase } from './supabase'
import type { Prato } from '../types/fechamento'

export async function listarPratos(): Promise<Prato[]> {
  const { data, error } = await supabase.from('pratos').select('*').order('nome')
  if (error) throw error
  return data as Prato[]
}

export async function criarPrato(nome: string): Promise<Prato> {
  const { data, error } = await supabase.from('pratos').insert({ nome: nome.trim() }).select('*').single()
  if (error) throw error
  return data as Prato
}

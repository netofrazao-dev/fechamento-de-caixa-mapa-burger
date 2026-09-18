import { supabase } from './supabase'
import type { Funcionario } from '../types/fechamento'

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const { data, error } = await supabase.from('funcionarios').select('*').order('nome')
  if (error) throw error
  return data as Funcionario[]
}

export async function criarFuncionario(nome: string): Promise<Funcionario> {
  const { data, error } = await supabase
    .from('funcionarios')
    .insert({ nome: nome.trim() })
    .select('*')
    .single()
  if (error) throw error
  return data as Funcionario
}

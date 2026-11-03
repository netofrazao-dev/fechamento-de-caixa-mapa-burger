import { supabase } from './supabase'
import type { Funcionario } from '../types/fechamento'

interface FuncionarioRow {
  id: string
  nome: string
  ativo?: boolean | null
}

const paraFuncionario = (r: FuncionarioRow): Funcionario => ({ id: r.id, nome: r.nome, ativo: r.ativo !== false })

/** Funcionários em ordem alfabética. Por padrão só os ativos. */
export async function listarFuncionarios(opts?: { incluirInativos?: boolean }): Promise<Funcionario[]> {
  // select('*') funciona com ou sem a coluna "ativo" (antes/depois da migração v3)
  const { data, error } = await supabase.from('funcionarios').select('*').order('nome')
  if (error) throw error
  const todos = (data as FuncionarioRow[]).map(paraFuncionario)
  return opts?.incluirInativos ? todos : todos.filter((f) => f.ativo)
}

export async function criarFuncionario(nome: string): Promise<Funcionario> {
  const { data, error } = await supabase
    .from('funcionarios')
    .insert({ nome: nome.trim().replace(/\s+/g, ' ') })
    .select('*')
    .single()
  if (error) throw error
  return paraFuncionario(data as FuncionarioRow)
}

export async function atualizarFuncionario(id: string, campos: { nome?: string; ativo?: boolean }): Promise<Funcionario> {
  const linha: Record<string, unknown> = {}
  if (campos.nome !== undefined) linha.nome = campos.nome.trim().replace(/\s+/g, ' ')
  if (campos.ativo !== undefined) linha.ativo = campos.ativo
  const { data, error } = await supabase.from('funcionarios').update(linha).eq('id', id).select('*').single()
  if (error) throw error
  return paraFuncionario(data as FuncionarioRow)
}

import { supabase } from './supabase'
import type { RegistroAuditoria } from '../types/fechamento'

interface AuditoriaRow {
  id: number
  registrado_em: string
  tabela: string
  operacao: RegistroAuditoria['operacao']
  registro_id: string | null
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  usuario: string | null
}

/**
 * Alterações registradas de um registro (mais recentes primeiro).
 * Devolve [] se a auditoria ainda não existir no banco (antes da migração v3).
 */
export async function listarAuditoria(tabela: string, registroId: string, limite = 50): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('*')
    .eq('tabela', tabela)
    .eq('registro_id', registroId)
    .order('registrado_em', { ascending: false })
    .limit(limite)
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code ?? '')) return []
    throw error
  }
  return ((data ?? []) as AuditoriaRow[]).map((r) => ({
    id: r.id,
    registradoEm: r.registrado_em,
    tabela: r.tabela,
    operacao: r.operacao,
    registroId: r.registro_id,
    antes: r.antes,
    depois: r.depois,
    usuario: r.usuario,
  }))
}

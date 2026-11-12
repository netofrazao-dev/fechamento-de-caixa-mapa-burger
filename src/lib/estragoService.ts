import { supabase } from './supabase'
import { ErroAmigavel } from './erros'

/** Algo que estragou, lançado pela cozinha (entra no "Estragou" do relatório do dia). */
export interface EstragoCozinha {
  id: string
  data: string
  texto: string
  criadoEm: string
  /** Nome de quem lançou (do cadastro de acesso). */
  nome: string | null
  /** Já entrou no relatório do dia (a cozinha não apaga mais). */
  importadoEm: string | null
}

interface Linha {
  id: string
  data: string
  texto: string
  criado_em: string
  nome: string | null
  importado_em: string | null
}

const COLUNAS = 'id, data, texto, criado_em, nome, importado_em'

function deLinha(l: Linha): EstragoCozinha {
  return { id: l.id, data: l.data, texto: l.texto, criadoEm: l.criado_em, nome: l.nome, importadoEm: l.importado_em }
}

/** Tabela ainda não criada (migração v11 não rodou): segue sem estragos da cozinha. */
function semTabela(e: { code?: string } | null): boolean {
  return Boolean(e && ['42P01', 'PGRST205', 'PGRST200'].includes(e.code ?? ''))
}

/** Estragos lançados pela cozinha num dia (a cozinha só vê os dela; o dono vê todos). */
export async function listarEstragosDoDia(data: string): Promise<EstragoCozinha[]> {
  const { data: linhas, error } = await supabase.from('estragos_cozinha').select(COLUNAS).eq('data', data).order('criado_em')
  if (semTabela(error)) return []
  if (error) throw error
  return (linhas as Linha[]).map(deLinha)
}

export async function lancarEstrago(data: string, texto: string): Promise<EstragoCozinha> {
  const limpo = texto.trim().replace(/\s+/g, ' ').slice(0, 200)
  if (!limpo) throw new ErroAmigavel('Escreva o que estragou.')
  const { data: linha, error } = await supabase.from('estragos_cozinha').insert({ data, texto: limpo }).select(COLUNAS).single()
  if (error) {
    if (semTabela(error)) throw new ErroAmigavel('O banco ainda não foi atualizado para isso (falta rodar a migração v11).')
    throw error
  }
  return deLinha(linha as Linha)
}

export async function excluirEstrago(id: string): Promise<void> {
  const { data, error } = await supabase.from('estragos_cozinha').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new ErroAmigavel('Esse já entrou no relatório do dia e não pode mais ser apagado aqui.')
}

/** Marca como já lançados no relatório (depois de salvar o relatório). */
export async function marcarEstragosNoRelatorio(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await supabase.from('estragos_cozinha').update({ importado_em: new Date().toISOString() }).in('id', ids).is('importado_em', null)
}

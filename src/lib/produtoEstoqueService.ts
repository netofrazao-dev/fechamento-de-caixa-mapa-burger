import { supabase } from './supabase'
import { codigoErro } from './erros'
import { PRODUTOS_ESTOQUE_PADRAO } from './produtos'

/** Produto contado no "Estoque quente" do relatório (refrigerantes, águas, energéticos). */
export interface ProdutoEstoque {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

interface ProdutoRow {
  id: string
  nome: string
  ativo?: boolean | null
  ordem?: number | null
}

const paraProduto = (r: ProdutoRow): ProdutoEstoque => ({ id: r.id, nome: r.nome, ativo: r.ativo !== false, ordem: r.ordem ?? 0 })

const TABELA_FALTANDO = ['42P01', 'PGRST205']

/** Produtos na ordem da contagem. Por padrão só os ativos. */
export async function listarProdutosEstoque(opts?: { incluirInativos?: boolean }): Promise<ProdutoEstoque[]> {
  const { data, error } = await supabase.from('produtos_estoque').select('*').order('ordem').order('nome')
  if (error) throw error
  const todos = (data as ProdutoRow[]).map(paraProduto)
  return opts?.incluirInativos ? todos : todos.filter((p) => p.ativo)
}

/**
 * Nomes dos produtos ativos para o formulário do relatório.
 * Se o banco ainda não tem a tabela (migração v8 não rodou) ou está sem
 * internet, usa a lista antiga para o relatório continuar funcionando.
 */
export async function nomesProdutosAtivos(): Promise<{ nomes: string[]; daListaAntiga: boolean }> {
  try {
    const produtos = await listarProdutosEstoque()
    return { nomes: produtos.map((p) => p.nome), daListaAntiga: false }
  } catch (e) {
    if (TABELA_FALTANDO.includes(codigoErro(e) ?? '')) return { nomes: PRODUTOS_ESTOQUE_PADRAO, daListaAntiga: true }
    throw e
  }
}

const limpar = (nome: string) => nome.trim().replace(/\s+/g, ' ')

export async function criarProdutoEstoque(nome: string): Promise<ProdutoEstoque> {
  const { data, error } = await supabase.from('produtos_estoque').insert({ nome: limpar(nome) }).select('*').single()
  if (error) throw error
  return paraProduto(data as ProdutoRow)
}

export async function atualizarProdutoEstoque(id: string, campos: { nome?: string; ativo?: boolean }): Promise<ProdutoEstoque> {
  const linha: Record<string, unknown> = {}
  if (campos.nome !== undefined) linha.nome = limpar(campos.nome)
  if (campos.ativo !== undefined) linha.ativo = campos.ativo
  const { data, error } = await supabase.from('produtos_estoque').update(linha).eq('id', id).select('*').single()
  if (error) throw error
  return paraProduto(data as ProdutoRow)
}

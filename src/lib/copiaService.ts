import { supabase } from './supabase'
import { baixarArquivo } from './arquivos'

export interface CopiaAutomatica {
  id: number
  criadaEm: string
  origem: string
  tamanhoBytes: number
  quantidades: Record<string, number>
}

const TABELAS: { nome: string; ordem: string; colunas?: string; colunasSemImagens?: string }[] = [
  { nome: 'fechamentos', ordem: 'data' },
  { nome: 'sangrias', ordem: 'created_at' },
  {
    nome: 'relatorios',
    ordem: 'data',
    colunasSemImagens:
      'id, data, abertura_caixa, fechamento_caixa, quantidade_vendida, estragou, funcionarios_que_comeram, ' +
      'consumo_loja_mensal, consumo_loja_motoboys, cortesia_clientes, sangrias, estoque_quente, created_at, updated_at',
  },
  { nome: 'vales', ordem: 'data' },
  { nome: 'vales_meses_fechados', ordem: 'mes' },
  { nome: 'vales_historico', ordem: 'id' },
  { nome: 'funcionarios', ordem: 'nome' },
  { nome: 'pratos', ordem: 'nome' },
]

const POR_PAGINA = 500

/** Lê uma tabela inteira, de 500 em 500 linhas. Tabela que não existe vira lista vazia. */
async function lerTabelaInteira(nome: string, ordem: string, colunas: string): Promise<unknown[]> {
  const linhas: unknown[] = []
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const { data, error } = await supabase
      .from(nome)
      .select(colunas)
      .order(ordem, { ascending: true })
      .range(inicio, inicio + POR_PAGINA - 1)
    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code ?? '')) return []
      throw error
    }
    linhas.push(...(data ?? []))
    if (!data || data.length < POR_PAGINA) return linhas
  }
}

function dataArquivo(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`
}

const CHAVE_ULTIMA = 'mapa-burger-ultima-copia-baixada'

export function ultimaCopiaBaixada(): string | null {
  try {
    return localStorage.getItem(CHAVE_ULTIMA)
  } catch {
    return null
  }
}

/** Gera e baixa, no aparelho, a cópia completa de todos os dados. */
export async function baixarCopiaCompleta(opts: {
  incluirImagens: boolean
  aoAvancar?: (tabela: string) => void
}): Promise<Record<string, number>> {
  const dados: Record<string, unknown> = {
    sistema: 'Mapa Burger - fechamento de caixa',
    versao: 1,
    origem: 'baixada pelo app',
    gerada_em: new Date().toISOString(),
    com_imagens: opts.incluirImagens,
  }
  const quantidades: Record<string, number> = {}
  for (const t of TABELAS) {
    opts.aoAvancar?.(t.nome)
    const colunas = !opts.incluirImagens && t.colunasSemImagens ? t.colunasSemImagens : '*'
    const linhas = await lerTabelaInteira(t.nome, t.ordem, colunas)
    dados[t.nome] = linhas
    quantidades[t.nome] = linhas.length
  }
  dados.quantidades = quantidades
  baixarArquivo(JSON.stringify(dados, null, 1), `copia-mapa-burger_${dataArquivo()}.json`, 'application/json')
  try {
    localStorage.setItem(CHAVE_ULTIMA, new Date().toISOString())
  } catch {
    // ignora
  }
  return quantidades
}

/** Cópias automáticas guardadas no banco (mais recentes primeiro). null = migração v6 ainda não rodada. */
export async function listarCopiasAutomaticas(): Promise<CopiaAutomatica[] | null> {
  const { data, error } = await supabase
    .from('copias_seguranca')
    .select('id, criada_em, origem, tamanho_bytes, quantidades')
    .order('criada_em', { ascending: false })
    .limit(20)
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code ?? '')) return null
    throw error
  }
  return ((data ?? []) as { id: number; criada_em: string; origem: string; tamanho_bytes: number; quantidades: Record<string, number> }[]).map(
    (c) => ({ id: c.id, criadaEm: c.criada_em, origem: c.origem, tamanhoBytes: c.tamanho_bytes, quantidades: c.quantidades ?? {} }),
  )
}

export async function baixarCopiaAutomatica(copia: CopiaAutomatica): Promise<void> {
  const { data, error } = await supabase.from('copias_seguranca').select('dados').eq('id', copia.id).single()
  if (error) throw error
  const d = new Date(copia.criadaEm)
  const p = (n: number) => String(n).padStart(2, '0')
  const nome = `copia-automatica-mapa-burger_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
  baixarArquivo(JSON.stringify((data as { dados: unknown }).dados, null, 1), nome, 'application/json')
}

/** "12 fechamentos · 30 vales · 25 relatórios" */
export function resumoQuantidades(q: Record<string, number>): string {
  const partes: [string, string][] = [
    ['fechamentos', 'fechamento(s)'],
    ['relatorios', 'relatório(s)'],
    ['vales', 'vale(s)'],
  ]
  return partes.map(([k, r]) => `${q[k] ?? 0} ${r}`).join(' · ')
}

/** true se a última cópia baixada neste aparelho tem mais de 30 dias (ou nunca baixou). */
export function copiaAtrasada(): boolean {
  const ultima = ultimaCopiaBaixada()
  return !ultima || Date.now() - new Date(ultima).getTime() > 30 * 86_400_000
}

import { supabase } from './supabase'
import { lerRascunho, limparRascunho } from './draft'
import { dataValida } from './vales'
import { calcularResultado } from './calculations'
import type { Ajuste, DadosBrendi, DadosLC } from '../types/fechamento'

/**
 * Rascunhos de fechamento e relatório que ainda não foram salvos — deste
 * aparelho (localStorage) e da nuvem (começados em outro aparelho). Servem
 * para mostrar "em andamento" e o botão "continuar".
 */

export type TipoRascunhoAberto = 'fechamento' | 'relatorio'

export interface DestinoRascunho {
  tipo: TipoRascunhoAberto
  chave: string
  /** Onde continuar (abre o formulário que restaura este rascunho). */
  link: string
  /** true = alterações não salvas de um fechamento/relatório que já existe. */
  edicao: boolean
  registroId?: string
}

export interface RascunhoAberto extends DestinoRascunho {
  /** Dia do formulário (campo "data" do rascunho). */
  data: string
  salvoEm: string
  dados: Record<string, unknown>
}

const FECH = 'mapa-burger-rascunho-fechamento'
const REL = 'mapa-burger-rascunho-relatorio'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Entende a chave do rascunho (mesmas chaves usadas pelos formulários). */
export function interpretarChave(chave: string): DestinoRascunho | null {
  if (chave === FECH) return { tipo: 'fechamento', chave, link: '/novo', edicao: false }
  if (chave.startsWith(`${FECH}-dia-`)) {
    const dia = chave.slice(`${FECH}-dia-`.length)
    return dataValida(dia) ? { tipo: 'fechamento', chave, link: `/novo?data=${dia}`, edicao: false } : null
  }
  if (chave.startsWith(`${FECH}-`)) {
    const id = chave.slice(`${FECH}-`.length)
    return UUID.test(id) ? { tipo: 'fechamento', chave, link: `/fechamento/${id}/editar`, edicao: true, registroId: id } : null
  }
  if (chave === `${REL}-novo`) return { tipo: 'relatorio', chave, link: '/relatorios/novo', edicao: false }
  if (chave.startsWith(`${REL}-novo-`)) {
    const dia = chave.slice(`${REL}-novo-`.length)
    return dataValida(dia) ? { tipo: 'relatorio', chave, link: `/relatorios/novo?data=${dia}`, edicao: false } : null
  }
  if (chave.startsWith(`${REL}-`)) {
    const id = chave.slice(`${REL}-`.length)
    return UUID.test(id) ? { tipo: 'relatorio', chave, link: `/relatorios/${id}`, edicao: true, registroId: id } : null
  }
  return null
}

/** Campos que são só rótulos (não algo que a pessoa preencheu). */
const SO_ROTULO = new Set(['data', 'turno', 'tipo', 'produto'])

/** true se o rascunho tem algo preenchido além da data (número > 0, texto, lista, foto...). */
export function temConteudo(valor: unknown, chave?: string): boolean {
  if (chave && SO_ROTULO.has(chave)) return false
  if (valor === null || valor === undefined || valor === false) return false
  if (typeof valor === 'number') return valor !== 0 && Number.isFinite(valor)
  if (typeof valor === 'string') return valor.trim() !== ''
  if (Array.isArray(valor)) return valor.some((v) => temConteudo(v))
  if (typeof valor === 'object') return Object.entries(valor as Record<string, unknown>).some(([k, v]) => temConteudo(v, k))
  return true
}

function montar(chave: string, dados: unknown, salvoEm: string): RascunhoAberto | null {
  const destino = interpretarChave(chave)
  if (!destino || !dados || typeof dados !== 'object') return null
  const d = dados as Record<string, unknown>
  const data = typeof d.data === 'string' ? d.data : ''
  if (!dataValida(data) || !temConteudo(d)) return null
  return { ...destino, data, salvoEm, dados: d }
}

/** Rascunhos guardados neste aparelho. */
export function rascunhosDoAparelho(): RascunhoAberto[] {
  const lista: RascunhoAberto[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i)
      if (!chave || !chave.startsWith('mapa-burger-rascunho-')) continue
      const r = lerRascunho<unknown>(chave)
      const m = r ? montar(chave, r.dados, r.salvoEm) : null
      if (m) lista.push(m)
    }
  } catch {
    // sem acesso ao armazenamento
  }
  return lista
}

/** Rascunhos guardados na nuvem (de qualquer aparelho). Sem internet ou sem a tabela: lista vazia. */
export async function rascunhosDaNuvem(): Promise<RascunhoAberto[]> {
  try {
    const { data, error } = await supabase
      .from('rascunhos')
      .select('chave, dados, salvo_em')
      .like('chave', 'mapa-burger-rascunho-%')
      .limit(200)
    if (error || !data) return []
    return (data as { chave: string; dados: unknown; salvo_em: string }[])
      .map((r) => montar(r.chave, r.dados, r.salvo_em))
      .filter((r): r is RascunhoAberto => r !== null)
  } catch {
    return []
  }
}

/** Junta aparelho + nuvem; para a mesma chave, fica o mais recente. */
export function juntarRascunhos(...listas: RascunhoAberto[][]): RascunhoAberto[] {
  const porChave = new Map<string, RascunhoAberto>()
  for (const r of listas.flat()) {
    const atual = porChave.get(r.chave)
    if (!atual || Date.parse(r.salvoEm) > Date.parse(atual.salvoEm)) porChave.set(r.chave, r)
  }
  return [...porChave.values()].sort((a, b) => b.data.localeCompare(a.data) || b.salvoEm.localeCompare(a.salvoEm))
}

export async function listarRascunhosAbertos(): Promise<RascunhoAberto[]> {
  return juntarRascunhos(rascunhosDoAparelho(), await rascunhosDaNuvem())
}

/** Apaga o rascunho (deste aparelho e da nuvem). */
export async function descartarRascunho(chave: string): Promise<void> {
  limparRascunho(chave)
  try {
    await supabase.from('rascunhos').delete().eq('chave', chave)
  } catch {
    // sem internet: o da nuvem some quando o formulário for salvo
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Total Caixa até agora de um rascunho de fechamento (para mostrar "em andamento"). */
export function caixaDoRascunho(dados: Record<string, unknown>): number {
  const lc = (dados.lc ?? {}) as Partial<DadosLC>
  const br = (dados.brendi ?? {}) as Partial<DadosBrendi>
  return calcularResultado({
    lc: {
      dinheiroAbertura: num(lc.dinheiroAbertura),
      dinheiroFechamento: num(lc.dinheiroFechamento),
      pix: num(lc.pix),
      debito: num(lc.debito),
      credito: num(lc.credito),
      consumoLoja: num(lc.consumoLoja),
      aPrazo: num(lc.aPrazo),
      ticket: num(lc.ticket),
    },
    brendi: { pix: num(br.pix), debito: num(br.debito), credito: num(br.credito), creditoOnline: num(br.creditoOnline), dinheiro: num(br.dinheiro) },
    totalLCSistema: num(dados.totalLCSistema),
    ajuste: { tipo: null, valor: 0 } as Ajuste,
  }).totalCaixa
}

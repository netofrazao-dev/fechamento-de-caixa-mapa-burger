import type {
  Ajuste,
  ConsumoItem,
  DadosBrendi,
  DadosLC,
  EstoqueSnapshot,
  MarmitaItem,
  Sangria,
} from '../types/fechamento'
import { normalizarNome } from './vales'
import { tipoDaSangria } from './sangrias'

/**
 * Junta o que dois aparelhos fizeram no mesmo formulário ("mesclagem de três
 * vias"): parte da versão que os dois tinham em comum (base) e pega, de cada
 * lado, só o que aquele lado mudou. Assim o PC pode lançar sangrias enquanto o
 * celular conta o estoque e tira as fotos, sem um apagar o que o outro fez.
 *
 * Regras:
 * - campo simples: fica o lado que mudou; se os dois mudaram para valores
 *   diferentes, fica o deste aparelho e o campo é avisado como conflito;
 * - listas (sangrias, consumo, estragou...): entra o que cada lado acrescentou
 *   e sai o que cada lado tirou. A mesma linha acrescentada nos dois lados
 *   (ex.: veio do rascunho compartilhado) entra uma vez só;
 * - estoque: produto por produto;
 * - marmitas: prato por prato; se os dois contaram, soma as duas contagens;
 * - fotos: comparadas pela assinatura (sem precisar baixar a foto de novo).
 */

// ─── Conteúdo de cada formulário ──────────────────────────────

/** O que o relatório do dia guarda (é o que os aparelhos editam juntos). */
export interface ConteudoRelatorio {
  data: string
  aberturaCaixa: number
  fechamentoCaixa: number
  quantidadeVendida: number
  /** Marmitas vendidas por prato (contador do relatório). */
  marmitas: MarmitaItem[]
  estragou: string[]
  funcionariosQueComeram: string[]
  consumoLojaMensal: ConsumoItem[]
  consumoLojaMotoboys: ConsumoItem[]
  cortesiaClientes: ConsumoItem[]
  sangrias: Sangria[]
  estoqueQuente: EstoqueSnapshot
  /** Foto/print: data URL no aparelho, ou "foto:<assinatura>" no rascunho da nuvem. */
  imagem1: string | null
  imagem2: string | null
}

/** O que o fechamento do caixa guarda. */
export interface ConteudoFechamento {
  data: string
  lc: DadosLC
  brendi: DadosBrendi
  /** Sangrias antigas (hoje as sangrias ficam no relatório). */
  sangrias: Sangria[]
  marmitas: MarmitaItem[]
  totalLCSistema: number
  ajuste: Ajuste
  observacoes: string
  /** Dinheiro colocado no caixa durante o dia (só informativo). */
  suprimento: number
  suprimentoObs: string
}

export interface ResultadoMescla<C> {
  resultado: C
  /** Partes em que entrou algo que veio do outro aparelho (para avisar na tela). */
  deFora: string[]
  /** Partes mudadas nos dois aparelhos de jeitos diferentes (ficou o deste aparelho). */
  conflitos: string[]
}

export const RELATORIO_VAZIO = (data: string): ConteudoRelatorio => ({
  data,
  aberturaCaixa: 0,
  fechamentoCaixa: 0,
  quantidadeVendida: 0,
  marmitas: [],
  estragou: [],
  funcionariosQueComeram: [],
  consumoLojaMensal: [],
  consumoLojaMotoboys: [],
  cortesiaClientes: [],
  sangrias: [],
  estoqueQuente: { itens: [] },
  imagem1: null,
  imagem2: null,
})

export const LC_VAZIO: DadosLC = {
  dinheiroAbertura: 0,
  dinheiroFechamento: 0,
  pix: 0,
  debito: 0,
  credito: 0,
  consumoLoja: 0,
  aPrazo: 0,
  ticket: 0,
}
export const BRENDI_VAZIO: DadosBrendi = { pix: 0, debito: 0, credito: 0, creditoOnline: 0, dinheiro: 0 }
export const AJUSTE_VAZIO: Ajuste = { tipo: null, valor: 0 }

export const FECHAMENTO_VAZIO = (data: string): ConteudoFechamento => ({
  data,
  lc: { ...LC_VAZIO },
  brendi: { ...BRENDI_VAZIO },
  sangrias: [],
  marmitas: [],
  totalLCSistema: 0,
  ajuste: { ...AJUSTE_VAZIO },
  observacoes: '',
  suprimento: 0,
  suprimentoObs: '',
})

// ─── Comparação ───────────────────────────────────────────────

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const saida: Record<string, unknown> = {}
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) saida[k] = ordenar(o[k])
    return saida
  }
  return v
}

/** Texto que representa o valor sem depender da ordem das chaves (para comparar). */
export function canonico(v: unknown): string {
  return JSON.stringify(ordenar(v)) ?? 'undefined'
}

export function iguais(a: unknown, b: unknown): boolean {
  return a === b || canonico(a) === canonico(b)
}

// ─── Fotos ────────────────────────────────────────────────────

export const PREFIXO_FOTO = 'foto:'
const memoAssinatura = new Map<string, string>()

/**
 * Assinatura curta de uma foto (data URL). Serve para comparar fotos e para
 * guardar a foto à parte na nuvem, sem reenviar a cada letra digitada.
 * Uma referência ("foto:...") devolve ela mesma.
 */
export function assinaturaFoto(v: string | null | undefined): string | null {
  if (!v) return null
  if (v.startsWith(PREFIXO_FOTO)) return v
  const memo = memoAssinatura.get(v)
  if (memo) return memo
  // FNV-1a (32 bits) em duas passadas com sementes diferentes + tamanho.
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x050c5d1f)
  }
  const assinatura = `${PREFIXO_FOTO}${v.length.toString(36)}-${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`
  if (memoAssinatura.size > 40) memoAssinatura.clear()
  memoAssinatura.set(v, assinatura)
  return assinatura
}

export function ehReferenciaFoto(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.startsWith(PREFIXO_FOTO)
}

// ─── Peças da mesclagem ───────────────────────────────────────

export type Origem = 'igual' | 'meu' | 'deles' | 'ambos' | 'conflito'

/** Um valor: fica o lado que mudou; os dois mudaram diferente = conflito (fica o meu). */
export function mesclarValor<T>(base: T, meu: T, deles: T, igual: (a: T, b: T) => boolean = iguais): { valor: T; origem: Origem } {
  if (igual(meu, deles)) return { valor: meu, origem: igual(meu, base) ? 'igual' : 'ambos' }
  if (igual(meu, base)) return { valor: deles, origem: 'deles' }
  if (igual(deles, base)) return { valor: meu, origem: 'meu' }
  return { valor: meu, origem: 'conflito' }
}

/**
 * Lista como "saco" de linhas identificadas por `chave`. Cada linha fica com
 * base + o maior acréscimo de um dos lados − a maior remoção de um dos lados.
 * Ordem: a deste aparelho primeiro (as linhas não pulam de lugar enquanto a
 * pessoa digita) e depois o que veio do outro.
 */
export function mesclarLista<T>(base: T[], meu: T[], deles: T[], chave: (x: T) => string): { valor: T[]; origem: Origem } {
  const contar = (l: T[]) => {
    const m = new Map<string, number>()
    for (const x of l) {
      const k = chave(x)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }
  const cb = contar(base)
  const cm = contar(meu)
  const cd = contar(deles)
  const alvo = new Map<string, number>()
  for (const k of new Set([...cb.keys(), ...cm.keys(), ...cd.keys()])) {
    const b = cb.get(k) ?? 0
    const m = cm.get(k) ?? 0
    const d = cd.get(k) ?? 0
    alvo.set(k, b + Math.max(m - b, d - b, 0) - Math.max(b - m, b - d, 0))
  }
  const usados = new Map<string, number>()
  const valor: T[] = []
  for (const x of [...meu, ...deles]) {
    const k = chave(x)
    const u = usados.get(k) ?? 0
    if (u < (alvo.get(k) ?? 0)) {
      valor.push(x)
      usados.set(k, u + 1)
    }
  }
  const mudouMeu = !mesmaSequencia(meu, base, chave)
  const origem: Origem = mesmaSequencia(valor, meu, chave) ? (mudouMeu ? 'meu' : 'igual') : 'deles'
  return { valor, origem }
}

function mesmaSequencia<T>(a: T[], b: T[], chave: (x: T) => string): boolean {
  return a.length === b.length && a.every((x, i) => chave(x) === chave(b[i]))
}

const textoChave = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ')
const numeroChave = (n: number) => String(Math.round((Number(n) || 0) * 100))

export const chaveSangria = (s: Sangria) => [tipoDaSangria(s), numeroChave(s.valor), textoChave(s.motivo)].join('|')
export const chaveConsumo = (c: ConsumoItem) =>
  [textoChave(c.pessoa), textoChave(c.item), numeroChave(c.valor), c.funcionarioId ?? ''].join('|')

function mesclarEstoque(base: EstoqueSnapshot, meu: EstoqueSnapshot, deles: EstoqueSnapshot): { valor: EstoqueSnapshot; origem: Origem } {
  const mapa = (s: EstoqueSnapshot) => new Map((s?.itens ?? []).map((i) => [normalizarNome(i.produto), i]))
  const mb = mapa(base)
  const mm = mapa(meu)
  const md = mapa(deles)
  let deFora = false
  let conflito = false
  let mudouMeu = false
  const itens: EstoqueSnapshot['itens'] = []
  for (const k of new Set([...mm.keys(), ...md.keys(), ...mb.keys()])) {
    const r = mesclarValor(mb.get(k)?.quantidade ?? 0, mm.get(k)?.quantidade ?? 0, md.get(k)?.quantidade ?? 0)
    if (r.origem === 'deles') deFora = true
    if (r.origem === 'conflito') conflito = true
    if (r.origem === 'meu') mudouMeu = true
    if (mm.has(k) || md.has(k) || r.valor > 0) itens.push({ produto: (mm.get(k) ?? md.get(k) ?? mb.get(k))!.produto, quantidade: r.valor })
  }
  return { valor: { itens }, origem: conflito ? 'conflito' : deFora ? 'deles' : mudouMeu ? 'meu' : 'igual' }
}

/** Fotos: compara pela assinatura e devolve o valor do lado escolhido (data URL ou referência). */
function mesclarFoto(base: string | null, meu: string | null, deles: string | null): { valor: string | null; origem: Origem } {
  const r = mesclarValor(assinaturaFoto(base), assinaturaFoto(meu), assinaturaFoto(deles))
  return { valor: r.origem === 'deles' ? deles : meu, origem: r.origem }
}

/** Marmitas prato por prato: se os dois contaram o mesmo prato, soma as duas contagens. */
function mesclarMarmitas(base: MarmitaItem[], meu: MarmitaItem[], deles: MarmitaItem[]): { valor: MarmitaItem[]; origem: Origem } {
  const mapa = (l: MarmitaItem[]) => new Map((l ?? []).map((i) => [normalizarNome(i.prato), i]))
  const mb = mapa(base)
  const mm = mapa(meu)
  const md = mapa(deles)
  let deFora = false
  let mudouMeu = false
  const valor: MarmitaItem[] = []
  for (const k of new Set([...mm.keys(), ...md.keys(), ...mb.keys()])) {
    const b = mb.get(k)?.quantidade ?? 0
    const m = mm.get(k)?.quantidade ?? 0
    const d = md.get(k)?.quantidade ?? 0
    const r = mesclarValor(b, m, d)
    let q = r.valor
    if (r.origem === 'conflito') {
      q = Math.max(0, m + d - b) // os dois contaram: junta as duas contagens
      deFora = true
    } else if (r.origem === 'deles') deFora = true
    else if (r.origem === 'meu') mudouMeu = true
    if (q > 0) valor.push({ prato: (mm.get(k) ?? md.get(k) ?? mb.get(k))!.prato, quantidade: q })
  }
  return { valor, origem: deFora ? 'deles' : mudouMeu ? 'meu' : 'igual' }
}

class Anotacoes {
  deFora: string[] = []
  conflitos: string[] = []
  anotar(rotulo: string, origem: Origem) {
    if (origem === 'deles' && !this.deFora.includes(rotulo)) this.deFora.push(rotulo)
    if (origem === 'conflito' && !this.conflitos.includes(rotulo)) this.conflitos.push(rotulo)
  }
  campo<T>(rotulo: string, r: { valor: T; origem: Origem }): T {
    this.anotar(rotulo, r.origem)
    return r.valor
  }
}

// ─── Relatório ────────────────────────────────────────────────

export const ROTULOS_RELATORIO: Record<keyof ConteudoRelatorio, string> = {
  data: 'Data',
  aberturaCaixa: 'Abertura anotada',
  fechamentoCaixa: 'Fechamento anotado',
  quantidadeVendida: 'Marmitas anotadas',
  marmitas: 'Marmitas',
  estragou: 'Estragou',
  funcionariosQueComeram: 'Funcionários que comeram',
  consumoLojaMensal: 'Consumo de funcionários',
  consumoLojaMotoboys: 'Consumo dos motoboys',
  cortesiaClientes: 'Cortesia',
  sangrias: 'Sangrias',
  estoqueQuente: 'Estoque',
  imagem1: 'Print 1',
  imagem2: 'Print 2',
}

/** Garante todos os campos (rascunhos antigos podem não ter algum). */
export function completarRelatorio(c: Partial<ConteudoRelatorio> | null | undefined, data = ''): ConteudoRelatorio {
  const v = RELATORIO_VAZIO(data)
  const x = c ?? {}
  return {
    data: typeof x.data === 'string' ? x.data : v.data,
    aberturaCaixa: Number(x.aberturaCaixa) || 0,
    fechamentoCaixa: Number(x.fechamentoCaixa) || 0,
    quantidadeVendida: Number(x.quantidadeVendida) || 0,
    marmitas: Array.isArray(x.marmitas) ? x.marmitas : [],
    estragou: Array.isArray(x.estragou) ? x.estragou : [],
    funcionariosQueComeram: Array.isArray(x.funcionariosQueComeram) ? x.funcionariosQueComeram : [],
    consumoLojaMensal: Array.isArray(x.consumoLojaMensal) ? x.consumoLojaMensal : [],
    consumoLojaMotoboys: Array.isArray(x.consumoLojaMotoboys) ? x.consumoLojaMotoboys : [],
    cortesiaClientes: Array.isArray(x.cortesiaClientes) ? x.cortesiaClientes : [],
    sangrias: Array.isArray(x.sangrias) ? x.sangrias : [],
    estoqueQuente: x.estoqueQuente && Array.isArray(x.estoqueQuente.itens) ? x.estoqueQuente : { itens: [] },
    imagem1: typeof x.imagem1 === 'string' && x.imagem1 ? x.imagem1 : null,
    imagem2: typeof x.imagem2 === 'string' && x.imagem2 ? x.imagem2 : null,
  }
}

export function mesclarRelatorio(base: ConteudoRelatorio, meu: ConteudoRelatorio, deles: ConteudoRelatorio): ResultadoMescla<ConteudoRelatorio> {
  const a = new Anotacoes()
  const R = ROTULOS_RELATORIO
  const resultado: ConteudoRelatorio = {
    data: a.campo(R.data, mesclarValor(base.data, meu.data, deles.data)),
    aberturaCaixa: a.campo(R.aberturaCaixa, mesclarValor(base.aberturaCaixa, meu.aberturaCaixa, deles.aberturaCaixa)),
    fechamentoCaixa: a.campo(R.fechamentoCaixa, mesclarValor(base.fechamentoCaixa, meu.fechamentoCaixa, deles.fechamentoCaixa)),
    quantidadeVendida: a.campo(R.quantidadeVendida, mesclarValor(base.quantidadeVendida, meu.quantidadeVendida, deles.quantidadeVendida)),
    marmitas: a.campo(R.marmitas, mesclarMarmitas(base.marmitas, meu.marmitas, deles.marmitas)),
    estragou: a.campo(R.estragou, mesclarLista(base.estragou, meu.estragou, deles.estragou, textoChave)),
    funcionariosQueComeram: a.campo(
      R.funcionariosQueComeram,
      mesclarLista(base.funcionariosQueComeram, meu.funcionariosQueComeram, deles.funcionariosQueComeram, normalizarNome),
    ),
    consumoLojaMensal: a.campo(R.consumoLojaMensal, mesclarLista(base.consumoLojaMensal, meu.consumoLojaMensal, deles.consumoLojaMensal, chaveConsumo)),
    consumoLojaMotoboys: a.campo(
      R.consumoLojaMotoboys,
      mesclarLista(base.consumoLojaMotoboys, meu.consumoLojaMotoboys, deles.consumoLojaMotoboys, chaveConsumo),
    ),
    cortesiaClientes: a.campo(R.cortesiaClientes, mesclarLista(base.cortesiaClientes, meu.cortesiaClientes, deles.cortesiaClientes, chaveConsumo)),
    sangrias: a.campo(R.sangrias, mesclarLista(base.sangrias, meu.sangrias, deles.sangrias, chaveSangria)),
    estoqueQuente: a.campo(R.estoqueQuente, mesclarEstoque(base.estoqueQuente, meu.estoqueQuente, deles.estoqueQuente)),
    imagem1: a.campo(R.imagem1, mesclarFoto(base.imagem1, meu.imagem1, deles.imagem1)),
    imagem2: a.campo(R.imagem2, mesclarFoto(base.imagem2, meu.imagem2, deles.imagem2)),
  }
  return { resultado, deFora: a.deFora, conflitos: a.conflitos }
}

// ─── Fechamento ───────────────────────────────────────────────

const ROTULOS_LC: Record<keyof DadosLC, string> = {
  dinheiroAbertura: 'Dinheiro na abertura',
  dinheiroFechamento: 'Dinheiro no fechamento',
  pix: 'PIX (LC)',
  debito: 'Débito (LC)',
  credito: 'Crédito (LC)',
  consumoLoja: 'Consumo loja',
  aPrazo: 'A prazo',
  ticket: 'Ticket',
}
const ROTULOS_BRENDI: Record<keyof DadosBrendi, string> = {
  pix: 'PIX (Brendi)',
  debito: 'Débito (Brendi)',
  credito: 'Crédito (Brendi)',
  creditoOnline: 'Crédito online (Brendi)',
  dinheiro: 'Dinheiro (Brendi)',
}

export function completarFechamento(c: Partial<ConteudoFechamento> | null | undefined, data = ''): ConteudoFechamento {
  const x = c ?? {}
  return {
    data: typeof x.data === 'string' ? x.data : data,
    lc: { ...LC_VAZIO, ...(x.lc ?? {}) },
    brendi: { ...BRENDI_VAZIO, ...(x.brendi ?? {}) },
    sangrias: Array.isArray(x.sangrias) ? x.sangrias : [],
    marmitas: Array.isArray(x.marmitas) ? x.marmitas : [],
    totalLCSistema: Number(x.totalLCSistema) || 0,
    ajuste: x.ajuste && x.ajuste.tipo ? { tipo: x.ajuste.tipo, valor: Number(x.ajuste.valor) || 0 } : { ...AJUSTE_VAZIO },
    observacoes: typeof x.observacoes === 'string' ? x.observacoes : '',
    suprimento: Number(x.suprimento) || 0,
    suprimentoObs: typeof x.suprimentoObs === 'string' ? x.suprimentoObs : '',
  }
}

function mesclarCampos<T extends object>(
  a: Anotacoes,
  rotulos: Record<keyof T, string>,
  grupo: string,
  base: T,
  meu: T,
  deles: T,
): T {
  const saida = { ...meu }
  let veio = false
  for (const k of Object.keys(rotulos) as (keyof T)[]) {
    const r = mesclarValor(base[k], meu[k], deles[k])
    saida[k] = r.valor
    if (r.origem === 'deles') veio = true
    if (r.origem === 'conflito') a.anotar(rotulos[k], 'conflito')
  }
  if (veio) a.anotar(grupo, 'deles')
  return saida
}

export function mesclarFechamento(base: ConteudoFechamento, meu: ConteudoFechamento, deles: ConteudoFechamento): ResultadoMescla<ConteudoFechamento> {
  const a = new Anotacoes()
  const chaveSangriaAntiga = (s: Sangria) => [numeroChave(s.valor), textoChave(s.motivo)].join('|')
  const resultado: ConteudoFechamento = {
    data: a.campo('Data', mesclarValor(base.data, meu.data, deles.data)),
    lc: mesclarCampos(a, ROTULOS_LC, 'Valores do LC', base.lc, meu.lc, deles.lc),
    brendi: mesclarCampos(a, ROTULOS_BRENDI, 'Valores do Brendi', base.brendi, meu.brendi, deles.brendi),
    sangrias: a.campo('Sangrias antigas', mesclarLista(base.sangrias, meu.sangrias, deles.sangrias, chaveSangriaAntiga)),
    marmitas: a.campo('Marmitas', mesclarMarmitas(base.marmitas, meu.marmitas, deles.marmitas)),
    totalLCSistema: a.campo('Total LC Sistema', mesclarValor(base.totalLCSistema, meu.totalLCSistema, deles.totalLCSistema)),
    ajuste: a.campo('Ajuste', mesclarValor(base.ajuste, meu.ajuste, deles.ajuste)),
    observacoes: a.campo('Observações', mesclarValor(base.observacoes, meu.observacoes, deles.observacoes, (x, y) => x.trim() === y.trim())),
    suprimento: a.campo('Suprimento', mesclarValor(base.suprimento, meu.suprimento, deles.suprimento)),
    suprimentoObs: a.campo(
      'Observação do suprimento',
      mesclarValor(base.suprimentoObs, meu.suprimentoObs, deles.suprimentoObs, (x, y) => x.trim() === y.trim()),
    ),
  }
  return { resultado, deFora: a.deFora, conflitos: a.conflitos }
}

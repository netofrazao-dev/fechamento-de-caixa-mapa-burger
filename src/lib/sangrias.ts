import type { Sangria, TipoSangria } from '../types/fechamento'

export interface InfoTipoSangria {
  tipo: TipoSangria
  /** Nome curto (tela e PDF). */
  rotulo: string
  /** Nome sem acento para a impressora térmica. */
  rotuloRecibo: string
  /** Explicação curta na tela. */
  ajuda: string
  /** Pedaço do rótulo de acessibilidade de cada linha: "Valor da compra 1". */
  nomeLinha: (i: number) => string
  textoAdicionar: string
  placeholderMotivo: string
  /** true = saiu do dinheiro do caixa (entra no total de sangrias). */
  saiDoCaixa: boolean
}

export const TIPOS_SANGRIA: InfoTipoSangria[] = [
  {
    tipo: 'compra',
    rotulo: 'Compras ($)',
    rotuloRecibo: 'Compras ($)',
    ajuda: 'Compras pagas com dinheiro do caixa.',
    nomeLinha: (i) => `da compra ${i + 1}`,
    textoAdicionar: 'Adicionar compra',
    placeholderMotivo: 'O que comprou (obrigatório)',
    saiDoCaixa: true,
  },
  {
    tipo: 'pagamento',
    rotulo: 'Pagamentos',
    rotuloRecibo: 'Pagamentos',
    ajuda: 'Pagamentos feitos com dinheiro do caixa.',
    nomeLinha: (i) => `do pagamento ${i + 1}`,
    textoAdicionar: 'Adicionar pagamento',
    placeholderMotivo: 'O que pagou (obrigatório)',
    saiDoCaixa: true,
  },
  {
    tipo: 'pix',
    rotulo: 'PIX',
    rotuloRecibo: 'PIX',
    ajuda: 'Compras pagas no PIX do patrão. Não saem do caixa: ficam só registradas e não entram no total de sangrias.',
    nomeLinha: (i) => `do PIX ${i + 1}`,
    textoAdicionar: 'Adicionar compra no PIX',
    placeholderMotivo: 'O que comprou no PIX (obrigatório)',
    saiDoCaixa: false,
  },
]

const INFO = Object.fromEntries(TIPOS_SANGRIA.map((t) => [t.tipo, t])) as Record<TipoSangria, InfoTipoSangria>

export function infoTipoSangria(tipo: TipoSangria): InfoTipoSangria {
  return INFO[tipo]
}

/** Tipo da sangria; as antigas (sem tipo) contam como compra com dinheiro do caixa. */
export function tipoDaSangria(s: Pick<Sangria, 'tipo'>): TipoSangria {
  return s.tipo === 'pagamento' || s.tipo === 'pix' ? s.tipo : 'compra'
}

/** true se a sangria saiu do dinheiro do caixa (compra ou pagamento). PIX não sai. */
export function saiDoCaixa(s: Pick<Sangria, 'tipo'>): boolean {
  return tipoDaSangria(s) !== 'pix'
}

function somar(lista: Sangria[]): number {
  return Math.round(lista.reduce((acc, s) => acc + Math.round((Number(s.valor) || 0) * 100), 0)) / 100
}

/**
 * Vale de funcionário dado com dinheiro do caixa. É uma sangria do dia, mas fica
 * guardado na tabela de vales (para o acerto do mês de cada pessoa).
 */
export interface ValeDaSangria {
  funcionario: string
  valor: number
  observacao?: string
}

export interface ResumoSangrias {
  compras: Sangria[]
  pagamentos: Sangria[]
  pix: Sangria[]
  vales: ValeDaSangria[]
  totalCompras: number
  totalPagamentos: number
  totalPix: number
  totalVales: number
  /** Compras + pagamentos + vales: o que saiu do dinheiro do caixa. PIX fica de fora. */
  totalSangrias: number
}

export function resumoSangrias(lista: Sangria[], vales: ValeDaSangria[] = []): ResumoSangrias {
  const compras = lista.filter((s) => tipoDaSangria(s) === 'compra')
  const pagamentos = lista.filter((s) => tipoDaSangria(s) === 'pagamento')
  const pix = lista.filter((s) => tipoDaSangria(s) === 'pix')
  const totalCompras = somar(compras)
  const totalPagamentos = somar(pagamentos)
  const totalVales = somar(vales.map((v) => ({ valor: v.valor, motivo: '' })))
  return {
    compras,
    pagamentos,
    pix,
    vales,
    totalCompras,
    totalPagamentos,
    totalPix: somar(pix),
    totalVales,
    totalSangrias: Math.round((totalCompras + totalPagamentos + totalVales) * 100) / 100,
  }
}

/** Texto de um vale nas listas e PDFs: "Vale — Neto (adiantamento)". */
export function descricaoVale(v: ValeDaSangria): string {
  const obs = (v.observacao ?? '').trim()
  return `Vale — ${v.funcionario}${obs ? ` (${obs})` : ''}`
}

export interface RetiradasPeriodo {
  compras: number
  pagamentos: number
  vales: number
  /** Compras + pagamentos + vales: o que saiu do dinheiro do caixa no período. */
  total: number
  /** Compras no PIX do patrão: só registradas, fora do total. */
  pix: number
}

/**
 * Quanto saiu do caixa num período (semana/mês), por tipo.
 * Cada dia usa as sangrias do relatório; dias antigos, de antes de as sangrias
 * irem para o relatório, usam as do fechamento (sem contar duas vezes).
 */
export function retiradasDoPeriodo(params: {
  relatorios: { data: string; sangrias: Sangria[] }[]
  fechamentos: { data: string; sangrias: Sangria[] }[]
  totalVales: number | null
}): RetiradasPeriodo {
  const doFechamento = new Map<string, Sangria[]>()
  for (const f of params.fechamentos) doFechamento.set(f.data, [...(doFechamento.get(f.data) ?? []), ...f.sangrias])
  const dias = new Set([...params.relatorios.map((r) => r.data), ...doFechamento.keys()])
  const porData = new Map(params.relatorios.map((r) => [r.data, r.sangrias]))

  const todas: Sangria[] = []
  for (const dia of dias) {
    const doRelatorio = porData.get(dia) ?? []
    const caixaRelatorio = doRelatorio.filter(saiDoCaixa)
    todas.push(...(caixaRelatorio.length > 0 ? caixaRelatorio : (doFechamento.get(dia) ?? [])))
    todas.push(...doRelatorio.filter((s) => !saiDoCaixa(s)))
  }
  const r = resumoSangrias(todas)
  const vales = Math.round((params.totalVales ?? 0) * 100) / 100
  return {
    compras: r.totalCompras,
    pagamentos: r.totalPagamentos,
    vales,
    total: Math.round((r.totalCompras + r.totalPagamentos + vales) * 100) / 100,
    pix: r.totalPix,
  }
}

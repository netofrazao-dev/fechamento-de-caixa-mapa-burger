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

export interface ResumoSangrias {
  compras: Sangria[]
  pagamentos: Sangria[]
  pix: Sangria[]
  totalCompras: number
  totalPagamentos: number
  totalPix: number
  /** Compras + pagamentos: o que saiu do dinheiro do caixa. PIX fica de fora. */
  totalSangrias: number
}

export function resumoSangrias(lista: Sangria[]): ResumoSangrias {
  const compras = lista.filter((s) => tipoDaSangria(s) === 'compra')
  const pagamentos = lista.filter((s) => tipoDaSangria(s) === 'pagamento')
  const pix = lista.filter((s) => tipoDaSangria(s) === 'pix')
  const totalCompras = somar(compras)
  const totalPagamentos = somar(pagamentos)
  return {
    compras,
    pagamentos,
    pix,
    totalCompras,
    totalPagamentos,
    totalPix: somar(pix),
    totalSangrias: Math.round((totalCompras + totalPagamentos) * 100) / 100,
  }
}

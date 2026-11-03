/**
 * Textos e contas dos relatórios em linguagem simples (pra quem não usa o
 * sistema no dia a dia entender: patrões, contador).
 */
import type { Fechamento, StatusFechamento } from '../types/fechamento'
import { formatarMoeda } from './calculations'
import { somarValores } from './vales'

export interface ItemPagamento {
  rotulo: string
  valor: number
}

/**
 * De onde veio o total do caixa (LC + Brendi), por forma de pagamento.
 * A soma dos itens é exatamente o Total Caixa. Itens zerados não aparecem.
 */
export function formasDePagamento(fechamentos: Fechamento[]): ItemPagamento[] {
  const soma = (f: (x: Fechamento) => number) => somarValores(fechamentos.map(f))
  const itens: ItemPagamento[] = [
    { rotulo: 'Dinheiro', valor: soma((f) => f.lc.dinheiroFechamento) },
    { rotulo: 'PIX', valor: soma((f) => f.lc.pix + f.brendi.pix) },
    { rotulo: 'Cartão de débito', valor: soma((f) => f.lc.debito + f.brendi.debito) },
    { rotulo: 'Cartão de crédito', valor: soma((f) => f.lc.credito + f.brendi.credito) },
    { rotulo: 'Crédito online (Brendi)', valor: soma((f) => f.brendi.creditoOnline) },
    { rotulo: 'Ticket / vale-refeição', valor: soma((f) => f.lc.ticket) },
    { rotulo: 'Consumo da loja', valor: soma((f) => f.lc.consumoLoja) },
    { rotulo: 'A prazo (fiado)', valor: soma((f) => f.lc.aPrazo) },
  ]
  return itens.filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor)
}

export function statusPorDiferenca(diferenca: number): StatusFechamento {
  if (Math.abs(diferenca) < 0.005) return 'fechou'
  return diferenca > 0 ? 'sobrou' : 'faltou'
}

/** Título e frase explicando o resultado do caixa. */
export function situacaoDoCaixa(diferencaFinal: number, ajusteAplicado = 0): {
  status: StatusFechamento
  titulo: string
  frase: string
} {
  const status = statusPorDiferenca(diferencaFinal)
  const valor = formatarMoeda(Math.abs(diferencaFinal))
  const ajuste =
    Math.abs(ajusteAplicado) >= 0.005
      ? ` (já considerando o ajuste manual de ${ajusteAplicado > 0 ? '+' : '-'}${formatarMoeda(Math.abs(ajusteAplicado))})`
      : ''
  if (status === 'fechou') {
    return {
      status,
      titulo: 'CAIXA FECHOU CERTINHO',
      frase: `O dinheiro contado bate com o que foi registrado no sistema${ajuste}.`,
    }
  }
  if (status === 'sobrou') {
    return {
      status,
      titulo: `SOBROU ${valor}`,
      frase: `O caixa contado ficou ${valor} acima do registrado no sistema${ajuste}.`,
    }
  }
  return {
    status,
    titulo: `FALTOU ${valor}`,
    frase: `O caixa contado ficou ${valor} abaixo do registrado no sistema${ajuste}.`,
  }
}

function diaMes(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Frases do resumo do mês. */
export function resumoDoMes(params: {
  dias: { data: string; totalCaixaDia: number; diferencaFinalDia: number }[]
  diasSemFechamento: number
  totalMarmitas: number
}): string[] {
  const { dias, diasSemFechamento, totalMarmitas } = params
  if (dias.length === 0) return ['Nenhum fechamento de caixa registrado neste mês.']
  const total = somarValores(dias.map((d) => d.totalCaixaDia))
  const media = Math.round((total / dias.length) * 100) / 100
  const fechou = dias.filter((d) => statusPorDiferenca(d.diferencaFinalDia) === 'fechou').length
  const sobrou = dias.filter((d) => statusPorDiferenca(d.diferencaFinalDia) === 'sobrou').length
  const faltou = dias.length - fechou - sobrou
  const diferenca = somarValores(dias.map((d) => d.diferencaFinalDia))
  const maior = [...dias].sort((a, b) => b.totalCaixaDia - a.totalCaixaDia)[0]
  const menor = [...dias].sort((a, b) => a.totalCaixaDia - b.totalCaixaDia)[0]

  const frases = [
    `Vendas no caixa: ${formatarMoeda(total)} em ${dias.length} dia(s) — média de ${formatarMoeda(media)} por dia.`,
    `O caixa fechou certinho em ${fechou} dia(s), sobrou em ${sobrou} e faltou em ${faltou}.`,
    statusPorDiferenca(diferenca) === 'fechou'
      ? 'Somando o mês, as diferenças se compensaram: saldo zero.'
      : `Somando o mês, ${diferenca > 0 ? 'sobraram' : 'faltaram'} ${formatarMoeda(Math.abs(diferenca))} no total.`,
  ]
  if (dias.length > 1) {
    frases.push(
      `Melhor dia: ${diaMes(maior.data)} (${formatarMoeda(maior.totalCaixaDia)}). ` +
        `Dia mais fraco: ${diaMes(menor.data)} (${formatarMoeda(menor.totalCaixaDia)}).`,
    )
  }
  if (totalMarmitas > 0) {
    frases.push(`Marmitas vendidas: ${totalMarmitas} (média de ${Math.round(totalMarmitas / dias.length)} por dia).`)
  }
  if (diasSemFechamento > 0) frases.push(`Atenção: ${diasSemFechamento} dia(s) sem fechamento registrado.`)
  return frases
}

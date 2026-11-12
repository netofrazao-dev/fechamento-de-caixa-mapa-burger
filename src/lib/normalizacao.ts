import type { ConsumoItem, MarmitaItem, NovoFechamentoInput, RelatorioDiarioInput } from '../types/fechamento'
import { arredondarCentavos } from './moeda'
import { tipoDaSangria } from './sangrias'

/**
 * Limpeza do que vai para o banco (relatório e fechamento). Fica num módulo
 * sem acesso ao banco para poder ser usada também na sincronia e nos testes.
 */

/** Pratos com nome e quantidade inteira maior que zero. */
function limparMarmitas(itens: MarmitaItem[]): MarmitaItem[] {
  return itens
    .map((m) => ({ prato: (m.prato ?? '').trim(), quantidade: Math.max(0, Math.floor(Number(m.quantidade) || 0)) }))
    .filter((m) => m.prato && m.quantidade > 0)
}

function dinheiro(v: number): number {
  return Math.max(0, arredondarCentavos(Number(v) || 0))
}
const inteiro = (v: number) => Math.max(0, Math.floor(Number(v) || 0))
const texto = (v: string, max: number) => (v ?? '').trim().slice(0, max)

function limparConsumo(itens: ConsumoItem[]): ConsumoItem[] {
  return itens
    .map((c) => ({
      pessoa: texto(c.pessoa, 80),
      item: texto(c.item, 120),
      valor: dinheiro(c.valor),
      ...(c.funcionarioId ? { funcionarioId: c.funcionarioId } : {}),
    }))
    .filter((c) => c.pessoa || c.item || c.valor > 0)
}

/** Limpa o relatório antes de gravar (sem negativos, sem linhas vazias, textos com limite). */
export function normalizarRelatorio(input: RelatorioDiarioInput): RelatorioDiarioInput {
  return {
    ...input,
    aberturaCaixa: dinheiro(input.aberturaCaixa),
    fechamentoCaixa: dinheiro(input.fechamentoCaixa),
    quantidadeVendida: inteiro(input.quantidadeVendida),
    marmitas: limparMarmitas(input.marmitas ?? []),
    estragou: input.estragou.map((e) => texto(e, 200)).filter(Boolean),
    funcionariosQueComeram: input.funcionariosQueComeram.map((f) => texto(f, 80)).filter(Boolean),
    consumoLojaMensal: limparConsumo(input.consumoLojaMensal),
    consumoLojaMotoboys: limparConsumo(input.consumoLojaMotoboys),
    cortesiaClientes: limparConsumo(input.cortesiaClientes),
    sangrias: input.sangrias
      .map((s) => ({ valor: dinheiro(s.valor), motivo: texto(s.motivo, 200), tipo: tipoDaSangria(s) }))
      .filter((s) => s.valor > 0 || s.motivo),
    estoqueQuente: {
      itens: input.estoqueQuente.itens.map((i) => ({ produto: i.produto, quantidade: inteiro(i.quantidade) })),
    },
  }
}


/**
 * Garante que o que vai pro banco está limpo: nada negativo, só centavos,
 * sangrias com motivo, pratos com quantidade inteira. Os totais são
 * calculados a partir DESTES valores (o banco confere as contas de novo).
 */
export function normalizarFechamento(input: NovoFechamentoInput): NovoFechamentoInput {
  return {
    ...input,
    lc: {
      dinheiroAbertura: dinheiro(input.lc.dinheiroAbertura),
      dinheiroFechamento: dinheiro(input.lc.dinheiroFechamento),
      pix: dinheiro(input.lc.pix),
      debito: dinheiro(input.lc.debito),
      credito: dinheiro(input.lc.credito),
      consumoLoja: dinheiro(input.lc.consumoLoja),
      aPrazo: dinheiro(input.lc.aPrazo),
      ticket: dinheiro(input.lc.ticket),
    },
    brendi: {
      pix: dinheiro(input.brendi.pix),
      debito: dinheiro(input.brendi.debito),
      credito: dinheiro(input.brendi.credito),
      creditoOnline: dinheiro(input.brendi.creditoOnline),
      dinheiro: dinheiro(input.brendi.dinheiro),
    },
    sangrias: input.sangrias
      .map((s) => ({ valor: dinheiro(s.valor), motivo: s.motivo.trim().slice(0, 200) }))
      .filter((s) => s.valor > 0 || s.motivo),
    marmitas: limparMarmitas(input.marmitas),
    totalLCSistema: dinheiro(input.totalLCSistema),
    ajuste: input.ajuste.tipo ? { tipo: input.ajuste.tipo, valor: dinheiro(input.ajuste.valor) } : { tipo: null, valor: 0 },
    observacoes: input.observacoes.trim().slice(0, 2000),
    suprimento: dinheiro(input.suprimento ?? 0),
    suprimentoObs: (input.suprimentoObs ?? '').trim().slice(0, 300),
  }
}


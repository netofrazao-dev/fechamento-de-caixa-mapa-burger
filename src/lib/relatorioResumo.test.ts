import { describe, expect, it } from 'vitest'
import { formasDePagamento, resumoDoMes, situacaoDoCaixa } from './relatorioResumo'
import { calcularResultado } from './calculations'
import type { Fechamento } from '../types/fechamento'

const sem = (s: string) => s.replace(/ /g, ' ')

function fechamento(): Fechamento {
  const lc = { dinheiroAbertura: 150, dinheiroFechamento: 812.5, pix: 1430.9, debito: 655.4, credito: 980, consumoLoja: 42, aPrazo: 0, ticket: 88 }
  const brendi = { pix: 310, debito: 0, credito: 120.5, creditoOnline: 245, dinheiro: 60 }
  const ajuste = { tipo: null, valor: 0 }
  return {
    id: 'f', data: '2026-11-03', turno: 'manha', createdAt: '', lc, brendi, sangrias: [], marmitas: [],
    totalLCSistema: 4020, ajuste, observacoes: '', suprimento: 0, suprimentoObs: '',
    resultado: calcularResultado({ lc, brendi, totalLCSistema: 4020, ajuste }),
  }
}

describe('formasDePagamento', () => {
  it('soma exatamente o Total Caixa, junta LC + Brendi e esconde zerados', () => {
    const f = fechamento()
    const itens = formasDePagamento([f])
    const soma = Math.round(itens.reduce((a, i) => a + i.valor * 100, 0)) / 100
    expect(soma).toBe(f.resultado.totalCaixa)
    expect(itens.find((i) => i.rotulo === 'PIX')?.valor).toBe(1740.9)
    expect(itens.some((i) => i.rotulo.startsWith('A prazo'))).toBe(false)
    expect(itens[0].rotulo).toBe('PIX') // maior primeiro
  })
})

describe('situacaoDoCaixa', () => {
  it('explica em português simples', () => {
    expect(situacaoDoCaixa(0).titulo).toBe('CAIXA FECHOU CERTINHO')
    expect(sem(situacaoDoCaixa(-31.2).titulo)).toBe('FALTOU R$ 31,20')
    expect(sem(situacaoDoCaixa(-31.2, 50).frase)).toContain('abaixo do registrado no sistema (já considerando o ajuste manual de +R$ 50,00)')
    expect(sem(situacaoDoCaixa(12.4).frase)).toContain('R$ 12,40 acima')
  })
})

describe('resumoDoMes', () => {
  it('conta dias, média, saldo e melhor/pior dia', () => {
    const frases = resumoDoMes({
      dias: [
        { data: '2026-11-01', totalCaixaDia: 4210.5, diferencaFinalDia: 0 },
        { data: '2026-11-02', totalCaixaDia: 3890, diferencaFinalDia: 12.4 },
        { data: '2026-11-03', totalCaixaDia: 4674.3, diferencaFinalDia: -31.2 },
      ],
      diasSemFechamento: 0,
      totalMarmitas: 128,
    }).map(sem)
    expect(frases[0]).toBe('Vendas no caixa: R$ 12.774,80 em 3 dia(s) — média de R$ 4.258,27 por dia.')
    expect(frases[1]).toBe('O caixa fechou certinho em 1 dia(s), sobrou em 1 e faltou em 1.')
    expect(frases[2]).toBe('Somando o mês, faltaram R$ 18,80 no total.')
    expect(frases[3]).toContain('Melhor dia: 03/11')
    expect(frases[4]).toBe('Marmitas vendidas: 128 (média de 43 por dia).')
  })
  it('mês vazio', () => {
    expect(resumoDoMes({ dias: [], diasSemFechamento: 3, totalMarmitas: 0 })).toHaveLength(1)
  })
})

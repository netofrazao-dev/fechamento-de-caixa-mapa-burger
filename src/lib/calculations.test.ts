import { describe, expect, it } from 'vitest'
import {
  agregarVendasPorPrato,
  calcularAjusteAplicado,
  calcularResultado,
  calcularStatus,
  calcularTotalBrendi,
  calcularTotalLC,
  totalMarmitas,
} from './calculations'
import type { DadosBrendi, DadosLC } from '../types/fechamento'

// Exemplo completo do documento de regras do fechamento.
const lcExemplo: DadosLC = {
  dinheiroAbertura: 150,
  dinheiroFechamento: 500,
  pix: 800,
  debito: 300,
  credito: 400,
  consumoLoja: 50,
  aPrazo: 100,
  ticket: 50,
}
const brendiExemplo: DadosBrendi = { pix: 200, debito: 100, credito: 150, creditoOnline: 50, dinheiro: 80 }

describe('Total LC', () => {
  it('soma tudo menos dinheiro de abertura (exemplo do documento = 2200)', () => {
    expect(calcularTotalLC(lcExemplo)).toBe(2200)
  })

  it('dinheiro de abertura não altera o total', () => {
    expect(calcularTotalLC({ ...lcExemplo, dinheiroAbertura: 9999 })).toBe(2200)
  })
})

describe('Total Brendi', () => {
  it('não inclui o dinheiro Brendi (exemplo do documento = 500)', () => {
    expect(calcularTotalBrendi(brendiExemplo)).toBe(500)
  })
})

describe('Resultado completo', () => {
  it('exemplo do documento: faltou R$ 60', () => {
    const r = calcularResultado({ lc: lcExemplo, brendi: brendiExemplo, totalLCSistema: 2180, ajuste: { tipo: null, valor: 0 } })
    expect(r.totalLC).toBe(2200)
    expect(r.totalBrendi).toBe(500)
    expect(r.totalCaixa).toBe(2700)
    expect(r.totalSistema).toBe(2760) // 2180 + 500 + 80 (dinheiro Brendi entra aqui)
    expect(r.diferencaOriginal).toBe(-60)
    expect(r.diferencaFinal).toBe(-60)
    expect(r.status).toBe('faltou')
  })

  it('ajuste de +60 faz o caixa fechar', () => {
    const r = calcularResultado({
      lc: lcExemplo,
      brendi: brendiExemplo,
      totalLCSistema: 2180,
      ajuste: { tipo: 'adicionar', valor: 60 },
    })
    expect(r.ajusteAplicado).toBe(60)
    expect(r.diferencaFinal).toBe(0)
    expect(r.status).toBe('fechou')
  })

  it("fecha quando bate exato e sobra quando o caixa é maior que o sistema", () => {
    const r = calcularResultado({ lc: lcExemplo, brendi: brendiExemplo, totalLCSistema: 2120, ajuste: { tipo: null, valor: 0 } })
    expect(r.diferencaOriginal).toBe(0) // 2120 + 500 + 80 = 2700 = total caixa
    expect(r.status).toBe('fechou')
    const sobrou = calcularResultado({ lc: lcExemplo, brendi: brendiExemplo, totalLCSistema: 2100, ajuste: { tipo: null, valor: 0 } })
    expect(sobrou.diferencaFinal).toBe(20)
    expect(sobrou.status).toBe('sobrou')
  })

  it('"remover" subtrai da diferença', () => {
    const r = calcularResultado({
      lc: lcExemplo,
      brendi: brendiExemplo,
      totalLCSistema: 2100,
      ajuste: { tipo: 'remover', valor: 20 },
    })
    expect(r.diferencaOriginal).toBe(20)
    expect(r.ajusteAplicado).toBe(-20)
    expect(r.diferencaFinal).toBe(0)
  })
})

describe('Ajuste', () => {
  it('sem tipo ou sem valor não aplica nada', () => {
    expect(calcularAjusteAplicado({ tipo: null, valor: 50 })).toBe(0)
    expect(calcularAjusteAplicado({ tipo: 'adicionar', valor: 0 })).toBe(0)
  })

  it('usa sempre o valor absoluto (sinal vem do tipo)', () => {
    expect(calcularAjusteAplicado({ tipo: 'adicionar', valor: -15 })).toBe(15)
    expect(calcularAjusteAplicado({ tipo: 'remover', valor: -15 })).toBe(-15)
  })
})

describe('Status e arredondamento', () => {
  it('diferença menor que meio centavo conta como "fechou"', () => {
    expect(calcularStatus(0.004)).toBe('fechou')
    expect(calcularStatus(-0.004)).toBe('fechou')
    expect(calcularStatus(0.01)).toBe('sobrou')
    expect(calcularStatus(-0.01)).toBe('faltou')
  })

  it('não acumula erro de ponto flutuante (0.1 + 0.2)', () => {
    const lc: DadosLC = { ...lcExemplo, dinheiroFechamento: 0.1, pix: 0.2, debito: 0, credito: 0, consumoLoja: 0, aPrazo: 0, ticket: 0 }
    expect(calcularTotalLC(lc)).toBe(0.3)
  })
})

describe('Marmitas', () => {
  it('soma a quantidade de todos os pratos', () => {
    expect(totalMarmitas([{ quantidade: 2 }, { quantidade: 1 }, { quantidade: 6 }])).toBe(9)
    expect(totalMarmitas([])).toBe(0)
  })

  it('agrega vendas por prato entre fechamentos, do mais vendido pro menos', () => {
    const resultado = agregarVendasPorPrato([
      { marmitas: [{ prato: 'Estrogonofe', quantidade: 2 }, { prato: 'Bife Acebolado', quantidade: 6 }] },
      { marmitas: [{ prato: 'Estrogonofe', quantidade: 3 }, { prato: 'Frango Grelhado', quantidade: 1 }] },
    ])
    expect(resultado).toEqual([
      ['Bife Acebolado', 6],
      ['Estrogonofe', 5],
      ['Frango Grelhado', 1],
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { arredondarCentavos, lerMoeda, sanitizarDigitacao, textoFormatado, textoParaEdicao } from './moeda'

describe('lerMoeda', () => {
  it('aceita vírgula e ponto como decimal', () => {
    expect(lerMoeda('12,50')).toBe(12.5)
    expect(lerMoeda('12.50')).toBe(12.5)
    expect(lerMoeda('12,5')).toBe(12.5)
    expect(lerMoeda('0,07')).toBe(0.07)
  })

  it('entende milhar com ponto', () => {
    expect(lerMoeda('1.234,56')).toBe(1234.56)
    expect(lerMoeda('1.234')).toBe(1234)
    expect(lerMoeda('10.000')).toBe(10000)
    expect(lerMoeda('R$ 1.234,56')).toBe(1234.56)
  })

  it('vazio é zero; nunca negativo; no máximo 2 casas', () => {
    expect(lerMoeda('')).toBe(0)
    expect(lerMoeda(',')).toBe(0)
    expect(lerMoeda('-50')).toBe(50)
    expect(lerMoeda('10,555')).toBe(10.55)
  })
})

describe('sanitizarDigitacao', () => {
  it('limita a 2 casas e uma vírgula', () => {
    expect(sanitizarDigitacao('12,345')).toBe('12,34')
    expect(sanitizarDigitacao('1,2,3')).toBe('1,23')
    expect(sanitizarDigitacao('abc12')).toBe('12')
    expect(sanitizarDigitacao('12,')).toBe('12,')
  })
})

describe('textos', () => {
  it('formata pra edição e pra leitura', () => {
    expect(textoParaEdicao(0)).toBe('')
    expect(textoParaEdicao(12.5)).toBe('12,50')
    expect(textoFormatado(1234.5)).toBe('1.234,50')
    expect(textoFormatado(0)).toBe('')
  })

  it('arredonda centavos sem erro de ponto flutuante', () => {
    expect(arredondarCentavos(1.005)).toBe(1.01)
    expect(arredondarCentavos(0.1 + 0.2)).toBe(0.3)
    expect(arredondarCentavos(Number.NaN)).toBe(0)
  })
})

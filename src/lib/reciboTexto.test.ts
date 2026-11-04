import { describe, expect, it } from 'vitest'
import { centralizar, COLUNAS_RECIBO, linhaComValor, quebrarTexto, separadorTexto } from './reciboTexto'

describe('recibo térmico em texto', () => {
  it('nome e valor separados por espaços, valor encostado à direita', () => {
    const [l] = linhaComValor('PIX', 'R$ 392,00')
    expect(l).toHaveLength(COLUNAS_RECIBO)
    expect(l.startsWith('PIX ')).toBe(true)
    expect(l.endsWith(' R$ 392,00')).toBe(true)
  })

  it('prato e quantidade nunca ficam grudados (mesmo com recuo)', () => {
    const [l] = linhaComValor('  iscas de peixe', '8')
    expect(l).toMatch(/^ {2}iscas de peixe +8$/)
    expect(l).toHaveLength(COLUNAS_RECIBO)
  })

  it('nome comprido quebra a linha e o valor fica na última, com espaço', () => {
    const linhas = linhaComValor('Fulano de Tal da Silva (refrigerante lata 350ml gelado)', 'R$ 1.234,56')
    expect(linhas.length).toBeGreaterThan(1)
    linhas.forEach((l) => expect(l.length).toBeLessThanOrEqual(COLUNAS_RECIBO))
    expect(linhas.at(-1)).toMatch(/\S +R\$ 1\.234,56$/)
  })

  it('quebra parágrafos sem cortar palavras e respeita quebras de linha', () => {
    const linhas = quebrarTexto('o vale da valeria de 100 eu acabei lancando 50 por engano ao inves de 100.\nai descontando, fica sobrando 1')
    linhas.forEach((l) => expect(l.length).toBeLessThanOrEqual(COLUNAS_RECIBO))
    expect(linhas.join(' ')).toBe('o vale da valeria de 100 eu acabei lancando 50 por engano ao inves de 100. ai descontando, fica sobrando 1')
    expect(linhas.some((l) => l.startsWith('ai descontando'))).toBe(true)
  })

  it('palavra maior que a linha é dividida', () => {
    expect(quebrarTexto('x'.repeat(45))).toEqual(['x'.repeat(40), 'x'.repeat(5)])
  })

  it('centraliza com espaços e separador de traços', () => {
    expect(centralizar('MAPA BURGER', 21)).toEqual(['     MAPA BURGER'])
    expect(separadorTexto()).toBe('-'.repeat(COLUNAS_RECIBO))
  })
})

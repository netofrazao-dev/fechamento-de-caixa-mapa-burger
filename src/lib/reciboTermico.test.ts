import { describe, expect, it } from 'vitest'
import { montarReciboDiaCompleto, montarReciboFechamento } from './pdf'
import { calcularResultado } from './calculations'
import { COLUNAS_RECIBO } from './reciboTexto'
import type { Ajuste, Fechamento, RelatorioDiario } from '../types/fechamento'

// Mesmos números do recibo impresso de 03/11/2026 (foto enviada).
function fechamentoDaFoto(): Fechamento {
  const lc = { dinheiroAbertura: 522, dinheiroFechamento: 135, pix: 392, debito: 166, credito: 0, consumoLoja: 0, aPrazo: 6, ticket: 56 }
  const brendi = { pix: 348.24, debito: 120, credito: 0, creditoOnline: 32, dinheiro: 104 }
  const ajuste: Ajuste = { tipo: 'adicionar', valor: 50, observacao: 'vale lançado errado' } as Ajuste
  return {
    id: 'f', data: '2026-11-03', turno: 'manha', createdAt: '', lc, brendi, sangrias: [],
    marmitas: [
      { prato: 'iscas de peixe', quantidade: 8 },
      { prato: 'picadinho', quantidade: 6 },
      { prato: 'peixe empanado', quantidade: 11 },
      { prato: 'Frango Grelhado', quantidade: 6 },
      { prato: 'Bife Acebolado', quantidade: 5 },
      { prato: 'carne assada de panela', quantidade: 3 },
      { prato: 'parmegiana de frango', quantidade: 2 },
    ],
    totalLCSistema: 700, ajuste,
    observacoes: 'o vale da valeria de 100 eu acabei lancando 50 por engano ao inves de 100. por isso acabou faltando 50. ai descontando, fica sobrando 1$ no caixa final.',
    resultado: calcularResultado({ lc, brendi, totalLCSistema: 700, ajuste }),
  }
}

/** Texto do PDF na ordem em que está escrito — como os aplicativos de impressora leem. */
function textoDoPdf(pdf: string): string[] {
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\(.)/g, '$1'))
}

describe('recibo térmico', () => {
  it('fechamento: uma página só, da altura do conteúdo, e cada valor separado do nome', () => {
    const doc = montarReciboFechamento(fechamentoDaFoto())
    expect(doc.getNumberOfPages()).toBe(1)
    const altura = doc.internal.pageSize.getHeight()
    expect(altura).toBeLessThan(260) // antes: 297 mm fixos (A4) => papel em branco sobrando
    const linhas = textoDoPdf(doc.output())
    linhas.forEach((l) => expect(l.length).toBeLessThanOrEqual(COLUNAS_RECIBO))
    expect(linhas).toContain('PIX' + ' '.repeat(COLUNAS_RECIBO - 3 - 'R$ 392,00'.length) + 'R$ 392,00')
    expect(linhas.find((l) => l.includes('iscas de peixe'))).toMatch(/^ {2}iscas de peixe +8$/)
    expect(linhas.find((l) => l.startsWith('Marmitas vendidas'))).toMatch(/^Marmitas vendidas +41$/)
    expect(linhas.find((l) => l.startsWith('DIFERENCA FINAL'))).toMatch(/^DIFERENCA FINAL +R\$ 1,00$/)
    expect(linhas.find((l) => l.trim() === 'MAPA BURGER')?.startsWith(' ')).toBe(true) // centralizado com espaços
    expect(linhas).toContain('-'.repeat(COLUNAS_RECIBO)) // separador aparece como texto
    expect(linhas.join(' ')).toContain('fica sobrando 1$ no caixa final.')
  })

  it('dia completo: uma página só, mesmo com fechamento + relatório', () => {
    const rel = {
      id: 'r', data: '2026-11-03', createdAt: '', updatedAt: '', aberturaCaixa: 522, fechamentoCaixa: 135, quantidadeVendida: 41,
      estragou: ['2 pães'], funcionariosQueComeram: ['Pâmela', 'Neto'],
      consumoLojaMensal: [{ pessoa: 'Pâmela', item: 'Coca lata', valor: 6 }], consumoLojaMotoboys: [], cortesiaClientes: [],
      sangrias: [
        { valor: 12.5, motivo: 'pão', tipo: 'compra' },
        { valor: 30, motivo: 'pagamento do gás', tipo: 'pagamento' },
        { valor: 80, motivo: 'carne no açougue', tipo: 'pix' },
      ], estoqueQuente: { itens: [{ produto: 'Coca 2L', quantidade: 4 }] },
      imagem1: null, imagem2: null,
    } as unknown as RelatorioDiario
    const doc = montarReciboDiaCompleto({ relatorio: rel, fechamentos: [fechamentoDaFoto()] })
    expect(doc.getNumberOfPages()).toBe(1)
    const linhas = textoDoPdf(doc.output())
    expect(linhas.find((l) => l.includes('pagamento do gas'))).toMatch(/^ {2}pagamento do gas +R\$ 30,00$/)
    // Compras e pagamentos somam no total; o PIX fica separado, fora do total.
    const i = linhas.indexOf('SANGRIAS (saem do caixa)')
    const j = linhas.indexOf('PIX (nao sai do caixa)')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
    expect(linhas.slice(i, j).find((l) => l.startsWith('Total de sangrias'))).toMatch(/R\$ 42,50$/)
    expect(linhas.slice(i, j).some((l) => l.includes('carne'))).toBe(false)
    expect(linhas.slice(j).find((l) => l.includes('carne no acougue'))).toMatch(/R\$ 80,00$/)
    expect(linhas.slice(j).find((l) => l.startsWith('Total no PIX'))).toMatch(/R\$ 80,00$/)
    expect(linhas.find((l) => l.startsWith('Pamela (Coca lata)'))).toMatch(/ +R\$ 6,00$/)
    expect(linhas.find((l) => l.startsWith('Coca 2L'))).toMatch(/^Coca 2L +4$/)
  })
})

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
    // Impressão enxuta: só o total de marmitas, sem a lista de pratos.
    expect(linhas.find((l) => l.startsWith('Marmitas vendidas'))).toMatch(/^Marmitas vendidas +41$/)
    expect(linhas.some((l) => l.includes('iscas de peixe') || l.includes('parmegiana'))).toBe(false)
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
    const doc = montarReciboDiaCompleto({ relatorio: rel, fechamentos: [fechamentoDaFoto()], vales: [{ funcionario: 'Neto', valor: 100, observacao: '' }] })
    expect(doc.getNumberOfPages()).toBe(1)
    const linhas = textoDoPdf(doc.output())
    const tudo = linhas.join('\n')
    // Sangrias: só o total que saiu do caixa (compras 12,50 + pagamentos 30 + vale 100), sem o detalhe.
    expect(linhas.find((l) => l.startsWith('SANGRIAS (total)'))).toMatch(/^SANGRIAS \(total\) +R\$ 142,50$/)
    expect(tudo).not.toMatch(/pagamento do gas|Neto +R\$ 100,00/)
    // Não imprime: o que estragou, o estoque, as compras no PIX do patrão nem a lista de pratos.
    expect(tudo).not.toMatch(/ESTRAGOU|2 paes|ESTOQUE|Coca 2L|PIX \(nao sai|carne no acougue|VENDAS POR PRATO|iscas de peixe/)
    // Continua: quem comeu e o consumo.
    expect(tudo).toContain('FUNCIONARIOS QUE COMERAM')
    expect(linhas.find((l) => l.startsWith('Pamela (Coca lata)'))).toMatch(/ +R\$ 6,00$/)
    // Abertura e fechamento do dinheiro saem uma vez só (no bloco do fechamento), sem repetir no relatório.
    expect(linhas.filter((l) => l.startsWith('Dinheiro abertura'))).toHaveLength(1)
    expect(linhas.some((l) => l.startsWith('Abertura do caixa') || l.startsWith('Fechamento do caixa') || l.startsWith('Vendidas'))).toBe(false)
    expect(linhas.filter((l) => l.startsWith('Marmitas vendidas'))).toHaveLength(1)

    // Dia sem fechamento salvo (relatório antigo): mostra o que foi anotado no relatório.
    const semFechamento = textoDoPdf(montarReciboDiaCompleto({ relatorio: rel, fechamentos: [] }).output())
    expect(semFechamento.find((l) => l.startsWith('Abertura do caixa'))).toMatch(/R\$ 522,00$/)
    expect(semFechamento.find((l) => l.startsWith('Vendidas'))).toMatch(/ 41$/)
  })

  it('dia completo fica curto: menos da metade da altura de antes com os mesmos dados', () => {
    const rel = {
      id: 'r', data: '2026-11-03', createdAt: '', updatedAt: '', aberturaCaixa: 0, fechamentoCaixa: 0, quantidadeVendida: 0,
      estragou: ['2 pães', '400g de arroz', '1 alface'], funcionariosQueComeram: [],
      consumoLojaMensal: [], consumoLojaMotoboys: [], cortesiaClientes: [],
      sangrias: Array.from({ length: 6 }, (_, i) => ({ valor: 10 + i, motivo: `compra ${i}`, tipo: i % 3 === 2 ? 'pix' : 'compra' })),
      estoqueQuente: { itens: Array.from({ length: 12 }, (_, i) => ({ produto: `Bebida ${i}`, quantidade: i + 1 })) },
      imagem1: null, imagem2: null,
    } as unknown as RelatorioDiario
    const doc = montarReciboDiaCompleto({ relatorio: rel, fechamentos: [fechamentoDaFoto()] })
    // fechamento (com observação) + total de sangrias; antes passava de 300 mm com pratos, sangrias, estoque...
    expect(doc.internal.pageSize.getHeight()).toBeLessThan(220)
    const linhas = textoDoPdf(doc.output())
    expect(linhas.find((l) => l.startsWith('SANGRIAS (total)'))).toMatch(/R\$ 48,00$/) // 10+11+13+14 (sem os PIX: 12 e 15)
  })

  it('relatório sem nada fora do normal avisa em vez de sair vazio', () => {
    const rel = {
      id: 'r', data: '2026-11-03', createdAt: '', updatedAt: '', aberturaCaixa: 0, fechamentoCaixa: 0, quantidadeVendida: 0,
      estragou: [], funcionariosQueComeram: [], consumoLojaMensal: [], consumoLojaMotoboys: [], cortesiaClientes: [],
      sangrias: [], estoqueQuente: { itens: [] }, imagem1: null, imagem2: null,
    } as unknown as RelatorioDiario
    const linhas = textoDoPdf(montarReciboDiaCompleto({ relatorio: rel, fechamentos: [fechamentoDaFoto()] }).output())
    expect(linhas).toContain('(nada fora do normal)')
  })
})

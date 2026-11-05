import { describe, expect, it } from 'vitest'
import { buscarItens, itensDoDia, resultadosDaBusca } from './buscaHistorico'
import type { Fechamento, RelatorioDiario, Vale } from '../types/fechamento'

const fechamento = {
  observacoes: 'Troco convertido em PIX',
  sangrias: [],
  marmitas: [{ prato: 'Parmegiana de frango', quantidade: 3 }],
} as unknown as Fechamento
const relatorio = {
  sangrias: [
    { valor: 30, motivo: 'pagamento do gás', tipo: 'pagamento' },
    { valor: 80, motivo: 'carne no açougue', tipo: 'pix' },
  ],
  consumoLojaMensal: [{ pessoa: 'Pâmela', item: 'Coca lata', valor: 6 }],
  consumoLojaMotoboys: [],
  cortesiaClientes: [],
  estragou: ['400g de arroz'],
  funcionariosQueComeram: ['Neto'],
} as unknown as RelatorioDiario
const vales = [
  { funcionario: 'Neto', valor: 100, observacao: 'adiantamento', excluidoEm: null },
  { funcionario: 'Diogo', valor: 50, observacao: '', excluidoEm: '2026-11-03T10:00:00Z' },
] as unknown as Vale[]
const itens = itensDoDia({ fechamentos: [fechamento], relatorio, vales })

describe('busca do Histórico', () => {
  it('acha sem acento e sem diferenciar maiúscula', () => {
    expect(buscarItens(itens, 'GAS')).toEqual([{ rotulo: 'Sangria — Pagamentos', texto: 'pagamento do gás', valor: 30 }])
    expect(buscarItens(itens, 'acougue')[0].rotulo).toBe('Sangria — PIX')
  })

  it('todas as palavras precisam aparecer; o "onde" também conta', () => {
    expect(buscarItens(itens, 'vale neto')).toEqual([{ rotulo: 'Vale', texto: 'Neto — adiantamento', valor: 100 }])
    expect(buscarItens(itens, 'neto').map((i) => i.rotulo).sort()).toEqual(['Comeu na loja', 'Vale'])
  })

  it('acha consumo, estragos, observação e prato vendido; ignora vale excluído', () => {
    expect(buscarItens(itens, 'coca')[0].rotulo).toBe('Consumo de funcionário')
    expect(buscarItens(itens, 'arroz')[0].rotulo).toBe('Estragou')
    expect(buscarItens(itens, 'troco')[0].rotulo).toBe('Observação do caixa')
    expect(buscarItens(itens, 'parmegiana')[0].texto).toBe('Parmegiana de frango (3)')
    expect(buscarItens(itens, 'diogo')).toEqual([])
  })

  it('busca vazia não acha nada', () => {
    expect(buscarItens(itens, '   ')).toEqual([])
  })

  it('resultado por dia, com vales de dias sem fechamento e mais recentes primeiro', () => {
    const r = resultadosDaBusca(
      {
        fechamentos: [{ ...fechamento, data: '2026-11-01', id: 'f1' } as Fechamento],
        relatorios: [{ ...relatorio, data: '2026-11-01', id: 'r1' } as RelatorioDiario],
        vales: [{ ...vales[0], data: '2026-11-03' } as Vale, { ...vales[0], data: '2026-11-01' } as Vale],
      },
      'neto',
    )
    expect(r.map((x) => x.data)).toEqual(['2026-11-03', '2026-11-01'])
    expect(r[0].fechamento).toBeUndefined()
    expect(r[1].achados.map((a) => a.rotulo).sort()).toEqual(['Comeu na loja', 'Vale'])
  })
})

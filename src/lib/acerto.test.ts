import { describe, expect, it } from 'vitest'
import { calcularAcerto, consumosDoMes, divergenciasAcerto, gerarCsvAcerto, resolverFuncionario } from './acerto'
import type { Funcionario, Vale } from '../types/fechamento'

const funcs: Funcionario[] = [
  { id: 'n', nome: 'Neto', ativo: true },
  { id: 'p', nome: 'Pâmela', ativo: true },
  { id: 'd', nome: 'Diogo', ativo: false },
]
let k = 0
const vale = (p: Partial<Vale>): Vale => ({
  id: `v${++k}`, funcionarioId: null, funcionario: 'Neto', data: '2026-10-05', valor: 10, observacao: '',
  createdAt: `2026-10-05T10:00:${String(k).padStart(2, '0')}Z`, updatedAt: null, excluidoEm: null, motivoExclusao: null, ...p,
})
const relatorios = [
  { id: 'r1', data: '2026-10-03', consumoLojaMensal: [
    { pessoa: 'Pâmela', item: 'Coca', valor: 6 }, { pessoa: 'Diogo', item: 'X-Burger', valor: 22 }, { pessoa: 'Neto', item: 'vazio', valor: 0 },
  ] },
  { id: 'r2', data: '2026-10-04', consumoLojaMensal: [
    { pessoa: 'PAMELA ', item: 'Suco', valor: 7.5 }, { pessoa: 'Pamelinha', item: 'Água', valor: 3 },
    { pessoa: 'qualquer coisa', item: 'Bolo', valor: 4.1, funcionarioId: 'n' },
  ] },
]

describe('resolverFuncionario', () => {
  it('usa o id escolhido; senão o nome normalizado', () => {
    expect(resolverFuncionario(funcs, 'qualquer', 'n')).toBe('n')
    expect(resolverFuncionario(funcs, '  pamela ')).toBe('p')
    expect(resolverFuncionario(funcs, 'Pamelinha')).toBeNull()
    expect(resolverFuncionario(funcs, 'x', 'id-que-nao-existe')).toBeNull()
  })
})

describe('consumosDoMes', () => {
  it('ignora valor zero e guarda a posição no relatório', () => {
    const c = consumosDoMes(relatorios, funcs)
    expect(c).toHaveLength(5)
    expect(c.find((x) => x.item === 'Água')).toMatchObject({ relatorioId: 'r2', indice: 1, funcionarioId: null })
  })
})

describe('calcularAcerto', () => {
  const r = calcularAcerto({
    vales: [
      vale({ funcionarioId: 'n', valor: 100 }),
      vale({ funcionarioId: 'p', funcionario: 'Pâmela', valor: 50 }),
      vale({ funcionarioId: 'p', funcionario: 'Pâmela', valor: 25.5 }),
      vale({ funcionarioId: 'n', valor: 999, excluidoEm: 'x', motivoExclusao: 'dobro' }),
    ],
    relatorios,
    funcionarios: funcs,
  })

  it('soma vales + consumo por pessoa (igual ao banco)', () => {
    expect(r.linhas.map((l) => [l.funcionario, l.totalVales, l.totalConsumo, l.total])).toEqual([
      ['Diogo', 0, 22, 22],
      ['Neto', 100, 4.1, 104.1],
      ['Pâmela', 75.5, 13.5, 89],
    ])
    expect(r.total).toBe(215.1)
    expect(r.totalVales + r.totalConsumo).toBe(r.total)
  })

  it('separa consumo sem funcionário identificado', () => {
    expect(r.semFuncionario.map((c) => c.pessoa)).toEqual(['Pamelinha'])
  })

  it('mostra funcionário desativado que tem valores', () => {
    expect(r.linhas.find((l) => l.funcionario === 'Diogo')?.ativo).toBe(false)
  })

  it('soma em centavos', () => {
    const x = calcularAcerto({ vales: [vale({ funcionarioId: 'n', valor: 0.1 }), vale({ funcionarioId: 'n', valor: 0.2 })], relatorios: [], funcionarios: funcs })
    expect(x.total).toBe(0.3)
  })

  it('aponta divergência entre o acerto fechado e os dados de hoje', () => {
    expect(divergenciasAcerto([{ funcionarioId: 'p', funcionario: 'Pâmela', total: 89 }, { funcionarioId: 'n', funcionario: 'Neto', total: 104.1 }, { funcionarioId: 'd', funcionario: 'Diogo', total: 22 }], r.linhas)).toEqual([])
    expect(divergenciasAcerto([{ funcionarioId: 'p', funcionario: 'Pâmela', total: 80 }], r.linhas)).toHaveLength(3)
  })

  it('gera planilha', () => {
    const csv = gerarCsvAcerto('10/2026', r)
    expect(csv).toContain('Pâmela;75,50;13,50;89,00')
    expect(csv).toContain('TOTAL;175,50;39,60;215,10')
    expect(csv).toContain('Neto;Consumo;04/10/2026;Bolo;4,10')
  })
})

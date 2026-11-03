import { describe, expect, it } from 'vitest'
import type { HistoricoVale, Vale, ValeInput } from '../types/fechamento'
import {
  agruparPorFuncionario,
  avisosVale,
  dataValida,
  descreverHistorico,
  gerarCsvVales,
  mesValido,
  nomeMes,
  normalizarNome,
  rotuloMes,
  somarMeses,
  somarValores,
  totalDosGrupos,
  validarVale,
  VALOR_ALTO_VALE,
} from './vales'

let seq = 0
function vale(p: Partial<Vale>): Vale {
  seq += 1
  return {
    id: `v${seq}`,
    funcionarioId: null,
    funcionario: 'Neto',
    data: '2026-10-10',
    valor: 10,
    observacao: '',
    createdAt: `2026-10-10T12:00:${String(seq).padStart(2, '0')}Z`,
    updatedAt: null,
    excluidoEm: null,
    motivoExclusao: null,
    ...p,
  }
}

const inputOk: ValeInput = { funcionario: 'Neto', data: '2026-10-10', valor: 50, observacao: '' }

describe('somas em centavos', () => {
  it('não acumula erro de ponto flutuante', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(somarValores([0.1, 0.2])).toBe(0.3)
    expect(somarValores(Array(100).fill(0.1))).toBe(10)
    expect(somarValores([19.9, 30.1, 0.01])).toBe(50.01)
  })

  it('ignora valores inválidos', () => {
    expect(somarValores([10, Number.NaN, Infinity, 5])).toBe(15)
  })
})

describe('nomes', () => {
  it('normaliza acento, maiúscula e espaços', () => {
    expect(normalizarNome('  Pâmela   Silva ')).toBe('pamela silva')
    expect(normalizarNome('JOÃOZINHO')).toBe('joaozinho')
    expect(normalizarNome('Conceição')).toBe('conceicao')
  })
})

describe('agruparPorFuncionario', () => {
  it('agrupa pelo cadastro (id), não pelo texto digitado', () => {
    const grupos = agruparPorFuncionario([
      vale({ funcionarioId: 'p', funcionario: 'Pâmela', valor: 50 }),
      vale({ funcionarioId: 'p', funcionario: 'Pâmela', valor: 30.5 }),
      vale({ funcionarioId: 'n', funcionario: 'Neto', valor: 100 }),
    ])
    expect(grupos.map((g) => [g.funcionario, g.total, g.quantidade])).toEqual([
      ['Neto', 100, 1],
      ['Pâmela', 80.5, 2],
    ])
  })

  it('sem id (dado antigo), agrupa pelo nome normalizado', () => {
    const grupos = agruparPorFuncionario([
      vale({ funcionario: 'Pâmela', valor: 1 }),
      vale({ funcionario: 'pamela ', valor: 2 }),
      vale({ funcionario: 'PAMELA', valor: 3 }),
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].total).toBe(6)
  })

  it('não conta vales excluídos', () => {
    const grupos = agruparPorFuncionario([
      vale({ funcionarioId: 'n', valor: 10 }),
      vale({ funcionarioId: 'n', valor: 999, excluidoEm: '2026-10-11T00:00:00Z', motivoExclusao: 'dobro' }),
    ])
    expect(grupos[0].total).toBe(10)
    expect(grupos[0].quantidade).toBe(1)
  })

  it('funcionário que só tem vale excluído some da lista', () => {
    const grupos = agruparPorFuncionario([vale({ excluidoEm: '2026-10-11T00:00:00Z', motivoExclusao: 'x' })])
    expect(grupos).toEqual([])
  })

  it('ordena pessoas por nome (com acento) e vales por data e hora', () => {
    const grupos = agruparPorFuncionario([
      vale({ funcionarioId: 'o', funcionario: 'Oneide', data: '2026-10-20' }),
      vale({ funcionarioId: 'a', funcionario: 'Ágata', data: '2026-10-15' }),
      vale({ funcionarioId: 'o', funcionario: 'Oneide', data: '2026-10-02' }),
      vale({ funcionarioId: 'b', funcionario: 'Bruno' }),
    ])
    expect(grupos.map((g) => g.funcionario)).toEqual(['Ágata', 'Bruno', 'Oneide'])
    expect(grupos[2].vales.map((v) => v.data)).toEqual(['2026-10-02', '2026-10-20'])
  })

  it('total geral bate com a soma dos grupos', () => {
    const grupos = agruparPorFuncionario([
      vale({ funcionarioId: 'a', valor: 0.1 }),
      vale({ funcionarioId: 'b', valor: 0.2 }),
    ])
    expect(totalDosGrupos(grupos)).toBe(0.3)
  })
})

describe('datas e meses', () => {
  it('aceita só datas reais', () => {
    expect(dataValida('2026-10-10')).toBe(true)
    expect(dataValida('2028-02-29')).toBe(true)
    expect(dataValida('2026-02-29')).toBe(false)
    expect(dataValida('2026-02-31')).toBe(false)
    expect(dataValida('')).toBe(false)
    expect(dataValida('10/10/2026')).toBe(false)
    expect(dataValida('0026-10-10')).toBe(false)
  })

  it('valida mês YYYY-MM', () => {
    expect(mesValido('2026-10')).toBe(true)
    expect(mesValido('2026-13')).toBe(false)
    expect(mesValido('')).toBe(false)
    expect(mesValido('2026-1')).toBe(false)
  })

  it('navega entre meses virando o ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(rotuloMes('2026-03')).toBe('03/2026')
    expect(nomeMes('2026-03')).toBe('março de 2026')
  })
})

describe('validarVale', () => {
  it('aceita um vale normal', () => {
    expect(validarVale(inputOk)).toEqual([])
  })

  it('exige funcionário, data, valor positivo', () => {
    expect(validarVale({ ...inputOk, funcionario: '   ' })).toContain('Selecione o funcionário.')
    expect(validarVale({ ...inputOk, data: '' })).toContain('Informe uma data válida.')
    expect(validarVale({ ...inputOk, valor: 0 }).length).toBe(1)
    expect(validarVale({ ...inputOk, valor: -5 }).length).toBe(1)
    expect(validarVale({ ...inputOk, valor: Number.NaN }).length).toBe(1)
  })

  it('recusa mais de 2 casas decimais e valores absurdos', () => {
    expect(validarVale({ ...inputOk, valor: 10.555 }).length).toBe(1)
    expect(validarVale({ ...inputOk, valor: 10.55 })).toEqual([])
    expect(validarVale({ ...inputOk, valor: 0.07 })).toEqual([])
    expect(validarVale({ ...inputOk, valor: 1_000_000 }).length).toBe(1)
  })

  it('limita o tamanho da observação', () => {
    expect(validarVale({ ...inputOk, observacao: 'x'.repeat(301) }).length).toBe(1)
  })
})

describe('avisosVale', () => {
  const hoje = '2026-10-15'

  it('sem nada estranho, sem avisos', () => {
    expect(avisosVale({ ...inputOk, data: '2026-10-15' }, { hoje, existentes: [] })).toEqual([])
  })

  it('avisa lançamento repetido (mesmo funcionário, dia e valor)', () => {
    const existentes = [vale({ funcionario: 'Neto', data: '2026-10-15', valor: 50 })]
    const avisos = avisosVale({ ...inputOk, funcionario: 'neto', data: '2026-10-15' }, { hoje, existentes })
    expect(avisos.some((a) => a.includes('repetido'))).toBe(true)
  })

  it('não se compara consigo mesmo ao editar, nem com vale excluído', () => {
    const v = vale({ funcionario: 'Neto', data: '2026-10-15', valor: 50 })
    const excluido = vale({ funcionario: 'Neto', data: '2026-10-15', valor: 50, excluidoEm: 'x', motivoExclusao: 'x' })
    expect(
      avisosVale({ ...inputOk, data: '2026-10-15' }, { hoje, existentes: [v, excluido], idEditando: v.id }),
    ).toEqual([])
  })

  it('avisa valor alto', () => {
    const avisos = avisosVale({ ...inputOk, data: hoje, valor: VALOR_ALTO_VALE }, { hoje, existentes: [] })
    expect(avisos.some((a) => a.includes('Valor alto'))).toBe(true)
  })

  it('avisa data no futuro e data em outro mês', () => {
    expect(avisosVale({ ...inputOk, data: '2026-10-16' }, { hoje, existentes: [] })[0]).toContain('futuro')
    expect(avisosVale({ ...inputOk, data: '2026-09-30' }, { hoje, existentes: [] })[0]).toContain('09/2026')
  })

  it('não dá aviso se o vale nem é válido (o erro já aparece)', () => {
    expect(avisosVale({ ...inputOk, valor: 0 }, { hoje, existentes: [] })).toEqual([])
  })
})

describe('gerarCsvVales', () => {
  it('gera planilha com resumo, detalhe, vírgula decimal e sem excluídos', () => {
    const csv = gerarCsvVales('2026-10', [
      vale({ funcionarioId: 'p', funcionario: 'Pâmela', data: '2026-10-02', valor: 50, observacao: 'remédio; farmácia' }),
      vale({ funcionarioId: 'p', funcionario: 'Pâmela', data: '2026-10-05', valor: 30.5 }),
      vale({ funcionarioId: 'n', funcionario: 'Neto', valor: 999, excluidoEm: 'x', motivoExclusao: 'x' }),
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Pâmela;2;80,50')
    expect(csv).toContain('TOTAL;2;80,50')
    expect(csv).toContain('02/10/2026;Pâmela;50,00;"remédio; farmácia"')
    expect(csv).not.toContain('999')
  })

  it('neutraliza texto que o Excel leria como fórmula', () => {
    const csv = gerarCsvVales('2026-10', [vale({ funcionarioId: 'n', observacao: '=HYPERLINK("x")' })])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
})

describe('descreverHistorico', () => {
  // toLocaleString usa espaço não separável depois do "R$"
  const descrever = (h: HistoricoVale) => {
    const d = descreverHistorico(h)
    return { titulo: d.titulo, descricao: d.descricao.replace(/\u00a0/g, ' ') }
  }
  const base: HistoricoVale = {
    id: 1,
    registradoEm: '2026-10-10T12:00:00Z',
    operacao: 'criado',
    valeId: 'v',
    antes: null,
    depois: { funcionario: 'Neto', valor: '20.00', data: '2026-10-10', observacao: null },
    detalhe: null,
  }

  it('descreve criação', () => {
    expect(descrever(base)).toEqual({ titulo: 'Vale lançado', descricao: 'Neto — R$ 20,00 em 10/10/2026' })
  })

  it('descreve o que mudou numa alteração', () => {
    const d = descrever({
      ...base,
      operacao: 'alterado',
      antes: { funcionario: 'Neto', valor: '20.00', data: '2026-10-10', observacao: null },
      depois: { funcionario: 'Neto', valor: '25.00', data: '2026-10-11', observacao: null },
    })
    expect(d.descricao).toContain('valor R$ 20,00 → R$ 25,00')
    expect(d.descricao).toContain('data 10/10/2026 → 11/10/2026')
  })

  it('descreve exclusão com motivo e fechamento de mês', () => {
    expect(descrever({ ...base, operacao: 'excluido', detalhe: 'dobro' }).descricao).toContain('Motivo: dobro')
    expect(
      descrever({
        ...base,
        operacao: 'mes_fechado',
        depois: { total: '235.00', quantidade: 6 },
        detalhe: 'folha 05/11',
      }).descricao,
    ).toBe('Total R$ 235,00 em 6 vale(s) — folha 05/11')
  })
})

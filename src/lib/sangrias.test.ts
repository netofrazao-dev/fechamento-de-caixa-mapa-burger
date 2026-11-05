import { describe, expect, it } from 'vitest'
import { descricaoVale, resumoSangrias, retiradasDoPeriodo, saiDoCaixa, tipoDaSangria } from './sangrias'

describe('sangrias do relatório', () => {
  const lista = [
    { valor: 30, motivo: 'gás', tipo: 'pagamento' as const },
    { valor: 12.5, motivo: 'pão', tipo: 'compra' as const },
    { valor: 80.1, motivo: 'carne', tipo: 'pix' as const },
    { valor: 0.2, motivo: 'troco antigo' }, // antiga, sem tipo
  ]

  it('PIX não entra no total de sangrias; compras e pagamentos entram', () => {
    const r = resumoSangrias(lista)
    expect(r.totalCompras).toBe(12.7)
    expect(r.totalPagamentos).toBe(30)
    expect(r.totalPix).toBe(80.1)
    expect(r.totalSangrias).toBe(42.7)
    expect(r.pix.map((s) => s.motivo)).toEqual(['carne'])
  })

  it('sangria antiga (sem tipo) conta como compra com dinheiro do caixa', () => {
    expect(tipoDaSangria({})).toBe('compra')
    expect(saiDoCaixa({})).toBe(true)
    expect(saiDoCaixa({ tipo: 'pix' })).toBe(false)
  })

  it('soma em centavos, sem erro de arredondamento', () => {
    expect(resumoSangrias([{ valor: 0.1, motivo: 'a' }, { valor: 0.2, motivo: 'b' }]).totalSangrias).toBe(0.3)
  })

  it('vales do dia entram no total de sangrias (saíram do caixa); PIX continua fora', () => {
    const vales = [
      { funcionario: 'Neto', valor: 100 },
      { funcionario: 'Pâmela', valor: 50.5, observacao: 'adiantamento' },
    ]
    const r = resumoSangrias(lista, vales)
    expect(r.totalVales).toBe(150.5)
    expect(r.totalSangrias).toBe(193.2) // 12,70 + 30 + 150,50
    expect(r.totalPix).toBe(80.1)
    expect(descricaoVale(vales[1])).toBe('Vale — Pâmela (adiantamento)')
  })

  it('retiradas do período: soma por tipo, vales entram no total, PIX fica de fora', () => {
    const r = retiradasDoPeriodo({
      relatorios: [
        { data: '2026-11-02', sangrias: [{ valor: 30, motivo: 'gás', tipo: 'pagamento' }, { valor: 80, motivo: 'carne', tipo: 'pix' }] },
        { data: '2026-11-03', sangrias: [{ valor: 12.5, motivo: 'pão', tipo: 'compra' }] },
      ],
      fechamentos: [],
      totalVales: 150,
    })
    expect(r).toEqual({ compras: 12.5, pagamentos: 30, vales: 150, total: 192.5, pix: 80 })
  })

  it('dia antigo usa as sangrias do fechamento; dia com sangrias no relatório não conta as do fechamento de novo', () => {
    const r = retiradasDoPeriodo({
      relatorios: [{ data: '2026-11-02', sangrias: [{ valor: 20, motivo: 'gelo', tipo: 'compra' }] }],
      fechamentos: [
        { data: '2026-11-01', sangrias: [{ valor: 15, motivo: 'troco' }] }, // antigo: só no fechamento
        { data: '2026-11-02', sangrias: [{ valor: 20, motivo: 'gelo' }] }, // repetido no relatório
      ],
      totalVales: null,
    })
    expect(r.compras).toBe(35)
    expect(r.total).toBe(35)
  })
})

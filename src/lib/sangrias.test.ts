import { describe, expect, it } from 'vitest'
import { resumoSangrias, saiDoCaixa, tipoDaSangria } from './sangrias'

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
})

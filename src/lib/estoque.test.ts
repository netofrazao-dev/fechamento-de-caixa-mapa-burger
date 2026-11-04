import { describe, expect, it } from 'vitest'
import { montarLinhasEstoque } from './estoque'

describe('estoque quente', () => {
  it('relatório novo: todos os ativos, zerados, na ordem do cadastro', () => {
    expect(montarLinhasEstoque([], ['Coca KS', 'Pepsi Lata'])).toEqual([
      { produto: 'Coca KS', quantidade: 0, desativado: false },
      { produto: 'Pepsi Lata', quantidade: 0, desativado: false },
    ])
  })

  it('relatório antigo: mantém a contagem salva e mostra o produto que foi desativado depois', () => {
    const salvos = [
      { produto: 'Monster Azul', quantidade: 3 },
      { produto: 'coca ks', quantidade: 12 },
      { produto: 'Fanta Uva 350ml', quantidade: 0 },
    ]
    expect(montarLinhasEstoque(salvos, ['Coca KS', 'Pepsi Lata'])).toEqual([
      { produto: 'Coca KS', quantidade: 12, desativado: false },
      { produto: 'Pepsi Lata', quantidade: 0, desativado: false },
      { produto: 'Monster Azul', quantidade: 3, desativado: true },
    ])
  })
})

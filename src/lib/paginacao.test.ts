import { describe, expect, it } from 'vitest'
import { buscarTodasAsPaginas, TAMANHO_PAGINA } from './paginacao'

function fonte(total: number) {
  const linhas = Array.from({ length: total }, (_, i) => i)
  const pedidos: [number, number][] = []
  const pagina = (de: number, ate: number) => {
    pedidos.push([de, ate])
    return Promise.resolve({ data: linhas.slice(de, ate + 1), error: null })
  }
  return { pagina, pedidos }
}

describe('buscarTodasAsPaginas', () => {
  it('junta todas as páginas, sem perder nem repetir linha', async () => {
    const { pagina, pedidos } = fonte(TAMANHO_PAGINA * 2 + 37)
    const todas = await buscarTodasAsPaginas(pagina)
    expect(todas).toHaveLength(TAMANHO_PAGINA * 2 + 37)
    expect(new Set(todas).size).toBe(todas.length)
    expect(pedidos).toEqual([
      [0, TAMANHO_PAGINA - 1],
      [TAMANHO_PAGINA, TAMANHO_PAGINA * 2 - 1],
      [TAMANHO_PAGINA * 2, TAMANHO_PAGINA * 3 - 1],
    ])
  })

  it('uma página só quando cabe tudo; lista vazia funciona', async () => {
    expect(await buscarTodasAsPaginas(fonte(3).pagina)).toEqual([0, 1, 2])
    expect(await buscarTodasAsPaginas(fonte(0).pagina)).toEqual([])
  })

  it('repassa o erro do banco', async () => {
    const erro = { code: '42501', message: 'permission denied' }
    await expect(buscarTodasAsPaginas(() => Promise.resolve({ data: null, error: erro }))).rejects.toBe(erro)
  })
})

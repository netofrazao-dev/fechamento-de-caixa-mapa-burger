import { describe, expect, it } from 'vitest'
import { interpretarChave, juntarRascunhos, rascunhosDoAparelho, temConteudo, type RascunhoAberto } from './rascunhosAbertos'

const id = '11111111-2222-4333-8444-555555555555'

describe('rascunhos abertos', () => {
  it('entende as chaves dos formulários e sabe onde continuar', () => {
    expect(interpretarChave('mapa-burger-rascunho-fechamento')).toMatchObject({ tipo: 'fechamento', link: '/novo', edicao: false })
    expect(interpretarChave('mapa-burger-rascunho-fechamento-dia-2026-11-02')).toMatchObject({ link: '/novo?data=2026-11-02', edicao: false })
    expect(interpretarChave(`mapa-burger-rascunho-fechamento-${id}`)).toMatchObject({ link: `/fechamento/${id}/editar`, edicao: true, registroId: id })
    expect(interpretarChave('mapa-burger-rascunho-relatorio-novo')).toMatchObject({ tipo: 'relatorio', link: '/relatorios/novo', edicao: false })
    expect(interpretarChave('mapa-burger-rascunho-relatorio-novo-2026-11-02')).toMatchObject({ link: '/relatorios/novo?data=2026-11-02' })
    expect(interpretarChave(`mapa-burger-rascunho-relatorio-${id}`)).toMatchObject({ link: `/relatorios/${id}`, edicao: true })
    expect(interpretarChave('mapa-burger-rascunho-relatorio-do-dia-2026-11-07')).toMatchObject({
      tipo: 'relatorio',
      link: '/relatorios/novo?data=2026-11-07',
      dia: '2026-11-07',
    })
    expect(interpretarChave('mapa-burger-rascunho-fechamento-do-dia-2026-11-07')).toMatchObject({ tipo: 'fechamento', link: '/novo?data=2026-11-07' })
    expect(interpretarChave('mapa-burger-rascunho-fechamento-do-dia-2026-11-07-noite')).toBeNull()
    expect(interpretarChave('mapa-burger-rascunho-teste')).toBeNull()
    expect(interpretarChave('mapa-burger-rascunho-fechamento-dia-lixo')).toBeNull()
  })

  it('rascunho só com a data (nada preenchido) não conta como em andamento', () => {
    const vazio = {
      data: '2026-11-05',
      lc: { dinheiroAbertura: 0, pix: 0 },
      sangrias: [{ valor: 0, motivo: ' ', tipo: 'compra' }],
      ajuste: { tipo: null, valor: 0 },
      estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 0 }] },
      imagem1: null,
    }
    expect(temConteudo(vazio)).toBe(false)
    expect(temConteudo({ ...vazio, lc: { dinheiroAbertura: 0, pix: 12.5 } })).toBe(true)
    expect(temConteudo({ ...vazio, funcionariosQueComeram: ['Neto'] })).toBe(true)
  })

  it('mesma chave no aparelho e na nuvem: fica o mais recente', () => {
    const r = (salvoEm: string, data = '2026-11-05'): RascunhoAberto => ({
      tipo: 'relatorio', chave: 'mapa-burger-rascunho-relatorio-novo', link: '/relatorios/novo', edicao: false, data, salvoEm, dados: {},
    })
    const juntos = juntarRascunhos([r('2026-11-05T10:00:00Z')], [r('2026-11-05T12:00:00Z')])
    expect(juntos).toHaveLength(1)
    expect(juntos[0].salvoEm).toBe('2026-11-05T12:00:00Z')
  })

  it('rascunho sincronizado: só aparece com algo não salvo e, se o dia já tem registro, abre o registro', () => {
    const original = globalThis.localStorage
    const dados = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() {
          return dados.size
        },
        key: (i: number) => [...dados.keys()][i] ?? null,
        getItem: (k: string) => dados.get(k) ?? null,
        setItem: (k: string, v: string) => void dados.set(k, v),
        removeItem: (k: string) => void dados.delete(k),
      },
    })
    try {
      const v2 = (pendente: boolean, banco: { id: string } | null, conteudo: object) =>
        JSON.stringify({ v: 2, conteudo, base: null, versaoRascunho: null, banco, pendente, salvoEm: '2026-11-07T15:00:00.000Z' })
      dados.set('mapa-burger-rascunho-relatorio-do-dia-2026-11-07', v2(true, null, { data: '2026-11-07', estragou: ['2 pães'] }))
      dados.set('mapa-burger-rascunho-fechamento-do-dia-2026-11-07', v2(true, { id }, { data: '2026-11-07', lc: { pix: 10 } }))
      dados.set('mapa-burger-rascunho-relatorio-do-dia-2026-11-06', v2(false, { id }, { data: '2026-11-06' }))
      const lista = rascunhosDoAparelho()
      expect(lista).toHaveLength(2)
      expect(lista.find((r) => r.tipo === 'relatorio')).toMatchObject({ data: '2026-11-07', edicao: false, link: '/relatorios/novo?data=2026-11-07' })
      expect(lista.find((r) => r.tipo === 'fechamento')).toMatchObject({ edicao: true, registroId: id, link: `/fechamento/${id}/editar`, dados: { lc: { pix: 10 } } })
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
    }
  })
})

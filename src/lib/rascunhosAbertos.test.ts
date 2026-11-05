import { describe, expect, it } from 'vitest'
import { interpretarChave, juntarRascunhos, temConteudo, type RascunhoAberto } from './rascunhosAbertos'

const id = '11111111-2222-4333-8444-555555555555'

describe('rascunhos abertos', () => {
  it('entende as chaves dos formulários e sabe onde continuar', () => {
    expect(interpretarChave('mapa-burger-rascunho-fechamento')).toMatchObject({ tipo: 'fechamento', link: '/novo', edicao: false })
    expect(interpretarChave('mapa-burger-rascunho-fechamento-dia-2026-11-02')).toMatchObject({ link: '/novo?data=2026-11-02', edicao: false })
    expect(interpretarChave(`mapa-burger-rascunho-fechamento-${id}`)).toMatchObject({ link: `/fechamento/${id}/editar`, edicao: true, registroId: id })
    expect(interpretarChave('mapa-burger-rascunho-relatorio-novo')).toMatchObject({ tipo: 'relatorio', link: '/relatorios/novo', edicao: false })
    expect(interpretarChave('mapa-burger-rascunho-relatorio-novo-2026-11-02')).toMatchObject({ link: '/relatorios/novo?data=2026-11-02' })
    expect(interpretarChave(`mapa-burger-rascunho-relatorio-${id}`)).toMatchObject({ link: `/relatorios/${id}`, edicao: true })
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
})

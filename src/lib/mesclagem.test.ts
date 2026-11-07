import { describe, expect, it } from 'vitest'
import {
  assinaturaFoto,
  canonico,
  FECHAMENTO_VAZIO,
  mesclarFechamento,
  mesclarLista,
  mesclarRelatorio,
  mesclarValor,
  RELATORIO_VAZIO,
  type ConteudoRelatorio,
} from './mesclagem'

const rel = (mudar: Partial<ConteudoRelatorio> = {}): ConteudoRelatorio => ({ ...RELATORIO_VAZIO('2026-11-07'), ...mudar })
const s = (valor: number, motivo: string, tipo: 'compra' | 'pagamento' | 'pix' = 'compra') => ({ valor, motivo, tipo })
const foto = (n: number) => `data:image/jpeg;base64,${'A'.repeat(200 + n)}${n}`

describe('mesclagem entre aparelhos', () => {
  it('valor simples: fica o lado que mudou; os dois mudando diferente vira conflito e fica o meu', () => {
    expect(mesclarValor(1, 1, 2)).toEqual({ valor: 2, origem: 'deles' })
    expect(mesclarValor(1, 3, 1)).toEqual({ valor: 3, origem: 'meu' })
    expect(mesclarValor(1, 5, 5)).toEqual({ valor: 5, origem: 'ambos' })
    expect(mesclarValor(1, 3, 2)).toEqual({ valor: 3, origem: 'conflito' })
  })

  it('listas: junta o que cada lado acrescentou e tira o que cada lado removeu', () => {
    const k = (x: string) => x
    expect(mesclarLista(['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'd'], k).valor).toEqual(['a', 'b', 'c', 'd'])
    expect(mesclarLista(['a', 'b'], ['b'], ['a', 'b', 'd'], k).valor).toEqual(['b', 'd'])
    // a mesma linha acrescentada nos dois lados (veio do rascunho compartilhado) entra uma vez só
    expect(mesclarLista([], ['a', 'b', 'c'], ['a', 'b'], k).valor).toEqual(['a', 'b', 'c'])
    // dois iguais de propósito de um lado só continuam dois
    expect(mesclarLista(['a'], ['a', 'a'], ['a'], k).valor).toEqual(['a', 'a'])
    // linha editada num lado só: troca pela versão nova
    expect(mesclarLista(['a', 'b'], ['a', 'B'], ['a', 'b'], k).valor).toEqual(['a', 'B'])
    // ordem: a deste aparelho primeiro (não mexe nas linhas que a pessoa está digitando)
    expect(mesclarLista(['a', 'b'], ['b', 'a', 'x'], ['a', 'b', 'y'], k).valor).toEqual(['b', 'a', 'x', 'y'])
  })

  it('PC lança sangrias e consumo enquanto o celular conta o estoque e tira as fotos: nada se perde', () => {
    const base = rel({ sangrias: [s(12.5, 'pão')] })
    const pc = rel({
      sangrias: [s(12.5, 'pão'), s(30, 'gás', 'pagamento')],
      consumoLojaMensal: [{ pessoa: 'Pâmela', item: 'Coca lata', valor: 6 }],
      funcionariosQueComeram: ['Neto'],
    })
    const celular = rel({
      sangrias: [s(12.5, 'pão')],
      estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 12 }, { produto: 'Sprite 350ml', quantidade: 4 }] },
      imagem1: foto(1),
    })
    const { resultado, deFora, conflitos } = mesclarRelatorio(base, pc, celular)
    expect(resultado.sangrias).toEqual([s(12.5, 'pão'), s(30, 'gás', 'pagamento')])
    expect(resultado.consumoLojaMensal).toHaveLength(1)
    expect(resultado.funcionariosQueComeram).toEqual(['Neto'])
    expect(resultado.estoqueQuente.itens).toEqual([
      { produto: 'Coca KS', quantidade: 12 },
      { produto: 'Sprite 350ml', quantidade: 4 },
    ])
    expect(resultado.imagem1).toBe(foto(1))
    expect(deFora).toEqual(['Estoque', 'Print 1'])
    expect(conflitos).toEqual([])
  })

  it('estoque produto por produto; foto comparada pela assinatura (referência da nuvem vale como a mesma foto)', () => {
    const base = rel({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 10 }] }, imagem1: assinaturaFoto(foto(1)) })
    const meu = rel({
      estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 10 }, { produto: 'Monster Azul', quantidade: 3 }] },
      imagem1: foto(1),
    })
    const deles = rel({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 8 }] }, imagem1: assinaturaFoto(foto(1)), imagem2: assinaturaFoto(foto(2)) })
    const { resultado, deFora } = mesclarRelatorio(base, meu, deles)
    expect(resultado.estoqueQuente.itens).toEqual([
      { produto: 'Coca KS', quantidade: 8 },
      { produto: 'Monster Azul', quantidade: 3 },
    ])
    expect(resultado.imagem1).toBe(foto(1)) // a mesma foto: fica a daqui (já baixada)
    expect(resultado.imagem2).toBe(assinaturaFoto(foto(2))) // foto nova do outro aparelho: referência para baixar
    expect(deFora).toEqual(['Estoque', 'Print 2'])
  })

  it('mesma coisa mudada nos dois aparelhos de jeitos diferentes: fica a deste e avisa', () => {
    const base = rel({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 10 }] } })
    const meu = rel({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 9 }] }, imagem1: foto(1) })
    const deles = rel({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 7 }] }, imagem1: foto(2) })
    const { resultado, conflitos } = mesclarRelatorio(base, meu, deles)
    expect(resultado.estoqueQuente.itens[0].quantidade).toBe(9)
    expect(resultado.imagem1).toBe(foto(1))
    expect(conflitos).toEqual(['Estoque', 'Print 1'])
  })

  it('consumo corrigido no Acerto (id do funcionário) não é desfeito por quem não mexeu nele', () => {
    const linha = { pessoa: 'Pamelinha', item: 'Água', valor: 3 }
    const base = rel({ consumoLojaMensal: [linha] })
    const meu = rel({ consumoLojaMensal: [linha], estragou: ['2 pães'] })
    const deles = rel({ consumoLojaMensal: [{ ...linha, pessoa: 'Pâmela', funcionarioId: 'f1' }] })
    const { resultado } = mesclarRelatorio(base, meu, deles)
    expect(resultado.consumoLojaMensal).toEqual([{ ...linha, pessoa: 'Pâmela', funcionarioId: 'f1' }])
    expect(resultado.estragou).toEqual(['2 pães'])
  })

  it('espaço sobrando digitado não conta como linha diferente', () => {
    const base = rel({ sangrias: [s(10, 'pão')] })
    const meu = rel({ sangrias: [s(10, 'pão ')] })
    const deles = rel({ sangrias: [s(10, 'pão'), s(5, 'gelo')] })
    expect(mesclarRelatorio(base, meu, deles).resultado.sangrias.map((x) => x.motivo)).toEqual(['pão ', 'gelo'])
  })

  it('fechamento: LC no PC e marmitas no celular; marmitas contadas nos dois lados somam', () => {
    const base = FECHAMENTO_VAZIO('2026-11-07')
    const pc = { ...base, lc: { ...base.lc, pix: 392, dinheiroFechamento: 135 }, marmitas: [{ prato: 'Estrogonofe', quantidade: 2 }], totalLCSistema: 700 }
    const celular = {
      ...base,
      marmitas: [
        { prato: 'Estrogonofe', quantidade: 3 },
        { prato: 'Frango Grelhado', quantidade: 6 },
      ],
      brendi: { ...base.brendi, pix: 348.24 },
    }
    const { resultado, deFora, conflitos } = mesclarFechamento(base, pc, celular)
    expect(resultado.lc.pix).toBe(392)
    expect(resultado.lc.dinheiroFechamento).toBe(135)
    expect(resultado.brendi.pix).toBe(348.24)
    expect(resultado.totalLCSistema).toBe(700)
    expect(resultado.marmitas).toEqual([
      { prato: 'Estrogonofe', quantidade: 5 },
      { prato: 'Frango Grelhado', quantidade: 6 },
    ])
    expect(deFora).toEqual(['Valores do Brendi', 'Marmitas'])
    expect(conflitos).toEqual([])
  })

  it('fechamento: o mesmo campo com valores diferentes nos dois aparelhos avisa o campo', () => {
    const base = FECHAMENTO_VAZIO('2026-11-07')
    const { resultado, conflitos } = mesclarFechamento(
      base,
      { ...base, lc: { ...base.lc, pix: 100 } },
      { ...base, lc: { ...base.lc, pix: 90 } },
    )
    expect(resultado.lc.pix).toBe(100)
    expect(conflitos).toEqual(['PIX (LC)'])
  })

  it('assinatura da foto: igual para a mesma foto, diferente para outra, e a referência é ela mesma', () => {
    expect(assinaturaFoto(foto(1))).toBe(assinaturaFoto(String(foto(1))))
    expect(assinaturaFoto(foto(1))).not.toBe(assinaturaFoto(foto(2)))
    expect(assinaturaFoto(assinaturaFoto(foto(1)))).toBe(assinaturaFoto(foto(1)))
    expect(assinaturaFoto(null)).toBeNull()
  })

  it('canônico não depende da ordem das chaves', () => {
    expect(canonico({ a: 1, b: [{ y: 2, x: 1 }] })).toBe(canonico({ b: [{ x: 1, y: 2 }], a: 1 }))
  })
})

import { describe, expect, it } from 'vitest'
import { avisosFechamento, avisosValoresFora, errosFechamento } from './conferencia'
import { calcularResultado } from './calculations'
import type { NovoFechamentoInput } from '../types/fechamento'

const base: NovoFechamentoInput = {
  data: '2026-11-03',
  turno: 'manha',
  lc: { dinheiroAbertura: 100, dinheiroFechamento: 300, pix: 200, debito: 0, credito: 0, consumoLoja: 0, aPrazo: 0, ticket: 0 },
  brendi: { pix: 0, debito: 0, credito: 0, creditoOnline: 0, dinheiro: 0 },
  sangrias: [],
  marmitas: [],
  totalLCSistema: 500,
  ajuste: { tipo: null, valor: 0 },
  observacoes: '',
}
const res = (i: NovoFechamentoInput) => calcularResultado(i)

describe('errosFechamento', () => {
  it('fechamento normal não tem erro', () => {
    expect(errosFechamento(base)).toEqual([])
  })
  it('sangria sem motivo, ajuste sem observação e data inválida', () => {
    expect(errosFechamento({ ...base, sangrias: [{ valor: 10, motivo: ' ' }] })).toHaveLength(1)
    expect(errosFechamento({ ...base, ajuste: { tipo: 'remover', valor: 5 } })).toHaveLength(1)
    expect(errosFechamento({ ...base, ajuste: { tipo: 'remover', valor: 5 }, observacoes: 'troco' })).toEqual([])
    expect(errosFechamento({ ...base, data: '' })).toHaveLength(1)
  })
})

describe('avisosFechamento', () => {
  it('sem avisos quando tudo bate e é de hoje', () => {
    expect(avisosFechamento(base, res(base), '2026-11-03')).toEqual([])
  })
  it('avisa data diferente de hoje e futura', () => {
    expect(avisosFechamento(base, res(base), '2026-11-04')[0]).toContain('não de hoje')
    expect(avisosFechamento(base, res(base), '2026-11-02')[0]).toContain('futuro')
  })
  it('avisa caixa vazio e Total LC Sistema zerado', () => {
    const vazio = { ...base, lc: { ...base.lc, dinheiroFechamento: 0, pix: 0 }, totalLCSistema: 0 }
    expect(avisosFechamento(vazio, res(vazio), '2026-11-03').join(' ')).toContain('Nenhum valor')
    const semSistema = { ...base, totalLCSistema: 0 }
    expect(avisosFechamento(semSistema, res(semSistema), '2026-11-03').join(' ')).toContain('Total LC Sistema')
  })
  it('pede observação quando a diferença é grande', () => {
    const faltou = { ...base, totalLCSistema: 600 }
    const avisos = avisosFechamento(faltou, res(faltou), '2026-11-03')
    expect(avisos.join(' ')).toContain('faltando')
    expect(avisosFechamento({ ...faltou, observacoes: 'cliente não pagou' }, res(faltou), '2026-11-03')).toEqual([])
  })
})

describe('avisosValoresFora (valor fora do normal)', () => {
  // 10 dias "normais": dinheiro ~300, PIX ~1500, ticket ~60, a prazo sempre zerado.
  const historico = Array.from({ length: 10 }, (_, i) => ({
    lc: { dinheiroAbertura: 100, dinheiroFechamento: 280 + i * 5, pix: 1400 + i * 20, debito: 400, credito: 300, consumoLoja: 20, aPrazo: 0, ticket: 50 + i },
    brendi: { pix: 300, debito: 0, credito: 100, creditoOnline: 80, dinheiro: 40 },
    totalLCSistema: 2500,
  }))
  const normal = { ...historico[0], lc: { ...historico[0].lc } }

  it('dia normal não gera aviso', () => {
    expect(avisosValoresFora(normal, historico)).toEqual([])
  })

  it('"15050" em vez de "150,50" no dinheiro é percebido', () => {
    const a = avisosValoresFora({ ...normal, lc: { ...normal.lc, dinheiroFechamento: 15050 } }, historico)
    expect(a).toHaveLength(1)
    expect(a[0]).toContain('Dinheiro no fechamento')
    expect(a[0]).toContain('vírgula')
  })

  it('ticket sem vírgula (5600 em vez de 56,00) é percebido mesmo com o total parecendo possível', () => {
    expect(avisosValoresFora({ ...normal, lc: { ...normal.lc, ticket: 5600 } }, historico)[0]).toContain('Ticket')
  })

  it('campo que sempre fica zerado recebendo valor alto: avisa que pode ser o campo errado', () => {
    expect(avisosValoresFora({ ...normal, lc: { ...normal.lc, aPrazo: 1500 } }, historico)[0]).toContain('campo certo')
    // valor pequeno num campo normalmente zerado não incomoda
    expect(avisosValoresFora({ ...normal, lc: { ...normal.lc, aPrazo: 120 } }, historico)).toEqual([])
  })

  it('com pouco histórico (loja nova) não compara', () => {
    expect(avisosValoresFora({ ...normal, lc: { ...normal.lc, pix: 999999 } }, historico.slice(0, 3))).toEqual([])
  })

  it('entra nos avisos do fechamento (pede confirmação)', () => {
    const errado = { ...base, lc: { ...base.lc, pix: 140000 }, totalLCSistema: 140500 }
    expect(avisosFechamento(errado, res(errado), '2026-11-03', historico).some((a) => a.startsWith('PIX (LC)'))).toBe(true)
  })
})

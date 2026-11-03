import { describe, expect, it } from 'vitest'
import { avisosFechamento, errosFechamento } from './conferencia'
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

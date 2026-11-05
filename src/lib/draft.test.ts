import { afterEach, describe, expect, it } from 'vitest'
import { formatarHoraRascunho, lerRascunho, salvarRascunho } from './draft'

describe('rascunho', () => {
  it('mostra só a hora quando é de hoje e o dia quando é de outro dia', () => {
    const agora = new Date(2026, 10, 5, 18, 0)
    expect(formatarHoraRascunho(new Date(2026, 10, 5, 14, 5).toISOString(), agora)).toBe('às 14:05')
    expect(formatarHoraRascunho(new Date(2026, 10, 3, 9, 30).toISOString(), agora)).toBe('em 03/11 às 09:30')
    expect(formatarHoraRascunho('lixo', agora)).toBe('')
  })

  describe('aparelho sem espaço', () => {
    const original = globalThis.localStorage
    afterEach(() => {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true })
    })

    function armazenamento(limite: number) {
      const dados = new Map<string, string>()
      return {
        getItem: (k: string) => dados.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (v.length > limite) throw new DOMException('cheio', 'QuotaExceededError')
          dados.set(k, v)
        },
        removeItem: (k: string) => dados.delete(k),
      }
    }

    it('guarda a versão leve (sem fotos) quando a completa não cabe', () => {
      Object.defineProperty(globalThis, 'localStorage', { value: armazenamento(500), configurable: true })
      const completo = { texto: 'sangria do gás', imagem1: 'x'.repeat(2000) }
      expect(salvarRascunho('chave', completo, '2026-11-05T12:00:00.000Z', { texto: 'sangria do gás' } as typeof completo)).toBe(true)
      expect(lerRascunho<typeof completo>('chave')?.dados).toEqual({ texto: 'sangria do gás' })
    })

    it('sem versão leve e sem espaço: avisa que não guardou (não quebra a tela)', () => {
      Object.defineProperty(globalThis, 'localStorage', { value: armazenamento(10), configurable: true })
      expect(salvarRascunho('chave', { texto: 'grande demais' })).toBe(false)
    })
  })
})

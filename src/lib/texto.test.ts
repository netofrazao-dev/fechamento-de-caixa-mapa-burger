import { describe, expect, it } from 'vitest'
import { semAcento } from './texto'

describe('semAcento (impressão térmica)', () => {
  it('remove acentos e cedilha', () => {
    expect(semAcento('Crédito Online — não açaí Pâmela')).toBe('Credito Online  nao acai Pamela')
  })

  it('mantém texto simples e lida com vazio', () => {
    expect(semAcento('PIX 10,50')).toBe('PIX 10,50')
    expect(semAcento('')).toBe('')
  })
})

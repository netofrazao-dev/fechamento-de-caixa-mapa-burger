import { describe, expect, it } from 'vitest'
import { dataLocal, inicioDoMesLocal, limitesDoMes, mesLocal } from './datas'

describe('datas locais', () => {
  it('à noite continua no mesmo dia (o bug do toISOString em UTC)', () => {
    // construtor local: 22h30 do dia 10 em qualquer fuso
    expect(dataLocal(new Date(2026, 9, 10, 22, 30))).toBe('2026-10-10')
    expect(dataLocal(new Date(2026, 9, 10, 23, 59))).toBe('2026-10-10')
  })

  it('completa mês e dia com zero à esquerda', () => {
    expect(dataLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('início do mês e mês no formato YYYY-MM', () => {
    expect(inicioDoMesLocal(new Date(2026, 9, 17))).toBe('2026-10-01')
    expect(mesLocal(new Date(2026, 9, 17))).toBe('2026-10')
  })

  it('limites do mês, incluindo fevereiro e ano bissexto', () => {
    expect(limitesDoMes('2026-10')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
    expect(limitesDoMes('2026-02')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(limitesDoMes('2028-02')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' })
    expect(limitesDoMes('2026-04').fim).toBe('2026-04-30')
  })
})

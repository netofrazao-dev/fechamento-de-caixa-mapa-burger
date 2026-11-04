/**
 * Remove acentos, til, cedilha etc. Usado só nas impressões térmicas
 * (recibo do fechamento e do relatório diário), porque alguns caracteres
 * acentuados somem/bugam ao imprimir nessas impressoras.
 */
export function semAcento(texto: string): string {
  return (texto ?? '')
    .replace(/[\u00a0\u202f\u2007]/g, ' ') // espaço "inquebrável" (ex.: "R$ 10,00") vira espaço comum
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '') // remove qualquer outro caractere não-ASCII residual
}

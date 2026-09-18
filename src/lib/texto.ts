/**
 * Remove acentos, til, cedilha etc. Usado só nas impressões térmicas
 * (recibo do fechamento e do relatório diário), porque alguns caracteres
 * acentuados somem/bugam ao imprimir nessas impressoras.
 */
export function semAcento(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '') // remove qualquer outro caractere não-ASCII residual
}

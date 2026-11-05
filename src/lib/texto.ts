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
    .replace(/[^\t\n\r -~]/g, '') // fica só o texto comum (ASCII imprimível + quebras de linha)
}

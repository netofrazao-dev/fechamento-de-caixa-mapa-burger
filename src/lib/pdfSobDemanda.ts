/**
 * O gerador de PDF é grande (jsPDF); só é baixado quando a pessoa
 * pede um PDF. Use: `const pdf = await carregarPdf(); pdf.gerarPdfFechamento(f)`.
 */
export function carregarPdf() {
  return import('./pdf')
}

/**
 * Lembrete mostrado depois de baixar o recibo de 80 mm: no Chrome, com o papel
 * "Carta" ou A4 selecionado, a impressora térmica solta uma folha inteira em branco.
 */
export const DICA_PAPEL_80MM =
  'Recibo baixado. Na tela de impressão, em Tamanho do papel, escolha o papel de 80 mm da Epson (ex.: Roll Paper 80 x 297 mm), não Carta nem A4, e em Margens escolha Nenhuma.'

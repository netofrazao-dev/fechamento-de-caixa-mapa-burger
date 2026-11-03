/**
 * O gerador de PDF é grande (jsPDF); só é baixado quando a pessoa
 * pede um PDF. Use: `const pdf = await carregarPdf(); pdf.gerarPdfFechamento(f)`.
 */
export function carregarPdf() {
  return import('./pdf')
}

/** Baixa um arquivo gerado no próprio aparelho (sem passar por servidor). */
export function baixarArquivo(conteudo: BlobPart | Blob, nome: string, tipo: string): void {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** true se o aparelho consegue mandar arquivos pelo "Compartilhar" (WhatsApp etc.). */
export function podeCompartilharArquivos(): boolean {
  try {
    const teste = new File(['x'], 'teste.pdf', { type: 'application/pdf' })
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [teste] })
  } catch {
    return false
  }
}

export type ResultadoEntrega = 'compartilhado' | 'baixado' | 'cancelado'

/**
 * Abre o "Compartilhar" do celular com o arquivo (WhatsApp, e-mail...).
 * Se o aparelho não suportar, ou o navegador recusar, baixa o arquivo.
 */
export async function compartilharOuBaixar(blob: Blob, nome: string, titulo: string): Promise<ResultadoEntrega> {
  const arquivo = new File([blob], nome, { type: blob.type || 'application/pdf' })
  if (podeCompartilharArquivos()) {
    try {
      await navigator.share({ files: [arquivo], title: titulo })
      return 'compartilhado'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // NotAllowedError etc.: cai no download
    }
  }
  baixarArquivo(blob, nome, blob.type || 'application/pdf')
  return 'baixado'
}

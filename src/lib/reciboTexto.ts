/**
 * Texto do recibo térmico, em colunas fixas.
 *
 * Muitos aplicativos de impressora térmica leem só o TEXTO do PDF e ignoram
 * a posição de cada coisa na página. Por isso o recibo é montado como texto
 * puro: nome e valor na mesma linha separados por espaços de verdade,
 * centralização feita com espaços e separador feito de traços.
 */

/** Colunas por linha. Cabe numa impressora de 80 mm (48 colunas) com folga. */
export const COLUNAS_RECIBO = 40

/** Quebra o texto em linhas de no máximo `largura` caracteres, sem cortar palavras (só as maiores que a linha). */
export function quebrarTexto(texto: string, largura: number = COLUNAS_RECIBO): string[] {
  const linhas: string[] = []
  for (const paragrafo of (texto ?? '').split(/\r?\n/)) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      let p = palavra
      while (p.length > largura) {
        if (atual) {
          linhas.push(atual)
          atual = ''
        }
        linhas.push(p.slice(0, largura))
        p = p.slice(largura)
      }
      if (!p) continue
      if (!atual) atual = p
      else if (atual.length + 1 + p.length <= largura) atual += ` ${p}`
      else {
        linhas.push(atual)
        atual = p
      }
    }
    linhas.push(atual)
  }
  // Tira linhas vazias do fim (parágrafo final vazio).
  while (linhas.length > 1 && linhas[linhas.length - 1] === '') linhas.pop()
  return linhas
}

/**
 * Nome à esquerda e valor à direita, com pelo menos um espaço entre eles.
 * Nome comprido quebra em mais linhas; o valor fica na última.
 */
export function linhaComValor(nome: string, valor: string, largura: number = COLUNAS_RECIBO): string[] {
  const v = valor.trim()
  const recuo = nome.match(/^\s*/)?.[0] ?? ''
  const espacoNome = Math.max(8, largura - v.length - 1 - recuo.length)
  const partes = quebrarTexto(nome.trim(), espacoNome).map((p) => recuo + p)
  const ultima = partes.pop() ?? ''
  const espacos = Math.max(1, largura - ultima.length - v.length)
  return [...partes, ultima + ' '.repeat(espacos) + v]
}

/** Centraliza com espaços. */
export function centralizar(texto: string, largura: number = COLUNAS_RECIBO): string[] {
  return quebrarTexto(texto, largura).map((l) => ' '.repeat(Math.floor((largura - l.length) / 2)) + l)
}

/** Linha de traços. */
export function separadorTexto(largura: number = COLUNAS_RECIBO): string {
  return '-'.repeat(largura)
}

import type { EstoqueItem } from '../types/fechamento'
import { normalizarNome } from './vales'

export interface LinhaEstoque extends EstoqueItem {
  /** Produto que foi desativado no cadastro, mas tem contagem salva neste relatório. */
  desativado: boolean
}

/**
 * Linhas do "Estoque quente" no relatório:
 * - todos os produtos ativos, na ordem do cadastro (com a quantidade já salva, se houver);
 * - depois, os produtos que foram desativados mas têm contagem salva neste relatório
 *   (assim um relatório antigo nunca perde o que foi contado).
 */
export function montarLinhasEstoque(salvos: EstoqueItem[], ativos: string[]): LinhaEstoque[] {
  const porNome = new Map<string, EstoqueItem>()
  for (const s of salvos) porNome.set(normalizarNome(s.produto), s)

  const linhas: LinhaEstoque[] = []
  const usados = new Set<string>()
  for (const nome of ativos) {
    const chave = normalizarNome(nome)
    if (usados.has(chave)) continue
    usados.add(chave)
    linhas.push({ produto: nome, quantidade: porNome.get(chave)?.quantidade ?? 0, desativado: false })
  }
  for (const s of salvos) {
    const chave = normalizarNome(s.produto)
    if (usados.has(chave) || !(s.quantidade > 0)) continue
    usados.add(chave)
    linhas.push({ produto: s.produto, quantidade: s.quantidade, desativado: true })
  }
  return linhas
}

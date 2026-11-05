/**
 * O Supabase devolve no máximo 1000 linhas por consulta (às vezes menos,
 * conforme a configuração). Para listas que podem crescer com os anos
 * (Histórico com período longo, por exemplo), busca de página em página
 * até acabar — assim nada fica de fora sem a pessoa perceber.
 */

export const TAMANHO_PAGINA = 500

/** Limite de segurança: 200 páginas = 100 mil linhas. */
const MAXIMO_PAGINAS = 200

type Pagina<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * `pagina(de, ate)` deve montar a consulta com `.range(de, ate)` e uma ordem
 * que não muda entre as páginas (ex.: por data + turno).
 */
export async function buscarTodasAsPaginas<T>(pagina: (de: number, ate: number) => Pagina<T>): Promise<T[]> {
  const todas: T[] = []
  for (let i = 0; i < MAXIMO_PAGINAS; i++) {
    const de = i * TAMANHO_PAGINA
    const { data, error } = await pagina(de, de + TAMANHO_PAGINA - 1)
    if (error) throw error
    const linhas = data ?? []
    todas.push(...linhas)
    if (linhas.length < TAMANHO_PAGINA) break
  }
  return todas
}

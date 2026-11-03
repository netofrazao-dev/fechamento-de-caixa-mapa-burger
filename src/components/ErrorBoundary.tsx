import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  erro: Error | null
}

const CHAVE_RECARREGOU = 'mapa-burger-recarregou-apos-atualizacao'

function ehVersaoNova(erro: Error): boolean {
  // Depois de publicar uma versão nova, arquivos antigos deixam de existir.
  return /dynamically imported module|importing a module script failed|error loading dynamically|chunkloaderror/i.test(
    erro.message,
  )
}

/** Evita tela branca: se algo quebrar numa tela, mostra um aviso com botão de recarregar. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[tela quebrou]', erro, info.componentStack)
    if (ehVersaoNova(erro)) {
      try {
        if (!sessionStorage.getItem(CHAVE_RECARREGOU)) {
          sessionStorage.setItem(CHAVE_RECARREGOU, '1')
          window.location.reload()
        }
      } catch {
        // sem sessionStorage: a pessoa recarrega pelo botão
      }
    }
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    const versaoNova = ehVersaoNova(erro)
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div role="alert" className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-5 space-y-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {versaoNova ? 'O sistema foi atualizado' : 'Algo deu errado nesta tela'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {versaoNova
              ? 'Recarregue para usar a versão nova. O que você estava preenchendo fica salvo no rascunho.'
              : 'Recarregue a página. O que você estava preenchendo fica salvo no rascunho. Se continuar, avise o responsável.'}
          </p>
          {!versaoNova && <p className="text-xs text-gray-400 break-words">Detalhe: {erro.message}</p>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-gray-900 dark:bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}

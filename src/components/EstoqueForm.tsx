import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import type { EstoqueSnapshot } from '../types/fechamento'
import { montarLinhasEstoque } from '../lib/estoque'
import { nomesProdutosAtivos } from '../lib/produtoEstoqueService'
import { PRODUTOS_ESTOQUE_PADRAO } from '../lib/produtos'

interface Props {
  value: EstoqueSnapshot
  onChange: (value: EstoqueSnapshot) => void
}

export default function EstoqueForm({ value, onChange }: Props) {
  const [ativos, setAtivos] = useState<string[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    nomesProdutosAtivos()
      .then(({ nomes, daListaAntiga }) => {
        if (!vivo) return
        setAtivos(nomes)
        if (daListaAntiga) setAviso('Lista antiga de produtos: rode a migração v8 no Supabase para poder ativar e desativar.')
      })
      .catch(() => {
        if (!vivo) return
        setAtivos(PRODUTOS_ESTOQUE_PADRAO)
        setAviso('Não consegui carregar os produtos do cadastro; mostrando a lista padrão.')
      })
    return () => {
      vivo = false
    }
  }, [])

  if (!ativos) return <p className="text-sm text-gray-400 dark:text-gray-500">Carregando produtos...</p>

  const linhas = montarLinhasEstoque(value.itens, ativos)

  function atualizarQtd(produto: string, quantidade: number) {
    onChange({
      itens: linhas
        .map((l) => (l.produto === produto ? { produto: l.produto, quantidade } : { produto: l.produto, quantidade: l.quantidade }))
        // Produto desativado que foi zerado sai do relatório.
        .filter((l, i) => !linhas[i].desativado || l.quantidade > 0),
    })
  }

  return (
    <div className="space-y-2">
      {aviso && <p className="text-[11px] text-amber-700 dark:text-amber-400">{aviso}</p>}
      {linhas.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum produto ativo. Ative ou cadastre em Cadastros.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {linhas.map((item) => (
          <label
            key={item.produto}
            className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5"
          >
            <span className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
              {item.produto}
              {item.desativado && <span className="block text-[10px] text-gray-400 dark:text-gray-500">desativado</span>}
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              aria-label={`Quantidade de ${item.produto}`}
              className="w-14 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1.5 text-sm text-right tabular-nums outline-none focus:border-gray-500"
              value={item.quantidade ? String(item.quantidade) : ''}
              onChange={(e) => {
                const digitos = e.target.value.replace(/\D/g, '').slice(0, 5)
                atualizarQtd(item.produto, digitos ? parseInt(digitos, 10) : 0)
              }}
              onFocus={(e) => e.target.select()}
            />
          </label>
        ))}
      </div>
      <Link
        to="/cadastros#produtos-estoque"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
      >
        <Settings2 size={13} /> Adicionar, ativar ou desativar produtos
      </Link>
    </div>
  )
}

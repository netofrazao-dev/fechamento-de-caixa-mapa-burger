import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import {
  atualizarRelatorio,
  buscarRelatorioPorId,
  criarRelatorio,
  excluirRelatorio,
} from '../lib/relatorioService'
import { gerarPdfRelatorio } from '../lib/pdf'
import type { ItemRelatorio } from '../types/fechamento'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function RelatorioForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hoje())
  const [itens, setItens] = useState<ItemRelatorio[]>([{ label: '', valor: '' }])

  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    buscarRelatorioPorId(id)
      .then((r) => {
        setTitulo(r.titulo)
        setData(r.data)
        setItens(r.itens.length > 0 ? r.itens : [{ label: '', valor: '' }])
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar relatório.'))
      .finally(() => setCarregando(false))
  }, [id])

  function atualizarItem(index: number, campo: keyof ItemRelatorio, valor: string) {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)))
  }
  function adicionarItem() {
    setItens((prev) => [...prev, { label: '', valor: '' }])
  }
  function removerItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index))
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      const itensLimpos = itens.filter((it) => it.label.trim() || it.valor.trim())
      const payload = { titulo, data, itens: itensLimpos }
      const salvo = id ? await atualizarRelatorio(id, payload) : await criarRelatorio(payload)
      navigate(`/relatorios/${salvo.id}`, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar relatório.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!id) return
    if (!confirm('Excluir este relatório? Essa ação não pode ser desfeita.')) return
    await excluirRelatorio(id)
    navigate('/relatorios', { replace: true })
  }

  function baixarPdf() {
    gerarPdfRelatorio({
      id: id ?? '',
      titulo,
      data,
      itens: itens.filter((it) => it.label.trim() || it.valor.trim()),
      createdAt: '',
      updatedAt: '',
    })
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400">Carregando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-36">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{editando ? 'Editar relatório' : 'Novo relatório'}</h1>
        {editando && (
          <button type="button" onClick={excluir} className="p-2 text-gray-300 hover:text-red-500">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      <section className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600">Título</span>
          <input
            type="text"
            placeholder="Ex: Relatório semanal de compras"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
      </section>

      <section className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
        <h2 className="text-[15px] font-semibold text-gray-900">Conteúdo</h2>
        <div className="space-y-3">
          {itens.map((item, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Nome do campo (ex: Fornecedor)"
                  className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium outline-none focus:border-gray-400"
                  value={item.label}
                  onChange={(e) => atualizarItem(i, 'label', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removerItem(i)}
                  className="shrink-0 p-1.5 text-gray-300 hover:text-red-500"
                  aria-label="Remover campo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea
                placeholder="Preencha aqui..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
                value={item.valor}
                onChange={(e) => atualizarItem(i, 'valor', e.target.value)}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={adicionarItem} className="text-sm font-medium text-gray-900 hover:underline">
          + Adicionar campo
        </button>
      </section>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="fixed bottom-14 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={baixarPdf}
            className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
          >
            Baixar PDF
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

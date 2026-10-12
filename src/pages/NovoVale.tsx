import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import SeletorFuncionarios from '../components/SeletorFuncionarios'
import CampoMoeda from '../components/CampoMoeda'
import { atualizarVale, buscarValePorId, criarVale } from '../lib/valeService'
import { hojeLocal as hoje } from '../lib/datas'

export default function NovoVale() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editando = Boolean(id)
  const [searchParams] = useSearchParams()

  const [funcionario, setFuncionario] = useState<string[]>([])
  const [data, setData] = useState(hoje())
  const [valor, setValor] = useState(0)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(editando)

  useEffect(() => {
    if (!id) return
    buscarValePorId(id)
      .then((v) => {
        setFuncionario([v.funcionario])
        setData(v.data)
        setValor(v.valor)
        setObservacao(v.observacao)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar vale.'))
      .finally(() => setCarregando(false))
  }, [id])

  const mesVoltar = searchParams.get('mes') || data.slice(0, 7)

  async function salvar(outro: boolean) {
    setErro(null)
    if (funcionario.length === 0) {
      setErro('Selecione o funcionário.')
      return
    }
    if (!valor || valor <= 0) {
      setErro('Informe o valor do vale.')
      return
    }

    setSalvando(true)
    try {
      const input = { funcionario: funcionario[0], data, valor, observacao: observacao.trim() }
      if (id) {
        await atualizarVale(id, input)
        navigate(`/vales?mes=${data.slice(0, 7)}`, { replace: true })
        return
      }
      await criarVale(input)
      if (outro) {
        setValor(0)
        setObservacao('')
        setFuncionario([])
      } else {
        navigate(`/vales?mes=${data.slice(0, 7)}`, { replace: true })
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar vale.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-40">
      <Link to={`/vales?mes=${mesVoltar}`} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Voltar aos vales
      </Link>
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{editando ? 'Editar vale' : 'Novo vale'}</h1>
      </header>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
        <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Funcionário</span>
        <SeletorFuncionarios value={funcionario} onChange={setFuncionario} unico />
      </section>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <CampoMoeda label="Valor do vale" value={valor} onChange={setValor} somavel={false} />
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Observação (opcional)</span>
          <input
            type="text"
            placeholder="Ex: adiantamento pra compra de remédio"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </label>
      </section>

      {erro && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{erro}</div>}

      <div className="fixed bottom-14 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          {!editando && (
          <button
            type="button"
            disabled={salvando}
            onClick={() => salvar(true)}
            className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Salvar e lançar outro
          </button>
          )}
          <button
            type="button"
            disabled={salvando}
            onClick={() => salvar(false)}
            className="flex-1 rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

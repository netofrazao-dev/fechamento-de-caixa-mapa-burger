import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, Trash2 } from 'lucide-react'
import {
  atualizarRelatorio,
  buscarRelatorioPorId,
  criarRelatorio,
  excluirRelatorio,
} from '../lib/relatorioService'
import { listarFechamentos } from '../lib/fechamentoService'
import { gerarPdfDiarioCompleto, imprimirRelatorioDiario } from '../lib/pdf'
import Secao from '../components/Secao'
import SeletorFuncionarios from '../components/SeletorFuncionarios'
import ListaLivre from '../components/ListaLivre'
import ListaConsumo from '../components/ListaConsumo'
import ListaValorMotivo from '../components/ListaValorMotivo'
import EstoqueForm from '../components/EstoqueForm'
import type { ConsumoItem, EstoqueSnapshot, Sangria } from '../types/fechamento'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

const ESTOQUE_VAZIO: EstoqueSnapshot = { dataHora: '', itens: [] }

export default function RelatorioForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [data, setData] = useState(hoje())
  const [aberturaCaixa, setAberturaCaixa] = useState(0)
  const [fechamentoCaixa, setFechamentoCaixa] = useState(0)
  const [quantidadeVendida, setQuantidadeVendida] = useState(0)
  const [estragou, setEstragou] = useState<string[]>([])
  const [funcionariosQueComeram, setFuncionariosQueComeram] = useState<string[]>([])
  const [consumoLojaMensal, setConsumoLojaMensal] = useState<ConsumoItem[]>([])
  const [consumoLojaMotoboys, setConsumoLojaMotoboys] = useState<ConsumoItem[]>([])
  const [cortesiaClientes, setCortesiaClientes] = useState<ConsumoItem[]>([])
  const [sangrias, setSangrias] = useState<Sangria[]>([])
  const [estoqueInicio, setEstoqueInicio] = useState<EstoqueSnapshot>(ESTOQUE_VAZIO)
  const [estoqueFinal, setEstoqueFinal] = useState<EstoqueSnapshot>(ESTOQUE_VAZIO)
  const [estoqueQuente, setEstoqueQuente] = useState<string[]>([])

  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    buscarRelatorioPorId(id)
      .then((r) => {
        setData(r.data)
        setAberturaCaixa(r.aberturaCaixa)
        setFechamentoCaixa(r.fechamentoCaixa)
        setQuantidadeVendida(r.quantidadeVendida)
        setEstragou(r.estragou)
        setFuncionariosQueComeram(r.funcionariosQueComeram)
        setConsumoLojaMensal(r.consumoLojaMensal)
        setConsumoLojaMotoboys(r.consumoLojaMotoboys)
        setCortesiaClientes(r.cortesiaClientes)
        setSangrias(r.sangrias)
        setEstoqueInicio(r.estoqueInicio)
        setEstoqueFinal(r.estoqueFinal)
        setEstoqueQuente(r.estoqueQuente)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar relatório.'))
      .finally(() => setCarregando(false))
  }, [id])

  function payload() {
    return {
      data,
      aberturaCaixa,
      fechamentoCaixa,
      quantidadeVendida,
      estragou: estragou.filter((s) => s.trim()),
      funcionariosQueComeram,
      consumoLojaMensal: consumoLojaMensal.filter((c) => c.pessoa.trim() || c.item.trim() || c.valor),
      consumoLojaMotoboys: consumoLojaMotoboys.filter((c) => c.pessoa.trim() || c.item.trim() || c.valor),
      cortesiaClientes: cortesiaClientes.filter((c) => c.pessoa.trim() || c.item.trim() || c.valor),
      sangrias: sangrias.filter((s) => s.valor > 0 || s.motivo.trim()),
      estoqueInicio,
      estoqueFinal,
      estoqueQuente: estoqueQuente.filter((s) => s.trim()),
    }
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      const salvo = id ? await atualizarRelatorio(id, payload()) : await criarRelatorio(payload())
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

  function imprimir() {
    imprimirRelatorioDiario({
      id: id ?? '',
      ...payload(),
      createdAt: '',
      updatedAt: '',
    })
  }

  async function baixarPdfCompleto() {
    const fechamentos = await listarFechamentos({ dataInicio: data, dataFim: data })
    gerarPdfDiarioCompleto({
      relatorio: { id: id ?? '', ...payload(), createdAt: '', updatedAt: '' },
      fechamentos,
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
          <span className="text-[13px] font-medium text-gray-600">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <CampoDinheiro label="Abertura do caixa" value={aberturaCaixa} onChange={setAberturaCaixa} />
          <CampoDinheiro label="Fechamento do caixa" value={fechamentoCaixa} onChange={setFechamentoCaixa} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600">Quantidade vendida</span>
          <input
            type="number"
            min={0}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 w-32"
            value={Number.isNaN(quantidadeVendida) ? '' : quantidadeVendida}
            onChange={(e) => setQuantidadeVendida(e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            onFocus={(e) => e.target.select()}
          />
        </label>
      </section>

      <Secao titulo="Estragou" resumo={estragou.length > 0 ? `${estragou.length} item(ns)` : 'Nenhum'}>
        <ListaLivre value={estragou} onChange={setEstragou} placeholder="Ex: 400g de arroz" />
      </Secao>

      <Secao
        titulo="Funcionários que comeram"
        resumo={funcionariosQueComeram.length > 0 ? funcionariosQueComeram.join(', ') : 'Nenhum'}
      >
        <SeletorFuncionarios value={funcionariosQueComeram} onChange={setFuncionariosQueComeram} />
      </Secao>

      <Secao titulo="Consumo loja mensal" resumo={`${consumoLojaMensal.length} lançamento(s)`}>
        <ListaConsumo value={consumoLojaMensal} onChange={setConsumoLojaMensal} placeholderPessoa="Funcionário" />
      </Secao>

      <Secao titulo="Consumo loja motoboys" resumo={`${consumoLojaMotoboys.length} lançamento(s)`}>
        <ListaConsumo value={consumoLojaMotoboys} onChange={setConsumoLojaMotoboys} placeholderPessoa="Motoboy" />
      </Secao>

      <Secao titulo="Cortesia clientes" resumo={`${cortesiaClientes.length} lançamento(s)`}>
        <ListaConsumo value={cortesiaClientes} onChange={setCortesiaClientes} placeholderPessoa="Cliente" />
      </Secao>

      <Secao titulo="Sangrias" resumo={`${sangrias.length} sangria(s)`}>
        <ListaValorMotivo value={sangrias} onChange={setSangrias} />
      </Secao>

      <Secao titulo="Estoque início">
        <EstoqueForm value={estoqueInicio} onChange={setEstoqueInicio} />
      </Secao>

      <Secao titulo="Estoque final">
        <EstoqueForm value={estoqueFinal} onChange={setEstoqueFinal} />
      </Secao>

      <Secao titulo="Estoque quente" resumo={estoqueQuente.length > 0 ? `${estoqueQuente.length} item(ns)` : 'Nenhum'}>
        <ListaLivre value={estoqueQuente} onChange={setEstoqueQuente} placeholder="Ex: 3 uva" />
      </Secao>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="fixed bottom-14 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={imprimir}
            title="Imprimir (recibo)"
            className="shrink-0 rounded-xl bg-gray-100 p-3 text-gray-700"
          >
            <Printer size={18} />
          </button>
          <button
            type="button"
            onClick={baixarPdfCompleto}
            className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
          >
            PDF completo
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

function CampoDinheiro({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-gray-600">{label}</span>
      <div className="flex items-center rounded-lg border border-gray-200 bg-white">
        <span className="pl-2.5 text-gray-400 text-sm">R$</span>
        <input
          type="number"
          step="0.01"
          className="w-full px-2 py-2 text-sm outline-none"
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
      </div>
    </label>
  )
}

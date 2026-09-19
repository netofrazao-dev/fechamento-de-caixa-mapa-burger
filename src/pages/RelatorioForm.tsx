import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { History, ImagePlus, Printer, Trash2, X } from 'lucide-react'
import {
  atualizarRelatorio,
  buscarRelatorioPorId,
  criarRelatorio,
  excluirRelatorio,
} from '../lib/relatorioService'
import { listarFechamentos } from '../lib/fechamentoService'
import { gerarPdfWhatsApp, imprimirDiaCompleto } from '../lib/pdf'
import { formatarHoraRascunho, lerRascunho, limparRascunho, salvarRascunho } from '../lib/draft'
import Secao from '../components/Secao'
import SeletorFuncionarios from '../components/SeletorFuncionarios'
import ListaLivre from '../components/ListaLivre'
import ListaConsumo from '../components/ListaConsumo'
import ListaValorMotivo from '../components/ListaValorMotivo'
import EstoqueForm from '../components/EstoqueForm'
import type { ConsumoItem, EstoqueSnapshot, Fechamento, Sangria } from '../types/fechamento'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

const ESTOQUE_VAZIO: EstoqueSnapshot = { itens: [] }

interface RascunhoRelatorio {
  data: string
  aberturaCaixa: number
  fechamentoCaixa: number
  quantidadeVendida: number
  estragou: string[]
  funcionariosQueComeram: string[]
  consumoLojaMensal: ConsumoItem[]
  consumoLojaMotoboys: ConsumoItem[]
  cortesiaClientes: ConsumoItem[]
  sangrias: Sangria[]
  estoqueQuente: EstoqueSnapshot
  imagem1: string | null
  imagem2: string | null
}

export default function RelatorioForm() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const chaveRascunho = `mapa-burger-rascunho-relatorio-${id ?? 'novo'}`
  const rascunho = useRef(lerRascunho<RascunhoRelatorio>(chaveRascunho)).current
  const [avisoRascunho, setAvisoRascunho] = useState(Boolean(rascunho))
  const pulandoPrimeiraGravacao = useRef(true)

  const [data, setData] = useState(rascunho?.dados.data ?? searchParams.get('data') ?? hoje())
  const [aberturaCaixa, setAberturaCaixa] = useState(rascunho?.dados.aberturaCaixa ?? 0)
  const [fechamentoCaixa, setFechamentoCaixa] = useState(rascunho?.dados.fechamentoCaixa ?? 0)
  const [quantidadeVendida, setQuantidadeVendida] = useState(rascunho?.dados.quantidadeVendida ?? 0)
  const [estragou, setEstragou] = useState<string[]>(rascunho?.dados.estragou ?? [])
  const [funcionariosQueComeram, setFuncionariosQueComeram] = useState<string[]>(
    rascunho?.dados.funcionariosQueComeram ?? [],
  )
  const [consumoLojaMensal, setConsumoLojaMensal] = useState<ConsumoItem[]>(
    rascunho?.dados.consumoLojaMensal ?? [],
  )
  const [consumoLojaMotoboys, setConsumoLojaMotoboys] = useState<ConsumoItem[]>(
    rascunho?.dados.consumoLojaMotoboys ?? [],
  )
  const [cortesiaClientes, setCortesiaClientes] = useState<ConsumoItem[]>(rascunho?.dados.cortesiaClientes ?? [])
  const [sangrias, setSangrias] = useState<Sangria[]>(rascunho?.dados.sangrias ?? [])
  const [estoqueQuente, setEstoqueQuente] = useState<EstoqueSnapshot>(rascunho?.dados.estoqueQuente ?? ESTOQUE_VAZIO)
  const [imagem1, setImagem1] = useState<string | null>(rascunho?.dados.imagem1 ?? null)
  const [imagem2, setImagem2] = useState<string | null>(rascunho?.dados.imagem2 ?? null)

  const [carregando, setCarregando] = useState(editando && !rascunho)
  const [salvando, setSalvando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id || rascunho) return // se já tem rascunho local, ele manda (é mais recente que o banco)
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
        setEstoqueQuente(r.estoqueQuente)
        setImagem1(r.imagem1 ?? null)
        setImagem2(r.imagem2 ?? null)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar relatório.'))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      estoqueQuente,
      imagem1,
      imagem2,
    }
  }

  // Salva o rascunho automaticamente a cada mudança, pra não perder o
  // que já foi preenchido se a aba fechar no meio do expediente.
  useEffect(() => {
    if (carregando) return
    if (pulandoPrimeiraGravacao.current) {
      pulandoPrimeiraGravacao.current = false
      return
    }
    salvarRascunho<RascunhoRelatorio>(chaveRascunho, {
      data,
      aberturaCaixa,
      fechamentoCaixa,
      quantidadeVendida,
      estragou,
      funcionariosQueComeram,
      consumoLojaMensal,
      consumoLojaMotoboys,
      cortesiaClientes,
      sangrias,
      estoqueQuente,
      imagem1,
      imagem2,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    carregando,
    data,
    aberturaCaixa,
    fechamentoCaixa,
    quantidadeVendida,
    estragou,
    funcionariosQueComeram,
    consumoLojaMensal,
    consumoLojaMotoboys,
    cortesiaClientes,
    sangrias,
    estoqueQuente,
    imagem1,
    imagem2,
  ])

  function descartarRascunho() {
    limparRascunho(chaveRascunho)
    setAvisoRascunho(false)
    if (id) {
      setCarregando(true)
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
          setEstoqueQuente(r.estoqueQuente)
          setImagem1(r.imagem1 ?? null)
          setImagem2(r.imagem2 ?? null)
        })
        .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar relatório.'))
        .finally(() => setCarregando(false))
    } else {
      setData(searchParams.get('data') || hoje())
      setAberturaCaixa(0)
      setFechamentoCaixa(0)
      setQuantidadeVendida(0)
      setEstragou([])
      setFuncionariosQueComeram([])
      setConsumoLojaMensal([])
      setConsumoLojaMotoboys([])
      setCortesiaClientes([])
      setSangrias([])
      setEstoqueQuente(ESTOQUE_VAZIO)
      setImagem1(null)
      setImagem2(null)
    }
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      const salvo = id ? await atualizarRelatorio(id, payload()) : await criarRelatorio(payload())
      limparRascunho(chaveRascunho)
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

  async function buscarFechamentosDoDia(): Promise<Fechamento[]> {
    return listarFechamentos({ dataInicio: data, dataFim: data })
  }

  async function imprimir() {
    setErro(null)
    setProcessando(true)
    try {
      const fechamentos = await buscarFechamentosDoDia()
      imprimirDiaCompleto({
        relatorio: { id: id ?? '', ...payload(), createdAt: '', updatedAt: '' },
        fechamentos,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar impressão.')
    } finally {
      setProcessando(false)
    }
  }

  async function baixarPdfWhatsApp() {
    setErro(null)
    setProcessando(true)
    try {
      const fechamentos = await buscarFechamentosDoDia()
      await gerarPdfWhatsApp({
        relatorio: { id: id ?? '', ...payload(), createdAt: '', updatedAt: '' },
        fechamentos,
        imagens: [imagem1, imagem2],
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar PDF.')
    } finally {
      setProcessando(false)
    }
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-36">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{editando ? 'Editar relatório' : 'Novo relatório'}</h1>
        {editando && (
          <button type="button" onClick={excluir} className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {avisoRascunho && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <History size={14} className="shrink-0" />
            Rascunho restaurado{rascunho ? ` (salvo às ${formatarHoraRascunho(rascunho.salvoEm)})` : ''} —
            continue de onde parou.
          </span>
          <button type="button" onClick={descartarRascunho} className="shrink-0 font-semibold underline">
            Descartar
          </button>
        </div>
      )}

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <CampoDinheiro label="Abertura do caixa" value={aberturaCaixa} onChange={setAberturaCaixa} />
          <CampoDinheiro label="Fechamento do caixa" value={fechamentoCaixa} onChange={setFechamentoCaixa} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Quantidade vendida</span>
          <input
            type="number"
            min={0}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-400 w-32"
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

      <Secao titulo="Estoque quente">
        <EstoqueForm value={estoqueQuente} onChange={setEstoqueQuente} />
      </Secao>

      <Secao titulo="Anexos (PDF WhatsApp)" resumo={`${[imagem1, imagem2].filter(Boolean).length}/2 imagem(ns)`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
          Os 2 prints que você manda por fora todo dia — entram como páginas extras só no PDF
          para WhatsApp. Ficam salvos junto com o relatório, não precisa anexar de novo depois.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <AnexoImagem valor={imagem1} onChange={setImagem1} label="Print 1" />
          <AnexoImagem valor={imagem2} onChange={setImagem2} label="Print 2" />
        </div>
      </Secao>

      {erro && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{erro}</div>}

      <div className="fixed bottom-14 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={imprimir}
            disabled={processando}
            title="PDF para impressão (recibo térmico)"
            className="shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 text-[10px] font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            <Printer size={16} />
            Impressão
          </button>
          <button
            type="button"
            onClick={baixarPdfWhatsApp}
            disabled={processando}
            title="PDF para enviar no WhatsApp"
            className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            PDF WhatsApp
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="flex-1 rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function lerComoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Redimensiona/comprime a imagem (canvas) antes de guardar, pra não pesar no banco. */
function comprimirImagem(dataUrl: string, larguraMaxima = 1400, qualidade = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(larguraMaxima / img.naturalWidth, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * escala)
      canvas.height = Math.round(img.naturalHeight * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', qualidade))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function AnexoImagem({
  valor,
  onChange,
  label,
}: {
  valor: string | null
  onChange: (dataUrl: string | null) => void
  label: string
}) {
  const [carregando, setCarregando] = useState(false)

  async function selecionar(file: File | undefined) {
    if (!file) return
    setCarregando(true)
    try {
      const dataUrl = await lerComoBase64(file)
      const comprimida = await comprimirImagem(dataUrl)
      onChange(comprimida)
    } finally {
      setCarregando(false)
    }
  }

  if (valor) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square">
        <img src={valor} alt={label} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
          aria-label={`Remover ${label}`}
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <label className="flex flex-col items-center justify-center gap-1 aspect-square rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-pointer">
      <ImagePlus size={20} />
      <span className="text-xs">{carregando ? 'Carregando...' : label}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={carregando}
        onChange={(e) => selecionar(e.target.files?.[0])}
      />
    </label>
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
      <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
      <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <span className="pl-2.5 text-gray-400 dark:text-gray-500 text-sm">R$</span>
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

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Download, History, ImagePlus, Printer, X } from 'lucide-react'
import {
  atualizarRelatorio,
  buscarIdRelatorioPorData,
  buscarRelatorioPorId,
  criarRelatorio,
  excluirRelatorio,
} from '../lib/relatorioService'
import { listarFechamentos } from '../lib/fechamentoService'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { mensagemErro } from '../lib/erros'
import { formatarMoeda, totalMarmitas } from '../lib/calculations'
import CampoMoeda from '../components/CampoMoeda'
import { BotaoExcluir, CaixaErro } from '../components/Avisos'
import { dataValida } from '../lib/vales'
import { listarFuncionarios } from '../lib/funcionarioService'
import { buscarAcerto } from '../lib/acertoService'
import type { Funcionario } from '../types/fechamento'
import { formatarHoraRascunho } from '../lib/draft'
import { useRascunho } from '../lib/useRascunho'
import Secao from '../components/Secao'
import SeletorFuncionarios from '../components/SeletorFuncionarios'
import ListaLivre from '../components/ListaLivre'
import ListaConsumo from '../components/ListaConsumo'
import ListaValorMotivo from '../components/ListaValorMotivo'
import EstoqueForm from '../components/EstoqueForm'
import type { ConsumoItem, EstoqueSnapshot, Fechamento, Sangria } from '../types/fechamento'
import { diaDaSemana, formatarDataBr, hojeLocal as hoje } from '../lib/datas'

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
  const location = useLocation()
  const editando = Boolean(id)

  const chaveRascunho = `mapa-burger-rascunho-relatorio-${id ?? 'novo'}`

  const dataUrl = searchParams.get('data')
  const [data, setData] = useState(dataUrl && dataValida(dataUrl) ? dataUrl : hoje())
  const [aberturaCaixa, setAberturaCaixa] = useState(0)
  const [fechamentoCaixa, setFechamentoCaixa] = useState(0)
  const [quantidadeVendida, setQuantidadeVendida] = useState(0)
  const [estragou, setEstragou] = useState<string[]>([])
  const [funcionariosQueComeram, setFuncionariosQueComeram] = useState<string[]>([])
  const [consumoLojaMensal, setConsumoLojaMensal] = useState<ConsumoItem[]>([])
  const [consumoLojaMotoboys, setConsumoLojaMotoboys] = useState<ConsumoItem[]>([])
  const [cortesiaClientes, setCortesiaClientes] = useState<ConsumoItem[]>([])
  const [sangrias, setSangrias] = useState<Sangria[]>([])
  const [estoqueQuente, setEstoqueQuente] = useState<EstoqueSnapshot>(ESTOQUE_VAZIO)
  const [imagem1, setImagem1] = useState<string | null>(null)
  const [imagem2, setImagem2] = useState<string | null>(null)

  const [carregando, setCarregando] = useState(editando)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [duplicadoId, setDuplicadoId] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const salvandoRef = useRef(false)
  const alertasRef = useRef<HTMLDivElement>(null)
  const [funcionarios, setFuncionarios] = useState<Funcionario[] | undefined>(undefined)
  const [acertoFechado, setAcertoFechado] = useState<{ mes: string; fechado: boolean } | null>(null)

  useEffect(() => {
    listarFuncionarios({ incluirInativos: true })
      .then(setFuncionarios)
      .catch(() => setFuncionarios(undefined))
  }, [])

  const mesDoRelatorio = dataValida(data) ? data.slice(0, 7) : null
  useEffect(() => {
    if (!mesDoRelatorio) return
    let ativo = true
    buscarAcerto(mesDoRelatorio)
      .then((a) => ativo && setAcertoFechado({ mes: mesDoRelatorio, fechado: Boolean(a) }))
      .catch(() => ativo && setAcertoFechado({ mes: mesDoRelatorio, fechado: false }))
    return () => {
      ativo = false
    }
  }, [mesDoRelatorio])
  const consumoTravado = acertoFechado?.mes === mesDoRelatorio && acertoFechado?.fechado === true

  function aplicarRelatorio(r: Awaited<ReturnType<typeof buscarRelatorioPorId>>) {
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
  }

  useEffect(() => {
    if (!id) return
    buscarRelatorioPorId(id)
      .then(aplicarRelatorio)
      .catch((e) => setErroCarregar(mensagemErro(e, 'Erro ao carregar o relatório.')))
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

  const rascunho = useRascunho<RascunhoRelatorio>({
    chave: chaveRascunho,
    dados: {
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
    },
    habilitado: !carregando && !erroCarregar,
    aplicar: (d) => {
      setData(d.data)
      setAberturaCaixa(d.aberturaCaixa)
      setFechamentoCaixa(d.fechamentoCaixa)
      setQuantidadeVendida(d.quantidadeVendida)
      setEstragou(d.estragou)
      setFuncionariosQueComeram(d.funcionariosQueComeram)
      setConsumoLojaMensal(d.consumoLojaMensal)
      setConsumoLojaMotoboys(d.consumoLojaMotoboys)
      setCortesiaClientes(d.cortesiaClientes)
      setSangrias(d.sangrias)
      setEstoqueQuente(d.estoqueQuente)
      setImagem1(d.imagem1)
      setImagem2(d.imagem2)
    },
  })

  function mostrarAlertas() {
    requestAnimationFrame(() => alertasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function salvar() {
    if (salvandoRef.current) return
    setErro(null)
    setDuplicadoId(null)
    setInfo(null)
    if (!dataValida(data)) {
      setErro('Informe uma data válida.')
      mostrarAlertas()
      return
    }
    salvandoRef.current = true
    setSalvando(true)
    try {
      const outro = await buscarIdRelatorioPorData(data, id)
      if (outro) {
        setDuplicadoId(outro)
        setErro(`Já existe um relatório de ${formatarDataBr(data)}. Edite o existente em vez de criar outro.`)
        mostrarAlertas()
        return
      }
      const salvo = id
        ? await atualizarRelatorio(id, payload(), { manterConsumoFuncionarios: consumoTravado })
        : await criarRelatorio(payload())
      rascunho.limpar()
      if (id) {
        aplicarRelatorio(salvo)
        setInfo('Relatório salvo.')
        mostrarAlertas()
      } else {
        navigate(`/relatorios/${salvo.id}`, { replace: true, state: { salvo: true } })
      }
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao salvar o relatório.'))
      mostrarAlertas()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  async function buscarFechamentosDoDia(): Promise<Fechamento[]> {
    return listarFechamentos({ dataInicio: data, dataFim: data })
  }

  /** Preenche abertura, fechamento e quantidade a partir do fechamento de caixa do mesmo dia. */
  async function puxarDoFechamento() {
    setErro(null)
    setInfo(null)
    setProcessando(true)
    try {
      const fechamentos = await buscarFechamentosDoDia()
      const f = fechamentos.find((x) => x.turno === 'manha') ?? fechamentos[0]
      if (!f) {
        setErro(`Não há fechamento de caixa salvo em ${formatarDataBr(data)}.`)
        return
      }
      setAberturaCaixa(f.lc.dinheiroAbertura)
      setFechamentoCaixa(f.lc.dinheiroFechamento)
      const qtd = totalMarmitas(f.marmitas)
      if (qtd > 0) setQuantidadeVendida(qtd)
      setInfo(
        `Puxado do fechamento: abertura ${formatarMoeda(f.lc.dinheiroAbertura)}, fechamento ${formatarMoeda(
          f.lc.dinheiroFechamento,
        )}${qtd > 0 ? `, ${qtd} marmitas` : ''}. Confira e ajuste se precisar.`,
      )
    } catch (e) {
      setErro(mensagemErro(e, 'Não consegui buscar o fechamento do dia.'))
    } finally {
      setProcessando(false)
    }
  }

  async function imprimir() {
    setErro(null)
    setProcessando(true)
    try {
      const [fechamentos, pdf] = await Promise.all([buscarFechamentosDoDia(), carregarPdf()])
      pdf.imprimirDiaCompleto({
        relatorio: { id: id ?? '', ...payload(), createdAt: '', updatedAt: '' },
        fechamentos,
      })
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao gerar a impressão.'))
      mostrarAlertas()
    } finally {
      setProcessando(false)
    }
  }

  async function baixarPdfWhatsApp() {
    setErro(null)
    setProcessando(true)
    try {
      const [fechamentos, pdf] = await Promise.all([buscarFechamentosDoDia(), carregarPdf()])
      const resultado = await pdf.gerarPdfWhatsApp({
        relatorio: { id: id ?? '', ...payload(), createdAt: '', updatedAt: '' },
        fechamentos,
        imagens: [imagem1, imagem2],
        compartilhar: true,
      })
      if (resultado === 'baixado') setInfo('PDF baixado. Agora é só anexar no WhatsApp.')
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao gerar o PDF.'))
      mostrarAlertas()
    } finally {
      setProcessando(false)
    }
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }
  if (erroCarregar) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <Link to="/relatorios" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Voltar aos relatórios
        </Link>
        <CaixaErro>{erroCarregar}</CaixaErro>
      </div>
    )
  }

  const recemCriado = Boolean((location.state as { salvo?: boolean } | null)?.salvo)
  const semana = diaDaSemana(data)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-40">
      <Link to="/relatorios" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Voltar aos relatórios
      </Link>
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {editando ? `Relatório de ${formatarDataBr(data)}` : 'Novo relatório do dia'}
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Só o que aconteceu de diferente no dia. Seções vazias não aparecem no PDF.
        </p>
      </header>

      {recemCriado && !info && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} className="shrink-0" /> Relatório salvo.
        </div>
      )}

      {rascunho.restaurado && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <History size={14} className="shrink-0" />
            Rascunho restaurado (salvo às {formatarHoraRascunho(rascunho.restaurado.salvoEm)}) — continue de onde parou.
          </span>
          <button type="button" onClick={rascunho.descartar} className="shrink-0 font-semibold underline">
            Descartar
          </button>
        </div>
      )}

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <div className="flex items-center gap-3">
            <input
              type="date"
              required
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            {semana && <span className="text-sm text-gray-400 dark:text-gray-500">{semana}</span>}
          </div>
        </label>
        <button
          type="button"
          onClick={puxarDoFechamento}
          disabled={processando}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline disabled:opacity-50"
        >
          <Download size={15} /> Puxar abertura, fechamento e marmitas do fechamento do dia
        </button>
        <div className="grid grid-cols-2 gap-3">
          <CampoMoeda label="Abertura do caixa" value={aberturaCaixa} onChange={setAberturaCaixa} somavel={false} />
          <CampoMoeda label="Fechamento do caixa" value={fechamentoCaixa} onChange={setFechamentoCaixa} somavel={false} />
        </div>
        <CampoInteiro label="Quantidade vendida" value={quantidadeVendida} onChange={setQuantidadeVendida} />
      </section>

      <Secao
        titulo="Estragou"
        resumo={estragou.length > 0 ? `${estragou.length} item(ns)` : 'Nenhum'}
        ajuda="Comida ou produto que foi perdido. Escreva quantidade e o que era."
      >
        <ListaLivre value={estragou} onChange={setEstragou} placeholder="Ex: 400g de arroz" />
      </Secao>

      <Secao
        titulo="Funcionários que comeram"
        resumo={funcionariosQueComeram.length > 0 ? funcionariosQueComeram.join(', ') : 'Nenhum'}
        ajuda="Toque no nome de quem comeu na loja hoje."
      >
        <SeletorFuncionarios value={funcionariosQueComeram} onChange={setFuncionariosQueComeram} />
      </Secao>

      <Secao
        titulo="Consumo de funcionários"
        resumo={`${consumoLojaMensal.length} lançamento(s)${consumoTravado ? ' · acerto fechado' : ''}`}
        ajuda="O que o funcionário consumiu na loja. Entra no Acerto do mês e é descontado do salário."
      >
        {consumoTravado && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            O acerto deste mês já foi fechado: o consumo de funcionários está travado. Para corrigir, reabra o acerto em
            Vales → Acerto do mês.
          </p>
        )}
        <ListaConsumo
          value={consumoLojaMensal}
          onChange={setConsumoLojaMensal}
          placeholderPessoa="Funcionário"
          funcionarios={funcionarios}
          travado={consumoTravado}
        />
      </Secao>

      <Secao titulo="Consumo loja motoboys" resumo={`${consumoLojaMotoboys.length} lançamento(s)`} ajuda="O que os motoboys consumiram.">
        <ListaConsumo value={consumoLojaMotoboys} onChange={setConsumoLojaMotoboys} placeholderPessoa="Motoboy" />
      </Secao>

      <Secao titulo="Cortesia clientes" resumo={`${cortesiaClientes.length} lançamento(s)`} ajuda="O que foi dado de cortesia a clientes.">
        <ListaConsumo value={cortesiaClientes} onChange={setCortesiaClientes} placeholderPessoa="Cliente" />
      </Secao>

      <Secao
        titulo="Sangrias"
        resumo={`${sangrias.length} sangria(s)`}
        alerta={sangrias.some((s) => s.valor > 0 && !s.motivo.trim())}
        ajuda="Retiradas de dinheiro do caixa, com o motivo."
      >
        <ListaValorMotivo value={sangrias} onChange={setSangrias} />
      </Secao>

      <Secao titulo="Estoque quente" ajuda="Quantidade de cada bebida/produto contada agora.">
        <EstoqueForm value={estoqueQuente} onChange={setEstoqueQuente} />
      </Secao>

      <Secao titulo="Anexos (PDF WhatsApp)" resumo={`${[imagem1, imagem2].filter(Boolean).length}/2 imagem(ns)`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
          Os 2 prints que você manda por fora todo dia — entram como páginas extras só no PDF para WhatsApp. Ficam
          salvos junto com o relatório, não precisa anexar de novo depois.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <AnexoImagem valor={imagem1} onChange={setImagem1} label="Print 1" onErro={setErro} />
          <AnexoImagem valor={imagem2} onChange={setImagem2} label="Print 2" onErro={setErro} />
        </div>
      </Secao>

      <div ref={alertasRef} className="space-y-3 scroll-mb-44">
        {info && (
          <div role="status" className="flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {info}
          </div>
        )}
        {erro && (
          <CaixaErro>
            {erro}{' '}
            {duplicadoId && (
              <Link to={`/relatorios/${duplicadoId}`} className="font-semibold underline">
                Abrir o relatório existente
              </Link>
            )}
          </CaixaErro>
        )}
      </div>

      {editando && id && (
        <div className="pt-2 flex">
          <BotaoExcluir
            rotulo="Excluir relatório"
            descricao={`Excluir o relatório de ${formatarDataBr(data)}? Os prints anexados também são apagados.`}
            onExcluir={async () => {
              try {
                await excluirRelatorio(id)
              } catch (e) {
                throw new Error(mensagemErro(e, 'Não foi possível excluir.'))
              }
              rascunho.limpar()
              navigate('/relatorios', { replace: true })
            }}
          />
        </div>
      )}

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={imprimir}
            disabled={processando}
            title="PDF para impressora térmica (80mm)"
            className="shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 text-[10px] font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            <Printer size={16} />
            Impressão
          </button>
          <button
            type="button"
            onClick={baixarPdfWhatsApp}
            disabled={processando}
            title="PDF completo para enviar no WhatsApp"
            className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            {processando ? 'Gerando...' : 'PDF WhatsApp'}
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

const LIMITE_IMAGEM = 3_500_000 // caracteres do base64 (~2,6 MB)

function AnexoImagem({
  valor,
  onChange,
  label,
  onErro,
}: {
  valor: string | null
  onChange: (dataUrl: string | null) => void
  label: string
  onErro: (mensagem: string) => void
}) {
  const [carregando, setCarregando] = useState(false)

  async function selecionar(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onErro('Escolha um arquivo de imagem (foto ou print).')
      return
    }
    setCarregando(true)
    try {
      const dataUrl = await lerComoBase64(file)
      let comprimida = await comprimirImagem(dataUrl)
      if (comprimida.length > LIMITE_IMAGEM) comprimida = await comprimirImagem(dataUrl, 1000, 0.7)
      if (comprimida.length > LIMITE_IMAGEM) {
        onErro('Imagem grande demais mesmo depois de comprimir. Tire um print menor.')
        return
      }
      onChange(comprimida)
    } catch {
      onErro('Não consegui abrir essa imagem. Tente outro formato (JPG ou PNG) ou tire um print da tela.')
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
          className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1.5 text-white"
          aria-label={`Remover ${label}`}
        >
          <X size={14} />
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
        className="sr-only"
        disabled={carregando}
        onChange={(e) => {
          selecionar(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </label>
  )
}

function CampoInteiro({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="0"
        className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-right tabular-nums outline-none focus:border-gray-500"
        value={value ? String(value) : ''}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').slice(0, 6)
          onChange(digitos ? parseInt(digitos, 10) : 0)
        }}
      />
    </label>
  )
}

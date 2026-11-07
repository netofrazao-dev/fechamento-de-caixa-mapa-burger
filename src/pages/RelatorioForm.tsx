import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Camera, CheckCircle2, ImagePlus, Images, Info, Loader2, Printer, X } from 'lucide-react'
import {
  adaptadorRelatorio,
  buscarIdRelatorioPorData,
  buscarRegistroRelatorio,
  excluirRelatorio,
} from '../lib/relatorioService'
import { listarFechamentos } from '../lib/fechamentoService'
import { carregarPdf, DICA_PAPEL_80MM } from '../lib/pdfSobDemanda'
import { mensagemErro } from '../lib/erros'
import { formatarMoeda, totalMarmitas } from '../lib/calculations'
import { BotaoExcluir, CaixaErro } from '../components/Avisos'
import { dataValida } from '../lib/vales'
import { listarFuncionarios } from '../lib/funcionarioService'
import { buscarAcerto } from '../lib/acertoService'
import { listarValesDoDia } from '../lib/valeService'
import type { Funcionario } from '../types/fechamento'
import { useSincronia } from '../lib/useSincronia'
import { useAtualizarAoVoltar } from '../lib/useAtualizarAoVoltar'
import { levarParaOutroDia, type RegistroBanco } from '../lib/sincronia'
import { localNavegador } from '../lib/sincroniaSupabase'
import { chaveRelatorioDoDia, DOC_RELATORIO } from '../lib/documentos'
import { legadoRelatorio } from '../lib/rascunhosLegados'
import { ehReferenciaFoto, type ConteudoRelatorio } from '../lib/mesclagem'
import { AvisosSincronia, LinhaSincronia } from '../components/StatusSincronia'
import Secao from '../components/Secao'
import SeletorFuncionarios from '../components/SeletorFuncionarios'
import ListaLivre from '../components/ListaLivre'
import ListaConsumo from '../components/ListaConsumo'
import SangriasRelatorio from '../components/SangriasRelatorio'
import { resumoSangrias } from '../lib/sangrias'
import EstoqueForm from '../components/EstoqueForm'
import type { ConsumoItem, EstoqueSnapshot, Fechamento, Sangria, Vale } from '../types/fechamento'
import { diaDaSemana, formatarDataBr, hojeLocal as hoje } from '../lib/datas'

const ESTOQUE_VAZIO: EstoqueSnapshot = { itens: [] }

/** Foto pronta para o PDF (a que ainda está chegando do outro aparelho fica de fora). */
const fotoParaPdf = (v: string | null) => (v && !ehReferenciaFoto(v) ? v : null)

export default function RelatorioForm() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const editando = Boolean(id)

  // Relatório novo: o dia vem do link (ou é hoje). Cada dia tem um rascunho só, o mesmo no PC e no celular.
  const dataUrl = searchParams.get('data')
  const diaDoLink = dataUrl && dataValida(dataUrl) ? dataUrl : hoje()

  const [data, setData] = useState(diaDoLink)
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

  // Edição: busca o relatório salvo primeiro (para saber de que dia ele é).
  const [registro, setRegistro] = useState<RegistroBanco<ConteudoRelatorio> | null>(null)
  const [carregando, setCarregando] = useState(editando)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const salvandoRef = useRef(false)
  const alertasRef = useRef<HTMLDivElement>(null)
  const [funcionarios, setFuncionarios] = useState<Funcionario[] | undefined>(undefined)
  const [acertoFechado, setAcertoFechado] = useState<{ mes: string; fechado: boolean } | null>(null)

  useEffect(() => {
    if (!id) return
    let ativo = true
    buscarRegistroRelatorio(id)
      .then((r) => ativo && setRegistro(r))
      .catch((e) => ativo && setErroCarregar(mensagemErro(e, 'Erro ao carregar o relatório.')))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [id])

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

  // Sincronia com o outro aparelho (rascunho do dia na nuvem + relatório salvo).
  const dataDocumento = editando ? (registro?.data ?? null) : diaDoLink
  const conteudo: ConteudoRelatorio = {
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
  }
  const aplicar = useCallback((c: ConteudoRelatorio) => {
    setData(c.data)
    setAberturaCaixa(c.aberturaCaixa)
    setFechamentoCaixa(c.fechamentoCaixa)
    setQuantidadeVendida(c.quantidadeVendida)
    setEstragou(c.estragou)
    setFuncionariosQueComeram(c.funcionariosQueComeram)
    setConsumoLojaMensal(c.consumoLojaMensal)
    setConsumoLojaMotoboys(c.consumoLojaMotoboys)
    setCortesiaClientes(c.cortesiaClientes)
    setSangrias(c.sangrias)
    setEstoqueQuente(c.estoqueQuente)
    setImagem1(c.imagem1)
    setImagem2(c.imagem2)
  }, [])
  const sinc = useSincronia<ConteudoRelatorio>({
    chave: dataDocumento && !erroCarregar ? chaveRelatorioDoDia(dataDocumento) : null,
    dataDocumento: dataDocumento ?? diaDoLink,
    tipo: DOC_RELATORIO,
    // Acerto do mês fechado: o consumo de funcionários não é regravado.
    banco: adaptadorRelatorio({ manterConsumoFuncionarios: consumoTravado }),
    conteudo,
    aplicar,
    registro: editando ? registro : undefined,
    legado: () => legadoRelatorio(id, dataDocumento ?? diaDoLink),
  })
  const idRegistro = id ?? sinc.estado.banco?.id ?? null
  const jaSalvo = Boolean(sinc.estado.banco)

  // Abertura e fechamento do dinheiro e marmitas vendidas vêm do fechamento do caixa do mesmo dia
  // (não se digita de novo aqui).
  // undefined = buscando; null = não há fechamento salvo nesse dia.
  const [fechamentoDoDia, setFechamentoDoDia] = useState<{ data: string; f: Fechamento | null; erro?: boolean } | undefined>(undefined)
  // Muda para buscar de novo (ao voltar para a tela e de tempos em tempos: o fechamento pode ser feito no outro aparelho).
  const [versaoDia, setVersaoDia] = useState(0)
  useAtualizarAoVoltar(() => setVersaoDia((v) => v + 1), 20_000)
  useEffect(() => {
    if (!dataValida(data)) return
    let ativo = true
    listarFechamentos({ dataInicio: data, dataFim: data })
      .then((lista) => ativo && setFechamentoDoDia({ data, f: lista.find((x) => x.turno === 'manha') ?? lista[0] ?? null }))
      .catch(() => ativo && setFechamentoDoDia((atual) => (atual?.data === data && atual.f ? atual : { data, f: null, erro: true })))
    return () => {
      ativo = false
    }
  }, [data, versaoDia])
  const fechamentoAtual = fechamentoDoDia?.data === data ? fechamentoDoDia : undefined
  const fDia = fechamentoAtual?.f ?? null
  // Com fechamento no dia, vale o dele. Sem fechamento, fica o que já estava salvo no relatório (relatórios antigos).
  const aberturaDoDia = fDia ? fDia.lc.dinheiroAbertura : aberturaCaixa
  const fechamentoDoDiaValor = fDia ? fDia.lc.dinheiroFechamento : fechamentoCaixa

  // Marmitas vendidas também vêm do fechamento (o contador de pratos de lá).
  const marmitasDoDia = fDia ? totalMarmitas(fDia.marmitas) : quantidadeVendida

  // Edição com a data trocada: já existe outro relatório nesse dia? Avisa antes de salvar.
  const [outroNaData, setOutroNaData] = useState<{ data: string; id: string | null } | null>(null)
  const dataMudou = editando && Boolean(registro) && data !== registro?.data
  useEffect(() => {
    if (!dataMudou || !dataValida(data)) return
    let ativo = true
    buscarIdRelatorioPorData(data, id)
      .then((outro) => ativo && setOutroNaData({ data, id: outro }))
      .catch(() => undefined)
    return () => {
      ativo = false
    }
  }, [data, dataMudou, id])
  const outroId = dataMudou && outroNaData?.data === data ? outroNaData.id : null

  // Vales do dia: são sangrias (saem do caixa) e ficam na tabela de vales (acerto do mês).
  const [valesDoDia, setValesDoDia] = useState<{ data: string; vales: Vale[] | null; erro?: string } | undefined>(undefined)
  const [versaoVales, setVersaoVales] = useState(0)
  useEffect(() => {
    if (!dataValida(data)) return
    let ativo = true
    listarValesDoDia(data)
      .then((vales) => ativo && setValesDoDia({ data, vales }))
      .catch((e) =>
        ativo &&
        setValesDoDia((atual) =>
          atual?.data === data && atual.vales?.length ? atual : { data, vales: [], erro: mensagemErro(e, 'Não consegui carregar os vales do dia.') },
        ),
      )
    return () => {
      ativo = false
    }
  }, [data, versaoVales, versaoDia])
  const valesAtuais = valesDoDia?.data === data ? valesDoDia : undefined

  /** Vales do dia na hora de gerar PDF/impressão (busca de novo para não perder nenhum). */
  async function valesParaPdf(dia: string): Promise<Vale[]> {
    try {
      return await listarValesDoDia(dia)
    } catch {
      return valesAtuais?.vales ?? []
    }
  }

  /** Valores que vêm do fechamento do dia (abertura, fechamento do dinheiro, marmitas). */
  function comValoresDoFechamento(c: ConteudoRelatorio): ConteudoRelatorio {
    return {
      ...c,
      aberturaCaixa: fDia ? fDia.lc.dinheiroAbertura : c.aberturaCaixa,
      fechamentoCaixa: fDia ? fDia.lc.dinheiroFechamento : c.fechamentoCaixa,
      quantidadeVendida: fDia ? totalMarmitas(fDia.marmitas) : c.quantidadeVendida,
    }
  }

  function mostrarAlertas() {
    requestAnimationFrame(() => alertasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  /** Relatório novo: trocar a data abre o relatório daquele dia (levando junto o que foi preenchido aqui). */
  async function trocarDia(dia: string) {
    if (!dataValida(dia) || dia > hoje() || dia === dataDocumento) return
    let levar = !jaSalvo && sinc.estado.pendente
    if (levar) {
      try {
        // Se o outro dia já tem relatório salvo, abre ele e deixa o que foi preenchido guardado neste dia.
        levar = !(await buscarIdRelatorioPorData(dia))
      } catch {
        levar = false
      }
    }
    if (levar) {
      levarParaOutroDia(localNavegador, DOC_RELATORIO, chaveRelatorioDoDia(dia), dia, conteudo)
      await sinc.descartar()
    }
    navigate(`/relatorios/novo?data=${dia}`, { replace: true })
  }

  async function salvar() {
    if (salvandoRef.current) return
    setErro(null)
    setInfo(null)
    if (!dataValida(data)) {
      setErro('Informe uma data válida.')
      mostrarAlertas()
      return
    }
    if (sangrias.some((s) => s.valor > 0 && !s.motivo.trim())) {
      setErro('Toda sangria (compra, pagamento ou PIX) com valor precisa ter um motivo escrito.')
      mostrarAlertas()
      return
    }
    if (outroId) {
      setErro(`Já existe um relatório de ${formatarDataBr(data)}. Troque a data ou abra o relatório desse dia.`)
      mostrarAlertas()
      return
    }
    salvandoRef.current = true
    setSalvando(true)
    try {
      // Junta com o que o outro aparelho fez e grava só se ninguém gravou no meio.
      const r = await sinc.salvar(comValoresDoFechamento)
      const aviso = textoJuntou(r.juntou, r.conflitos)
      if (!editando) {
        navigate(`/relatorios/${r.registro.id}`, { replace: true, state: { salvo: true, aviso } })
      } else {
        setInfo(`Relatório salvo.${aviso ? ` ${aviso}` : ''}`)
        mostrarAlertas()
      }
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao salvar o relatório.'))
      mostrarAlertas()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  async function buscarFechamentosDoDia(dia: string): Promise<Fechamento[]> {
    return listarFechamentos({ dataInicio: dia, dataFim: dia })
  }

  /** Relatório do jeito que está agora (já com o que chegou do outro aparelho), para PDF e impressão. */
  async function relatorioAtual() {
    const c = comValoresDoFechamento(await sinc.conteudoAtualizado())
    return { c, relatorio: { id: idRegistro ?? '', ...c, imagem1: fotoParaPdf(c.imagem1), imagem2: fotoParaPdf(c.imagem2), createdAt: '', updatedAt: '' } }
  }

  async function imprimir() {
    setErro(null)
    setProcessando(true)
    try {
      const { c, relatorio } = await relatorioAtual()
      const [fechamentos, pdf, vales] = await Promise.all([buscarFechamentosDoDia(c.data), carregarPdf(), valesParaPdf(c.data)])
      pdf.imprimirDiaCompleto({ relatorio, fechamentos, vales })
      // Com papel "Carta"/A4 a impressora térmica solta uma folha inteira de papel em branco.
      setInfo(DICA_PAPEL_80MM)
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
      const { c, relatorio } = await relatorioAtual()
      const [fechamentos, pdf] = await Promise.all([buscarFechamentosDoDia(c.data), carregarPdf()])
      const vales = await valesParaPdf(c.data)
      const resultado = await pdf.gerarPdfWhatsApp({
        relatorio,
        fechamentos,
        vales,
        imagens: [relatorio.imagem1, relatorio.imagem2],
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

  const descartarAlteracoes = useCallback(async () => {
    await sinc.descartar()
    window.location.reload()
  }, [sinc])

  if (carregando || (!erroCarregar && !sinc.estado.pronto)) {
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

  const estadoNavegacao = location.state as { salvo?: boolean; aviso?: string } | null
  const recemCriado = Boolean(estadoNavegacao?.salvo)
  const semana = diaDaSemana(data)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-44">
      <Link to="/relatorios" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Voltar aos relatórios
      </Link>
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {editando || jaSalvo ? `Relatório de ${formatarDataBr(data)}` : 'Novo relatório do dia'}
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Só o que aconteceu de diferente no dia. Seções vazias não aparecem no PDF. Dá para preencher no PC e no celular ao
          mesmo tempo.
        </p>
      </header>

      {recemCriado && !info && (
        <div role="status" className="flex items-start gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Relatório salvo.{estadoNavegacao?.aviso ? ` ${estadoNavegacao.aviso}` : ''}
        </div>
      )}

      <AvisosSincronia estado={sinc.estado} nome="relatório" onFecharChegou={sinc.limparAviso} onDescartar={descartarAlteracoes} />

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <div className="flex items-center gap-3">
            <input
              type="date"
              required
              max={hoje()}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500"
              value={data}
              onChange={(e) => (editando ? setData(e.target.value) : void trocarDia(e.target.value))}
            />
            {semana && <span className="text-sm text-gray-400 dark:text-gray-500">{semana}</span>}
          </div>
        </label>
        {!editando && jaSalvo && idRegistro && (
          <p className="flex gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3.5 py-2.5 text-sm text-sky-900 dark:text-sky-200">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>
              Este dia já tem relatório salvo (antes ou no outro aparelho): você está continuando ele. O que mudar aqui é juntado
              quando salvar.
            </span>
          </p>
        )}
        {outroId && (
          <p role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200">
            Já existe um relatório de {formatarDataBr(data)}.{' '}
            <Link to={`/relatorios/${outroId}`} className="font-semibold underline">
              Abrir o relatório
            </Link>{' '}
            ou troque a data acima.
          </p>
        )}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3.5 py-3 space-y-2" aria-label="Dados do fechamento do dia">
          <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Do fechamento do caixa</p>
          {!fechamentoAtual ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Buscando o fechamento do dia...</p>
          ) : fDia ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Abertura</p>
                  <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(aberturaDoDia)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Fechamento</p>
                  <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatarMoeda(fechamentoDoDiaValor)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Marmitas</p>
                  <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{marmitasDoDia}</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Vem do fechamento do caixa deste dia, sem precisar digitar de novo. Para mudar,{' '}
                <Link to={`/fechamento/${fDia.id}`} className="font-semibold underline">
                  abra o fechamento
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {fechamentoAtual.erro
                  ? 'Não consegui buscar o fechamento do dia agora (sem internet?).'
                  : `Ainda não há fechamento do caixa em ${formatarDataBr(data)}.`}{' '}
                A abertura, o fechamento do dinheiro e as marmitas vendidas vêm de lá automaticamente.
              </p>
              {!fechamentoAtual.erro && (
                <Link to={`/novo?data=${data}`} className="inline-block text-sm font-semibold text-gray-900 dark:text-gray-100 underline">
                  Fazer o fechamento do caixa
                </Link>
              )}
              {(aberturaCaixa > 0 || fechamentoCaixa > 0 || quantidadeVendida > 0) && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Anotado antes neste relatório: abertura {formatarMoeda(aberturaCaixa)} · fechamento {formatarMoeda(fechamentoCaixa)} ·{' '}
                  {quantidadeVendida} marmitas.
                </p>
              )}
            </>
          )}
        </div>
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
        resumo={resumoSecaoSangrias(sangrias, valesAtuais?.vales ?? [])}
        alerta={sangrias.some((s) => s.valor > 0 && !s.motivo.trim())}
        ajuda="Compras, pagamentos e vales com dinheiro do caixa (entram no total de sangrias) e compras no PIX do patrão (só registradas). Saem no PDF do dia junto com o fechamento. Não mexem no Total LC."
      >
        <SangriasRelatorio
          value={sangrias}
          onChange={setSangrias}
          data={data}
          vales={valesAtuais ? valesAtuais.vales : dataValida(data) ? null : []}
          erroVales={valesAtuais?.erro}
          onValesMudou={({ lancado, excluidoId }) => {
            // Atualiza na hora (lista e total) e depois confere de novo com o banco.
            setValesDoDia((atual) =>
              atual && atual.vales
                ? {
                    ...atual,
                    vales: [...atual.vales.filter((v) => v.id !== excluidoId && v.id !== lancado?.id), ...(lancado ? [lancado] : [])],
                  }
                : atual,
            )
            setVersaoVales((v) => v + 1)
          }}
        />
      </Secao>

      <Secao titulo="Estoque quente" ajuda="Quantidade de cada bebida/produto contada agora.">
        <EstoqueForm value={estoqueQuente} onChange={setEstoqueQuente} />
      </Secao>

      <Secao titulo="Anexos (PDF WhatsApp)" resumo={`${[imagem1, imagem2].filter(Boolean).length}/2 imagem(ns)`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">
          Os 2 prints ou fotos que você manda por fora todo dia: tire a foto na hora ou escolha da galeria. Entram como
          páginas extras só no PDF para WhatsApp e ficam salvos junto com o relatório.
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
            {outroId && (
              <Link to={`/relatorios/${outroId}`} className="font-semibold underline">
                Abrir o relatório existente
              </Link>
            )}
          </CaixaErro>
        )}
      </div>

      {idRegistro && (
        <div className="pt-2 flex">
          <BotaoExcluir
            rotulo="Excluir relatório"
            descricao={`Excluir o relatório de ${formatarDataBr(data)}? Os prints anexados também são apagados.`}
            onExcluir={async () => {
              try {
                await excluirRelatorio(idRegistro)
              } catch (e) {
                throw new Error(mensagemErro(e, 'Não foi possível excluir.'))
              }
              sinc.esquecer()
              navigate('/relatorios', { replace: true })
            }}
          />
        </div>
      )}

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto px-1 pb-1.5 min-h-[1rem]">
          <LinhaSincronia estado={sinc.estado} />
        </div>
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
      // Limita a largura e também a altura (foto de celular em pé é bem alta).
      const alturaMaxima = Math.round(larguraMaxima * 1.45)
      const escala = Math.min(larguraMaxima / img.naturalWidth, alturaMaxima / img.naturalHeight, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * escala)
      canvas.height = Math.round(img.naturalHeight * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      // JPEG não tem transparência: sem fundo branco, partes transparentes do print ficariam pretas.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
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

  if (valor && ehReferenciaFoto(valor)) {
    return (
      <div className="relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 aspect-square p-2 text-center text-xs text-gray-500 dark:text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Recebendo a foto do outro aparelho...
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

  const aoEscolher = (e: ChangeEvent<HTMLInputElement>) => {
    selecionar(e.target.files?.[0])
    e.target.value = '' // permite escolher a mesma foto de novo
  }
  const botao =
    'flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold cursor-pointer select-none has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gray-400'

  return (
    <div className="flex flex-col justify-center gap-2 aspect-square rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-2.5">
      <p className="flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <ImagePlus size={14} /> {carregando ? 'Preparando a foto...' : label}
      </p>
      {/* No celular, "capture" abre a câmera direto (câmera de trás). */}
      <label className={`${botao} bg-gray-900 dark:bg-gray-700 text-white`}>
        <Camera size={15} /> Tirar foto
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={carregando}
          aria-label={`Tirar foto para o ${label}`}
          onChange={aoEscolher}
        />
      </label>
      <label className={`${botao} bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300`}>
        <Images size={15} /> Da galeria
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={carregando}
          aria-label={`Escolher ${label} da galeria`}
          onChange={aoEscolher}
        />
      </label>
    </div>
  )
}

/** Resumo da seção fechada: "Sangrias R$ 142,50 · 1 vale(s) · PIX R$ 80,00". */
function resumoSecaoSangrias(sangrias: Sangria[], vales: Vale[]): string {
  if (sangrias.length === 0 && vales.length === 0) return 'Nenhuma'
  const r = resumoSangrias(sangrias, vales)
  const partes = [`Sangrias ${formatarMoeda(r.totalSangrias)}`]
  if (r.vales.length > 0) partes.push(`${r.vales.length} vale(s)`)
  if (r.pix.length > 0) partes.push(`PIX ${formatarMoeda(r.totalPix)}`)
  if (sangrias.some((s) => s.valor > 0 && !s.motivo.trim())) partes.push('falta motivo')
  return partes.join(' · ')
}

/** "Juntei com o que veio do outro aparelho: Estoque, Print 1." */
function textoJuntou(juntou: string[], conflitos: string[]): string {
  const partes: string[] = []
  if (juntou.length > 0) partes.push(`Juntei com o que veio do outro aparelho: ${juntou.join(', ')}.`)
  if (conflitos.length > 0) partes.push(`Mudado nos dois aparelhos (ficou o deste): ${conflitos.join(', ')}.`)
  return partes.join(' ')
}


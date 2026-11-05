import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { History, Info } from 'lucide-react'
import LCForm from '../components/LCForm'
import BrendiForm from '../components/BrendiForm'
import ResultadoCard from '../components/ResultadoCard'
import ContadorPratos from '../components/ContadorPratos'
import Secao from '../components/Secao'
import { CaixaErro, PainelAvisos } from '../components/Avisos'
import { calcularResultado, formatarMoeda, STATUS_LABEL, totalMarmitas } from '../lib/calculations'
import {
  atualizarFechamento,
  buscarFechamentoPorId,
  buscarIdFechamento,
  criarFechamento,
  listarFechamentos,
  normalizarFechamento,
} from '../lib/fechamentoService'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { formatarHoraRascunho } from '../lib/draft'
import { useRascunho } from '../lib/useRascunho'
import { avisosFechamento, errosFechamento } from '../lib/conferencia'
import { dataValida, somarValores } from '../lib/vales'
import { mensagemErro } from '../lib/erros'
import type { Ajuste, DadosBrendi, DadosLC, Fechamento, MarmitaItem, NovoFechamentoInput, Sangria, Turno } from '../types/fechamento'
import { diaDaSemana, formatarDataBr, hojeLocal as hoje, somarDias } from '../lib/datas'

const LC_VAZIO: DadosLC = {
  dinheiroAbertura: 0,
  dinheiroFechamento: 0,
  pix: 0,
  debito: 0,
  credito: 0,
  consumoLoja: 0,
  aPrazo: 0,
  ticket: 0,
}

const BRENDI_VAZIO: DadosBrendi = { pix: 0, debito: 0, credito: 0, creditoOnline: 0, dinheiro: 0 }
const AJUSTE_VAZIO: Ajuste = { tipo: null, valor: 0 }

// Só o turno da manhã é usado em novos fechamentos (o da noite foi desativado).
// Ao editar um fechamento antigo, o turno original dele é mantido.
const TURNO_PADRAO: Turno = 'manha'

const COR_STATUS_RODAPE = {
  fechou: 'text-green-600 dark:text-green-400',
  sobrou: 'text-blue-600 dark:text-blue-400',
  faltou: 'text-red-600 dark:text-red-400',
} as const

interface RascunhoFechamento {
  data: string
  lc: DadosLC
  brendi: DadosBrendi
  sangrias: Sangria[]
  marmitas: MarmitaItem[]
  totalLCSistema: number
  ajuste: Ajuste
  observacoes: string
}

export default function NovoFechamento() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editando = Boolean(id)
  const [searchParams] = useSearchParams()
  const dataInicial = searchParams.get('data')
  // Aberto pelo link de outro dia (ex.: "ontem ficou sem fechamento"): rascunho próprio daquele dia,
  // pra não misturar com o rascunho do fechamento de hoje.
  const dataDoLink = !id && dataInicial && dataValida(dataInicial) && dataInicial !== hoje() ? dataInicial : null
  const chaveRascunho = id
    ? `mapa-burger-rascunho-fechamento-${id}`
    : dataDoLink
      ? `mapa-burger-rascunho-fechamento-dia-${dataDoLink}`
      : 'mapa-burger-rascunho-fechamento'

  const [turno, setTurno] = useState<Turno>(TURNO_PADRAO)
  const [data, setData] = useState(() => (dataInicial && dataValida(dataInicial) ? dataInicial : hoje()))
  const [lc, setLc] = useState<DadosLC>(LC_VAZIO)
  const [brendi, setBrendi] = useState<DadosBrendi>(BRENDI_VAZIO)
  const [sangrias, setSangrias] = useState<Sangria[]>([])
  const [marmitas, setMarmitas] = useState<MarmitaItem[]>([])
  const [totalLCSistema, setTotalLCSistema] = useState(0)
  const [ajuste, setAjuste] = useState<Ajuste>(AJUSTE_VAZIO)
  const [observacoes, setObservacoes] = useState('')

  const [carregando, setCarregando] = useState(editando)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [duplicadoId, setDuplicadoId] = useState<string | null>(null)
  const [pendencia, setPendencia] = useState<{ avisos: string[]; chave: string } | null>(null)

  const salvandoRef = useRef(false)
  const alertasRef = useRef<HTMLDivElement>(null)

  // Ao editar, carrega o fechamento salvo.
  useEffect(() => {
    if (!id) return
    let ativo = true
    buscarFechamentoPorId(id)
      .then((f) => {
        if (!ativo) return
        setTurno(f.turno)
        setData(f.data)
        setLc(f.lc)
        setBrendi(f.brendi)
        setSangrias(f.sangrias)
        setMarmitas(f.marmitas)
        setTotalLCSistema(f.totalLCSistema)
        setAjuste(f.ajuste.tipo ? f.ajuste : AJUSTE_VAZIO)
        setObservacoes(f.observacoes)
      })
      .catch((e) => ativo && setErroCarregar(mensagemErro(e, 'Erro ao carregar o fechamento.')))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [id])

  // Fechamento novo: já existe um salvo nesta data? Avisa logo, antes de preencher tudo.
  const [existenteNaData, setExistenteNaData] = useState<{ data: string; id: string | null } | null>(null)
  useEffect(() => {
    if (editando || !dataValida(data)) return
    let ativo = true
    buscarIdFechamento(data, turno)
      .then((idExistente) => ativo && setExistenteNaData({ data, id: idExistente }))
      .catch(() => {
        // sem internet: a conferência acontece de novo na hora de salvar
      })
    return () => {
      ativo = false
    }
  }, [data, turno, editando])
  const jaExisteId = existenteNaData?.data === data ? existenteNaData.id : null

  // Últimos 45 dias antes da data: para perceber valor digitado fora do normal (ex.: 15050 em vez de 150,50).
  const [historico, setHistorico] = useState<{ data: string; dias: Fechamento[] } | null>(null)
  useEffect(() => {
    if (!dataValida(data)) return
    let ativo = true
    listarFechamentos({ dataInicio: somarDias(data, -45), dataFim: somarDias(data, -1) })
      .then((dias) => ativo && setHistorico({ data, dias }))
      .catch(() => {
        // sem histórico (sem internet): só não compara
      })
    return () => {
      ativo = false
    }
  }, [data])

  const resultado = useMemo(
    () => calcularResultado({ lc, brendi, totalLCSistema, ajuste }),
    [lc, brendi, totalLCSistema, ajuste],
  )

  // Rascunho automático (navegador + Supabase, sincroniza entre aparelhos).
  const rascunho = useRascunho<RascunhoFechamento>({
    chave: chaveRascunho,
    dados: { data, lc, brendi, sangrias, marmitas, totalLCSistema, ajuste, observacoes },
    habilitado: !carregando && !erroCarregar,
    aplicar: (d) => {
      setData(d.data)
      setLc({ ...LC_VAZIO, ...d.lc })
      setBrendi({ ...BRENDI_VAZIO, ...d.brendi })
      setSangrias(d.sangrias ?? [])
      setMarmitas(d.marmitas ?? [])
      setTotalLCSistema(d.totalLCSistema ?? 0)
      setAjuste(d.ajuste ?? AJUSTE_VAZIO)
      setObservacoes(d.observacoes ?? '')
    },
  })

  function montarInput(): NovoFechamentoInput {
    return { data, turno, lc, brendi, sangrias, marmitas, totalLCSistema, ajuste, observacoes }
  }

  function mostrarAlertas() {
    requestAnimationFrame(() => alertasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function salvar(confirmado = false) {
    if (salvandoRef.current) return
    setErro(null)
    setDuplicadoId(null)

    const input = normalizarFechamento(montarInput())
    const erros = errosFechamento(montarInput())
    if (erros.length > 0) {
      setErro(erros.join(' '))
      mostrarAlertas()
      return
    }

    const chave = JSON.stringify(input)
    if (!confirmado) {
      const recentes = historico?.data === input.data ? historico.dias.filter((f) => f.id !== id) : []
      const avisos = avisosFechamento(input, calcularResultado(input), hoje(), recentes)
      if (avisos.length > 0) {
        setPendencia({ avisos, chave })
        mostrarAlertas()
        return
      }
    }
    setPendencia(null)

    salvandoRef.current = true
    setSalvando(true)
    try {
      const existente = await buscarIdFechamento(input.data, input.turno, id)
      if (existente) {
        setDuplicadoId(existente)
        setErro(`Já existe um fechamento salvo para ${formatarDataBr(input.data)}.`)
        mostrarAlertas()
        return
      }

      if (id) {
        await atualizarFechamento(id, input)
        rascunho.limpar()
        navigate(`/fechamento/${id}`, { state: { salvo: 'Alterações salvas.' } })
      } else {
        const fechamento = await criarFechamento(input)
        rascunho.limpar()
        let pdfBaixado = false
        try {
          const pdf = await carregarPdf()
          pdf.gerarPdfFechamento(fechamento)
          pdfBaixado = true
        } catch {
          // Salvo mesmo sem PDF; dá pra gerar depois na tela do fechamento.
        }
        navigate(`/fechamento/${fechamento.id}`, { state: { salvo: 'Fechamento salvo.', pdfBaixado } })
      }
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao salvar o fechamento.'))
      mostrarAlertas()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }
  if (erroCarregar) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <Link to="/historico" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Voltar ao histórico
        </Link>
        <CaixaErro>{erroCarregar}</CaixaErro>
      </div>
    )
  }

  // A confirmação só vale para os mesmos dados que foram conferidos.
  const avisosVisiveis =
    pendencia && pendencia.chave === JSON.stringify(normalizarFechamento(montarInput())) ? pendencia.avisos : null
  const semana = diaDaSemana(data)

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-44">
      {editando && (
        <Link to={`/fechamento/${id}`} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Cancelar edição
        </Link>
      )}
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {editando ? 'Editar fechamento' : 'Fechamento do caixa'}
        </h1>
        {!editando && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Preencha de cima para baixo. O resultado aparece embaixo, na hora.
          </p>
        )}
      </header>

      {rascunho.restaurado && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <History size={14} className="shrink-0" />
            Rascunho restaurado (salvo {formatarHoraRascunho(rascunho.restaurado.salvoEm)}) — continue de onde parou.
          </span>
          <button type="button" onClick={rascunho.descartar} className="shrink-0 font-semibold underline">
            Descartar
          </button>
        </div>
      )}

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data do fechamento</span>
          <div className="flex items-center gap-3">
            <input
              type="date"
              required
              max={hoje()}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            {semana && <span className="text-sm text-gray-400 dark:text-gray-500">{semana}</span>}
          </div>
        </label>
        {jaExisteId && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200">
            Já existe um fechamento salvo em {formatarDataBr(data)}.{' '}
            <Link to={`/fechamento/${jaExisteId}`} className="font-semibold underline">
              Abrir o fechamento
            </Link>{' '}
            ou troque a data acima.
          </p>
        )}
      </section>

      <Secao
        titulo="1. Marmitas vendidas"
        resumo={`Total: ${totalMarmitas(marmitas)}`}
        ajuda="Toque no + de cada prato vendido."
      >
        <ContadorPratos value={marmitas} onChange={setMarmitas} />
      </Secao>

      <LCForm value={lc} onChange={setLc} defaultAberto />
      <BrendiForm value={brendi} onChange={setBrendi} />
      {sangrias.length > 0 && (
        // Fechamentos antigos podem ter sangrias lançadas aqui. Agora elas ficam só no Relatório do dia.
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3.5 text-sm text-blue-900 dark:text-blue-200 space-y-2">
          <p className="flex gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>
              Este fechamento tem {sangrias.length} sangria(s) lançada(s) antes (
              {formatarMoeda(somarValores(sangrias.map((s) => s.valor)))}):{' '}
              {sangrias.map((s) => s.motivo.trim() || 'sem motivo').join(', ')}. Agora as sangrias ficam só no{' '}
              <strong>Relatório do dia</strong>.
            </span>
          </p>
          <button type="button" onClick={() => setSangrias([])} className="text-xs font-semibold underline">
            Tirar do fechamento (lance no relatório)
          </button>
        </div>
      )}
      <ResultadoCard
        resultado={resultado}
        totalLCSistema={totalLCSistema}
        onTotalLCSistemaChange={setTotalLCSistema}
        ajuste={ajuste}
        onAjusteChange={setAjuste}
        observacoes={observacoes}
        onObservacoesChange={setObservacoes}
      />

      <div ref={alertasRef} className="space-y-3 scroll-mb-44">
        {erro && (
          <CaixaErro>
            {erro}{' '}
            {duplicadoId && (
              <Link to={`/fechamento/${duplicadoId}`} className="font-semibold underline">
                Abrir o fechamento existente
              </Link>
            )}
          </CaixaErro>
        )}
        {avisosVisiveis && (
          <PainelAvisos
            avisos={avisosVisiveis}
            ocupado={salvando}
            onCorrigir={() => setPendencia(null)}
            onConfirmar={() => salvar(true)}
          />
        )}
      </div>

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-gray-500 dark:text-gray-400">
              Caixa {formatarMoeda(resultado.totalCaixa)} · Sistema {formatarMoeda(resultado.totalSistema)}
            </span>
            <span className={`font-semibold ${COR_STATUS_RODAPE[resultado.status]}`}>
              {STATUS_LABEL[resultado.status]}
              {resultado.status !== 'fechou' && ` ${formatarMoeda(Math.abs(resultado.diferencaFinal))}`}
            </span>
          </div>
          <button
            type="button"
            disabled={salvando}
            onClick={() => salvar()}
            className="w-full rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-white text-sm font-semibold disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar e gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

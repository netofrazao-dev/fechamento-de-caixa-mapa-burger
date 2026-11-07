import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import LCForm from '../components/LCForm'
import BrendiForm from '../components/BrendiForm'
import ResultadoCard from '../components/ResultadoCard'
import ContadorPratos from '../components/ContadorPratos'
import Secao from '../components/Secao'
import { CaixaErro, PainelAvisos } from '../components/Avisos'
import { AvisosSincronia, LinhaSincronia } from '../components/StatusSincronia'
import { calcularResultado, formatarMoeda, STATUS_LABEL, totalMarmitas } from '../lib/calculations'
import {
  adaptadorFechamento,
  buscarFechamentoPorId,
  buscarIdFechamento,
  buscarRegistroFechamento,
  listarFechamentos,
  normalizarFechamento,
} from '../lib/fechamentoService'
import { carregarPdf } from '../lib/pdfSobDemanda'
import { useSincronia } from '../lib/useSincronia'
import { levarParaOutroDia, type RegistroBanco } from '../lib/sincronia'
import { localNavegador } from '../lib/sincroniaSupabase'
import { chaveFechamentoDoDia, DOC_FECHAMENTO } from '../lib/documentos'
import { legadoFechamento } from '../lib/rascunhosLegados'
import { AJUSTE_VAZIO, BRENDI_VAZIO, LC_VAZIO, type ConteudoFechamento } from '../lib/mesclagem'
import { avisosFechamento, errosFechamento } from '../lib/conferencia'
import { dataValida, somarValores } from '../lib/vales'
import { mensagemErro } from '../lib/erros'
import type { Ajuste, DadosBrendi, DadosLC, Fechamento, MarmitaItem, NovoFechamentoInput, Sangria, Turno } from '../types/fechamento'
import { diaDaSemana, formatarDataBr, hojeLocal as hoje, somarDias } from '../lib/datas'

// Só o turno da manhã é usado em novos fechamentos (o da noite foi desativado).
// Ao editar um fechamento antigo, o turno original dele é mantido.
const TURNO_PADRAO: Turno = 'manha'

const COR_STATUS_RODAPE = {
  fechou: 'text-green-600 dark:text-green-400',
  sobrou: 'text-blue-600 dark:text-blue-400',
  faltou: 'text-red-600 dark:text-red-400',
} as const

export default function NovoFechamento() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editando = Boolean(id)
  const [searchParams] = useSearchParams()
  const dataInicial = searchParams.get('data')
  // Fechamento novo: o dia vem do link (ou é hoje). Cada dia tem um rascunho só, o mesmo no PC e no celular.
  const diaDoLink = dataInicial && dataValida(dataInicial) ? dataInicial : hoje()

  const [turno, setTurno] = useState<Turno>(TURNO_PADRAO)
  const [data, setData] = useState(diaDoLink)
  const [lc, setLc] = useState<DadosLC>(LC_VAZIO)
  const [brendi, setBrendi] = useState<DadosBrendi>(BRENDI_VAZIO)
  const [sangrias, setSangrias] = useState<Sangria[]>([])
  const [marmitas, setMarmitas] = useState<MarmitaItem[]>([])
  const [totalLCSistema, setTotalLCSistema] = useState(0)
  const [ajuste, setAjuste] = useState<Ajuste>(AJUSTE_VAZIO)
  const [observacoes, setObservacoes] = useState('')

  const [registro, setRegistro] = useState<RegistroBanco<ConteudoFechamento> | null>(null)
  const [carregando, setCarregando] = useState(editando)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [duplicadoId, setDuplicadoId] = useState<string | null>(null)
  const [pendencia, setPendencia] = useState<{ avisos: string[]; chave: string } | null>(null)

  const salvandoRef = useRef(false)
  const alertasRef = useRef<HTMLDivElement>(null)

  // Ao editar, carrega o fechamento salvo (para saber o dia e o turno dele).
  useEffect(() => {
    if (!id) return
    let ativo = true
    buscarRegistroFechamento(id)
      .then(({ fechamento, registro: r }) => {
        if (!ativo) return
        setTurno(fechamento.turno)
        setRegistro(r)
      })
      .catch((e) => ativo && setErroCarregar(mensagemErro(e, 'Erro ao carregar o fechamento.')))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [id])

  // Sincronia com o outro aparelho (rascunho do dia na nuvem + fechamento salvo).
  const dataDocumento = editando ? (registro?.data ?? null) : diaDoLink
  const conteudo: ConteudoFechamento = { data, lc, brendi, sangrias, marmitas, totalLCSistema, ajuste, observacoes }
  const aplicar = useCallback((c: ConteudoFechamento) => {
    setData(c.data)
    setLc({ ...LC_VAZIO, ...c.lc })
    setBrendi({ ...BRENDI_VAZIO, ...c.brendi })
    setSangrias(c.sangrias ?? [])
    setMarmitas(c.marmitas ?? [])
    setTotalLCSistema(c.totalLCSistema ?? 0)
    setAjuste(c.ajuste?.tipo ? c.ajuste : AJUSTE_VAZIO)
    setObservacoes(c.observacoes ?? '')
  }, [])
  const sinc = useSincronia<ConteudoFechamento>({
    chave: dataDocumento && !erroCarregar && !carregando ? chaveFechamentoDoDia(dataDocumento, turno) : null,
    dataDocumento: dataDocumento ?? diaDoLink,
    tipo: DOC_FECHAMENTO,
    banco: adaptadorFechamento(turno),
    conteudo,
    aplicar,
    registro: editando ? registro : undefined,
    legado: () => legadoFechamento(id, dataDocumento ?? diaDoLink),
  })
  const jaSalvo = Boolean(sinc.estado.banco)

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

  function montarInput(): NovoFechamentoInput {
    return { data, turno, lc, brendi, sangrias, marmitas, totalLCSistema, ajuste, observacoes }
  }

  function mostrarAlertas() {
    requestAnimationFrame(() => alertasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  /** Fechamento novo: trocar a data abre o fechamento daquele dia (levando junto o que foi preenchido aqui). */
  async function trocarDia(dia: string) {
    if (!dataValida(dia) || dia > hoje() || dia === dataDocumento) return
    let levar = !jaSalvo && sinc.estado.pendente
    if (levar) {
      try {
        // Se o outro dia já tem fechamento salvo, abre ele e deixa o que foi preenchido guardado neste dia.
        levar = !(await buscarIdFechamento(dia, TURNO_PADRAO))
      } catch {
        levar = false
      }
    }
    if (levar) {
      levarParaOutroDia(localNavegador, DOC_FECHAMENTO, chaveFechamentoDoDia(dia), dia, conteudo)
      await sinc.descartar()
    }
    navigate(`/novo?data=${dia}`, { replace: true })
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
      // Editando com a data trocada: não deixa cair em cima de outro fechamento.
      if (id && registro && input.data !== registro.data) {
        const existente = await buscarIdFechamento(input.data, input.turno, id)
        if (existente) {
          setDuplicadoId(existente)
          setErro(`Já existe um fechamento salvo para ${formatarDataBr(input.data)}.`)
          mostrarAlertas()
          return
        }
      }

      // Junta com o que o outro aparelho fez e grava só se ninguém gravou no meio.
      const r = await sinc.salvar()
      const aviso = textoJuntou(r.juntou, r.conflitos)
      if (id) {
        navigate(`/fechamento/${id}`, { state: { salvo: `Alterações salvas.${aviso ? ` ${aviso}` : ''}` } })
        return
      }
      let pdfBaixado = false
      try {
        const [fechamento, pdf] = await Promise.all([buscarFechamentoPorId(r.registro.id), carregarPdf()])
        pdf.gerarPdfFechamento(fechamento)
        pdfBaixado = true
      } catch {
        // Salvo mesmo sem PDF; dá pra gerar depois na tela do fechamento.
      }
      navigate(`/fechamento/${r.registro.id}`, { state: { salvo: `Fechamento salvo.${aviso ? ` ${aviso}` : ''}`, pdfBaixado } })
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao salvar o fechamento.'))
      mostrarAlertas()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
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
          {editando ? 'Editar fechamento' : jaSalvo ? `Fechamento de ${formatarDataBr(data)}` : 'Fechamento do caixa'}
        </h1>
        {!editando && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Preencha de cima para baixo. O resultado aparece embaixo, na hora. Dá para preencher no PC e no celular ao mesmo
            tempo.
          </p>
        )}
      </header>

      <AvisosSincronia estado={sinc.estado} nome="fechamento" onFecharChegou={sinc.limparAviso} onDescartar={descartarAlteracoes} />

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
              onChange={(e) => (editando ? setData(e.target.value) : void trocarDia(e.target.value))}
            />
            {semana && <span className="text-sm text-gray-400 dark:text-gray-500">{semana}</span>}
          </div>
        </label>
        {!editando && jaSalvo && sinc.estado.banco && (
          <p className="mt-3 flex gap-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3.5 py-2.5 text-sm text-sky-900 dark:text-sky-200">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>
              Este dia já tem fechamento salvo (antes ou no outro aparelho): você está continuando ele. O que mudar aqui é
              juntado quando salvar.{' '}
              <Link to={`/fechamento/${sinc.estado.banco.id}`} className="font-semibold underline">
                Ver o fechamento salvo
              </Link>
            </span>
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
          <div className="px-1 min-h-[1rem]">
            <LinhaSincronia estado={sinc.estado} />
          </div>
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

/** "Juntei com o que veio do outro aparelho: Marmitas." */
function textoJuntou(juntou: string[], conflitos: string[]): string {
  const partes: string[] = []
  if (juntou.length > 0) partes.push(`Juntei com o que veio do outro aparelho: ${juntou.join(', ')}.`)
  if (conflitos.length > 0) partes.push(`Mudado nos dois aparelhos (ficou o deste): ${conflitos.join(', ')}.`)
  return partes.join(' ')
}


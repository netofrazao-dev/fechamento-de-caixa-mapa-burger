import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { History } from 'lucide-react'
import LCForm from '../components/LCForm'
import BrendiForm from '../components/BrendiForm'
import SangriaForm from '../components/SangriaForm'
import ResultadoCard from '../components/ResultadoCard'
import ContadorPratos from '../components/ContadorPratos'
import Secao from '../components/Secao'
import { calcularResultado, totalMarmitas } from '../lib/calculations'
import {
  atualizarFechamento,
  buscarFechamentoPorId,
  criarFechamento,
  existeFechamento,
} from '../lib/fechamentoService'
import { gerarPdfFechamento } from '../lib/pdf'
import { formatarHoraRascunho } from '../lib/draft'
import { useRascunho } from '../lib/useRascunho'
import type { Ajuste, DadosBrendi, DadosLC, MarmitaItem, Sangria, Turno } from '../types/fechamento'
import { hojeLocal as hoje } from '../lib/datas'

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
  const chaveRascunho = id ? `mapa-burger-rascunho-fechamento-${id}` : 'mapa-burger-rascunho-fechamento'

  const [turno, setTurno] = useState<Turno>(TURNO_PADRAO)
  const [data, setData] = useState(hoje())
  const [lc, setLc] = useState<DadosLC>(LC_VAZIO)
  const [brendi, setBrendi] = useState<DadosBrendi>(BRENDI_VAZIO)
  const [sangrias, setSangrias] = useState<Sangria[]>([])
  const [marmitas, setMarmitas] = useState<MarmitaItem[]>([])
  const [totalLCSistema, setTotalLCSistema] = useState(0)
  const [ajuste, setAjuste] = useState<Ajuste>(AJUSTE_VAZIO)
  const [observacoes, setObservacoes] = useState('')

  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Ao editar, carrega o fechamento salvo.
  useEffect(() => {
    if (!id) return
    buscarFechamentoPorId(id)
      .then((f) => {
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
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar fechamento.'))
      .finally(() => setCarregando(false))
  }, [id])

  const resultado = useMemo(
    () => calcularResultado({ lc, brendi, totalLCSistema, ajuste }),
    [lc, brendi, totalLCSistema, ajuste],
  )

  // Rascunho automático (navegador + Supabase, sincroniza entre aparelhos).
  const rascunho = useRascunho<RascunhoFechamento>({
    chave: chaveRascunho,
    dados: { data, lc, brendi, sangrias, marmitas, totalLCSistema, ajuste, observacoes },
    habilitado: !carregando,
    aplicar: (d) => {
      setData(d.data)
      setLc(d.lc)
      setBrendi(d.brendi)
      setSangrias(d.sangrias)
      setMarmitas(d.marmitas)
      setTotalLCSistema(d.totalLCSistema)
      setAjuste(d.ajuste)
      setObservacoes(d.observacoes)
    },
  })

  async function salvar() {
    setErro(null)

    if (sangrias.some((s) => s.valor > 0 && !s.motivo.trim())) {
      setErro('Toda sangria com valor precisa ter um motivo escrito.')
      return
    }
    if (ajuste.tipo && !observacoes.trim()) {
      setErro('Quando há ajuste manual, escreva uma observação explicando o motivo.')
      return
    }

    setSalvando(true)
    try {
      if (await existeFechamento(data, turno, id)) {
        setErro('Já existe um fechamento salvo para essa data.')
        setSalvando(false)
        return
      }

      const input = {
        data,
        turno,
        lc,
        brendi,
        sangrias: sangrias.filter((s) => s.valor > 0 || s.motivo.trim()),
        marmitas,
        totalLCSistema,
        ajuste,
        observacoes,
      }

      if (id) {
        await atualizarFechamento(id, input)
        rascunho.limpar()
        navigate(`/fechamento/${id}`)
      } else {
        const fechamento = await criarFechamento(input)
        rascunho.limpar()
        gerarPdfFechamento(fechamento)
        navigate(`/fechamento/${fechamento.id}`)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar o fechamento.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-36">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {editando ? 'Editar fechamento' : 'Novo Fechamento'}
        </h1>
      </header>

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

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
      </section>

      <Secao titulo="Marmitas vendidas" resumo={`Total: ${totalMarmitas(marmitas)}`}>
        <ContadorPratos value={marmitas} onChange={setMarmitas} />
      </Secao>

      <LCForm value={lc} onChange={setLc} defaultAberto />
      <BrendiForm value={brendi} onChange={setBrendi} />
      <SangriaForm value={sangrias} onChange={setSangrias} />
      <ResultadoCard
        resultado={resultado}
        totalLCSistema={totalLCSistema}
        onTotalLCSistemaChange={setTotalLCSistema}
        ajuste={ajuste}
        onAjusteChange={setAjuste}
        observacoes={observacoes}
        onObservacoesChange={setObservacoes}
      />

      {erro && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{erro}</div>
      )}

      <div className="fixed bottom-14 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="w-full rounded-xl bg-gray-900 dark:bg-gray-700 py-3 text-white text-sm font-semibold disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar e gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

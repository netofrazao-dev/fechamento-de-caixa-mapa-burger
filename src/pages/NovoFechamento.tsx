import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LCForm from '../components/LCForm'
import BrendiForm from '../components/BrendiForm'
import SangriaForm from '../components/SangriaForm'
import ResultadoCard from '../components/ResultadoCard'
import { calcularResultado } from '../lib/calculations'
import { criarFechamento, existeFechamento } from '../lib/fechamentoService'
import { gerarPdfFechamento } from '../lib/pdf'
import type { Ajuste, DadosBrendi, DadosLC, Sangria, Turno } from '../types/fechamento'

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

const BRENDI_VAZIO: DadosBrendi = {
  pix: 0,
  debito: 0,
  credito: 0,
  creditoOnline: 0,
  dinheiro: 0,
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NovoFechamento() {
  const navigate = useNavigate()

  const [data, setData] = useState(hoje())
  const [turno, setTurno] = useState<Turno>('manha')
  const [lc, setLc] = useState<DadosLC>(LC_VAZIO)
  const [brendi, setBrendi] = useState<DadosBrendi>(BRENDI_VAZIO)
  const [sangrias, setSangrias] = useState<Sangria[]>([])
  const [marmitasVendidas, setMarmitasVendidas] = useState(0)
  const [totalLCSistema, setTotalLCSistema] = useState(0)
  const [ajuste, setAjuste] = useState<Ajuste>({ tipo: null, valor: 0 })
  const [observacoes, setObservacoes] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const resultado = useMemo(
    () => calcularResultado({ lc, brendi, totalLCSistema, ajuste }),
    [lc, brendi, totalLCSistema, ajuste],
  )

  async function salvar() {
    setErro(null)

    const sangriaSemMotivo = sangrias.some((s) => s.valor > 0 && !s.motivo.trim())
    if (sangriaSemMotivo) {
      setErro('Toda sangria com valor precisa ter um motivo escrito.')
      return
    }
    if (ajuste.tipo && !observacoes.trim()) {
      setErro('Quando há ajuste manual, escreva uma observação explicando o motivo.')
      return
    }

    setSalvando(true)
    try {
      const jaExiste = await existeFechamento(data, turno)
      if (jaExiste) {
        setErro('Já existe um fechamento salvo para essa data e turno.')
        setSalvando(false)
        return
      }

      const fechamento = await criarFechamento({
        data,
        turno,
        lc,
        brendi,
        sangrias: sangrias.filter((s) => s.valor > 0 || s.motivo.trim()),
        marmitasVendidas,
        totalLCSistema,
        ajuste,
        observacoes,
      })

      gerarPdfFechamento(fechamento)
      navigate(`/fechamento/${fechamento.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar o fechamento.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-36">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Novo Fechamento</h1>
      </header>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Turno</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['manha', 'noite'] as Turno[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTurno(t)}
                className={`flex-1 py-2 text-sm font-medium ${
                  turno === t ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'
                }`}
              >
                {t === 'manha' ? 'Manhã' : 'Noite'}
              </button>
            ))}
          </div>
        </label>
      </section>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Marmitas vendidas</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-400 w-32"
            value={Number.isNaN(marmitasVendidas) ? '' : marmitasVendidas}
            onChange={(e) => setMarmitasVendidas(e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            onFocus={(e) => e.target.select()}
          />
        </label>
      </section>

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
            {salvando ? 'Salvando...' : 'Salvar e gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

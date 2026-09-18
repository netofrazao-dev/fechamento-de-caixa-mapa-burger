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
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Novo Fechamento</h1>
        <p className="text-sm text-gray-500">Preencha os dados do LC e do Brendi para este turno.</p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Data</span>
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Turno</span>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900"
            value={turno}
            onChange={(e) => setTurno(e.target.value as Turno)}
          >
            <option value="manha">Manhã</option>
            <option value="noite">Noite</option>
          </select>
        </label>
      </section>

      <LCForm value={lc} onChange={setLc} />
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="w-full rounded-lg bg-gray-900 py-3 text-white font-semibold disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar fechamento e gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import SeletorFuncionarios from '../components/SeletorFuncionarios'
import CampoMoeda from '../components/CampoMoeda'
import {
  atualizarVale,
  buscarFechamentoDoMes,
  buscarValePorId,
  criarVale,
  listarValesDoMes,
  mensagemDeErro,
} from '../lib/valeService'
import { hojeLocal as hoje } from '../lib/datas'
import { formatarMoeda } from '../lib/calculations'
import {
  avisosVale,
  dataValida,
  normalizarNome,
  OBSERVACAO_MAX,
  rotuloMes,
  somarValores,
  validarVale,
} from '../lib/vales'
import type { MesValesFechado, Vale, ValeInput } from '../types/fechamento'

interface ContextoMes {
  mes: string
  vales: Vale[]
  fechamento: MesValesFechado | null
}

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
  const [valeOriginal, setValeOriginal] = useState<Vale | null>(null)
  const [pendencia, setPendencia] = useState<{ avisos: string[]; outro: boolean; input: ValeInput } | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Vales e situação do mês da data escolhida (pra avisar repetido / mês fechado)
  const [contexto, setContexto] = useState<ContextoMes | null>(null)
  const [erroContexto, setErroContexto] = useState<{ mes: string; mensagem: string } | null>(null)

  // Trava contra toque duplo no botão (o estado do React demora um render)
  const salvandoRef = useRef(false)
  // Avisos e erros aparecem embaixo; rola a tela até eles pra não passarem despercebidos
  const alertasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    let ativo = true
    buscarValePorId(id)
      .then((v) => {
        if (!ativo) return
        setValeOriginal(v)
        setFuncionario([v.funcionario])
        setData(v.data)
        setValor(v.valor)
        setObservacao(v.observacao)
      })
      .catch((e) => ativo && setErro(mensagemDeErro(e, 'Erro ao carregar vale.')))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [id])

  const mesDaData = dataValida(data) ? data.slice(0, 7) : null

  useEffect(() => {
    if (!mesDaData) return
    let ativo = true
    Promise.all([listarValesDoMes(mesDaData), buscarFechamentoDoMes(mesDaData)])
      .then(([vales, fechamento]) => {
        if (!ativo) return
        setContexto({ mes: mesDaData, vales, fechamento })
        setErroContexto(null)
      })
      .catch((e) => {
        if (!ativo) return
        setContexto(null)
        setErroContexto({ mes: mesDaData, mensagem: mensagemDeErro(e, 'Não consegui conferir os vales do mês.') })
      })
    return () => {
      ativo = false
    }
  }, [mesDaData])

  const contextoAtual = contexto && contexto.mes === mesDaData ? contexto : null
  const mesFechado = contextoAtual?.fechamento ?? null
  // Editando: o mês original também precisa estar aberto (o banco confere de novo).
  const mesOriginalDiferente = valeOriginal && valeOriginal.data.slice(0, 7) !== mesDaData

  const nomeSelecionado = funcionario[0] ?? ''
  const jaRecebido = useMemo(() => {
    if (!contextoAtual || !nomeSelecionado) return null
    const doFuncionario = contextoAtual.vales.filter(
      (v) => !v.excluidoEm && v.id !== id && normalizarNome(v.funcionario) === normalizarNome(nomeSelecionado),
    )
    return { total: somarValores(doFuncionario.map((v) => v.valor)), quantidade: doFuncionario.length }
  }, [contextoAtual, nomeSelecionado, id])

  const mesVoltar = searchParams.get('mes') || data.slice(0, 7)

  function montarInput(): ValeInput {
    return { funcionario: nomeSelecionado, data, valor, observacao: observacao.trim() }
  }

  function mostrarAlertas() {
    requestAnimationFrame(() => alertasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function salvar(outro: boolean, confirmado = false) {
    if (salvandoRef.current) return
    setErro(null)
    setSucesso(null)

    const input = montarInput()
    const erros = validarVale(input)
    if (erros.length > 0) {
      setErro(erros.join(' '))
      mostrarAlertas()
      return
    }
    if (mesFechado) {
      setErro(`O mês ${rotuloMes(mesFechado.mes)} já foi fechado. Reabra o mês na tela de Vales para lançar ou alterar.`)
      return
    }

    if (!confirmado) {
      const avisos = avisosVale(input, { hoje: hoje(), existentes: contextoAtual?.vales ?? [], idEditando: id })
      if (!contextoAtual) {
        avisos.unshift('Não consegui conferir os vales já lançados nesse mês (sem conexão?). Confira se este vale já não foi lançado.')
      }
      if (avisos.length > 0) {
        setPendencia({ avisos, outro, input })
        mostrarAlertas()
        return
      }
    }
    setPendencia(null)

    salvandoRef.current = true
    setSalvando(true)
    try {
      if (id) {
        await atualizarVale(id, input)
        navigate(`/vales?mes=${input.data.slice(0, 7)}`, { replace: true })
        return
      }
      const criado = await criarVale(input)
      if (outro) {
        setSucesso(`Vale de ${formatarMoeda(criado.valor)} para ${criado.funcionario} salvo.`)
        setContexto((c) => (c && c.mes === criado.data.slice(0, 7) ? { ...c, vales: [...c.vales, criado] } : c))
        setValor(0)
        setObservacao('')
        setFuncionario([])
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate(`/vales?mes=${input.data.slice(0, 7)}`, { replace: true })
      }
    } catch (e) {
      setErro(mensagemDeErro(e, 'Erro ao salvar vale.'))
      mostrarAlertas()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-gray-400 dark:text-gray-500">Carregando...</div>
  }

  if (editando && !valeOriginal) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <Link to={`/vales?mes=${mesVoltar}`} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Voltar aos vales
        </Link>
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {erro ?? 'Vale não encontrado.'}
        </div>
      </div>
    )
  }

  if (valeOriginal?.excluidoEm) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <Link to={`/vales?mes=${mesVoltar}`} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          ← Voltar aos vales
        </Link>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Este vale foi excluído ({valeOriginal.motivoExclusao}). Para editar, restaure-o primeiro na lista de vales excluídos.
        </div>
      </div>
    )
  }

  const bloqueado = Boolean(mesFechado)
  // Mudou algo depois dos avisos? Então a confirmação não vale mais.
  const inputAtual = montarInput()
  const avisosVisiveis =
    pendencia &&
    pendencia.input.funcionario === inputAtual.funcionario &&
    pendencia.input.data === inputAtual.data &&
    pendencia.input.valor === inputAtual.valor &&
    pendencia.input.observacao === inputAtual.observacao
      ? pendencia
      : null

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-40">
      <Link to={`/vales?mes=${mesVoltar}`} className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
        ← Voltar aos vales
      </Link>
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{editando ? 'Editar vale' : 'Novo vale'}</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">Adiantamento de salário — será descontado na folha do mês da data.</p>
      </header>

      {sucesso && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} className="shrink-0" /> {sucesso}
        </div>
      )}

      {mesFechado && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Lock size={16} className="shrink-0 mt-0.5" />
          <span>
            O mês {rotuloMes(mesFechado.mes)} já foi fechado (descontado na folha). Não dá para lançar nem alterar vales
            nele. Se precisar, reabra o mês na tela de Vales.
          </span>
        </div>
      )}

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-2">
        <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Funcionário</span>
        <SeletorFuncionarios value={funcionario} onChange={setFuncionario} unico />
        {jaRecebido && mesDaData && (
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
            {jaRecebido.quantidade === 0
              ? `${nomeSelecionado} ainda não pegou vale em ${rotuloMes(mesDaData)}.`
              : `${nomeSelecionado} já pegou ${formatarMoeda(jaRecebido.total)} em ${jaRecebido.quantidade} vale(s) em ${rotuloMes(mesDaData)}` +
                (valor > 0 ? ` — com este, ${formatarMoeda(somarValores([jaRecebido.total, valor]))}.` : '.')}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Data</span>
          <input
            type="date"
            required
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
            maxLength={OBSERVACAO_MAX}
            placeholder="Ex: adiantamento pra compra de remédio"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-400"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </label>
        {mesOriginalDiferente && valeOriginal && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Atenção: o vale vai sair de {rotuloMes(valeOriginal.data.slice(0, 7))} e passar para{' '}
            {mesDaData ? rotuloMes(mesDaData) : 'outro mês'}.
          </p>
        )}
      </section>

      {erroContexto && erroContexto.mes === mesDaData && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {erroContexto.mensagem}
        </div>
      )}

      <div ref={alertasRef} className="space-y-3 scroll-mb-40">
        {erro && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">{erro}</div>}

        {avisosVisiveis && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle size={16} /> Confira antes de salvar
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-amber-900 dark:text-amber-200">
              {avisosVisiveis.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendencia(null)}
                className="flex-1 rounded-xl bg-white dark:bg-gray-800 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Corrigir
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => salvar(avisosVisiveis.outro, true)}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Está certo, salvar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-14 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          {!editando && (
            <button
              type="button"
              disabled={salvando || bloqueado}
              onClick={() => salvar(true)}
              className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              Salvar e lançar outro
            </button>
          )}
          <button
            type="button"
            disabled={salvando || bloqueado}
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

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react'
import { listarRelatorios } from '../lib/relatorioService'
import { mensagemErro } from '../lib/erros'
import { mesValido, nomeMes, rotuloMes, somarMeses, somarValores } from '../lib/vales'
import { formatarMoeda } from '../lib/calculations'
import { diaDaSemana, formatarDataBr, limitesDoMes, mesLocal } from '../lib/datas'
import { CaixaErro } from '../components/Avisos'
import type { RelatorioDiario } from '../types/fechamento'

export default function Relatorios() {
  const [params, setParams] = useSearchParams()
  const mesUrl = params.get('mes')
  const mes = mesUrl && mesValido(mesUrl) ? mesUrl : mesLocal()

  const [dados, setDados] = useState<{ mes: string; lista: RelatorioDiario[] } | null>(null)
  const [erro, setErro] = useState<{ mes: string; mensagem: string } | null>(null)
  // Muda quando a pessoa toca em "Tentar de novo" (busca outra vez).
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const { inicio, fim } = limitesDoMes(mes)
    let ativo = true
    listarRelatorios({ dataInicio: inicio, dataFim: fim })
      .then((lista) => ativo && setDados({ mes, lista }))
      .catch((e) => ativo && setErro({ mes, mensagem: mensagemErro(e, 'Erro ao carregar os relatórios.') }))
    return () => {
      ativo = false
    }
  }, [mes, tentativa])

  const relatorios = dados?.mes === mes ? dados.lista : null
  const erroAtual = erro?.mes === mes ? erro.mensagem : null
  const nome = nomeMes(mes)

  function trocarMes(novo: string) {
    if (mesValido(novo)) setParams({ mes: novo }, { replace: true })
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Relatórios diários</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Um por dia: consumo, estoque, prints e mais.</p>
        </div>
        <Link
          to="/relatorios/novo"
          className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-700 px-3.5 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Novo
        </Link>
      </header>

      <section className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-3 flex items-center gap-2">
        <button type="button" onClick={() => trocarMes(somarMeses(mes, -1))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Mês anterior">
          <ChevronLeft size={18} />
        </button>
        <label className="flex-1 flex flex-col items-center">
          <span className="sr-only">Mês</span>
          <input
            type="month"
            className="w-full max-w-[12rem] text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-gray-500"
            value={mes}
            onChange={(e) => trocarMes(e.target.value)}
          />
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{nome.charAt(0).toUpperCase() + nome.slice(1)}</span>
        </label>
        <button type="button" onClick={() => trocarMes(somarMeses(mes, 1))} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Próximo mês">
          <ChevronRight size={18} />
        </button>
      </section>

      {erroAtual && (
        <CaixaErro
          onTentarDeNovo={() => {
            setErro(null)
            setTentativa((t) => t + 1)
          }}
        >
          {erroAtual}
        </CaixaErro>
      )}
      {!relatorios && !erroAtual && <p className="text-sm text-gray-400 dark:text-gray-500">Carregando...</p>}
      {relatorios?.length === 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-8 text-center space-y-2">
          <FileText className="mx-auto text-gray-300 dark:text-gray-600" size={28} />
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum relatório em {rotuloMes(mes)}.</p>
        </div>
      )}

      <div className="space-y-2">
        {relatorios?.map((r) => {
          const consumo = somarValores(
            [...r.consumoLojaMensal, ...r.consumoLojaMotoboys, ...r.cortesiaClientes].map((c) => c.valor),
          )
          return (
            <Link
              key={r.id}
              to={`/relatorios/${r.id}`}
              className="block rounded-2xl bg-white dark:bg-gray-900 shadow-sm p-4 hover:shadow transition"
            >
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatarDataBr(r.data)} <span className="text-xs font-normal text-gray-400">{diaDaSemana(r.data)}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {r.quantidadeVendida} vendidas · {r.funcionariosQueComeram.length} funcionário(s) comeram
                {consumo > 0 && ` · consumo/cortesia ${formatarMoeda(consumo)}`}
                {r.estragou.length > 0 && ` · ${r.estragou.length} item(ns) estragado(s)`}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

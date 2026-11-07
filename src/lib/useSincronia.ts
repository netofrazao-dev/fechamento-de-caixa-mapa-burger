import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Sincronizador,
  type AdaptadorBanco,
  type EstadoSincronia,
  type RascunhoLegado,
  type RegistroBanco,
  type ResultadoSalvar,
  type TipoDocumento,
} from './sincronia'
import { idDoAparelho, localNavegador, remotoSupabase } from './sincroniaSupabase'
import { assinaturaFoto, canonico } from './mesclagem'

/** De quanto em quanto tempo confere o outro aparelho com a tela aberta. */
const INTERVALO_MS = 4000

const ESTADO_INICIAL: EstadoSincronia = {
  pronto: false,
  online: true,
  enviando: false,
  pendente: false,
  banco: null,
  sincronizadoEm: null,
  restaurado: null,
  chegou: null,
  excluido: false,
}

interface Opcoes<C> {
  /** Rascunho compartilhado do dia; null = ainda carregando (não começa). */
  chave: string | null
  dataDocumento: string
  tipo: TipoDocumento<C>
  banco: AdaptadorBanco<C>
  /** O que está na tela agora. */
  conteudo: C
  /** Põe na tela o que foi juntado com o outro aparelho. */
  aplicar: (c: C) => void
  /** Registro já buscado pela tela (edição); undefined = a sincronia procura pela data. */
  registro?: RegistroBanco<C> | null
  /** Rascunho do formato antigo deste aparelho (para não perder nada na troca de versão). */
  legado?: () => RascunhoLegado<C> | null
}

/**
 * Liga um formulário à sincronia entre aparelhos: confere a nuvem a cada
 * poucos segundos (e ao voltar para a tela), manda o que foi digitado e
 * junta o que veio do outro aparelho.
 */
export function useSincronia<C>(op: Opcoes<C>) {
  const [estado, setEstado] = useState<EstadoSincronia>(ESTADO_INICIAL)
  const motorRef = useRef<Sincronizador<C> | null>(null)
  const ultimo = useRef(op)
  useEffect(() => {
    ultimo.current = op
  })

  useEffect(() => {
    if (!op.chave) return
    const atual = ultimo.current
    const motor = new Sincronizador<C>({
      chave: op.chave,
      dataDocumento: op.dataDocumento,
      aparelho: idDoAparelho(),
      tipo: atual.tipo,
      banco: {
        ler: (a) => ultimo.current.banco.ler(a),
        versao: (a) => ultimo.current.banco.versao(a),
        gravar: (c, e) => ultimo.current.banco.gravar(c, e),
      },
      remoto: remotoSupabase,
      local: localNavegador,
      aplicar: (c) => ultimo.current.aplicar(c),
      aoMudar: setEstado,
      legado: () => ultimo.current.legado?.() ?? null,
    })
    motorRef.current = motor
    setEstado(motor.estadoAtual)
    motor.iniciar(atual.registro).catch((e) => console.warn('sincronia: não iniciou', e))

    const conferir = () => {
      if (document.visibilityState !== 'visible') return
      motor.puxar().catch((e) => console.warn('sincronia: conferência falhou', e))
    }
    // Saindo da tela (trocou de app, bloqueou o celular): manda já o que está pendente.
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') conferir()
      else motor.enviarAgora().catch(() => undefined)
    }
    const intervalo = setInterval(conferir, INTERVALO_MS)
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('focus', conferir)
    window.addEventListener('online', conferir)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('focus', conferir)
      window.removeEventListener('online', conferir)
      motor.encerrar()
      if (motorRef.current === motor) motorRef.current = null
    }
  }, [op.chave, op.dataDocumento])

  // Cada mudança na tela vai para o motor (que guarda no aparelho e manda para a nuvem).
  const assinatura = op.chave ? assinaturaConteudo(op.conteudo, op.tipo) : ''
  useEffect(() => {
    if (assinatura) motorRef.current?.editar(ultimo.current.conteudo)
  }, [assinatura])

  const salvar = useCallback((preparar?: (c: C) => C): Promise<ResultadoSalvar<C>> => {
    const motor = motorRef.current
    if (!motor) return Promise.reject(new Error('Aguarde a tela terminar de carregar.'))
    motor.editar(ultimo.current.conteudo)
    return motor.salvar(preparar)
  }, [])

  /** Confere a nuvem já e devolve o conteúdo atualizado (antes de gerar PDF ou imprimir). */
  const conteudoAtualizado = useCallback(async (): Promise<C> => {
    const motor = motorRef.current
    if (!motor) return ultimo.current.conteudo
    motor.editar(ultimo.current.conteudo)
    await motor.sincronizarAgora().catch(() => undefined)
    return motor.conteudoAtual
  }, [])

  const descartar = useCallback(async () => {
    await motorRef.current?.descartar()
  }, [])

  const esquecer = useCallback(() => {
    motorRef.current?.esquecer()
  }, [])

  const limparAviso = useCallback(() => {
    motorRef.current?.limparAviso()
  }, [])

  return { estado, salvar, conteudoAtualizado, descartar, esquecer, limparAviso }
}

/** Assinatura barata do conteúdo (fotos viram a assinatura curta delas). */
function assinaturaConteudo<C>(c: C, tipo: TipoDocumento<C>): string {
  if (tipo.camposFoto.length === 0) return canonico(c)
  const leve = { ...c }
  for (const campo of tipo.camposFoto) (leve as Record<keyof C, unknown>)[campo] = assinaturaFoto(c[campo] as unknown as string | null)
  return canonico(leve)
}

import { assinaturaFoto, ehReferenciaFoto, iguais, type ResultadoMescla } from './mesclagem'
import { ErroAmigavel } from './erros'

/**
 * Sincronia de um formulário (relatório ou fechamento de um dia) entre
 * aparelhos — por exemplo o PC lançando as sangrias enquanto o celular conta
 * o estoque e tira as fotos.
 *
 * Há duas coisas compartilhadas na nuvem:
 * - o registro salvo no banco (o que vale de verdade, com "versão" = updated_at);
 * - o rascunho do dia (tabela `rascunhos`): o que já foi preenchido e ainda não
 *   foi salvo, para o outro aparelho ver na hora. As fotos vão à parte (uma vez
 *   cada), o rascunho só leva a assinatura delas.
 *
 * Cada aparelho guarda a "base": a última versão compartilhada que ele viu.
 * Tudo que chega de fora é juntado com uma mesclagem de três vias
 * (base, o que está na tela, o que veio de fora), então um aparelho nunca
 * apaga o que o outro fez. Gravações são condicionais à versão (se alguém
 * gravou antes, junta de novo e tenta outra vez).
 */

/** Registro salvo no banco (com as fotos). */
export interface RegistroBanco<C> {
  id: string
  /** updated_at do banco (muda a cada gravação). */
  versao: string
  data: string
  conteudo: C
}

/** O que o rascunho sabe do banco (fotos só como referência). */
export type RefBanco<C> = RegistroBanco<C>

export interface AlvoBanco {
  /** Registro conhecido (por id); null = procura pela data do documento. */
  id: string | null
  data: string
}

export type ResultadoGravacao<C> = RegistroBanco<C> | 'conflito' | 'excluido'

export interface AdaptadorBanco<C> {
  ler(alvo: AlvoBanco): Promise<RegistroBanco<C> | null>
  /** Só id e versão (consulta leve, para conferir se mudou). */
  versao(alvo: AlvoBanco): Promise<{ id: string; versao: string } | null>
  /**
   * Grava. esperado null = criar (devolve 'conflito' se o dia já tem registro);
   * senão atualiza só se a versão no banco ainda for a esperada.
   */
  gravar(conteudo: C, esperado: { id: string; versao: string } | null): Promise<ResultadoGravacao<C>>
}

export interface TipoDocumento<C> {
  vazio(data: string): C
  /** Completa campos que faltam (rascunhos antigos). */
  completar(c: unknown, data: string): C
  mesclar(base: C, meu: C, deles: C): ResultadoMescla<C>
  /** Versão limpa (sem linhas vazias, textos aparados) para saber se há algo não salvo. */
  normalizar(c: C): C
  camposFoto: readonly (keyof C)[]
}

/** Rascunho compartilhado na nuvem. */
export interface EnvelopeRascunho<C = unknown> {
  v: 2
  /** Identificador desta gravação (a próxima só grava se ainda for esta). */
  versao: string
  conteudo: C
  /** Versão do banco em que este rascunho se baseia (null = ainda não salvo). */
  banco: RefBanco<C> | null
  aparelho: string
  /** true = tem algo que ainda não foi salvo no banco. */
  pendente: boolean
  salvoEm: string
}

/** Respostas: undefined = não deu para falar com a nuvem (sem internet). */
export interface ArmazemRemoto {
  ler(chave: string): Promise<EnvelopeRascunho | null | undefined>
  versao(chave: string): Promise<string | null | undefined>
  /**
   * esperado null = criar; senão só grava se a versão atual for a esperada.
   * false = alguém gravou antes; 'indisponivel' = não há rascunho na nuvem (tabela faltando/sem permissão).
   */
  gravar(chave: string, env: EnvelopeRascunho, esperado: string | null): Promise<boolean | undefined | 'indisponivel'>
  apagar(chave: string, esperado: string | null): Promise<boolean | undefined>
  lerFoto(assinatura: string): Promise<string | null | undefined>
  gravarFoto(assinatura: string, dataUrl: string): Promise<boolean>
  /** Foto que já foi para o banco: não precisa mais da cópia no rascunho. */
  apagarFoto(assinatura: string): Promise<void>
}

export interface ArmazemLocal {
  ler(chave: string): unknown
  /** false = não coube. */
  gravar(chave: string, valor: unknown): boolean
  apagar(chave: string): void
}

/** Rascunho guardado no próprio aparelho (vale mesmo sem internet ou se a aba fechar). */
export interface RascunhoLocal<C> {
  v: 2
  conteudo: C
  base: C | null
  versaoRascunho: string | null
  banco: RefBanco<C> | null
  pendente: boolean
  salvoEm: string
}

/** Rascunho do formato antigo (antes da sincronia), achado para não perder nada. */
export interface RascunhoLegado<C> {
  conteudo: C
  salvoEm: string
  /** true = era alteração de um registro já salvo (o que estava nele vale por cima). */
  edicao: boolean
  /** true = veio da nuvem sem as fotos (mantém as fotos que já existem). */
  semFotos: boolean
}

export interface EstadoSincronia {
  /** Já mostrou o que tinha no aparelho (e começou a conferir a nuvem). */
  pronto: boolean
  /** Conseguiu falar com a nuvem na última tentativa. */
  online: boolean
  enviando: boolean
  /** Há algo na tela que ainda não está salvo no banco. */
  pendente: boolean
  /** Registro salvo deste dia (se existe). */
  banco: { id: string; versao: string; data: string } | null
  /** Última conferência/envio bem-sucedido com a nuvem. */
  sincronizadoEm: number | null
  /** Ao abrir, havia alterações não salvas guardadas neste aparelho. */
  restaurado: { salvoEm: string } | null
  /** O que chegou do outro aparelho na última vez. */
  chegou: { campos: string[]; conflitos: string[]; em: number } | null
  /** O registro salvo foi excluído em outro aparelho. */
  excluido: boolean
}

export interface ResultadoSalvar<C> {
  registro: RegistroBanco<C>
  /** Partes que entraram do outro aparelho na hora de salvar. */
  juntou: string[]
  conflitos: string[]
}

export interface ConfigSincronizador<C> {
  chave: string
  dataDocumento: string
  aparelho: string
  tipo: TipoDocumento<C>
  banco: AdaptadorBanco<C>
  remoto: ArmazemRemoto
  local: ArmazemLocal
  /** Joga o conteúdo juntado de volta na tela. */
  aplicar: (c: C) => void
  aoMudar?: (e: EstadoSincronia) => void
  /** Procura rascunho do formato antigo guardado neste aparelho (só quando não há rascunho novo). */
  legado?: () => RascunhoLegado<C> | null
  /** Fotos já vistas neste aparelho (assinatura → foto). */
  fotos?: CacheFotos
  /** Hora (ms) para gravar quando foi salvo. */
  agora?: () => number
  /** Relógio contínuo (ms) para medir intervalos, como "parou de digitar" (não muda se acertarem a hora). */
  relogio?: () => number
  novoId?: () => string
  /** Não junta o que chegou enquanto a pessoa está digitando (ms desde a última edição). */
  ociosoMs?: number
  /** Espera depois da última edição antes de mandar o rascunho para a nuvem. */
  atrasoEnvioMs?: number
}

// ─── Fotos em memória (assinatura → data URL) ─────────────────

/** Fotos já vistas neste aparelho, para não baixar de novo. */
export class CacheFotos {
  private mapa = new Map<string, string>()
  private readonly limite: number
  constructor(limite = 16) {
    this.limite = limite
  }
  lembrar(dataUrl: string | null | undefined): void {
    if (!dataUrl || ehReferenciaFoto(dataUrl)) return
    const sig = assinaturaFoto(dataUrl)!
    this.mapa.delete(sig)
    this.mapa.set(sig, dataUrl)
    while (this.mapa.size > this.limite) this.mapa.delete(this.mapa.keys().next().value as string)
  }
  obter(sig: string): string | undefined {
    return this.mapa.get(sig)
  }
}

/** As fotos vistas neste aparelho (compartilhado entre as telas). */
export const fotosDoAparelho = new CacheFotos()

function idAleatorio(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

/** Falha de rede (sem internet, tempo esgotado) — diferente de um erro do banco. */
export function ehFalhaDeRede(e: unknown): boolean {
  if (!e) return false
  if (e instanceof TypeError) return true
  const err = e as { status?: number; message?: string; name?: string }
  if (err.status === 0) return true
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|aborterror|timeouterror|timed out/i.test(
    `${err.name ?? ''} ${err.message ?? ''}`,
  )
}

const ERRO_SEM_INTERNET = 'Sem conexão com a internet. Nada foi salvo — confira a conexão e tente de novo (o que você preencheu continua guardado neste aparelho).'

class SemInternet extends Error {}

export class Sincronizador<C> {
  private readonly cfg: ConfigSincronizador<C>
  private readonly agora: () => number
  private readonly relogio: () => number
  private readonly novoId: () => string
  private readonly ociosoMs: number
  private readonly atrasoEnvioMs: number

  private conteudo: C
  private base: C
  private versaoRascunho: string | null = null
  private ultimoRascunho: EnvelopeRascunho<C> | null = null
  private banco: RefBanco<C> | null = null
  /** Rascunho que ficou para apagar depois de salvar (não deu na hora). */
  private apagarDepois: string | null = null
  /** Lido da nuvem e ainda não juntado (a pessoa estava digitando). */
  private guardado: { versaoR: string | null; env: EnvelopeRascunho<C> | null; reg: RegistroBanco<C> | null | undefined } | null = null
  private editadoEm = Number.NEGATIVE_INFINITY
  private fila: Promise<unknown> = Promise.resolve()
  private timerEnvio: ReturnType<typeof setTimeout> | null = null
  private encerrado = false
  /** Saiu da tela: nada mais mexe na tela (mesmo uma conferência que ainda estava no meio). */
  private desligado = false
  /** A nuvem não aceita rascunhos (banco sem a tabela): segue só com o registro salvo. */
  private remotoIndisponivel = false
  private fotosEnviadas = new Set<string>()
  private readonly fotos: CacheFotos
  private estado: EstadoSincronia = {
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

  constructor(cfg: ConfigSincronizador<C>) {
    this.cfg = cfg
    this.agora = cfg.agora ?? (() => Date.now())
    this.relogio = cfg.relogio ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.novoId = cfg.novoId ?? idAleatorio
    this.ociosoMs = cfg.ociosoMs ?? 1200
    this.atrasoEnvioMs = cfg.atrasoEnvioMs ?? 1500
    this.fotos = cfg.fotos ?? fotosDoAparelho
    this.conteudo = cfg.tipo.vazio(cfg.dataDocumento)
    this.base = cfg.tipo.vazio(cfg.dataDocumento)
  }

  // ─── API ───────────────────────────────────────────────────

  get estadoAtual(): EstadoSincronia {
    return this.estado
  }

  /** Conteúdo atual (com as fotos). */
  get conteudoAtual(): C {
    return this.conteudo
  }

  /**
   * Começa: mostra na hora o que este aparelho tinha guardado e depois junta
   * com o rascunho da nuvem e com o que está salvo no banco.
   * `registro` = o que a tela já buscou no banco (undefined = buscar aqui).
   */
  iniciar(registro?: RegistroBanco<C> | null): Promise<void> {
    return this.executar(() => this.iniciarInterno(registro))
  }

  /** Cada mudança feita na tela. */
  editar(c: C): void {
    if (this.encerrado || !this.estado.pronto) return
    if (iguais(this.comparavel(c), this.comparavel(this.conteudo))) return
    this.conteudo = c
    this.editadoEm = this.relogio()
    this.salvarLocal()
    this.atualizarEstado({ pendente: this.calcularPendente() })
    this.agendarEnvio()
  }

  /** Confere a nuvem e junta o que mudou (chamado de tempos em tempos e ao voltar para a tela). */
  puxar(): Promise<void> {
    return this.executar(async () => {
      try {
        await this.puxarInterno(false, false)
      } catch (e) {
        if (!(e instanceof SemInternet)) throw e
      }
    })
  }

  /** Confere a nuvem já, mesmo com a pessoa digitando (antes de gerar PDF/imprimir). */
  sincronizarAgora(): Promise<void> {
    return this.executar(async () => {
      try {
        await this.puxarInterno(true, true)
      } catch (e) {
        if (!(e instanceof SemInternet)) throw e
      }
    })
  }

  /** Manda já o que está pendente (ao sair da tela). */
  enviarAgora(): Promise<void> {
    this.cancelarEnvio()
    return this.executar(() => this.empurrarInterno())
  }

  /**
   * Salva no banco: junta antes com o que está na nuvem, grava só se ninguém
   * gravou no meio (senão junta de novo e tenta outra vez) e depois limpa o
   * rascunho compartilhado. `preparar` ajusta o conteúdo final (ex.: valores
   * que vêm do fechamento do dia).
   */
  salvar(preparar: (c: C) => C = (c) => c): Promise<ResultadoSalvar<C>> {
    this.cancelarEnvio()
    return this.executar(async () => {
      const juntou: string[] = []
      const conflitos: string[] = []
      const coletar = (m: ResultadoMescla<C>) => {
        for (const c of m.deFora) if (!juntou.includes(c)) juntou.push(c)
        for (const c of m.conflitos) if (!conflitos.includes(c)) conflitos.push(c)
      }
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        try {
          await this.puxarInterno(true, true, coletar)
        } catch (e) {
          if (e instanceof SemInternet) throw new ErroAmigavel(ERRO_SEM_INTERNET)
          throw e
        }
        const baseAntes = this.base
        const versaoAntes = this.versaoRascunho
        const { conteudo: enviado, faltando } = await this.resolverFotos(this.conteudo, this.banco)
        if (faltando.length > 0) {
          throw new ErroAmigavel('Uma foto que veio do outro aparelho ainda está chegando. Espere uns segundos e toque em Salvar de novo.')
        }
        const esperado = this.banco ? { id: this.banco.id, versao: this.banco.versao } : null
        let r: ResultadoGravacao<C>
        try {
          r = await this.cfg.banco.gravar(preparar(enviado), esperado)
        } catch (e) {
          if (ehFalhaDeRede(e)) {
            this.atualizarEstado({ online: false })
            throw new ErroAmigavel(ERRO_SEM_INTERNET)
          }
          throw e
        }
        if (r === 'conflito') continue
        if (r === 'excluido') {
          this.banco = null
          this.atualizarEstado({ excluido: true, banco: null })
          continue
        }
        this.lembrarFotos(r.conteudo)
        this.banco = this.refDe(r)
        // O que foi digitado enquanto salvava continua na tela (fica como alteração não salva).
        this.conteudo = this.cfg.tipo.mesclar(enviado, this.conteudo, r.conteudo).resultado
        this.mostrar(this.conteudo)
        this.atualizarEstado({ excluido: false, banco: this.resumoBanco(), restaurado: null })
        await this.depoisDeSalvar(baseAntes, versaoAntes, coletar)
        this.salvarLocal()
        this.atualizarEstado({ pendente: this.calcularPendente() })
        this.marcarOnline()
        return { registro: r, juntou, conflitos }
      }
      throw new ErroAmigavel('O outro aparelho está salvando este mesmo dia agora. Espere uns segundos e toque em Salvar de novo.')
    })
  }

  /** Joga fora o que não foi salvo (neste aparelho e na nuvem). */
  descartar(): Promise<void> {
    this.cancelarEnvio()
    this.encerrado = true
    this.desligado = true
    this.cfg.local.apagar(this.cfg.chave)
    return this.executar(async () => {
      await this.cfg.remoto.apagar(this.cfg.chave, null)
    })
  }

  /** Depois de excluir o registro: esquece os rascunhos dele. */
  esquecer(): void {
    this.cancelarEnvio()
    this.encerrado = true
    this.desligado = true
    this.cfg.local.apagar(this.cfg.chave)
    void this.cfg.remoto.apagar(this.cfg.chave, null)
  }

  /** Para tudo (saiu da tela). Manda antes o que estava esperando para ir para a nuvem. */
  encerrar(): void {
    this.desligado = true
    if (this.encerrado) return
    const tinhaEnvio = this.timerEnvio !== null
    this.cancelarEnvio()
    if (tinhaEnvio) void this.executar(() => this.empurrarInterno())
    void this.executar(async () => {
      this.encerrado = true
    })
  }

  limparAviso(): void {
    this.atualizarEstado({ chegou: null })
  }

  // ─── Início ────────────────────────────────────────────────

  private async iniciarInterno(registro: RegistroBanco<C> | null | undefined): Promise<void> {
    const { tipo, dataDocumento } = this.cfg
    const local = this.lerLocal()
    let legado: RascunhoLegado<C> | null = null
    if (!local && this.cfg.legado) {
      try {
        legado = this.cfg.legado()
      } catch {
        legado = null
      }
    }

    if (registro) this.lembrarFotos(registro.conteudo)
    if (local) {
      this.conteudo = local.conteudo
      this.base = local.base ?? this.paraRef(local.conteudo)
      this.banco = local.banco
      this.versaoRascunho = local.versaoRascunho
    } else if (registro) {
      this.conteudo = registro.conteudo
      this.base = this.paraRef(registro.conteudo)
      this.banco = this.refDe(registro)
    }
    if (legado) this.conteudo = legado.semFotos && registro ? this.comFotosDe(legado.conteudo, registro.conteudo) : legado.conteudo
    const restaurado = local?.pendente ? { salvoEm: local.salvoEm } : legado ? { salvoEm: legado.salvoEm } : null

    this.mostrar(this.conteudo)
    this.atualizarEstado({ pronto: true, restaurado, banco: this.resumoBanco(), pendente: this.calcularPendente() })
    // O rascunho antigo já foi apagado: guarda logo no formato novo (antes de qualquer espera pela internet).
    if (legado) this.salvarLocal()

    // Agora a nuvem: rascunho compartilhado + registro salvo.
    let env: EnvelopeRascunho<C> | null | undefined
    let reg: RegistroBanco<C> | null | undefined = registro
    try {
      env = await this.lerRascunho()
      if (reg === undefined) reg = await this.lerBanco(this.alvo())
    } catch (e) {
      if (!(e instanceof SemInternet)) throw e
      this.atualizarEstado({ online: false })
      return
    }
    const bancoRef = reg ? this.refDe(reg) : null
    if (this.banco && !bancoRef) this.atualizarEstado({ excluido: true })
    const deles = this.estadoCompartilhado(env, bancoRef)
    // Base da junção: a do rascunho deste aparelho; rascunho antigo de edição vale por cima do salvo;
    // sem rascunho, a tela começou do que estava salvo (ou vazia).
    const base = local ? (local.base ?? deles) : legado ? (legado.edicao ? deles : tipo.vazio(dataDocumento)) : this.base
    await this.juntar(base, deles, env, bancoRef, env?.versao ?? null, true)
    this.salvarLocal()
    this.marcarOnline()
    if (this.precisaEmpurrar()) this.agendarEnvio(0)
  }

  // ─── Puxar ─────────────────────────────────────────────────

  /**
   * Confere versões; se algo mudou, lê e junta.
   * completo = lê tudo sem conferir versão; ignorarOcioso = junta mesmo com a pessoa digitando.
   */
  private async puxarInterno(completo: boolean, ignorarOcioso: boolean, coletar?: (m: ResultadoMescla<C>) => void): Promise<void> {
    if (this.encerrado) return
    if (this.apagarDepois) await this.tentarApagarDepois()
    const alvo = this.alvo()
    let env: EnvelopeRascunho<C> | null
    let reg: RegistroBanco<C> | null | undefined // undefined = o banco não mudou
    let versaoR: string | null

    if (completo) {
      env = await this.lerRascunho()
      reg = await this.lerBanco(alvo)
      versaoR = env?.versao ?? null
    } else {
      const [vr, vb] = await Promise.all([this.cfg.remoto.versao(this.cfg.chave), this.versaoBanco(alvo)])
      if (vr === undefined) throw this.semInternet()
      this.marcarOnline()
      versaoR = vr
      const mudouR = vr !== this.versaoRascunho
      const mudouB = (vb?.id ?? null) !== (this.banco?.id ?? null) || (vb?.versao ?? null) !== (this.banco?.versao ?? null)
      if (!mudouR && !mudouB) {
        this.guardado = null
        await this.completarFotos()
        return
      }
      const g = this.guardado
      env = !mudouR ? this.ultimoRascunho : g && g.versaoR === vr ? g.env : await this.lerRascunho()
      if (!mudouB) reg = undefined
      else if (g && g.reg !== undefined && (g.reg?.id ?? null) === (vb?.id ?? null) && (g.reg?.versao ?? null) === (vb?.versao ?? null)) reg = g.reg
      else reg = vb ? await this.lerBanco({ id: vb.id, data: alvo.data }) : null
    }

    if (!ignorarOcioso && this.digitando()) {
      // Junta quando a pessoa parar de digitar (não troca o que está sendo digitado).
      this.guardado = { versaoR, env, reg }
      return
    }
    this.guardado = null
    const bancoRef = reg === undefined ? this.banco : reg ? this.refDe(reg) : null
    if (this.banco && !bancoRef && !this.estado.excluido) this.atualizarEstado({ excluido: true })
    const deles = this.estadoCompartilhado(env, bancoRef)
    await this.juntar(this.base, deles, env, bancoRef, versaoR, ignorarOcioso, coletar)
    this.salvarLocal()
    this.marcarOnline()
    if (this.precisaEmpurrar()) this.agendarEnvio()
  }

  /** Junta `deles` com a tela usando `base` e passa a considerar `deles` a nova base. */
  private async juntar(
    base: C,
    deles: C,
    env: EnvelopeRascunho<C> | null,
    bancoRef: RefBanco<C> | null,
    versaoR: string | null,
    ignorarOcioso: boolean,
    coletar?: (m: ResultadoMescla<C>) => void,
  ): Promise<boolean> {
    // Foto que ainda não deu para baixar fica como referência (a tela mostra "recebendo a foto")
    // e é baixada numa próxima conferência; a assinatura é a mesma, então não conta como mudança.
    const { conteudo: efetivo } = await this.resolverFotos(deles, bancoRef)
    // Enquanto baixava as fotos a pessoa voltou a digitar: junta na próxima conferência.
    if (!ignorarOcioso && this.digitando()) return false
    const m = this.cfg.tipo.mesclar(base, this.conteudo, efetivo)
    coletar?.(m)
    this.base = this.paraRef(efetivo)
    this.versaoRascunho = versaoR
    this.ultimoRascunho = env
    this.banco = bancoRef
    const mudou = !iguais(this.comparavel(m.resultado), this.comparavel(this.conteudo))
    if (mudou) {
      this.conteudo = m.resultado
      this.mostrar(m.resultado)
    }
    await this.completarFotos()
    const veio = m.deFora.length > 0 || m.conflitos.length > 0
    this.atualizarEstado({
      banco: this.resumoBanco(),
      pendente: this.calcularPendente(),
      ...(mudou && veio ? { chegou: { campos: m.deFora, conflitos: m.conflitos, em: this.agora() } } : {}),
    })
    return true
  }

  /**
   * O que está valendo na nuvem agora: o rascunho compartilhado (com o que
   * mudou no banco por fora aplicado por cima) ou, sem rascunho, o registro salvo.
   */
  private estadoCompartilhado(env: EnvelopeRascunho<C> | null, bancoRef: RefBanco<C> | null): C {
    const { tipo, dataDocumento } = this.cfg
    if (!env) return bancoRef ? bancoRef.conteudo : tipo.vazio(dataDocumento)
    if (!bancoRef) return env.conteudo
    if (env.banco && env.banco.id === bancoRef.id) {
      if (env.banco.versao === bancoRef.versao) return env.conteudo
      return tipo.mesclar(env.banco.conteudo, env.conteudo, bancoRef.conteudo).resultado
    }
    return tipo.mesclar(tipo.vazio(dataDocumento), env.conteudo, bancoRef.conteudo).resultado
  }

  // ─── Empurrar ──────────────────────────────────────────────

  private agendarEnvio(atraso = this.atrasoEnvioMs): void {
    if (this.encerrado) return
    if (this.timerEnvio) clearTimeout(this.timerEnvio)
    this.timerEnvio = setTimeout(() => {
      this.timerEnvio = null
      void this.executar(() => this.empurrarInterno())
    }, atraso)
  }

  private cancelarEnvio(): void {
    if (this.timerEnvio) clearTimeout(this.timerEnvio)
    this.timerEnvio = null
  }

  private async empurrarInterno(): Promise<void> {
    for (let tentativa = 0; tentativa < 5 && !this.encerrado && !this.remotoIndisponivel; tentativa++) {
      if (!this.precisaEmpurrar()) return
      this.atualizarEstado({ enviando: true })
      try {
        const { env, fotoFalhou } = await this.montarEnvelope()
        const ok = await this.cfg.remoto.gravar(this.cfg.chave, env as EnvelopeRascunho, this.versaoRascunho)
        if (ok === 'indisponivel') {
          // Sem rascunho na nuvem: o que foi digitado fica neste aparelho até salvar (a base não muda).
          this.remotoIndisponivel = true
          return
        }
        if (ok === undefined) {
          this.atualizarEstado({ online: false })
          this.agendarEnvio(10_000)
          return
        }
        if (ok) {
          this.versaoRascunho = env.versao
          this.ultimoRascunho = env
          this.base = env.conteudo
          this.salvarLocal()
          this.marcarOnline()
          if (fotoFalhou) this.agendarEnvio(10_000)
          return
        }
        // Alguém gravou antes: junta o que chegou e tenta de novo.
        await this.puxarInterno(true, true)
      } catch (e) {
        if (e instanceof SemInternet) {
          this.atualizarEstado({ online: false })
          this.agendarEnvio(10_000)
          return
        }
        throw e
      } finally {
        this.atualizarEstado({ enviando: false })
      }
    }
  }

  private async montarEnvelope(): Promise<{ env: EnvelopeRascunho<C>; fotoFalhou: boolean }> {
    const conteudo = this.paraRef(this.conteudo)
    let fotoFalhou = false
    for (const campo of this.cfg.tipo.camposFoto) {
      const valor = this.conteudo[campo] as unknown as string | null
      const sig = conteudo[campo] as unknown as string | null
      if (!valor || !sig || ehReferenciaFoto(valor) || this.fotoNoBanco(sig) || this.fotosEnviadas.has(sig)) continue
      if (await this.cfg.remoto.gravarFoto(sig, valor)) this.fotosEnviadas.add(sig)
      else {
        // Sem a foto na nuvem o outro aparelho não teria como abrir: por enquanto vai a anterior.
        ;(conteudo as Record<keyof C, unknown>)[campo] = this.base[campo]
        fotoFalhou = true
      }
    }
    return {
      env: {
        v: 2,
        versao: this.novoId(),
        conteudo,
        banco: this.banco,
        aparelho: this.cfg.aparelho,
        pendente: this.calcularPendente(),
        salvoEm: new Date(this.agora()).toISOString(),
      },
      fotoFalhou,
    }
  }

  // ─── Depois de salvar ──────────────────────────────────────

  private async depoisDeSalvar(baseAntes: C, versaoAntes: string | null, coletar: (m: ResultadoMescla<C>) => void): Promise<void> {
    // As fotos agora estão no banco: a cópia que ficava no rascunho pode sair.
    for (const campo of this.cfg.tipo.camposFoto) {
      const sig = assinaturaFoto(this.conteudo[campo] as unknown as string | null)
      if (sig) void this.cfg.remoto.apagarFoto(sig)
    }
    const versao = versaoAntes
    if (versao === null) {
      this.base = this.baseSalva()
      this.versaoRascunho = null
      this.ultimoRascunho = null
      return
    }
    const apagou = await this.cfg.remoto.apagar(this.cfg.chave, versao)
    if (apagou !== false) {
      // Apagou (ou não deu agora: tenta de novo na próxima conferência).
      if (apagou === undefined) this.apagarDepois = versao
      this.base = this.baseSalva()
      this.versaoRascunho = null
      this.ultimoRascunho = null
      return
    }
    // O outro aparelho mandou mais coisa no meio: junta (a base comum é a de antes de salvar) e publica de novo.
    let base = baseAntes
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const env = await this.cfg.remoto.ler(this.cfg.chave).catch(() => undefined)
      if (env === undefined) return
      if (env === null) {
        this.base = this.baseSalva()
        this.versaoRascunho = null
        this.ultimoRascunho = null
        return
      }
      const deles = this.cfg.tipo.completar((env as EnvelopeRascunho<C>).conteudo, this.cfg.dataDocumento)
      await this.juntar(base, deles, env as EnvelopeRascunho<C>, this.banco, env.versao, true, coletar)
      const { env: novo } = await this.montarEnvelope()
      const ok = await this.cfg.remoto.gravar(this.cfg.chave, novo as EnvelopeRascunho, env.versao)
      if (ok !== false) {
        if (ok === true) {
          this.versaoRascunho = novo.versao
          this.ultimoRascunho = novo
          this.base = novo.conteudo
        }
        return
      }
      base = this.base
    }
  }

  private async tentarApagarDepois(): Promise<void> {
    const versao = this.apagarDepois
    if (!versao) return
    const r = await this.cfg.remoto.apagar(this.cfg.chave, versao)
    if (r !== undefined) this.apagarDepois = null
  }

  // ─── Leitura ───────────────────────────────────────────────

  private marcarOnline(): void {
    this.atualizarEstado({ online: true, sincronizadoEm: Math.floor(this.agora() / 60_000) * 60_000 })
  }

  private semInternet(): SemInternet {
    this.atualizarEstado({ online: false })
    return new SemInternet('sem internet')
  }

  private async lerRascunho(): Promise<EnvelopeRascunho<C> | null> {
    const env = await this.cfg.remoto.ler(this.cfg.chave)
    if (env === undefined) throw this.semInternet()
    if (!env) return null
    const banco = env.banco
      ? { ...env.banco, conteudo: this.cfg.tipo.completar(env.banco.conteudo, this.cfg.dataDocumento) }
      : null
    return { ...(env as EnvelopeRascunho<C>), conteudo: this.cfg.tipo.completar(env.conteudo, this.cfg.dataDocumento), banco }
  }

  private async lerBanco(alvo: AlvoBanco): Promise<RegistroBanco<C> | null> {
    try {
      const r = await this.cfg.banco.ler(alvo)
      if (r) this.lembrarFotos(r.conteudo)
      return r
    } catch (e) {
      throw ehFalhaDeRede(e) ? this.semInternet() : e
    }
  }

  private async versaoBanco(alvo: AlvoBanco): Promise<{ id: string; versao: string } | null> {
    try {
      return await this.cfg.banco.versao(alvo)
    } catch (e) {
      throw ehFalhaDeRede(e) ? this.semInternet() : e
    }
  }

  private alvo(): AlvoBanco {
    return { id: this.banco?.id ?? null, data: this.cfg.dataDocumento }
  }

  /** Baixa as fotos que ainda estão só como referência na tela. */
  private async completarFotos(): Promise<void> {
    if (!this.cfg.tipo.camposFoto.some((f) => ehReferenciaFoto(this.conteudo[f] as unknown as string | null))) return
    const antes = this.conteudo
    const { conteudo, faltando } = await this.resolverFotos(antes, this.banco)
    if (faltando.length === this.cfg.tipo.camposFoto.filter((f) => ehReferenciaFoto(antes[f] as unknown as string | null)).length) return
    // Só troca as fotos (a pessoa pode ter digitado enquanto baixava).
    const novo = { ...this.conteudo }
    for (const f of this.cfg.tipo.camposFoto) {
      if (ehReferenciaFoto(novo[f] as unknown as string | null) && novo[f] === antes[f]) (novo as Record<keyof C, unknown>)[f] = conteudo[f]
    }
    this.conteudo = novo
    this.mostrar(novo)
    this.salvarLocal()
  }

  /** Troca referências de foto pelas fotos (memória → nuvem → banco). */
  private async resolverFotos(c: C, bancoRef: RefBanco<C> | null): Promise<{ conteudo: C; faltando: (keyof C)[] }> {
    const saida = { ...c }
    const faltando: (keyof C)[] = []
    for (const campo of this.cfg.tipo.camposFoto) {
      const v = c[campo] as unknown as string | null
      if (!ehReferenciaFoto(v)) continue
      const naTela = this.conteudo[campo] as unknown as string | null
      let foto = this.fotos.obter(v) ?? (naTela && !ehReferenciaFoto(naTela) && assinaturaFoto(naTela) === v ? naTela : undefined)
      if (!foto) {
        const daNuvem = await this.cfg.remoto.lerFoto(v)
        if (daNuvem) {
          this.fotos.lembrar(daNuvem)
          foto = daNuvem
        }
      }
      if (!foto && bancoRef && this.fotoDe(bancoRef.conteudo, v)) {
        const reg = await this.cfg.banco.ler({ id: bancoRef.id, data: bancoRef.data }).catch(() => null)
        if (reg) this.lembrarFotos(reg.conteudo)
        foto = this.fotos.obter(v)
      }
      if (foto) (saida as Record<keyof C, unknown>)[campo] = foto
      else faltando.push(campo)
    }
    return { conteudo: saida, faltando }
  }

  // ─── Utilidades ────────────────────────────────────────────

  private executar<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.fila.then(fn, fn)
    this.fila = p.catch(() => undefined)
    return p
  }

  private digitando(): boolean {
    return this.relogio() - this.editadoEm < this.ociosoMs
  }

  /** Conteúdo com as fotos trocadas pela assinatura (para comparar e guardar na nuvem). */
  private paraRef(c: C): C {
    const saida = { ...c }
    for (const campo of this.cfg.tipo.camposFoto) {
      const v = c[campo] as unknown as string | null
      if (v && !ehReferenciaFoto(v)) this.fotos.lembrar(v)
      ;(saida as Record<keyof C, unknown>)[campo] = assinaturaFoto(v)
    }
    return saida
  }

  private comparavel(c: C): C {
    return this.paraRef(c)
  }

  private comFotosDe(c: C, de: C): C {
    const saida = { ...c }
    for (const campo of this.cfg.tipo.camposFoto) (saida as Record<keyof C, unknown>)[campo] = de[campo]
    return saida
  }

  private fotoDe(c: C, sig: string): boolean {
    return this.cfg.tipo.camposFoto.some((campo) => assinaturaFoto(c[campo] as unknown as string) === sig)
  }

  private fotoNoBanco(sig: string): boolean {
    return Boolean(this.banco && this.fotoDe(this.banco.conteudo, sig))
  }

  private lembrarFotos(c: C): void {
    for (const campo of this.cfg.tipo.camposFoto) this.fotos.lembrar(c[campo] as unknown as string | null)
  }

  private refDe(r: RegistroBanco<C>): RefBanco<C> {
    return { id: r.id, versao: r.versao, data: r.data, conteudo: this.paraRef(r.conteudo) }
  }

  /** Depois de salvar e limpar o rascunho, o que vale na nuvem é o registro salvo. */
  private baseSalva(): C {
    return this.banco ? this.banco.conteudo : this.paraRef(this.conteudo)
  }

  private resumoBanco(): EstadoSincronia['banco'] {
    return this.banco ? { id: this.banco.id, versao: this.banco.versao, data: this.banco.data } : null
  }

  private calcularPendente(): boolean {
    const { tipo, dataDocumento } = this.cfg
    const salvo = this.banco ? this.banco.conteudo : tipo.vazio(dataDocumento)
    return !iguais(tipo.normalizar(this.paraRef(this.conteudo)), tipo.normalizar(salvo))
  }

  private precisaEmpurrar(): boolean {
    return !iguais(this.paraRef(this.conteudo), this.base)
  }

  private lerLocal(): RascunhoLocal<C> | null {
    const bruto = this.cfg.local.ler(this.cfg.chave) as Partial<RascunhoLocal<C>> | null
    if (!bruto || bruto.v !== 2 || !bruto.conteudo) return null
    const { tipo, dataDocumento } = this.cfg
    return {
      v: 2,
      conteudo: tipo.completar(bruto.conteudo, dataDocumento),
      base: bruto.base ? tipo.completar(bruto.base, dataDocumento) : null,
      versaoRascunho: bruto.versaoRascunho ?? null,
      banco: bruto.banco ? { ...bruto.banco, conteudo: tipo.completar(bruto.banco.conteudo, dataDocumento) } : null,
      pendente: Boolean(bruto.pendente),
      salvoEm: bruto.salvoEm ?? new Date(this.agora()).toISOString(),
    }
  }

  private salvarLocal(): void {
    if (this.encerrado) return
    const pendente = this.calcularPendente()
    if (!pendente && !this.precisaEmpurrar()) {
      // Nada a guardar: tudo salvo e já igual à nuvem.
      this.cfg.local.apagar(this.cfg.chave)
      return
    }
    const rascunho: RascunhoLocal<C> = {
      v: 2,
      conteudo: this.conteudo,
      base: this.base,
      versaoRascunho: this.versaoRascunho,
      banco: this.banco,
      pendente,
      salvoEm: new Date(this.agora()).toISOString(),
    }
    if (!this.cfg.local.gravar(this.cfg.chave, rascunho)) {
      // Sem espaço no aparelho: guarda sem as fotos para não perder o resto.
      this.cfg.local.gravar(this.cfg.chave, { ...rascunho, conteudo: this.paraRef(this.conteudo) })
    }
  }

  /** Põe na tela (a não ser que a pessoa já tenha saído dela). */
  private mostrar(c: C): void {
    if (!this.desligado) this.cfg.aplicar(c)
  }

  private atualizarEstado(mudanca: Partial<EstadoSincronia>): void {
    let mudou = false
    for (const k of Object.keys(mudanca) as (keyof EstadoSincronia)[]) {
      if (!iguais(this.estado[k], mudanca[k])) mudou = true
    }
    if (!mudou) return
    this.estado = { ...this.estado, ...mudanca }
    if (!this.desligado) this.cfg.aoMudar?.(this.estado)
  }
}

/**
 * Formulário novo cuja data foi trocada antes de salvar: leva o que foi
 * preenchido para o rascunho do outro dia (juntando com o que já houver lá).
 */
export function levarParaOutroDia<C extends { data: string }>(
  local: ArmazemLocal,
  tipo: TipoDocumento<C>,
  chaveNova: string,
  dataNova: string,
  conteudo: C,
  agora: Date = new Date(),
): void {
  const movido = { ...conteudo, data: dataNova }
  const existente = local.ler(chaveNova) as Partial<RascunhoLocal<C>> | null
  const salvoEm = agora.toISOString()
  if (existente && existente.v === 2 && existente.conteudo) {
    const atual = tipo.completar(existente.conteudo, dataNova)
    const junto = tipo.mesclar(tipo.vazio(dataNova), atual, movido).resultado
    local.gravar(chaveNova, { ...existente, conteudo: junto, pendente: true, salvoEm })
    return
  }
  const rascunho: RascunhoLocal<C> = {
    v: 2,
    conteudo: movido,
    base: tipo.vazio(dataNova),
    versaoRascunho: null,
    banco: null,
    pendente: true,
    salvoEm,
  }
  local.gravar(chaveNova, rascunho)
}


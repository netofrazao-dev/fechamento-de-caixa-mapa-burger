import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CacheFotos,
  Sincronizador,
  type AdaptadorBanco,
  type AlvoBanco,
  type ArmazemLocal,
  type ArmazemRemoto,
  type EnvelopeRascunho,
  type RegistroBanco,
  type ResultadoGravacao,
} from './sincronia'
import { DOC_RELATORIO } from './documentos'
import { assinaturaFoto, canonico, RELATORIO_VAZIO, type ConteudoRelatorio } from './mesclagem'

const DIA = '2026-11-07'
const CHAVE = `mapa-burger-rascunho-relatorio-do-dia-${DIA}`
const copia = <T,>(x: T): T => (x === undefined ? x : structuredClone(x))
const foto = (n: number) => `data:image/jpeg;base64,${'Q'.repeat(300 + n)}${n}`
const sangria = (valor: number, motivo: string) => ({ valor, motivo, tipo: 'compra' as const })

/** Tabela `rascunhos` de mentira (com gravação condicional, como a de verdade). */
class NuvemFalsa implements ArmazemRemoto {
  linhas = new Map<string, EnvelopeRascunho>()
  fotos = new Map<string, string>()
  offline = false
  /** Banco sem a tabela de rascunhos (ou sem permissão). */
  semTabela = false
  gravacoes = 0
  async ler(chave: string) {
    if (this.offline) return undefined
    if (this.semTabela) return null
    return copia(this.linhas.get(chave) ?? null)
  }
  async versao(chave: string) {
    if (this.offline) return undefined
    if (this.semTabela) return null
    return this.linhas.get(chave)?.versao ?? null
  }
  async gravar(chave: string, env: EnvelopeRascunho, esperado: string | null) {
    if (this.offline) return undefined
    if (this.semTabela) return 'indisponivel' as const
    const atual = this.linhas.get(chave)
    if (esperado === null ? atual : atual?.versao !== esperado) return false
    this.linhas.set(chave, copia(env))
    this.gravacoes++
    return true
  }
  async apagar(chave: string, esperado: string | null) {
    if (this.offline) return undefined
    const atual = this.linhas.get(chave)
    if (esperado !== null && atual?.versao !== esperado) return false
    this.linhas.delete(chave)
    return true
  }
  async lerFoto(sig: string) {
    if (this.offline) return undefined
    return this.fotos.get(sig) ?? null
  }
  async gravarFoto(sig: string, dataUrl: string) {
    if (this.offline) return false
    this.fotos.set(sig, dataUrl)
    return true
  }
  async apagarFoto(sig: string) {
    this.fotos.delete(sig)
  }
}

/** Tabela `relatorios` de mentira: um por dia, versão muda a cada gravação. */
class BancoFalso implements AdaptadorBanco<ConteudoRelatorio> {
  registros = new Map<string, RegistroBanco<ConteudoRelatorio>>()
  private seq = 0
  /** Roda antes de gravar (para simular o outro aparelho gravando no meio). */
  antesDeGravar: (() => void | Promise<void>) | null = null
  private achar(alvo: AlvoBanco) {
    return alvo.id ? this.registros.get(alvo.id) : [...this.registros.values()].find((r) => r.data === alvo.data)
  }
  async ler(alvo: AlvoBanco) {
    return copia(this.achar(alvo) ?? null)
  }
  async versao(alvo: AlvoBanco) {
    const r = this.achar(alvo)
    return r ? { id: r.id, versao: r.versao } : null
  }
  gravarDireto(conteudo: ConteudoRelatorio, id = 'r1'): RegistroBanco<ConteudoRelatorio> {
    const r = { id, versao: `v${++this.seq}`, data: conteudo.data, conteudo: copia(DOC_RELATORIO.normalizar(conteudo)) }
    this.registros.set(id, r)
    return copia(r)
  }
  async gravar(conteudo: ConteudoRelatorio, esperado: { id: string; versao: string } | null): Promise<ResultadoGravacao<ConteudoRelatorio>> {
    const antes = this.antesDeGravar
    this.antesDeGravar = null
    await antes?.()
    if (!esperado) {
      if ([...this.registros.values()].some((r) => r.data === conteudo.data)) return 'conflito'
      return this.gravarDireto(conteudo, `r${this.registros.size + 1}`)
    }
    const atual = this.registros.get(esperado.id)
    if (!atual) return 'excluido'
    if (atual.versao !== esperado.versao) return 'conflito'
    return this.gravarDireto(conteudo, esperado.id)
  }
}

class LocalFalso implements ArmazemLocal {
  dados = new Map<string, string>()
  ler(chave: string) {
    const v = this.dados.get(chave)
    return v ? JSON.parse(v) : null
  }
  gravar(chave: string, valor: unknown) {
    this.dados.set(chave, JSON.stringify(valor))
    return true
  }
  apagar(chave: string) {
    this.dados.delete(chave)
  }
}

function aparelho(nome: string, nuvem: NuvemFalsa, banco: BancoFalso, local = new LocalFalso()) {
  const tela = { conteudo: RELATORIO_VAZIO(DIA) }
  const motor = new Sincronizador<ConteudoRelatorio>({
    chave: CHAVE,
    dataDocumento: DIA,
    aparelho: nome,
    tipo: DOC_RELATORIO,
    banco,
    remoto: nuvem,
    local,
    aplicar: (c) => {
      tela.conteudo = c
    },
    fotos: new CacheFotos(), // cada aparelho com a sua memória
    ociosoMs: 0,
  })
  return {
    tela,
    local,
    motor,
    editar(mudar: (c: ConteudoRelatorio) => Partial<ConteudoRelatorio>) {
      tela.conteudo = { ...tela.conteudo, ...mudar(tela.conteudo) }
      motor.editar(tela.conteudo)
    },
  }
}

describe('sincronia entre PC e celular', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('relatório novo: o que o PC preenche aparece no celular e as fotos/estoque do celular aparecem no PC', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar()
    pc.editar(() => ({ sangrias: [sangria(12.5, 'pão')], funcionariosQueComeram: ['Neto'] }))
    await pc.motor.enviarAgora()

    const cel = aparelho('celular', nuvem, banco)
    await cel.motor.iniciar()
    expect(cel.tela.conteudo.sangrias).toEqual([sangria(12.5, 'pão')])
    expect(cel.tela.conteudo.funcionariosQueComeram).toEqual(['Neto'])

    cel.editar(() => ({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 12 }] }, imagem1: foto(1) }))
    await cel.motor.enviarAgora()
    // a foto vai à parte (uma vez); o rascunho leva só a assinatura
    expect(nuvem.fotos.get(assinaturaFoto(foto(1))!)).toBe(foto(1))
    expect(nuvem.linhas.get(CHAVE)!.conteudo).toMatchObject({ imagem1: assinaturaFoto(foto(1)) })

    await pc.motor.puxar()
    expect(pc.tela.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Coca KS', quantidade: 12 }])
    expect(pc.tela.conteudo.imagem1).toBe(foto(1))
    expect(pc.motor.estadoAtual.chegou?.campos).toEqual(['Estoque', 'Print 1'])
    expect(pc.motor.estadoAtual.pendente).toBe(true) // ainda não foi salvo no banco
  })

  it('os dois mexendo ao mesmo tempo: quem manda depois junta e ninguém perde nada', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    const cel = aparelho('celular', nuvem, banco)
    await pc.motor.iniciar()
    await cel.motor.iniciar()

    pc.editar(() => ({ sangrias: [sangria(30, 'gás')] }))
    cel.editar(() => ({ estoqueQuente: { itens: [{ produto: 'Sprite 350ml', quantidade: 4 }] }, estragou: ['2 pães'] }))
    await pc.motor.enviarAgora()
    await cel.motor.enviarAgora() // a versão mudou no meio: junta e manda de novo
    await pc.motor.puxar()

    for (const a of [pc, cel]) {
      expect(a.tela.conteudo.sangrias).toEqual([sangria(30, 'gás')])
      expect(a.tela.conteudo.estragou).toEqual(['2 pães'])
      expect(a.tela.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Sprite 350ml', quantidade: 4 }])
    }
    expect(canonico(pc.tela.conteudo)).toBe(canonico(cel.tela.conteudo))
  })

  it('celular salva primeiro; o PC continua com o que não salvou e, ao salvar, junta sem duplicar', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar()
    pc.editar(() => ({ sangrias: [sangria(12.5, 'pão')] }))
    await pc.motor.enviarAgora()
    const cel = aparelho('celular', nuvem, banco)
    await cel.motor.iniciar()
    cel.editar(() => ({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 9 }] }, imagem2: foto(2) }))
    // o PC continua lançando e ainda não mandou para a nuvem
    pc.editar((c) => ({ sangrias: [...c.sangrias, sangria(80, 'carne')] }))

    const salvo = await cel.motor.salvar()
    expect(salvo.registro.conteudo.sangrias).toEqual([sangria(12.5, 'pão')])
    expect(nuvem.linhas.has(CHAVE)).toBe(false) // rascunho compartilhado limpo
    expect(nuvem.fotos.size).toBe(0) // foto já está no banco

    await pc.motor.puxar()
    expect(pc.motor.estadoAtual.banco?.id).toBe(salvo.registro.id)
    expect(pc.tela.conteudo.sangrias).toEqual([sangria(12.5, 'pão'), sangria(80, 'carne')])
    expect(pc.tela.conteudo.imagem2).toBe(foto(2))
    expect(pc.motor.estadoAtual.pendente).toBe(true)

    await pc.motor.salvar()
    const r = banco.registros.get(salvo.registro.id)!
    expect(r.conteudo.sangrias).toEqual([sangria(12.5, 'pão'), sangria(80, 'carne')])
    expect(r.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Coca KS', quantidade: 9 }])
    expect(r.conteudo.imagem2).toBe(foto(2))
    expect(banco.registros.size).toBe(1)
    expect(pc.motor.estadoAtual.pendente).toBe(false)
  })

  it('relatório salvo aberto nos dois: o PC salva com a tela antiga e não apaga o estoque e a foto salvos no celular', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const inicial = banco.gravarDireto({ ...RELATORIO_VAZIO(DIA), sangrias: [sangria(10, 'gelo')] })
    const pc = aparelho('pc', nuvem, banco)
    const cel = aparelho('celular', nuvem, banco)
    await pc.motor.iniciar(copia(inicial))
    await cel.motor.iniciar(copia(inicial))

    cel.editar(() => ({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 7 }] }, imagem1: foto(3) }))
    await cel.motor.salvar()
    pc.editar((c) => ({ sangrias: [...c.sangrias, sangria(25, 'troco')] }))
    await pc.motor.salvar()

    const r = banco.registros.get(inicial.id)!
    expect(r.conteudo.sangrias).toEqual([sangria(10, 'gelo'), sangria(25, 'troco')])
    expect(r.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Coca KS', quantidade: 7 }])
    expect(r.conteudo.imagem1).toBe(foto(3))
  })

  it('alguém grava no banco bem na hora em que este aparelho salva: junta e tenta de novo', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const inicial = banco.gravarDireto(RELATORIO_VAZIO(DIA))
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar(copia(inicial))
    pc.editar(() => ({ estragou: ['1 alface'] }))
    banco.antesDeGravar = () => {
      banco.gravarDireto({ ...RELATORIO_VAZIO(DIA), funcionariosQueComeram: ['Pâmela'] }, inicial.id)
    }
    const { juntou } = await pc.motor.salvar()
    const r = banco.registros.get(inicial.id)!
    expect(r.conteudo.estragou).toEqual(['1 alface'])
    expect(r.conteudo.funcionariosQueComeram).toEqual(['Pâmela'])
    expect(juntou).toContain('Funcionários que comeram')
  })

  it('os dois criaram o relatório do dia sem se ver (sem internet): o segundo junta no que já existe', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    const cel = aparelho('celular', nuvem, banco)
    nuvem.offline = true
    await pc.motor.iniciar()
    await cel.motor.iniciar()
    pc.editar(() => ({ sangrias: [sangria(5, 'gelo')], funcionariosQueComeram: ['Neto'] }))
    cel.editar(() => ({ funcionariosQueComeram: ['Neto'], estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 3 }] } }))
    nuvem.offline = false
    await pc.motor.salvar()
    await cel.motor.salvar()
    expect(banco.registros.size).toBe(1)
    const r = [...banco.registros.values()][0]
    expect(r.conteudo.sangrias).toEqual([sangria(5, 'gelo')])
    expect(r.conteudo.funcionariosQueComeram).toEqual(['Neto']) // os dois marcaram: entra uma vez
    expect(r.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Coca KS', quantidade: 3 }])
  })

  it('o celular manda mais coisa bem na hora em que o PC salva: o PC salva e o que o celular mandou continua', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    const cel = aparelho('celular', nuvem, banco)
    await pc.motor.iniciar()
    await cel.motor.iniciar()
    pc.editar(() => ({ sangrias: [sangria(12.5, 'pão')] }))
    await pc.motor.enviarAgora()
    await cel.motor.puxar()
    pc.editar(() => ({ estragou: ['arroz'] }))
    banco.antesDeGravar = async () => {
      cel.editar(() => ({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 6 }] } }))
      await cel.motor.enviarAgora()
    }
    await pc.motor.salvar()
    const id = [...banco.registros.keys()][0]
    expect(banco.registros.get(id)!.conteudo).toMatchObject({ sangrias: [sangria(12.5, 'pão')], estragou: ['arroz'], estoqueQuente: { itens: [] } })
    // o estoque mandado no meio continua no rascunho (e na tela do PC), como alteração ainda não salva
    expect(nuvem.linhas.get(CHAVE)).toMatchObject({ pendente: true, banco: { id }, conteudo: { estragou: ['arroz'] } })
    expect(pc.tela.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Coca KS', quantidade: 6 }])
    expect(pc.motor.estadoAtual.pendente).toBe(true)

    await cel.motor.puxar()
    expect(cel.tela.conteudo).toMatchObject({ estragou: ['arroz'], sangrias: [sangria(12.5, 'pão')] })
    await cel.motor.salvar()
    expect(banco.registros.get(id)!.conteudo).toMatchObject({
      sangrias: [sangria(12.5, 'pão')],
      estragou: ['arroz'],
      estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 6 }] },
    })
    expect(nuvem.linhas.has(CHAVE)).toBe(false)
    await pc.motor.puxar()
    expect(pc.motor.estadoAtual.pendente).toBe(false)
  })

  it('rascunho velho deste aparelho (aba fechada) depois que o outro salvou: junta em vez de desfazer o outro', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const inicial = banco.gravarDireto({ ...RELATORIO_VAZIO(DIA), estragou: ['arroz'] })
    const local = new LocalFalso()
    const cel = aparelho('celular', nuvem, banco, local)
    await cel.motor.iniciar(copia(inicial))
    nuvem.offline = true // celular sem internet: fica só no aparelho
    cel.editar(() => ({ estoqueQuente: { itens: [{ produto: 'Coca KS', quantidade: 5 }] } }))
    cel.motor.encerrar()

    const pc = aparelho('pc', new NuvemFalsa(), banco)
    await pc.motor.iniciar(copia(inicial))
    pc.editar(() => ({ estragou: [], sangrias: [sangria(40, 'gás')] }))
    await pc.motor.salvar()

    nuvem.offline = false
    const atual = await banco.ler({ id: inicial.id, data: DIA })
    const cel2 = aparelho('celular', nuvem, banco, local)
    await cel2.motor.iniciar(atual)
    expect(cel2.motor.estadoAtual.restaurado).not.toBeNull()
    expect(cel2.tela.conteudo.estoqueQuente.itens).toEqual([{ produto: 'Coca KS', quantidade: 5 }])
    expect(cel2.tela.conteudo.estragou).toEqual([]) // o PC tirou: continua tirado
    expect(cel2.tela.conteudo.sangrias).toEqual([sangria(40, 'gás')])
  })

  it('sem internet: guarda no aparelho e manda quando a internet volta', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar()
    nuvem.offline = true
    pc.editar(() => ({ estragou: ['2 pães'] }))
    await pc.motor.enviarAgora()
    expect(pc.motor.estadoAtual.online).toBe(false)
    expect(pc.local.ler(CHAVE)?.conteudo.estragou).toEqual(['2 pães'])
    await expect(pc.motor.salvar()).rejects.toThrow(/Sem conexão/)
    nuvem.offline = false
    await pc.motor.enviarAgora()
    expect(pc.motor.estadoAtual.online).toBe(true)
    expect(nuvem.linhas.get(CHAVE)?.conteudo).toMatchObject({ estragou: ['2 pães'] })
  })

  it('banco sem a tabela de rascunhos: o que foi digitado não some e salvar junta com o que o outro salvou', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.semTabela = true
    const banco = new BancoFalso()
    const inicial = banco.gravarDireto(RELATORIO_VAZIO(DIA))
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar(copia(inicial))
    pc.editar(() => ({ estragou: ['arroz'] }))
    await pc.motor.enviarAgora()
    await pc.motor.puxar()
    expect(pc.tela.conteudo.estragou).toEqual(['arroz'])
    banco.gravarDireto({ ...RELATORIO_VAZIO(DIA), funcionariosQueComeram: ['Neto'] }, inicial.id)
    await pc.motor.puxar()
    expect(pc.tela.conteudo).toMatchObject({ estragou: ['arroz'], funcionariosQueComeram: ['Neto'] })
    await pc.motor.salvar()
    expect(banco.registros.get(inicial.id)!.conteudo).toMatchObject({ estragou: ['arroz'], funcionariosQueComeram: ['Neto'] })
  })

  it('foto do outro aparelho que ainda não deu para baixar não é apagada (tenta de novo depois)', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    const cel = aparelho('celular', nuvem, banco)
    await pc.motor.iniciar()
    await cel.motor.iniciar()
    cel.editar(() => ({ imagem1: foto(9) }))
    await cel.motor.enviarAgora()
    const fotoNaNuvem = nuvem.fotos.get(assinaturaFoto(foto(9))!)!
    nuvem.fotos.clear() // ainda não chegou
    await pc.motor.puxar()
    expect(pc.tela.conteudo.imagem1).toBe(assinaturaFoto(foto(9))) // a tela mostra "recebendo a foto"
    pc.editar(() => ({ estragou: ['gelo'] }))
    await pc.motor.enviarAgora()
    expect(nuvem.linhas.get(CHAVE)!.conteudo).toMatchObject({ imagem1: assinaturaFoto(foto(9)), estragou: ['gelo'] })
    await expect(pc.motor.salvar()).rejects.toThrow(/ainda está chegando/)
    nuvem.fotos.set(assinaturaFoto(foto(9))!, fotoNaNuvem)
    await pc.motor.puxar()
    expect(pc.tela.conteudo.imagem1).toBe(foto(9))
    expect(pc.motor.estadoAtual.chegou?.campos).toEqual(['Print 1'])
  })

  it('o que é digitado enquanto salva continua na tela (como alteração não salva)', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar()
    pc.editar(() => ({ estragou: ['arroz'] }))
    banco.antesDeGravar = () => pc.editar((c) => ({ estragou: [...c.estragou, 'feijão'] }))
    await pc.motor.salvar()
    expect([...banco.registros.values()][0].conteudo.estragou).toEqual(['arroz'])
    expect(pc.tela.conteudo.estragou).toEqual(['arroz', 'feijão'])
    expect(pc.motor.estadoAtual.pendente).toBe(true)
  })

  it('relatório excluído no outro aparelho: avisa e salvar cria de novo', async () => {
    const nuvem = new NuvemFalsa()
    const banco = new BancoFalso()
    const inicial = banco.gravarDireto({ ...RELATORIO_VAZIO(DIA), estragou: ['arroz'] })
    const pc = aparelho('pc', nuvem, banco)
    await pc.motor.iniciar(copia(inicial))
    pc.editar(() => ({ sangrias: [sangria(3, 'gelo')] }))
    banco.registros.clear()
    await pc.motor.puxar()
    expect(pc.motor.estadoAtual.excluido).toBe(true)
    await pc.motor.salvar()
    expect(banco.registros.size).toBe(1)
    expect([...banco.registros.values()][0].conteudo.sangrias).toEqual([sangria(3, 'gelo')])
  })
})

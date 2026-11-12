import type { TipoDocumento } from './sincronia'
import {
  completarFechamento,
  completarRelatorio,
  FECHAMENTO_VAZIO,
  mesclarFechamento,
  mesclarRelatorio,
  RELATORIO_VAZIO,
  type ConteudoFechamento,
  type ConteudoRelatorio,
} from './mesclagem'
import { normalizarFechamento, normalizarRelatorio } from './normalizacao'

/** Como a sincronia trata o relatório do dia. */
export const DOC_RELATORIO: TipoDocumento<ConteudoRelatorio> = {
  vazio: RELATORIO_VAZIO,
  completar: (c, data) => completarRelatorio(c as Partial<ConteudoRelatorio>, data),
  mesclar: mesclarRelatorio,
  normalizar: (c) => ({ ...c, ...normalizarRelatorio(c), imagem1: c.imagem1 ?? null, imagem2: c.imagem2 ?? null }),
  camposFoto: ['imagem1', 'imagem2'],
}

/** Como a sincronia trata o fechamento do caixa. */
export const DOC_FECHAMENTO: TipoDocumento<ConteudoFechamento> = {
  vazio: FECHAMENTO_VAZIO,
  completar: (c, data) => completarFechamento(c as Partial<ConteudoFechamento>, data),
  mesclar: mesclarFechamento,
  normalizar: (c) => {
    const n = normalizarFechamento({ ...c, turno: 'manha' })
    return {
      data: n.data,
      lc: n.lc,
      brendi: n.brendi,
      sangrias: n.sangrias,
      marmitas: n.marmitas,
      totalLCSistema: n.totalLCSistema,
      ajuste: n.ajuste,
      observacoes: n.observacoes,
      suprimento: n.suprimento,
      suprimentoObs: n.suprimento > 0 ? n.suprimentoObs : '',
    }
  },
  camposFoto: [],
}

/** Rascunho compartilhado do relatório de um dia (o mesmo no PC e no celular). */
export const chaveRelatorioDoDia = (data: string) => `mapa-burger-rascunho-relatorio-do-dia-${data}`

/** Rascunho compartilhado do fechamento de um dia (turno da noite só em fechamentos antigos). */
export const chaveFechamentoDoDia = (data: string, turno: 'manha' | 'noite' = 'manha') =>
  `mapa-burger-rascunho-fechamento-do-dia-${data}${turno === 'manha' ? '' : '-noite'}`

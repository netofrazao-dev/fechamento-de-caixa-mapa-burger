/**
 * Verificação automática do banco (Vercel Cron, de 3 em 3 dias — ver vercel.json).
 *
 * O Supabase grátis pausa o banco depois de 7 dias sem uso. Esta função
 * chama `manter_ativo()` no banco (supabase/migration_v5_manter_ativo.sql),
 * que confere se as tabelas respondem e registra a verificação.
 *
 * Usa as mesmas variáveis do app (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY),
 * que já estão na Vercel. Se existir a variável CRON_SECRET, só aceita
 * chamadas da própria Vercel (ela envia "Authorization: Bearer <CRON_SECRET>").
 */

const TENTATIVAS = 3
const TEMPO_LIMITE_MS = 8000

function resposta(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function chamarBanco(url, chave) {
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' }
  const r = await fetch(`${url}/rest/v1/rpc/manter_ativo`, {
    method: 'POST',
    headers: cabecalhos,
    body: '{}',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })
  if (r.ok) return { ok: true, banco: await r.json() }

  const detalhe = await r.text()
  if (r.status === 404) {
    // Função ainda não criada (migração v5 não rodou): faz uma consulta simples,
    // que mesmo recusada por permissão chega no banco e conta como uso.
    await fetch(`${url}/rest/v1/funcionarios?select=id&limit=1`, {
      headers: cabecalhos,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    }).catch(() => {})
    return { ok: false, aviso: 'Rode supabase/migration_v5_manter_ativo.sql no Supabase.', status: r.status }
  }
  throw new Error(`Supabase respondeu ${r.status}: ${detalhe.slice(0, 200)}`)
}

export async function GET(request) {
  const segredo = process.env.CRON_SECRET
  if (segredo && request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return resposta({ ok: false, erro: 'não autorizado' }, 401)
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const chave = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!/^https?:\/\//.test(url) || !chave) {
    return resposta({ ok: false, erro: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas na Vercel.' }, 500)
  }

  let ultimoErro = ''
  for (let i = 1; i <= TENTATIVAS; i++) {
    try {
      const resultado = await chamarBanco(url, chave)
      const tudoCerto = resultado.ok && resultado.banco?.ok === true
      console.log('[manter-ativo]', JSON.stringify(resultado))
      return resposta({ ...resultado, ok: tudoCerto, tentativa: i }, tudoCerto ? 200 : 500)
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e)
      console.error(`[manter-ativo] tentativa ${i} falhou: ${ultimoErro}`)
      if (i < TENTATIVAS) await esperar(2000 * i)
    }
  }
  return resposta({ ok: false, erro: ultimoErro }, 502)
}

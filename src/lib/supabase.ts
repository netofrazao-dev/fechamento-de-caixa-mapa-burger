import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/** false quando faltam as variáveis de ambiente (o app mostra uma tela explicando). */
export const supabaseConfigurado = /^https?:\/\//.test(supabaseUrl) && supabaseAnonKey.length > 0

if (!supabaseConfigurado) {
  console.error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(
  supabaseConfigurado ? supabaseUrl : 'http://supabase-nao-configurado.invalid',
  supabaseConfigurado ? supabaseAnonKey : 'chave-ausente',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Login é só por e-mail e senha; não aceita tokens vindos na URL.
      detectSessionInUrl: false,
      storageKey: 'mapa-burger-sessao',
    },
  },
)

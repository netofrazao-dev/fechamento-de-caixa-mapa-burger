import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ✅ Variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ✅ Validação em tempo de execução
if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL não definida no .env.local')
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY não definida no .env.local')
}

// ✅ Singleton — evita múltiplas instâncias em desenvolvimento (hot reload)
let supabaseInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,       // mantém sessão no localStorage
      autoRefreshToken: true,     // renova token automaticamente
      detectSessionInUrl: true,   // captura tokens de redirect (OAuth, magic link)
    },
  })

  return supabaseInstance
}

export const supabase = getSupabaseClient()
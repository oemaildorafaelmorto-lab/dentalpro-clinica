import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const configurationError = new Error(
  'Supabase ainda não está configurado neste ambiente.'
)

const supabaseUnavailable = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: configurationError,
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: configurationError,
    }),
    signOut: async () => ({ error: null }),
  },
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : supabaseUnavailable

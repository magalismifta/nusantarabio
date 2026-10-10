import { createClient } from '@supabase/supabase-js'

// URL Supabase project kamu
const supabaseUrl = 'https://jcsijgldjiejpzohwvwl.supabase.co'

// Ambil anon key dari Supabase: Project Settings > API > Project API keys (anon public)
const supabaseAnonKey = 'sb_publishable_4igsMT7yxJsFug7_ng8RXg_9VkDpTPi'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const appConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api',
};

export const isSupabaseConfigured =
  Boolean(appConfig.supabaseUrl) &&
  Boolean(appConfig.supabaseAnonKey) &&
  !appConfig.supabaseUrl.includes('<project-ref>') &&
  !appConfig.supabaseAnonKey.includes('<');

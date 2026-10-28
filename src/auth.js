import { createClient } from '@supabase/supabase-js';

let bootstrap;
export function initializeAuth() {
  if (!bootstrap) bootstrap = (async () => {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('El servicio de acceso no está disponible. Intenta de nuevo más tarde.');
    const { supabaseUrl, supabaseAnonKey } = await response.json();
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true }
    });
    const url = new URL(window.location.href);
    let authError = url.searchParams.get('error_description');
    const code = url.searchParams.get('code');
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) authError = 'No se pudo completar el acceso. Vuelve a iniciar sesión con GitHub.';
    }
    if (code || authError || url.pathname === '/auth/callback') window.history.replaceState({}, document.title, '/');
    const { data: { session } } = await client.auth.getSession();
    return { client, session, authError };
  })();
  return bootstrap;
}

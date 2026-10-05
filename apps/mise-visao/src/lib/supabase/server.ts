import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com service role — bypassa RLS. Único cliente Supabase desta zona:
 * o app é somente leitura e não precisa de sessão de usuário para consultar
 * dados (a autenticação do usuário já é garantida pelo middleware do shell).
 *
 * Os dados do MISE vivem no schema `mise` (não em `public`) — sempre acesse
 * via `.schema("mise")`, nunca chame este client do browser.
 *
 * NUNCA expor SUPABASE_SERVICE_ROLE_KEY no bundle do client.
 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

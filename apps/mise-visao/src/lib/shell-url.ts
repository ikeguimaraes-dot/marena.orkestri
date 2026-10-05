import "server-only";

/**
 * Resolve a URL do shell baseado em variáveis de ambiente.
 *
 * Comportamento:
 *   - Se NEXT_PUBLIC_SHELL_URL estiver setada (dev/preview), usa ela.
 *   - Caso contrário, fallback pra produção (http://localhost:3000).
 *
 * Em Edge runtime (middleware), `process.env` está disponível mas NÃO use
 * `node:*` APIs. Este helper usa apenas `process.env` (Web API compatível).
 *
 * IMPORTANTE: este helper existe (com a mesma lógica) em todos os sub-apps
 * do grupo Marena. Ver maza-financeiro/src/lib/shell-url.ts.
 */

const PRODUCTION_SHELL_URL = "http://localhost:3000";

function getShellBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SHELL_URL?.trim();
  const isLocalUrl = fromEnv?.includes("localhost") || fromEnv?.includes("127.0.0.1");
  if (fromEnv && fromEnv.length > 0 && !(process.env.NODE_ENV === "production" && isLocalUrl)) {
    return fromEnv;
  }
  return PRODUCTION_SHELL_URL;
}

/**
 * Monta a URL completa de login do shell, com ?next=<returnTo>.
 *
 * @param returnTo Path do shell para onde o user deve voltar após logar.
 *
 * @example
 *   getShellLoginUrl("/mise")
 *   // → http://localhost:3000/login?next=%2Fmise
 */
export function getShellLoginUrl(returnTo: string): URL {
  const base = getShellBaseUrl();
  const url = new URL("/login", base);
  const safeReturnTo =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/mise";
  url.searchParams.set("next", safeReturnTo);
  return url;
}

/**
 * Retorna só a base do shell (sem path). Útil pra montar redirects
 * absolutos em outros lugares (ex: links no header, deep-links).
 */
export function getShellBase(): string {
  return getShellBaseUrl();
}

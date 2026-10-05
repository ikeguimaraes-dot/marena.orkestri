import path from "node:path";

function zoneUrl(envName: string, localPort: number) {
  const configured = process.env[envName]?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development" || process.env.LOCAL_ZONES === "true") return `http://localhost:${localPort}`;
  throw new Error(`${envName} deve apontar para o módulo da Marena.`);
}
const financeiroOrigin = zoneUrl("FINANCEIRO_APP_URL", 3001);
const zones = [
  { prefix: "/financeiro", origin: financeiroOrigin },
  { prefix: "/mise", origin: zoneUrl("MISE_APP_URL", 3008) },
  { prefix: "/operacao", origin: zoneUrl("OPERACAO_APP_URL", 3003) },
  { prefix: "/compras", origin: zoneUrl("COMPRAS_APP_URL", 3004) },
  ...[
    ["/pessoas", "PESSOAS_APP_URL"], ["/comercial", "COMERCIAL_APP_URL"],
    ["/marca", "MARCA_APP_URL"], ["/inteligencia", "INTELIGENCIA_APP_URL"],
    ["/orquestrador", "INTELIGENCIA_APP_URL"],
  ].flatMap(([prefix, envName]) => {
    const origin = process.env[envName!]?.trim();
    return origin ? [{ prefix: prefix!, origin: origin.replace(/\/$/, "") }] : [];
  }),
];

const nextConfig = {
  // Raiz do monorepo — sem isso o Turbopack infere a raiz a partir de
  // lockfiles fora do repo e quebra a resolução de módulos.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  transpilePackages: ["@maza/db", "@maza/ui", "@maza/auth", "@maza/core"],
  async rewrites() {
    const afterFiles = zones.flatMap(({ prefix, origin }) => [
      // Static assets must be proxied before the page routes so the browser
      // can load JS chunks from the correct zone app.
      {
        source: `${prefix}/_next/:path*`,
        // O sub-app publica os chunks no namespace do assetPrefix; preserve
        // esse prefixo também no destino para o runtime correto hidratar.
        destination: `${origin}${prefix}/_next/:path*`,
      },
      // Mantém as chamadas de API sob o domínio do shell, onde está a sessão,
      // e remove o prefixo antes de encaminhar ao Route Handler do sub-app.
      {
        source: `${prefix}/api/:path*`,
        destination: `${origin}/api/:path*`,
      },
      // Exact match (no trailing path) — :path* doesn't match empty string
      {
        source: `${prefix}`,
        destination: `${origin}${prefix}`,
      },
      {
        source: `${prefix}/:path*`,
        destination: `${origin}${prefix}/:path*`,
      },
    ]);
    // Dashboard belongs to the financial zone and uses the same cockpit.
    // Its assets are already handled by the /financeiro/_next rewrite.
    return { afterFiles: [{ source: "/dashboard", destination: `${financeiroOrigin}/dashboard` }, ...afterFiles] };
  },
};

export default nextConfig;

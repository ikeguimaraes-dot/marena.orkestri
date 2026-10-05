import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta zona vive atrás do rewrite do shell (/mise/* -> este deploy).
  // assetPrefix garante que os chunks de _next/static sejam buscados via
  // /mise/_next/*, e não via /_next/* do domínio do shell.
  assetPrefix: "/mise",
};

export default nextConfig;

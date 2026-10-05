import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

async function rewritesFor(environment) {
  const isolated = source.replaceAll("process.env", `(${JSON.stringify(environment)})`).replaceAll("import.meta.dirname", JSON.stringify(root));
  const { outputText } = ts.transpileModule(isolated, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const { default: config } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  return (await config.rewrites()).afterFiles;
}

test("Dashboard usa a zona financeira local mantendo sua URL", async () => {
  const rewrites = await rewritesFor({ NODE_ENV: "development" });
  assert.deepEqual(rewrites.find((rule) => rule.source === "/dashboard"), { source: "/dashboard", destination: "http://localhost:3001/dashboard" });
});

test("Dashboard e seus assets usam a mesma origem financeira configurada", async () => {
  const rewrites = await rewritesFor({ NODE_ENV: "production", MISE_APP_URL: "https://mise.example.test", OPERACAO_APP_URL: "https://operacao.example.test", COMPRAS_APP_URL: "https://compras.example.test", FINANCEIRO_APP_URL: "https://financeiro.example.test/" });
  assert.equal(rewrites.find((rule) => rule.source === "/dashboard").destination, "https://financeiro.example.test/dashboard");
  assert.equal(rewrites.find((rule) => rule.source === "/financeiro/_next/:path*").destination, "https://financeiro.example.test/financeiro/_next/:path*");
});

test("produção exige configuração própria e nunca usa o cliente original", async () => {
  await assert.rejects(rewritesFor({ NODE_ENV: "production" }), /FINANCEIRO_APP_URL/);
});

test("a página antiga do Shell não intercepta o rewrite do Dashboard", () => {
  assert.equal(existsSync(new URL("../src/app/(dashboard)/dashboard/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/app/dashboard/page.tsx", import.meta.url)), false);
});

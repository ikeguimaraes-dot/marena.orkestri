import { test, expect } from '@playwright/test'

const BASE = process.env.PREVIEW_URL || 'http://localhost:3000'

test('homepage carrega sem erro 5xx', async ({ page }) => {
  const res = await page.goto(BASE)
  expect(res?.status()).toBeLessThan(500)
})

test('orquestrador carrega ou redireciona', async ({ page }) => {
  const res = await page.goto(`${BASE}/orquestrador`)
  expect(res?.status()).toBeLessThan(500)
})

test('API webhook responde (não 500)', async ({ request }) => {
  const res = await request.get(`${BASE}/api/orchestrator/webhook`)
  expect(res.status()).not.toBe(500)
})

test('dashboard carrega ou redireciona', async ({ page }) => {
  const res = await page.goto(`${BASE}/dashboard`)
  expect(res?.status()).toBeLessThan(500)
})

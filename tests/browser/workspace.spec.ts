import { test, expect } from "@playwright/test"
import path from "node:path"

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/api/demo/reset")
  expect(reset.ok()).toBeTruthy()
})

test("workspace navigation and four financial reports render without browser errors", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/app")
  await expect(page.getByRole("heading", { name: "Semua angka, lebih jelas." })).toBeVisible()
  for (const [link, heading] of [["Transaksi", "Transaksi"], ["Bagan akun", "Bagan akun"], ["Aturan kategori", "Aturan kategorisasi"], ["Import CSV", "Impor transaksi"]]) {
    await page.getByRole("navigation").getByRole("link", { name: link, exact: true }).click()
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible()
  }
  await page.getByRole("navigation").getByRole("link", { name: "Laporan", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Financial Reports" })).toBeVisible()
  for (const name of ["Profit & Loss", "EBITDA", "Balance Sheet", "Cash Flow"]) {
    await page.getByRole("button", { name: `Open ${name}`, exact: true }).click()
    await expect(page.getByRole("button", { name: "Back to Reports" })).toBeVisible()
    await page.getByRole("button", { name: "Apply Filter", exact: true }).click()
    await expect(page.getByRole("button", { name: /Export|Download|PDF/i }).first()).toBeVisible()
    await page.getByRole("button", { name: "Back to Reports" }).click()
  }
  expect(errors).toEqual([])
})

test("transaction creation, category editing and CSV export reach persisted API data", async ({ page, request }) => {
  await page.goto("/app/transactions")
  await page.getByRole("button", { name: "Tambah transaksi", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Deskripsi", { exact: true }).fill("Synthetic browser service")
  await dialog.getByLabel("Nominal IDR", { exact: true }).fill("250000")
  await dialog.getByLabel("Jenis", { exact: true }).selectOption("CREDIT")
  await dialog.getByLabel("Kategori", { exact: true }).selectOption("services")
  await dialog.getByRole("button", { name: "Simpan transaksi" }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByLabel("Cari transaksi").fill("Synthetic browser service")
  await expect(page.getByRole("row").filter({ hasText: "Synthetic browser service" })).toBeVisible()
  let state = await (await request.get("/api/transactions")).json()
  const created = state.transactions.find((entry: { description: string }) => entry.description === "Synthetic browser service")
  expect(created.account_id).toBe("services")
  await page.getByRole("button", { name: "Edit Synthetic browser service", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Kategori", { exact: true }).selectOption("")
  await page.getByRole("dialog").getByRole("button", { name: "Simpan transaksi" }).click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  state = await (await request.get("/api/transactions")).json()
  expect(state.transactions.find((entry: { id: string }) => entry.id === created.id).account_id).toBeFalsy()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Ekspor CSV" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  expect(await download.failure()).toBeNull()
})

test("CSV preview imports synthetic rows once and reports duplicate count", async ({ page, request }) => {
  await page.goto("/app/upload")
  await page.locator('input[type="file"]').setInputFiles(path.resolve("public/samples/transactions.csv"))
  await expect(page.getByText("Example product sale", { exact: true }).first()).toBeVisible()
  const before = (await (await request.get("/api/transactions")).json()).transactions.length
  await page.getByRole("button", { name: /Import.*4|Impor.*4|Import transaksi|Impor transaksi/i }).click()
  await expect.poll(async () => (await (await request.get("/api/transactions")).json()).transactions.length).toBe(before + 4)
  await page.goto("/app/upload")
  await page.locator('input[type="file"]').setInputFiles(path.resolve("public/samples/transactions.csv"))
  await page.getByRole("button", { name: /Import.*4|Impor.*4|Import transaksi|Impor transaksi/i }).click()
  await expect(page.getByText(/duplikat/i).last()).toBeVisible()
  expect((await (await request.get("/api/transactions")).json()).transactions.length).toBe(before + 4)
})

test("HTTP rules and reports update coherently and invalid input remains atomic", async ({ request }) => {
  const endpoint = "/api/reports?type=profit-loss&startDate=2026-11-01&endDate=2026-11-30"
  const baseline = await (await request.get(endpoint)).json()
  const classify = await request.post("/api/transactions/auto-tag", { data: { dateFrom: "2026-11-01", dateTo: "2026-11-30" } })
  expect(classify.ok()).toBeTruthy()
  const result = await (await request.get(endpoint)).json()
  expect(result.summary.netIncome - baseline.summary.netIncome).toBe(450000)
  const balance = await (await request.get("/api/reports?type=balance-sheet&endDate=2026-11-30")).json()
  expect(balance.totals.isBalanced).toBeTruthy()
  expect(balance.totals.difference).toBe(0)
  const before = (await (await request.get("/api/transactions")).json()).transactions.length
  const rejected = await request.post("/api/upload", { data: { rows: [
    { date: "2026-11-20", description: "Synthetic valid row", amount: 123, transaction_type: "CREDIT" },
    { date: "2026-02-30", description: "Synthetic invalid row", amount: 123, transaction_type: "CREDIT" },
  ] } })
  expect(rejected.status()).toBe(400)
  expect((await (await request.get("/api/transactions")).json()).transactions.length).toBe(before)
})

for (const report of ["EBITDA", "Cash Flow"]) test(`${report} export creates a real PDF document`, async ({ page }) => {
  const alerts: string[] = []
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept() })
  await page.goto("/app/reports")
  await page.getByRole("button", { name: `Open ${report}`, exact: true }).click()
  await page.getByRole("button", { name: "Apply Filter", exact: true }).click()
  await expect(page.getByRole("button", { name: report === "Cash Flow" ? "PDF" : "Export PDF", exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent("download", { timeout: 25_000 })
  await page.getByRole("button", { name: report === "Cash Flow" ? "PDF" : "Export PDF", exact: true }).click()
  const download = await downloadPromise
  expect(alerts).toEqual([])
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  const document = Buffer.concat(chunks)
  expect(document.subarray(0, 5).toString()).toBe("%PDF-")
  expect(document.length).toBeGreaterThan(1000)
})

test("account catalog and rule builder save and toggle through the browser", async ({ page, request }) => {
  await page.goto("/app/accounts")
  await page.getByRole("button", { name: "Tambah akun", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Kode akun", { exact: true }).fill("6401")
  await page.getByRole("dialog").getByLabel("Nama akun", { exact: true }).fill("Synthetic browser operations")
  await page.getByRole("dialog").getByRole("button", { name: "Simpan akun", exact: true }).click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  await expect(page.getByRole("cell", { name: "Synthetic browser operations", exact: true })).toBeVisible()
  await page.getByRole("navigation").getByRole("link", { name: "Aturan kategori", exact: true }).click()
  await page.getByRole("button", { name: "Buat aturan", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Nama Aturan", { exact: true }).fill("Synthetic browser rule")
  await dialog.getByLabel("Nilai kondisi 1", { exact: true }).fill("product")
  await dialog.getByLabel("Nilai aksi 1", { exact: true }).fill("browser-tag")
  await dialog.getByRole("button", { name: /Simpan|Buat Aturan/ }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText("Synthetic browser rule", { exact: true })).toBeVisible()
  const toggle = page.getByRole("switch", { name: "Aktifkan Synthetic browser rule", exact: true })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await expect.poll(async () => {
    const data = await (await request.get("/api/rules")).json()
    return data.rules.find((rule: { name: string }) => rule.name === "Synthetic browser rule").is_active
  }).toBe(false)
})

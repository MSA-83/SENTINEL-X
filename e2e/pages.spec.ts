import { test, expect } from "@playwright/test"

const BASE_URL = process.env.BASE_URL || "http://localhost:5173"

test.describe("SENTINEL-X Pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test("CommandCenterPage loads", async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator("text=COMMAND CENTER")).toBeVisible()
  })

  test("CaseManagementPage loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`)
    await expect(page.locator("text=CASE MANAGEMENT")).toBeVisible()
  })

  test("EntityResolutionPage loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/entities`)
    await expect(page.locator("text=ENTITY RESOLUTION")).toBeVisible()
  })

  test("AnalyticsDashboard loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`)
    await expect(page.locator("text=ANALYTICS")).toBeVisible()
  })

  test("AIAssistantPage loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/ai`)
    await expect(page.locator("text=AI ASSISTANT")).toBeVisible()
  })

  test("Sidebar navigation works", async ({ page }) => {
    await expect(page.locator("text=Command Center")).toBeVisible()
    await expect(page.locator("text=Cases")).toBeVisible()
    await expect(page.locator("text=Entities")).toBeVisible()
    await expect(page.locator("text=Analytics")).toBeVisible()
    await expect(page.locator("text=AI Assistant")).toBeVisible()
  })

  test("ThreatMap has map container", async ({ page }) => {
    await expect(page.locator(".leaflet-container")).toBeVisible()
  })

  test("LiveFeed displays threats", async ({ page }) => {
    await expect(page.locator("text=Threat Feed")).toBeVisible()
  })

  test("Case filters work", async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`)
    await page.locator("text=Critical").click()
    await page.locator("text=High").click()
  })

  test("Entity type filters work", async ({ page }) => {
    await page.goto(`${BASE_URL}/entities`)
    await page.locator("text=aircraft").click()
    await page.locator("text=vessel").click()
  })

  test("AI assistant can send message", async ({ page }) => {
    await page.goto(`${BASE_URL}/ai`)
    const input = page.locator('textarea[placeholder*="Ask"]')
    await input.fill("Show critical threats")
    await page.locator("button:has-text('Send')").click()
  })

  test("Analytics time range switches", async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`)
    await page.locator("text=7D").click()
    await page.locator("text=30D").click()
  })

  test("Case can be selected", async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`)
    await page.locator("text=Unknown Aircraft Intercept").click()
    await expect(page.locator("text=Case Information")).toBeVisible()
  })

  test("Entity can be selected", async ({ page }) => {
    await page.goto(`${BASE_URL}/entities`)
    await page.locator("text=Unknown-2024-A892").click()
    await expect(page.locator("text=Entity Details")).toBeVisible()
  })

  test("Quick actions in AI assistant", async ({ page }) => {
    await page.goto(`${BASE_URL}/ai`)
    await page.locator("text=Show Critical Threats").click()
    await expect(page.locator('textarea[value*="critical"]')).toBeVisible()
  })

  test("System status displays", async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics`)
    await expect(page.locator("text=Data Ingestion")).toBeVisible()
    await expect(page.locator("text=Real-time Stream")).toBeVisible()
  })

  test("Threat severity badges", async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator("text=Critical")).toBeVisible()
    await expect(page.locator("text=High")).toBeVisible()
    await expect(page.locator("text=Medium")).toBeVisible()
    await expect(page.locator("text=Low")).toBeVisible()
  })

  test("View mode toggle works", async ({ page }) => {
    await page.goto(BASE_URL)
    await page.locator("text=Map").click()
    await page.locator("text=Feed").click()
    await page.locator("text=Split").click()
  })
})
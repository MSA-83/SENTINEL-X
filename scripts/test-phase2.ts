import { createPageHelper, runTest } from "./auth";

runTest("SENTINEL-X Phase 2 — Multi-INT Integration", async (helper) => {
	const { page } = helper;

	// Go to landing page first
	await page.goto(`${process.env.APP_URL || "http://localhost:5173"}/`, { waitUntil: "networkidle" });
	await page.waitForTimeout(2000);
	await page.screenshot({ path: "tmp/screenshot-landing-v2.png", fullPage: false });
	console.log("✅ Landing page loaded");

	// Go to dashboard
	await page.goto(`${process.env.APP_URL || "http://localhost:5173"}/dashboard`, { waitUntil: "networkidle" });
	await page.waitForTimeout(5000);

	// Verify core elements
	const sentinel = page.locator("text=SENTINEL-X");
	await sentinel.first().waitFor({ timeout: 10000 });
	console.log("✅ SENTINEL-X branding visible");

	const mapEl = page.locator("#sentinel-map");
	const mapVisible = await mapEl.isVisible();
	console.log(`✅ Map visible: ${mapVisible}`);

	const liveIndicator = page.locator("text=LIVE");
	const liveVisible = await liveIndicator.first().isVisible();
	console.log(`✅ LIVE indicator: ${liveVisible}`);

	// Check new layer controls
	const layerLabels = ["ADS-B", "ACLED", "GNSS", "FIRMS", "VESSEL", "CYBER", "OSINT", "WX", "SAT-IMG", "N2YO"];
	for (const label of layerLabels) {
		const el = page.locator(`text=${label}`);
		const visible = await el.first().isVisible().catch(() => false);
		console.log(`  Layer toggle "${label}": ${visible ? "✅" : "⚠️ not found"}`);
	}

	// Check stats bar items
	const statsLabels = ["Aircraft", "Jamming", "Fire Hotspots", "Vessels", "Alerts", "Conflicts", "Satellites", "Ingest", "Sources"];
	for (const label of statsLabels) {
		const el = page.locator(`text=${label}`);
		const visible = await el.first().isVisible().catch(() => false);
		console.log(`  Stat "${label}": ${visible ? "✅" : "⚠️"}`);
	}

	// Check right panel tabs
	const tabs = ["ALERTS", "OSINT", "SOURCES"];
	for (const tab of tabs) {
		const el = page.locator(`text=${tab}`);
		const visible = await el.first().isVisible().catch(() => false);
		console.log(`  Tab "${tab}": ${visible ? "✅" : "⚠️"}`);
	}

	// Screenshot command center with all layers
	await page.screenshot({ path: "tmp/screenshot-phase2-full.png", fullPage: false });
	console.log("✅ Phase 2 command center screenshot");

	// Click OSINT tab (use the tab button specifically, not the layer toggle)
	const osintTab = page.locator("button.flex-1:has-text('OSINT')");
	if (await osintTab.isVisible()) {
		await osintTab.click();
		await page.waitForTimeout(1000);
		await page.screenshot({ path: "tmp/screenshot-phase2-osint.png", fullPage: false });
		console.log("✅ OSINT tab screenshot");
	}

	// Click SOURCES tab
	const sourcesTab = page.locator("button.flex-1:has-text('SOURCES')");
	if (await sourcesTab.isVisible()) {
		await sourcesTab.click();
		await page.waitForTimeout(1000);
		await page.screenshot({ path: "tmp/screenshot-phase2-sources.png", fullPage: false });
		console.log("✅ Sources tab screenshot");
	}

	// Click back to ALERTS
	const alertsTab = page.locator("button.flex-1:has-text('ALERTS')");
	if (await alertsTab.isVisible()) {
		await alertsTab.click();
		await page.waitForTimeout(1000);
	}

	// Wait for aircraft movement & take final screenshot
	await page.waitForTimeout(6000);
	await page.screenshot({ path: "tmp/screenshot-phase2-final.png", fullPage: false });
	console.log("✅ Final command center screenshot (after data refresh)");
});

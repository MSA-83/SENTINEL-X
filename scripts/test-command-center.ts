import { createPageHelper, runTest } from "./auth";

runTest("SENTINEL-X Command Center", async (helper) => {
	const { page } = helper;

	// Go to landing page and screenshot
	await page.goto(`${process.env.APP_URL || "http://localhost:5173"}/`, { waitUntil: "networkidle" });
	await page.waitForTimeout(2000);
	await page.screenshot({ path: "tmp/screenshot-landing.png", fullPage: false });
	console.log("✅ Landing page screenshot taken");

	// Navigate to dashboard (should auto-redirect after login from createPageHelper)
	await page.goto(`${process.env.APP_URL || "http://localhost:5173"}/dashboard`, { waitUntil: "networkidle" });

	// Wait for map and data to load
	await page.waitForTimeout(5000);

	// Screenshot the command center
	await page.screenshot({ path: "tmp/screenshot-command-center.png", fullPage: false });
	console.log("✅ Command center screenshot taken");

	// Verify key elements exist
	const sentinel = page.locator("text=SENTINEL-X");
	await sentinel.first().waitFor({ timeout: 10000 });
	console.log("✅ SENTINEL-X branding visible");

	// Check for map
	const mapEl = page.locator("#sentinel-map");
	const mapVisible = await mapEl.isVisible();
	console.log(`✅ Map visible: ${mapVisible}`);

	// Check for stats bar elements
	const liveIndicator = page.locator("text=LIVE");
	const liveVisible = await liveIndicator.first().isVisible();
	console.log(`✅ LIVE indicator visible: ${liveVisible}`);

	// Take another screenshot after some aircraft movement
	await page.waitForTimeout(6000);
	await page.screenshot({ path: "tmp/screenshot-command-center-2.png", fullPage: false });
	console.log("✅ Second command center screenshot taken (after aircraft movement)");
});

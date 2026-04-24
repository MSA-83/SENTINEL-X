import { runTest } from "./auth";

runTest("Phase 14 Screenshots", async (helper) => {
  const { page } = helper;

  // Executive Summary
  await helper.goto("/executive");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tmp/phase14-executive.png", fullPage: false });
  console.log("✅ Executive Summary screenshot");

  // Case Management
  await helper.goto("/cases");
  await page.waitForTimeout(2000);
  // Click first case in list if any
  const caseItem = page.locator("button").filter({ hasText: /CASE-/ }).first();
  if (await caseItem.isVisible()) {
    await caseItem.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: "tmp/phase14-cases.png", fullPage: false });
  console.log("✅ Case Management screenshot");

  // Knowledge Graph
  await helper.goto("/knowledge-graph");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tmp/phase14-knowledge-graph.png", fullPage: false });
  console.log("✅ Knowledge Graph screenshot");

  // AI Copilot
  await helper.goto("/copilot");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tmp/phase14-copilot.png", fullPage: false });
  console.log("✅ AI Copilot screenshot");

  // Asset Tracking
  await helper.goto("/assets");
  await page.waitForTimeout(2000);
  const assetItem = page.locator("button").first();
  if (await assetItem.isVisible()) {
    await assetItem.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: "tmp/phase14-assets.png", fullPage: false });
  console.log("✅ Asset Tracking screenshot");

  // Admin Console
  await helper.goto("/admin");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tmp/phase14-admin.png", fullPage: false });
  console.log("✅ Admin Console screenshot");

  // Workspace Manager
  await helper.goto("/workspaces");
  await page.waitForTimeout(2000);
  const wsItem = page.locator("button").filter({ hasText: /Mediterranean|Ukraine|Indo-Pacific/ }).first();
  if (await wsItem.isVisible()) {
    await wsItem.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: "tmp/phase14-workspaces.png", fullPage: false });
  console.log("✅ Workspace Manager screenshot");

  console.log("All Phase 14 screenshots taken!");
}).catch(() => process.exit(1));

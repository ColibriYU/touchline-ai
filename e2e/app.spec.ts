import { test, expect } from "@playwright/test";
test("触屏拖动站位保存后可恢复", async ({ page }) => {
  await page.goto("/");
  const marker = page.locator(".pitch g[transform]").first();
  await expect(marker).toBeVisible();
  const before = await marker.getAttribute("transform");
  const box = (await marker.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + 15;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 25, y: y + 25 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(marker).not.toHaveAttribute("transform", before!);
  const after = await marker.getAttribute("transform");
  await expect(page.getByRole("status")).toHaveText("已保存到此设备");
  await page.reload();
  await expect(page.locator(".pitch g[transform]").first()).toHaveAttribute(
    "transform",
    after!,
  );
});
test("AI模拟响应：显式采纳与过期建议保护", async ({ page }) => {
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        judgment: "测试判断",
        priority: "测试变阵",
        execution: "测试执行",
        evidence: ["测试依据"],
        risks: ["测试风险"],
        alternatives: ["测试备选"],
        missing: ["测试缺失"],
        action: { type: "formation", formation: "4-4-2" },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "✦ 请求AI分析" }).click();
  await expect(
    page.getByRole("heading", { name: "1. 当前问题判断" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "阵型", exact: true }),
  ).toHaveValue("4-3-3");
  await page.getByRole("button", { name: "采纳建议并执行" }).click();
  await expect(
    page.getByRole("combobox", { name: "阵型", exact: true }),
  ).toHaveValue("4-4-2");
  await page.getByRole("button", { name: "✦ 请求AI分析" }).click();
  await expect(
    page.getByRole("button", { name: "采纳建议并执行" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "阵型", exact: true })
    .selectOption("4-2-3-1");
  await expect(
    page.getByRole("button", { name: "阵容已变化，请重新分析" }),
  ).toBeDisabled();
});
test("球员编辑支持多个特征，导出与无效导入保护", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "球员", exact: true }).click();
  await page.getByRole("button", { name: "＋ 添加球员" }).click();
  await page.getByLabel("姓名", { exact: true }).fill("测试球员");
  await page.getByLabel("优势（逗号分隔）").pressSequentially("one,two");
  await page.getByRole("button", { name: "保存档案" }).click();
  await expect(page.locator("article")).toHaveCount(18);
  await expect(page.getByText("优势：one、two")).toBeVisible();
  await page.getByRole("button", { name: "数据", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整JSON备份" }).click();
  expect((await downloaded).suggestedFilename()).toBe("touchline-backup.json");
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(page.getByRole("status")).toContainText("导入失败");
  await page.getByRole("button", { name: "球员", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(18);
});
test("手机：球员、首发、比赛、撤销、持久化、AI失败与离线", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "赛前战术板" })).toBeVisible();
  await page.getByRole("button", { name: "球员", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(17);
  await page.getByPlaceholder("搜索姓名、优势或弱点").fill("王靖雨");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByPlaceholder("搜索姓名、优势或弱点").fill("");
  await page.getByRole("button", { name: "阵容", exact: true }).click();
  for (let i = 0; i < 11; i++)
    await page
      .getByRole("combobox", { name: new RegExp(`^位置${i + 1} `) })
      .selectOption(
        [
          "p09",
          "p11",
          "p10",
          "p06",
          "p08",
          "p07",
          "p05",
          "p03",
          "p04",
          "p01",
          "p02",
        ][i],
      );
  await page.screenshot({
    path: "test-results/mobile-lineup.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "比赛", exact: true }).click();
  await page.getByRole("button", { name: "＋ 创建比赛" }).click();
  await page.getByLabel("对手", { exact: true }).fill("校园联队");
  await page.getByRole("button", { name: "保存并进入比赛" }).click();
  await page.getByRole("button", { name: "开始 / 继续" }).click();
  await page.getByRole("button", { name: "我方 ＋1" }).click();
  await expect(page.locator(".scoreline strong")).toHaveText("1 : 0");
  await page.getByRole("button", { name: "撤销", exact: true }).first().click();
  await expect(page.locator(".scoreline strong")).toHaveText("0 : 0");
  await page.getByLabel("原因 / 状态 / 补充说明").fill("加强边路保护");
  await page
    .getByRole("combobox", { name: "换下", exact: true })
    .selectOption("p01");
  await page
    .getByRole("combobox", { name: "换上", exact: true })
    .selectOption("p12");
  await page.getByRole("button", { name: "确认换人（先填写原因）" }).click();
  await expect(page.getByText("剩余换人 4 次", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "✦ 请求AI分析" }).click();
  await expect(page.getByRole("alert")).toContainText("尚未配置");
  await page.reload();
  await page.getByRole("button", { name: "比赛", exact: true }).click();
  await expect(page.getByText("剩余换人 4 次", { exact: false })).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-match.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "比赛", exact: true }).click();
  await expect(
    page.getByText("离线模式 · 比赛记录可用，AI暂不可用"),
  ).toBeVisible();
  await page.getByRole("button", { name: "我方 ＋1" }).click();
  await expect(page.locator(".scoreline strong")).toHaveText("1 : 0");
  await page.getByRole("button", { name: "✦ 请求AI分析" }).click();
  await expect(page.getByRole("alert")).toContainText("当前离线");
  expect(errors).toEqual([]);
});
test("桌面布局和空状态", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "赛前战术板" })).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

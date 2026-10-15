import { expect, test } from "@playwright/test";
import { formsSchema } from "../../src/lib/schemas/site";
import { contentYaml } from "./helpers";

const { messages } = formsSchema.parse(contentYaml("site/forms.yaml"));

test("fields stack in one column; tapping Absenden! checks like on desktop", async ({ page }) => {
  await page.goto("/kontakt/");
  const boxes = await Promise.all(
    ["#vorname", "#nachname", "#email", "#text", "#send_contact"].map((selector) =>
      page.locator(selector).boundingBox(),
    ),
  );
  for (const [index, box] of boxes.entries()) {
    expect(box!.width).toBeGreaterThan(300);
    if (index > 0) expect(box!.y).toBeGreaterThan(boxes[index - 1]!.y + boxes[index - 1]!.height);
  }

  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.dismiss();
  });
  await page.fill("#vorname", "Max");
  await page.locator("#send_contact").tap();
  await expect.poll(() => alerts).toEqual([messages.lastName]);
  await expect(page.locator("#nachname")).toBeFocused();
});

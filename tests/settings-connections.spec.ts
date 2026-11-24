import { test, expect } from "@playwright/test";

test("connection settings control which public sources are shown", async ({page})=>{
  await page.goto("/");
  await page.getByTitle("Настройки", {exact:true}).click();
  await page.getByRole("button", {name:"Подключения",exact:true}).click();
  const telegram = page.getByRole("checkbox",{name:"Telegram · @bulotkaff"});
  await expect(telegram).toBeChecked();
  await telegram.uncheck();
  await page.getByRole("button",{name:"Открыть источники"}).click();
  await expect(page.getByRole("heading",{name:"Лента",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Telegram",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"ВКонтакте",exact:true})).toBeVisible();
  await page.reload();
  await page.getByTitle("Настройки", {exact:true}).click();
  await page.getByRole("button",{name:"Подключения",exact:true}).click();
  await expect(telegram).not.toBeChecked();
  await telegram.check();
  await page.getByRole("button",{name:"Открыть источники"}).click();
  await expect(page.getByRole("button",{name:"Telegram",exact:true})).toBeVisible();
});

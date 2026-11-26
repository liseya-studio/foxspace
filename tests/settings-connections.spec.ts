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

test("settings uses a responsive screen with eight categories", async ({page}, info)=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/");
  await page.getByTitle("Настройки",{exact:true}).click();
  const pageContent=page.locator("main").locator(".fox-settings-page");
  await expect(pageContent.getByRole("heading",{name:"Настройки",exact:true})).toBeVisible();
  await expect(pageContent.getByRole("article")).toHaveCount(8);
  const grid=pageContent.locator(".fox-settings-grid");
  await expect.poll(()=>grid.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(4);
  await info.attach("settings-screen",{body:await page.screenshot(),contentType:"image/png"});
  await page.setViewportSize({width:820,height:900});
  await expect.poll(()=>grid.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(2);
  await pageContent.getByRole("button",{name:"Профиль и аккаунты",exact:true}).click();
  await pageContent.getByLabel("Имя в Fox Space").fill("Лея");
  await pageContent.getByRole("button",{name:"Все настройки"}).click();
  await expect(pageContent.getByRole("article")).toHaveCount(8);
  await page.reload();
  const profile=page.getByRole("button",{name:"Профиль и настройки"});
  await expect(profile).toHaveText("Л");
  await profile.click();
  await expect(pageContent.getByLabel("Имя в Fox Space")).toHaveValue("Лея");
});

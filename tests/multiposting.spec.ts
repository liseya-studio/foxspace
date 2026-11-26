import { test, expect } from "@playwright/test";

test("a Boosty blog can be reused from a content draft with its own post link", async ({page})=>{
  await page.goto("/");
  await page.getByTitle("Настройки",{exact:true}).click();
  await page.getByRole("button",{name:"Подключения",exact:true}).click();
  await page.getByLabel("Площадка для публикаций").selectOption("boosty");
  await page.getByLabel("Блог Boosty").fill("https://boosty.to/fox_test");
  await page.getByRole("button",{name:"Добавить блог"}).click();
  await expect(page.getByText("fox_test",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Закрыть настройки"}).click();

  await page.getByRole("button",{name:"Управление",exact:true}).click();
  await page.getByRole("button",{name:"Контент-план",exact:true}).click();
  await page.getByRole("button",{name:"Новая публикация"}).click();
  await page.getByLabel("Название",{exact:true}).fill("Пробный текст");
  await page.getByLabel("Исходный текст").fill("Пост для проверки");
  await expect(page.getByRole("link",{name:"Открыть бота Boosty"})).toHaveAttribute("href","https://t.me/boosty_posting_bot");
  const link = page.getByLabel("Ссылка на опубликованный пост");
  await link.fill("https://boosty.to/another_blog/posts/test");
  await page.getByRole("button",{name:"Отметить публикацию"}).click();
  await expect(page.getByRole("alert")).toHaveText("Вставьте ссылку на опубликованный пост в этом блоге Boosty.");
  await link.fill("https://boosty.to/fox_test/posts/test");
  await page.getByRole("button",{name:"Отметить публикацию"}).click();
  await expect(page.getByRole("link",{name:"Открыть опубликованный пост"})).toHaveAttribute("href","https://boosty.to/fox_test/posts/test");
  await page.reload();
  await page.getByRole("button",{name:"Управление",exact:true}).click();
  await page.getByRole("button",{name:"Контент-план",exact:true}).click();
  await page.getByRole("button",{name:"Изменить",exact:true}).click();
  await expect(page.getByRole("link",{name:"Открыть опубликованный пост"})).toHaveAttribute("href","https://boosty.to/fox_test/posts/test");
});

test("opening connection settings from a draft preserves unsaved text",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Управление",exact:true}).click();
  await page.getByRole("button",{name:"Контент-план",exact:true}).click();
  await page.getByRole("button",{name:"Новая публикация"}).click();
  await page.getByLabel("Название",{exact:true}).fill("Черновик");
  await page.getByLabel("Исходный текст").fill("Содержание черновика");
  await page.getByRole("button",{name:"Настроить площадки"}).click();
  await expect(page.getByRole("heading",{name:"Подключения",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Закрыть настройки"}).click();
  await expect(page.getByLabel("Исходный текст")).toHaveValue("Содержание черновика");
});

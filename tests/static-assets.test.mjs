import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("deployed html cache-busts dashboard stylesheet", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const publicHtml = await readFile("public/index.html", "utf8");

  assert.match(rootHtml, /href="\.\/styles\.css\?v=dashboard-\d+"/);
  assert.match(publicHtml, /href="\.\/styles\.css\?v=dashboard-\d+"/);
});

test("dashboard stylesheet contains app shell rules", async () => {
  const rootCss = await readFile("styles.css", "utf8");
  const publicCss = await readFile("public/styles.css", "utf8");

  assert.match(rootCss, /\.app-shell/);
  assert.match(publicCss, /\.app-shell/);
});

test("html exposes Russian role selection and removes decorative menu tabs", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const publicHtml = await readFile("public/index.html", "utf8");

  for (const html of [rootHtml, publicHtml]) {
    assert.match(html, /Админ ТЗ/);
    assert.match(html, /Исполнитель/);
    assert.doesNotMatch(html, /Dashboard<\/a>|Sync room|Ideas board|Content Command Center|Strategy Board|Ideas market/);
  }
});

test("html exposes role dock and cache-busts app script", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const publicHtml = await readFile("public/index.html", "utf8");

  for (const html of [rootHtml, publicHtml]) {
    assert.match(html, /role-dock/);
    assert.match(html, /app\.js\?v=ux-\d+/);
  }
});

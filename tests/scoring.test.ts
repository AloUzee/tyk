import { RUBRIC_VERSION, scoreHtml } from "../src/scoring.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const completePage = `<!doctype html>
<html lang="ru"><head>
  <title>Тестовый продукт</title>
  <meta name="description" content="Понятное описание тестового продукта для пользователя">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/favicon.ico">
</head><body>
  <header><nav><a href="/about">О продукте</a><a href="/privacy">Политика конфиденциальности</a></nav></header>
  <main><h1>Тестовый продукт</h1><h2>Возможности</h2>
    <img src="demo.png" alt="Интерфейс продукта">
    <form><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email"><button type="submit">Начать бесплатно</button></form>
    <a href="mailto:help@example.com">Поддержка</a>
  </main><footer><a href="/terms">Условия использования</a></footer>
</body></html>`;

const first = scoreHtml(completePage, "https://example.com");
assert(first.score === 100, `Полная страница должна получать 100, получено ${first.score}`);
assert(first.criteria.length === 20, "Методика должна содержать ровно 20 критериев");
assert(first.categories.length === 5, "Методика должна содержать ровно 5 категорий");
assert(first.rubricVersion === RUBRIC_VERSION, "Версия методики должна быть стабильной");

for (let run = 0; run < 10; run += 1) {
  const repeated = scoreHtml(completePage, "https://example.com");
  assert(JSON.stringify(repeated) === JSON.stringify(first), `Прогон ${run + 1} изменил результат`);
}

const incomplete = scoreHtml("<html><body><h1>Черновик</h1><a href=\"#\"></a></body></html>", "http://example.com");
assert(incomplete.score < first.score, "Страница с ошибками должна получать меньший балл");
assert(incomplete.criteria.some((item) => item.status === "fail"), "Ошибки должны быть перечислены явно");

console.log(`TYK Score tests passed: stable ${first.score}/100, incomplete ${incomplete.score}/100`);

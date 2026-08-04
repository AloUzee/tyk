# ТЫК

AI-тестировщик сайтов: Cloudflare Worker получает публичный HTML страницы, а
`stepfun-ai/step-3.7-flash` через NVIDIA NIM составляет UX-отчёт.

## Запуск

```bash
npm install
copy .dev.vars.example .dev.vars
# вставьте настоящий NVIDIA API key в .dev.vars
npx wrangler dev
```

## Сборка

```bash
npm run build
```

## Секрет Cloudflare

В Cloudflare откройте Worker → Settings → Variables and Secrets, добавьте
зашифрованный секрет `NVIDIA_API_KEY`, затем повторите deployment.

Ключ нельзя добавлять в исходный код, `.env` или GitHub. Анимация действий пока
остаётся демонстрационной; вывод AI основан на реально полученном HTML страницы.

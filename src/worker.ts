import { scoreHtml, type ScoreCriterion, type ScoreResult } from "./scoring";

interface Env {
  NVIDIA_API_KEY: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

type NvidiaResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      reasoning_content?: string;
    };
  }>;
  error?: { message?: string };
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "stepfun-ai/step-3.7-flash";
const MAX_HTML_LENGTH = 12_000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  );
}

function cleanHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/\s(?:class|style|id|data-[\w:-]+)=(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_HTML_LENGTH);
}

function extractJson(value: string) {
  const cleaned = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? cleaned;
  for (let start = source.indexOf("{"); start >= 0; start = source.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) return JSON.parse(source.slice(start, index + 1));
      }
    }
  }
  throw new Error("JSON object not found");
}

function messageText(response: NvidiaResponse) {
  const message = response.choices?.[0]?.message;
  if (typeof message?.content === "string" && message.content.trim()) return message.content;
  if (Array.isArray(message?.content)) {
    const text = message.content.map((part) => part.text ?? "").join("");
    if (text.trim()) return text;
  }
  return message?.reasoning_content ?? "";
}

function scoreVerdict(score: number) {
  if (score >= 90) return "Основа сделана отлично";
  if (score >= 75) return "Хороший сайт с точечными недочётами";
  if (score >= 55) return "Работает, но заметно теряет пользователей";
  if (score >= 35) return "Нужны важные исправления";
  return "Базовый пользовательский путь под угрозой";
}

function fallbackFindings(criteria: ScoreCriterion[]) {
  return criteria
    .filter((item) => item.status === "fail")
    .slice(0, 3)
    .map((item, index) => ({
      severity: index === 0 ? "Критично" : index === 1 ? "Важно" : "Наблюдение",
      title: item.title,
      description: item.recommendation,
      evidence: item.evidence,
      prompt: item.recommendation,
    }));
}

function deterministicReport(score: ScoreResult, target: URL, error?: string) {
  const failed = score.criteria.filter((item) => item.status === "fail");
  return {
    ...score,
    verdict: scoreVerdict(score.score),
    summary: error
      ? `Объективная оценка рассчитана по ${score.criteria.length} критериям. AI-пояснение временно недоступно: ${error}`
      : `Пройдено ${score.criteria.length - failed.length} из ${score.criteria.length} фиксированных проверок.`,
    findings: fallbackFindings(score.criteria),
    analyzedUrl: target.toString(),
    model: MODEL,
    aiStatus: "fallback" as const,
  };
}

async function invokeNvidia(apiKey: string, prompt: string, retry: boolean) {
  const response = await fetch(NVIDIA_URL, {
    method: "POST",
    signal: AbortSignal.timeout(retry ? 90_000 : 120_000),
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Отвечай только валидным JSON. Не показывай ход рассуждений." },
        { role: "user", content: retry ? `${prompt}\n\nПовтор: выведи сразу готовый JSON без пояснений.` : prompt },
      ],
      temperature: retry ? 0 : 0.15,
      top_p: 0.9,
      max_tokens: 4096,
      seed: retry ? 43 : 42,
      stream: false,
      reasoning_effort: "low",
      chat_template_kwargs: { thinking: false },
    }),
  });
  const data = (await response.json()) as NvidiaResponse;
  if (!response.ok) throw new Error(data.error?.message ?? "NVIDIA API вернул ошибку");
  return data;
}

async function analyze(request: Request, env: Env) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Некорректный JSON" }, 400);
  }

  if (typeof body.url !== "string" || body.url.length > 2048) {
    return json({ error: "Передайте корректный URL" }, 400);
  }

  let target: URL;
  try {
    target = new URL(body.url);
  } catch {
    return json({ error: "Некорректный URL" }, 400);
  }
  if (!["http:", "https:"].includes(target.protocol) || isPrivateHostname(target.hostname)) {
    return json({ error: "Можно проверять только публичные HTTP(S)-сайты" }, 400);
  }

  let pageResponse: Response;
  try {
    pageResponse = await fetch(target.toString(), {
      headers: { "user-agent": "TYK UX Auditor/1.0" },
      redirect: "follow",
    });
  } catch {
    return json({ error: "Не удалось открыть сайт" }, 422);
  }
  if (!pageResponse.ok) return json({ error: `Сайт ответил кодом ${pageResponse.status}` }, 422);

  const contentType = pageResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return json({ error: "По ссылке находится не HTML-страница" }, 422);

  const rawHtml = await pageResponse.text();
  const score = scoreHtml(rawHtml, target.toString());
  const html = cleanHtml(rawHtml);
  const failedCriteria = score.criteria.filter((item) => item.status === "fail");
  const prompt = `Ты — редактор UX-отчёта сервиса «ТЫК». Код уже объективно проверил страницу ${target.toString()} по методике ${score.rubricVersion} и вычислил оценку ${score.score}/100.

Ты НЕ выставляешь и НЕ изменяешь баллы. Объясни только перечисленные проваленные критерии, не добавляя новых фактов. Не утверждай, что нажимал кнопки или видел визуальный дизайн. Ответь ТОЛЬКО валидным JSON без markdown по схеме:
{"verdict":"короткий вывод", "summary":"1-2 предложения", "findings":[{"severity":"Критично|Важно|Наблюдение","title":"...","description":"...","evidence":"...","prompt":"точное задание разработчику"}]}

Проваленные критерии:
${JSON.stringify(failedCriteria.map(({ id, category, title, evidence, recommendation }) => ({ id, category, title, evidence, recommendation })))}

Фрагмент HTML только для контекста:
${html}`;

  if (!env.NVIDIA_API_KEY) {
    return json(deterministicReport(score, target, "NVIDIA_API_KEY не настроен"));
  }

  let lastError = "Модель вернула пустой ответ";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const nvidia = await invokeNvidia(env.NVIDIA_API_KEY, prompt, attempt === 1);
      const content = messageText(nvidia);
      if (!content.trim()) {
        lastError = `Модель вернула пустой ответ (${nvidia.choices?.[0]?.finish_reason ?? "unknown"})`;
        continue;
      }
      const ai = extractJson(content) as { verdict?: unknown; summary?: unknown; findings?: unknown };
      if (typeof ai.verdict !== "string" || typeof ai.summary !== "string" || !Array.isArray(ai.findings)) {
        throw new Error("AI вернул неполный JSON");
      }
      return json({
        ...score,
        verdict: ai.verdict,
        summary: ai.summary,
        findings: ai.findings,
        analyzedUrl: target.toString(),
        model: MODEL,
        aiStatus: "ready",
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Ошибка NVIDIA API";
    }
  }
  return json(deterministicReport(score, target, `${lastError}. Автоматический повтор не помог`));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return analyze(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

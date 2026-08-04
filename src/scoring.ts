export const RUBRIC_VERSION = "TYK Score v1.0";

export type CriterionStatus = "pass" | "fail" | "na";

export type ScoreCriterion = {
  id: string;
  category: string;
  title: string;
  status: CriterionStatus;
  points: number;
  maxPoints: 5;
  evidence: string;
  recommendation: string;
};

export type ScoreCategory = {
  id: string;
  title: string;
  score: number;
  maxScore: 20;
};

export type ScoreResult = {
  score: number;
  rubricVersion: string;
  categories: ScoreCategory[];
  criteria: ScoreCriterion[];
};

const CATEGORY_TITLES: Record<string, string> = {
  foundation: "Основа",
  structure: "Структура",
  accessibility: "Доступность",
  journey: "Сценарий",
  reliability: "Надёжность",
};

function tags(html: string, name: string) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function blocks(html: string, name: string) {
  return html.match(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}>`, "gi")) ?? [];
}

function attribute(tag: string, name: string) {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  if (quoted) return quoted[2]?.trim() ?? "";
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"))?.[1]?.trim() ?? "";
}

function textContent(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function criterion(
  id: string,
  category: string,
  title: string,
  status: CriterionStatus,
  evidence: string,
  recommendation: string,
): ScoreCriterion {
  return { id, category, title, status, points: status === "fail" ? 0 : 5, maxPoints: 5, evidence, recommendation };
}

export function scoreHtml(html: string, pageUrl: string): ScoreResult {
  const lower = html.toLowerCase();
  const titleText = textContent(blocks(html, "title")[0] ?? "");
  const htmlTag = tags(html, "html")[0] ?? "";
  const metas = tags(html, "meta");
  const links = tags(html, "link");
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  const h1Count = headings.filter((level) => level === 1).length;
  const images = tags(html, "img");
  const anchors = blocks(html, "a");
  const buttonBlocks = blocks(html, "button");
  const inputs = tags(html, "input").filter((tag) => attribute(tag, "type").toLowerCase() !== "hidden");
  const controls = [...inputs, ...tags(html, "select"), ...tags(html, "textarea")];
  const labels = blocks(html, "label");

  const hasMetaDescription = metas.some(
    (tag) => attribute(tag, "name").toLowerCase() === "description" && Boolean(attribute(tag, "content")),
  );
  const hasViewport = metas.some((tag) => attribute(tag, "name").toLowerCase() === "viewport" && Boolean(attribute(tag, "content")));
  const headingOrderValid = headings.every((level, index) => index === 0 || level <= headings[index - 1]! + 1);
  const hasLandmarks = /<(main|nav)\b/i.test(html) || /\brole\s*=\s*["']?(main|navigation)/i.test(html);
  const imagesHaveAlt = images.every((tag) => /\balt\s*=/i.test(tag));
  const controlsHaveLabels = controls.every((tag) => {
    if (/\baria-label(?:ledby)?\s*=|\btitle\s*=/i.test(tag)) return true;
    const id = attribute(tag, "id");
    if (id && labels.some((label) => attribute(label.match(/<label\b[^>]*>/i)?.[0] ?? "", "for") === id)) return true;
    return labels.some((label) => label.includes(tag));
  });
  const buttons = [...buttonBlocks, ...inputs.filter((tag) => /^(submit|button|reset|image)$/i.test(attribute(tag, "type")))];
  const buttonsNamed = buttons.every((tag) => Boolean(textContent(tag) || attribute(tag, "aria-label") || attribute(tag, "title") || attribute(tag, "value")));
  const linksNamed = anchors.every((tag) => Boolean(textContent(tag) || attribute(tag, "aria-label") || attribute(tag, "title") || /<img\b[^>]*\balt\s*=\s*["'][^"']+/i.test(tag)));
  const actionText = [...buttonBlocks, ...anchors].map(textContent).join(" ");
  const hasCta = /начать|попроб|проверить|купить|заказать|регист|получить|демо|скачать|start|try|buy|sign\s*up|get\s*started|book|download/i.test(actionText);
  const hasNavigation = /<nav\b|\brole\s*=\s*["']?navigation/i.test(html);
  const hasContact = /mailto:|tel:|контакт|поддержк|связаться|contact|support/i.test(lower);
  const hasLegal = /privacy|terms|legal|политик[аи]|услови[яй]|оферт|конфиденциальност/i.test(lower);
  const formBlocks = blocks(html, "form");
  const formInputs = formBlocks.flatMap((form) => tags(form, "input")).filter((tag) => attribute(tag, "type").toLowerCase() !== "hidden");
  const formTypesValid = formInputs.every((tag) => {
    const type = attribute(tag, "type").toLowerCase();
    if (!type) return false;
    const name = `${attribute(tag, "name")} ${attribute(tag, "autocomplete")} ${attribute(tag, "placeholder")}`.toLowerCase();
    if (/mail/.test(name)) return type === "email";
    if (/phone|tel|телефон/.test(name)) return type === "tel";
    return true;
  });
  const emptyLinks = tags(html, "a").filter((tag) => {
    const href = attribute(tag, "href");
    return !href || href === "#" || /^javascript:/i.test(href);
  });
  const ids = [...html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]!).filter(Boolean);
  const idsUnique = new Set(ids).size === ids.length;
  const hasFavicon = links.some((tag) => /\bicon\b/i.test(attribute(tag, "rel")) && Boolean(attribute(tag, "href")));

  const criteria: ScoreCriterion[] = [
    criterion("https", "foundation", "Безопасное соединение HTTPS", pageUrl.startsWith("https://") ? "pass" : "fail", pageUrl.startsWith("https://") ? "Страница открывается по HTTPS" : "Используется небезопасный HTTP", "Подключите HTTPS и перенаправляйте HTTP на защищённый адрес."),
    criterion("title", "foundation", "Название страницы", titleText ? "pass" : "fail", titleText ? `title: «${titleText.slice(0, 90)}»` : "Тег title отсутствует или пуст", "Добавьте короткий уникальный title, объясняющий назначение страницы."),
    criterion("description", "foundation", "Описание для поиска и превью", hasMetaDescription ? "pass" : "fail", hasMetaDescription ? "meta description заполнен" : "meta description отсутствует", "Добавьте meta description длиной примерно 120–160 символов."),
    criterion("language", "foundation", "Язык документа", attribute(htmlTag, "lang") ? "pass" : "fail", attribute(htmlTag, "lang") ? `lang="${attribute(htmlTag, "lang")}"` : "У html отсутствует атрибут lang", "Укажите язык страницы в атрибуте lang у элемента html."),

    criterion("viewport", "structure", "Мобильный viewport", hasViewport ? "pass" : "fail", hasViewport ? "Viewport настроен" : "Viewport не найден", "Добавьте meta viewport с width=device-width и initial-scale=1."),
    criterion("h1", "structure", "Один главный заголовок H1", h1Count === 1 ? "pass" : "fail", `Найдено H1: ${h1Count}`, "Оставьте ровно один содержательный H1 на странице."),
    criterion("heading-order", "structure", "Последовательность заголовков", headingOrderValid ? "pass" : "fail", headingOrderValid ? "Уровни заголовков не перескакивают" : "Обнаружен пропуск уровня заголовка", "Используйте последовательную иерархию H1 → H2 → H3 без пропусков."),
    criterion("landmarks", "structure", "Смысловые области страницы", hasLandmarks ? "pass" : "fail", hasLandmarks ? "Найдены main/nav или соответствующие роли" : "main и nav не обнаружены", "Разметьте основное содержимое и навигацию элементами main и nav."),

    criterion("image-alt", "accessibility", "Альтернативный текст изображений", images.length === 0 ? "na" : imagesHaveAlt ? "pass" : "fail", images.length === 0 ? "На странице нет изображений — критерий не применяется" : imagesHaveAlt ? `Все изображения (${images.length}) имеют alt` : "Есть изображения без alt", "Добавьте каждому смысловому изображению alt, декоративным — пустой alt."),
    criterion("form-labels", "accessibility", "Подписи полей", controls.length === 0 ? "na" : controlsHaveLabels ? "pass" : "fail", controls.length === 0 ? "Нет полей — критерий не применяется" : controlsHaveLabels ? "Все поля имеют подпись" : "Есть поля без label или aria-label", "Свяжите каждое поле с label либо задайте доступное имя через aria-label."),
    criterion("button-names", "accessibility", "Понятные названия кнопок", buttons.length === 0 ? "na" : buttonsNamed ? "pass" : "fail", buttons.length === 0 ? "Нет кнопок — критерий не применяется" : buttonsNamed ? "Все кнопки имеют название" : "Есть кнопки без текста или aria-label", "Добавьте видимый текст или aria-label каждой кнопке."),
    criterion("link-names", "accessibility", "Понятные названия ссылок", anchors.length === 0 ? "na" : linksNamed ? "pass" : "fail", anchors.length === 0 ? "Нет ссылок — критерий не применяется" : linksNamed ? "Все ссылки имеют доступное имя" : "Есть ссылки без понятного названия", "Добавьте ссылкам осмысленный текст или aria-label."),

    criterion("cta", "journey", "Главное действие пользователя", hasCta ? "pass" : "fail", hasCta ? "Найден явный призыв к действию" : "Явный CTA не найден", "Добавьте заметную кнопку с конкретным действием: начать, попробовать, проверить или заказать."),
    criterion("navigation", "journey", "Навигация", hasNavigation ? "pass" : "fail", hasNavigation ? "Найдена семантическая навигация" : "Элемент nav не найден", "Поместите основные ссылки в семантический элемент nav."),
    criterion("contact", "journey", "Связь и поддержка", hasContact ? "pass" : "fail", hasContact ? "Найдены контактные данные или поддержка" : "Контакты и поддержка не найдены", "Добавьте понятный способ связаться: email, телефон или ссылку на поддержку."),
    criterion("legal", "journey", "Доверие и юридическая информация", hasLegal ? "pass" : "fail", hasLegal ? "Найдены политика или условия" : "Политика и условия не найдены", "Добавьте ссылки на политику конфиденциальности и условия использования."),

    criterion("field-types", "reliability", "Корректные типы полей", formBlocks.length === 0 ? "na" : formTypesValid ? "pass" : "fail", formBlocks.length === 0 ? "Форм нет — критерий не применяется" : formTypesValid ? "Типы полей соответствуют данным" : "Есть поля без type или с неверным типом", "Задайте полям email, tel, password и другим данным соответствующие type и autocomplete."),
    criterion("empty-links", "reliability", "Рабочие ссылки", emptyLinks.length === 0 ? "pass" : "fail", emptyLinks.length === 0 ? "Пустых ссылок не найдено" : `Пустых или служебных ссылок: ${emptyLinks.length}`, "Удалите пустые href, # и javascript-ссылки либо замените их кнопками."),
    criterion("unique-ids", "reliability", "Уникальные идентификаторы", idsUnique ? "pass" : "fail", idsUnique ? "Повторяющихся id не найдено" : "На странице есть повторяющиеся id", "Сделайте значения id уникальными во всём документе."),
    criterion("favicon", "reliability", "Иконка сайта", hasFavicon ? "pass" : "fail", hasFavicon ? "Favicon подключён" : "Favicon не найден", "Подключите favicon через link rel=icon."),
  ];

  const categoryIds = Object.keys(CATEGORY_TITLES);
  const categories = categoryIds.map((id) => ({
    id,
    title: CATEGORY_TITLES[id]!,
    score: criteria.filter((item) => item.category === id).reduce((sum, item) => sum + item.points, 0),
    maxScore: 20 as const,
  }));

  return {
    score: criteria.reduce((sum, item) => sum + item.points, 0),
    rubricVersion: RUBRIC_VERSION,
    categories,
    criteria,
  };
}

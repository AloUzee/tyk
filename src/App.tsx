import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Browser,
  Check,
  ClipboardText,
  CursorClick,
  DeviceMobile,
  Eye,
  Play,
  ShieldCheck,
  Sparkle,
  Warning,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { demoSteps, findings } from "./demo-data";
import type { RunPhase } from "./types";

const DEFAULT_URL = "tyk.pages.dev";

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLocal && !parsed.hostname.includes(".")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function AppHeader({ onLaunch }: { onLaunch: () => void }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="ТЫК, на главную">
        <span className="brand-mark" aria-hidden="true">
          <CursorClick weight="fill" />
        </span>
        ТЫК
      </a>
      <nav aria-label="Основная навигация">
        <a href="#how">Как работает</a>
        <a href="#result">Что найдёт</a>
      </nav>
      <button className="header-action" type="button" onClick={onLaunch}>
        Запустить <ArrowRight aria-hidden="true" />
      </button>
    </header>
  );
}

function UrlForm({ onStart, compact = false }: { onStart: (url: string) => void; compact?: boolean }) {
  const [value, setValue] = useState(DEFAULT_URL);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = normalizeUrl(value);
    if (!parsed) {
      setError("Введите адрес сайта, например example.com");
      return;
    }
    setError("");
    onStart(parsed.toString());
  };

  return (
    <form className={`url-form ${compact ? "url-form--compact" : ""}`} onSubmit={submit} noValidate>
      <label htmlFor={compact ? "demo-url" : "hero-url"}>Адрес сайта</label>
      <div className="url-control">
        <span aria-hidden="true">https://</span>
        <input
          id={compact ? "demo-url" : "hero-url"}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          value={value.replace(/^https?:\/\//i, "")}
          aria-describedby={error ? `${compact ? "demo" : "hero"}-url-error` : undefined}
          aria-invalid={Boolean(error)}
          onBlur={() => {
            if (value && !normalizeUrl(value)) setError("Проверьте адрес сайта");
          }}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError("");
          }}
        />
        <button type="submit">
          <Play weight="fill" aria-hidden="true" />
          Проверить
        </button>
      </div>
      <div className="form-footnote">
        {error ? (
          <span className="field-error" id={`${compact ? "demo" : "hero"}-url-error`} role="alert">
            <Warning weight="fill" aria-hidden="true" /> {error}
          </span>
        ) : (
          <span>Сейчас работает демонстрационный сценарий без отправки данных.</span>
        )}
      </div>
    </form>
  );
}

function TargetSite({ state }: { state: "landing" | "form" | "error" }) {
  return (
    <div className="target-site" aria-label="Демонстрационный сайт внутри тестовой сессии">
      <div className="target-nav">
        <strong>СБОРКА</strong>
        <span>Шаблоны</span>
        <span>Примеры</span>
        <button type="button">Войти</button>
      </div>
      <AnimatePresence mode="wait">
        {state === "landing" ? (
          <motion.div
            className="target-hero"
            key="landing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <span>Сайты за вечер</span>
            <h3>Соберите продукт без лишнего кода</h3>
            <p>Готовые блоки, формы и публикация в один клик.</p>
            <div>
              <button type="button">Попробовать демо</button>
              <button type="button">Начать бесплатно</button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="target-form"
            key="form"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            <button className="target-close" type="button" aria-label="Закрыть форму">
              <X aria-hidden="true" />
            </button>
            <span>Создать аккаунт</span>
            <h3>Сначала представьтесь</h3>
            <label>
              Рабочая почта
              <input defaultValue={state === "error" ? "alex@" : ""} placeholder="name@company.ru" />
            </label>
            {state === "error" ? <p className="target-error">Что-то пошло не так</p> : null}
            <button className="target-submit" type="button">Продолжить</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrowserStage({ phase, step, testedUrl }: { phase: RunPhase; step: number; testedUrl: string }) {
  const reduceMotion = useReducedMotion();
  const current = demoSteps[Math.min(step, demoSteps.length - 1)];
  const targetState = phase === "idle" ? "landing" : current.targetState;
  const hostname = normalizeUrl(testedUrl)?.hostname || DEFAULT_URL;

  return (
    <div className="browser-stage">
      <div className="browser-bar">
        <div className="window-actions" aria-hidden="true">
          <X />
          <span></span>
        </div>
        <div className="browser-address">
          <ShieldCheck weight="fill" aria-hidden="true" />
          <span>{hostname}</span>
        </div>
        <span className="viewport-label">1280 × 800</span>
      </div>
      <div className="browser-content">
        <TargetSite state={targetState} />
        {phase === "running" ? (
          <motion.div
            className="agent-cursor"
            aria-hidden="true"
            animate={{ left: `${current.cursor.x}%`, top: `${current.cursor.y}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 18 }}
          >
            <CursorClick weight="fill" />
            <span>ТЫК</span>
          </motion.div>
        ) : null}
        {phase === "idle" ? (
          <div className="stage-idle">
            <span className="stage-idle-icon"><Eye weight="fill" aria-hidden="true" /></span>
            <strong>Первый взгляд готов</strong>
            <span>Запустите демо, чтобы увидеть действия агента.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AgentFeed({ phase, step }: { phase: RunPhase; step: number }) {
  return (
    <aside className="agent-feed" aria-live="polite" aria-label="Ход проверки">
      <div className="feed-head">
        <span>
          <Sparkle weight="fill" aria-hidden="true" /> Агент
        </span>
        <strong>{phase === "running" ? `${step + 1} / ${demoSteps.length}` : phase === "report" ? "Готово" : "Ожидает"}</strong>
      </div>
      <div className="feed-body">
        {phase === "idle" ? (
          <div className="feed-empty">
            <Browser aria-hidden="true" />
            <strong>Здесь появится ход мыслей</strong>
            <p>Агент объяснит каждый клик простым языком.</p>
          </div>
        ) : (
          demoSteps.map((item, index) => {
            const visible = phase === "report" || index <= step;
            if (!visible) return null;
            const active = phase === "running" && index === step;
            return (
              <motion.div
                className={`feed-item ${active ? "feed-item--active" : ""}`}
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
              >
                <span className="feed-icon" aria-hidden="true">
                  {active ? <CursorClick weight="fill" /> : <Check weight="bold" />}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function DemoPanel({
  onReport,
  request,
}: {
  onReport: () => void;
  request: { id: number; url: string } | null;
}) {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [step, setStep] = useState(0);
  const [testedUrl, setTestedUrl] = useState(`https://${DEFAULT_URL}`);
  const reduceMotion = useReducedMotion();

  const start = useCallback((url: string) => {
    setTestedUrl(url);
    setStep(0);
    setPhase("running");
  }, []);

  useEffect(() => {
    if (request) start(request.url);
  }, [request, start]);

  useEffect(() => {
    if (phase !== "running") return;
    const duration = reduceMotion ? 320 : 1250;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= demoSteps.length - 1) {
          window.clearInterval(timer);
          setPhase("report");
          window.setTimeout(onReport, 250);
          return current;
        }
        return current + 1;
      });
    }, duration);
    return () => window.clearInterval(timer);
  }, [onReport, phase, reduceMotion]);

  return (
    <section className="demo-shell" id="demo" aria-labelledby="demo-title">
      <div className="demo-topline">
        <div>
          <span>Живое демо</span>
          <h2 id="demo-title">Смотрите, куда он тыкает</h2>
        </div>
        <UrlForm compact onStart={start} />
      </div>
      <div className="demo-workspace">
        <BrowserStage phase={phase} step={step} testedUrl={testedUrl} />
        <AgentFeed phase={phase} step={step} />
      </div>
      <div className="demo-progress" aria-label="Прогресс проверки">
        <span style={{ transform: `scaleX(${phase === "idle" ? 0 : phase === "report" ? 1 : (step + 1) / demoSteps.length})` }} />
      </div>
    </section>
  );
}

function ReportSection({ reportRef }: { reportRef: React.RefObject<HTMLElement | null> }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copyPrompt = async (index: number) => {
    await navigator.clipboard.writeText(findings[index].prompt);
    setCopied(index);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section className="report-section" id="result" ref={reportRef} aria-labelledby="report-title">
      <div className="report-heading">
        <span className="report-score"><strong>68</strong><small>из 100</small></span>
        <div>
          <h2 id="report-title">Красиво. Но первый пользователь застрял.</h2>
          <p>Демонстрационный отчёт показывает формат результата до подключения реального агента.</p>
        </div>
      </div>
      <div className="findings-grid">
        {findings.map((finding, index) => (
          <article className={`finding finding--${index + 1}`} key={finding.title}>
            <div className="finding-topline">
              <span><Warning weight={index === 0 ? "fill" : "regular"} aria-hidden="true" /> {finding.severity}</span>
              <small>{finding.evidence}</small>
            </div>
            <h3>{finding.title}</h3>
            <p>{finding.description}</p>
            <button type="button" onClick={() => copyPrompt(index)}>
              {copied === index ? <Check weight="bold" aria-hidden="true" /> : <ClipboardText aria-hidden="true" />}
              {copied === index ? "Скопировано" : "Промпт для исправления"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const items = useMemo(
    () => [
      { icon: <Browser />, verb: "Открывает", text: "Запускает публичный сайт в изолированном браузере." },
      { icon: <CursorClick />, verb: "Пробует", text: "Нажимает, вводит данные и объясняет каждое решение." },
      { icon: <ClipboardText />, verb: "Доказывает", text: "Прикладывает путь, скриншот и промпт для исправления." },
    ],
    [],
  );

  return (
    <section className="how-section" id="how" aria-labelledby="how-title">
      <h2 id="how-title">Не аудит по шаблону.<br />Настоящая попытка пройти сайт.</h2>
      <div className="how-flow">
        {items.map((item) => (
          <article key={item.verb}>
            <span aria-hidden="true">{item.icon}</span>
            <h3>{item.verb}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="use-cases" aria-labelledby="use-cases-title">
      <div className="use-cases-copy">
        <h2 id="use-cases-title">Проверяет то, что автор уже не замечает</h2>
        <p>ТЫК смотрит на продукт без контекста команды и фиксирует момент, где ожидание расходится с интерфейсом.</p>
      </div>
      <div className="use-cases-grid">
        <article className="case-large">
          <Eye weight="fill" aria-hidden="true" />
          <h3>Первое впечатление</h3>
          <p>Понимает ли новый человек, что делает продукт и куда нажать дальше.</p>
          <blockquote>«Я вижу обещание, но не понимаю результат клика»</blockquote>
        </article>
        <article>
          <DeviceMobile aria-hidden="true" />
          <h3>Мобильный путь</h3>
          <p>Проверяет касания, переполнение и доступность главного действия.</p>
        </article>
        <article className="case-accent">
          <ShieldCheck weight="fill" aria-hidden="true" />
          <h3>Безопасный режим</h3>
          <p>Не подтверждает покупки и не выполняет разрушительные действия.</p>
        </article>
      </div>
    </section>
  );
}

export function App() {
  const reportRef = useRef<HTMLElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const [demoRequest, setDemoRequest] = useState<{ id: number; url: string } | null>(null);

  const scrollToDemo = () => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToReport = useCallback(() => {
    reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const launchFromHero = (url: string) => {
    setDemoRequest({ id: Date.now(), url });
    scrollToDemo();
  };

  return (
    <div id="top" ref={demoRef}>
      <AppHeader onLaunch={scrollToDemo} />
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="hero-label"><CursorClick weight="fill" aria-hidden="true" /> ИИ-тестировщик сайтов</span>
            <h1 id="hero-title">Дайте ссылку.<br /><em>Мы потыкаем.</em></h1>
            <p>Агент проходит сайт как новый пользователь и показывает, где интерфейс ломает сценарий.</p>
            <UrlForm onStart={launchFromHero} />
          </div>
          <div className="hero-proof" aria-label="Пример наблюдения агента">
            <div className="proof-cursor" aria-hidden="true"><CursorClick weight="fill" /></div>
            <span>Наблюдение агента</span>
            <blockquote>Кнопка обещает демо, но просит зарегистрироваться.</blockquote>
            <div className="proof-path">
              <span>Главная</span><ArrowRight aria-hidden="true" /><span>Регистрация</span><X aria-hidden="true" />
            </div>
          </div>
        </section>
        <DemoPanel onReport={scrollToReport} request={demoRequest} />
        <HowItWorks />
        <ReportSection reportRef={reportRef} />
        <UseCases />
        <section className="final-cta" aria-labelledby="final-title">
          <CursorClick weight="fill" aria-hidden="true" />
          <h2 id="final-title">Лучше один ТЫК сейчас,<br />чем десять баг-репортов потом.</h2>
          <button type="button" onClick={scrollToDemo}>Запустить демо <ArrowRight aria-hidden="true" /></button>
        </section>
      </main>
      <footer>
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><CursorClick weight="fill" /></span>ТЫК</a>
        <p>Автономный первый пользователь для сайтов.</p>
        <span>Конкурсный прототип</span>
      </footer>
    </div>
  );
}

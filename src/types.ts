export type RunPhase = "idle" | "running" | "report";

export type DemoStep = {
  title: string;
  detail: string;
  cursor: { x: number; y: number };
  targetState: "landing" | "form" | "error";
};

export type Finding = {
  severity: "Критично" | "Важно" | "Наблюдение";
  title: string;
  description: string;
  evidence: string;
  prompt: string;
};

export type AiReport = {
  score: number;
  verdict: string;
  summary: string;
  findings: Finding[];
  analyzedUrl: string;
};

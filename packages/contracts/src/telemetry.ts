export type TelemetryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TelemetryValue[]
  | { [key: string]: TelemetryValue };

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(authorization|cookie|password|secret|token|api[-_]?key|prompt|content|raw|email)/i;

export function redactTelemetry(value: unknown, depth = 0): TelemetryValue {
  if (depth > 5) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string")
    return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => redactTelemetry(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 80)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY.test(key) ? REDACTED : redactTelemetry(item, depth + 1),
        ]),
    );
  }
  return String(value);
}

export type TelemetrySink = (line: string) => void;

export class StructuredLogger {
  constructor(
    private readonly component: string,
    private readonly sink: TelemetrySink = (line) => console.log(line),
  ) {}

  info(event: string, fields: Record<string, unknown> = {}) {
    this.write("info", event, fields);
  }
  warn(event: string, fields: Record<string, unknown> = {}) {
    this.write("warn", event, fields);
  }
  error(event: string, fields: Record<string, unknown> = {}) {
    this.write("error", event, fields);
  }
  private write(
    level: "info" | "warn" | "error",
    event: string,
    fields: Record<string, unknown>,
  ) {
    const safeFields = redactTelemetry(fields) as Record<
      string,
      TelemetryValue
    >;
    this.sink(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        component: this.component,
        event,
        ...safeFields,
      }),
    );
  }
}

type MetricLabels = Record<string, string | number | boolean>;
type MetricEntry = { value: number; labels: MetricLabels };

export class MetricsRegistry {
  private readonly counters = new Map<string, MetricEntry>();
  private readonly observations = new Map<string, MetricEntry[]>();

  increment(name: string, labels: MetricLabels = {}, value = 1) {
    const normalized = normalizeLabels(labels);
    const key = `${name}${formatLabels(normalized)}`;
    const current = this.counters.get(key);
    this.counters.set(key, {
      labels: normalized,
      value: (current?.value ?? 0) + value,
    });
  }

  observe(name: string, value: number, labels: MetricLabels = {}) {
    const entries = this.observations.get(name) ?? [];
    const normalized = normalizeLabels(labels);
    const current = entries.find((entry) =>
      sameLabels(entry.labels, normalized),
    );
    if (current) current.value += value;
    else entries.push({ labels: normalized, value });
    this.observations.set(name, entries);
  }

  snapshot() {
    return {
      counters: [...this.counters.entries()].map(([name, entry]) => ({
        name,
        ...entry,
      })),
      observations: [...this.observations.entries()].flatMap(
        ([name, entries]) => entries.map((entry) => ({ name, ...entry })),
      ),
    };
  }

  toPrometheus() {
    const lines: string[] = [];
    for (const [key, entry] of this.counters)
      lines.push(`${key} ${entry.value}`);
    for (const [name, entries] of this.observations) {
      for (const entry of entries)
        lines.push(`${name}_sum${formatLabels(entry.labels)} ${entry.value}`);
      for (const entry of entries)
        lines.push(`${name}_count${formatLabels(entry.labels)} 1`);
    }
    return `${lines.join("\n")}\n`;
  }
}

function normalizeLabels(labels: MetricLabels): MetricLabels {
  return Object.fromEntries(
    Object.entries(labels)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 8)
      .map(([key, value]) => [key, String(value).slice(0, 64)]),
  );
}

function formatLabels(labels: MetricLabels) {
  const entries = Object.entries(labels);
  return entries.length
    ? `{${entries.map(([key, value]) => `${key}="${String(value).replaceAll('"', '\\"')}"`).join(",")}}`
    : "";
}

function sameLabels(left: MetricLabels, right: MetricLabels) {
  return JSON.stringify(left) === JSON.stringify(right);
}

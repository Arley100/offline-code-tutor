/**
 * Pure parsing + validation for OfflineCodeTutor benchmark artifacts.
 *
 * Framework- and database-free so it can be unit tested in isolation and reused
 * by the import server action. See docs/ARTIFACT_FORMAT.md for the contract.
 *
 * Hard rules:
 *   - Missing optional metrics become `null` (unavailable), NEVER 0.
 *   - Nothing is fabricated; absent values stay absent.
 *   - Structurally non-OfflineCodeTutor JSON is rejected with a readable error.
 */

export const KNOWN_VARIANTS = ["baseline", "prompt_v2", "prompt_v3"] as const;
export type KnownVariant = (typeof KNOWN_VARIANTS)[number];

export interface ParsedRun {
  promptId: string;
  prompt: string;
  ok: boolean;
  elapsedSeconds: number | null;
  tokensPerSecond: number | null;
  cleanOutputPreview: string | null;
}

export interface ParsedArtifact {
  project: string;
  createdAtUtc: string | null;
  benchmarkStatus: string;
  /** Raw variant string from settings.prompt_variant. */
  variant: string;
  /** Whether the variant is one of the known EvalForge variants. */
  variantKnown: boolean;
  modelSha256: string | null;
  modelFilename: string | null;
  runs: ParsedRun[];
  /** The original parsed object, preserved for immutable storage. */
  raw: Record<string, unknown>;
}

export type ParseResult =
  | { ok: true; artifact: ParsedArtifact }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read `model.filename` from a stored artifact's raw JSON, if present. Read-only:
 * never mutates the artifact. Returns null when unavailable.
 */
export function modelNameFromRawJson(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const model = raw.model;
  if (!isRecord(model)) return null;
  const filename = model.filename;
  return typeof filename === "string" && filename.length > 0 ? filename : null;
}

/** Finite number, else null. Never coerces missing/invalid to 0. */
function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const REQUIRED_OBJECT_FIELDS = [
  "model",
  "runtime",
  "settings",
  "manual_accuracy",
] as const;

export function parseArtifact(input: string | unknown): ParseResult {
  let data: unknown = input;

  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      return {
        ok: false,
        error: "The artifact is not valid JSON. Check that you pasted the full file.",
      };
    }
  }

  if (!isRecord(data)) {
    return { ok: false, error: "Artifact must be a JSON object." };
  }

  // Structural signature: these define "looks like an OfflineCodeTutor artifact".
  const missing: string[] = [];
  if (!isNonEmptyString(data.project)) missing.push("project");
  if (!isNonEmptyString(data.created_at_utc)) missing.push("created_at_utc");
  if (!isNonEmptyString(data.benchmark_status)) missing.push("benchmark_status");
  for (const field of REQUIRED_OBJECT_FIELDS) {
    if (!isRecord(data[field])) missing.push(field);
  }
  if (!Array.isArray(data.runs) || data.runs.length === 0) missing.push("runs");

  if (missing.length > 0) {
    return {
      ok: false,
      error:
        "This does not look like an OfflineCodeTutor benchmark artifact. " +
        `Missing or invalid required field(s): ${missing.join(", ")}.`,
    };
  }

  const rawRuns = data.runs as unknown[];
  const runs: ParsedRun[] = [];
  for (let i = 0; i < rawRuns.length; i++) {
    const run = rawRuns[i];
    if (
      !isRecord(run) ||
      !isNonEmptyString(run.prompt_id) ||
      typeof run.prompt !== "string" ||
      typeof run.ok !== "boolean"
    ) {
      return {
        ok: false,
        error: `Run ${i + 1} is missing required fields (prompt_id, prompt, ok).`,
      };
    }
    runs.push({
      promptId: run.prompt_id,
      prompt: run.prompt,
      ok: run.ok,
      // Optional metrics: unavailable stays null, never 0.
      elapsedSeconds: asNumberOrNull(run.elapsed_seconds),
      tokensPerSecond: asNumberOrNull(run.tokens_per_second),
      cleanOutputPreview: asStringOrNull(run.clean_output_preview),
    });
  }

  const settings = data.settings as Record<string, unknown>;
  const model = data.model as Record<string, unknown>;
  const rawVariant = settings.prompt_variant;
  const variant = isNonEmptyString(rawVariant) ? rawVariant : "unknown";
  const variantKnown = (KNOWN_VARIANTS as readonly string[]).includes(variant);

  return {
    ok: true,
    artifact: {
      project: data.project as string,
      createdAtUtc: asStringOrNull(data.created_at_utc),
      benchmarkStatus: data.benchmark_status as string,
      variant,
      variantKnown,
      modelSha256: asStringOrNull(model.sha256),
      modelFilename: asStringOrNull(model.filename),
      runs,
      raw: data,
    },
  };
}

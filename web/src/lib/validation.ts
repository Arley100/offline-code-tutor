/**
 * Pure input validation for projects and benchmark tasks.
 *
 * Framework-free so it can be unit tested in isolation and reused by server
 * actions. Returns user-readable field errors; deliberately simple, not a schema
 * library, to avoid over-engineering this ticket.
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string> };

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

/** Slugify a title into a stable task key. Always returns a non-empty slug. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "task";
}

export interface ProjectInput {
  name: string;
  description: string | null;
}

export function validateProjectInput(raw: {
  name?: unknown;
  description?: unknown;
}): ValidationResult<ProjectInput> {
  const fieldErrors: Record<string, string> = {};
  const name = asTrimmed(raw.name);
  const description = asTrimmed(raw.description);

  if (!name) {
    fieldErrors.name = "Project name is required.";
  } else if (name.length > 120) {
    fieldErrors.name = "Project name must be 120 characters or fewer.";
  }
  if (description.length > 2000) {
    fieldErrors.description = "Description must be 2000 characters or fewer.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, data: { name, description: emptyToNull(description) } };
}

export interface TaskInput {
  title: string;
  prompt: string;
  language: string | null;
  difficulty: string | null;
  category: string | null;
  expectedFixHint: string | null;
  notes: string | null;
}

export function validateTaskInput(raw: {
  title?: unknown;
  prompt?: unknown;
  language?: unknown;
  difficulty?: unknown;
  category?: unknown;
  expectedFixHint?: unknown;
  notes?: unknown;
}): ValidationResult<TaskInput> {
  const fieldErrors: Record<string, string> = {};
  const title = asTrimmed(raw.title);
  const prompt = asTrimmed(raw.prompt);
  const language = asTrimmed(raw.language);
  const difficulty = asTrimmed(raw.difficulty);
  const category = asTrimmed(raw.category);
  const expectedFixHint = asTrimmed(raw.expectedFixHint);
  const notes = asTrimmed(raw.notes);

  if (!title) {
    fieldErrors.title = "Task title is required.";
  } else if (title.length > 160) {
    fieldErrors.title = "Task title must be 160 characters or fewer.";
  }
  if (!prompt) {
    fieldErrors.prompt = "Task prompt is required.";
  } else if (prompt.length > 5000) {
    fieldErrors.prompt = "Task prompt must be 5000 characters or fewer.";
  }
  if (language.length > 40) {
    fieldErrors.language = "Language must be 40 characters or fewer.";
  }
  if (difficulty && !DIFFICULTIES.includes(difficulty as Difficulty)) {
    fieldErrors.difficulty = "Difficulty must be easy, medium, or hard.";
  }
  if (category.length > 60) {
    fieldErrors.category = "Category must be 60 characters or fewer.";
  }
  if (expectedFixHint.length > 2000) {
    fieldErrors.expectedFixHint =
      "Expected behavior/fix must be 2000 characters or fewer.";
  }
  if (notes.length > 2000) {
    fieldErrors.notes = "Notes must be 2000 characters or fewer.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    data: {
      title,
      prompt,
      language: emptyToNull(language),
      difficulty: emptyToNull(difficulty),
      category: emptyToNull(category),
      expectedFixHint: emptyToNull(expectedFixHint),
      notes: emptyToNull(notes),
    },
  };
}

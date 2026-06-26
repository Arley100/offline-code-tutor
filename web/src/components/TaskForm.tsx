"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form";
import { DIFFICULTIES } from "@/lib/validation";

type TaskAction = (prev: FormState, formData: FormData) => Promise<FormState>;

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

export interface TaskInitial {
  id?: string;
  title?: string;
  prompt?: string;
  language?: string | null;
  difficulty?: string | null;
  category?: string | null;
  expectedFixHint?: string | null;
  notes?: string | null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-xs text-red-600">{message}</span>;
}

export function TaskForm({
  action,
  projectId,
  initial,
  submitLabel,
}: {
  action: TaskAction;
  projectId: string;
  initial?: TaskInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      {initial?.id ? (
        <input type="hidden" name="taskId" value={initial.id} />
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Title <span className="text-red-600">*</span>
        </span>
        <input
          name="title"
          defaultValue={initial?.title ?? ""}
          className={inputClass}
          placeholder="e.g. Off-by-one in vector loop"
        />
        <FieldError message={state.fieldErrors?.title} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
            Language
          </span>
          <input
            name="language"
            defaultValue={initial?.language ?? ""}
            className={inputClass}
            placeholder="python"
          />
          <FieldError message={state.fieldErrors?.language} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
            Difficulty
          </span>
          <select
            name="difficulty"
            defaultValue={initial?.difficulty ?? ""}
            className={inputClass}
          >
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.difficulty} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
            Category
          </span>
          <input
            name="category"
            defaultValue={initial?.category ?? ""}
            className={inputClass}
            placeholder="off-by-one"
          />
          <FieldError message={state.fieldErrors?.category} />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Prompt <span className="text-red-600">*</span>
        </span>
        <textarea
          name="prompt"
          defaultValue={initial?.prompt ?? ""}
          rows={4}
          className={inputClass}
          placeholder="The debugging prompt sent to the model."
        />
        <FieldError message={state.fieldErrors?.prompt} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Expected behavior / fix
        </span>
        <textarea
          name="expectedFixHint"
          defaultValue={initial?.expectedFixHint ?? ""}
          rows={2}
          className={inputClass}
          placeholder="Optional. e.g. factorial(0) should return 1."
        />
        <FieldError message={state.fieldErrors?.expectedFixHint} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Notes
        </span>
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={2}
          className={inputClass}
          placeholder="Optional"
        />
        <FieldError message={state.fieldErrors?.notes} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import {
  RUBRIC_DIMENSIONS,
  type ManualScoreValidationData,
} from "@/lib/domain";
import { initialFormState, type FormState } from "@/lib/form";

type ScoreAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

export function ScoreForm({
  action,
  projectId,
  runId,
  initial,
}: {
  action: ScoreAction;
  projectId: string;
  runId: string;
  initial?: Partial<ManualScoreValidationData> | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="runId" value={runId} />

      <div className="grid gap-4 md:grid-cols-2">
        {RUBRIC_DIMENSIONS.map((dimension) => (
          <label key={dimension.field} className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-800 dark:text-neutral-100">
              {dimension.label} <span className="text-red-600">*</span>
            </span>
            <span className="mb-2 block text-xs text-neutral-500">
              {dimension.helper}
            </span>
            <select
              name={dimension.field}
              defaultValue={initial?.[dimension.field] ?? ""}
              className={inputClass}
              required
            >
              <option value="">Choose 1–5</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            {state.fieldErrors?.[dimension.field] ? (
              <span className="mt-1 block text-xs text-red-600">
                {state.fieldErrors[dimension.field]}
              </span>
            ) : null}
          </label>
        ))}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-neutral-800 dark:text-neutral-100">
          Notes
        </span>
        <span className="mb-2 block text-xs text-neutral-500">
          Optional human rationale. Do not auto-score or invent missing evidence.
        </span>
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={5}
          className={inputClass}
          placeholder="Why did you assign these scores?"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Saving…" : initial ? "Save score edits" : "Save manual score"}
      </button>
    </form>
  );
}

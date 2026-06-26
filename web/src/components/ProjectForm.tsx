"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form";

type ProjectAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

export function ProjectForm({
  action,
  initial,
  submitLabel,
}: {
  action: ProjectAction;
  initial?: { id?: string; name?: string; description?: string | null };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Name <span className="text-red-600">*</span>
        </span>
        <input
          name="name"
          defaultValue={initial?.name ?? ""}
          className={inputClass}
          placeholder="e.g. Local model regression eval"
        />
        {state.fieldErrors?.name ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.fieldErrors.name}
          </span>
        ) : null}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Description
        </span>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
          className={inputClass}
          placeholder="Optional"
        />
        {state.fieldErrors?.description ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.fieldErrors.description}
          </span>
        ) : null}
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
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

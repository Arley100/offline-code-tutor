"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form";

type ImportAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

export function ImportArtifactForm({
  action,
  projectId,
}: {
  action: ImportAction;
  projectId: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          Artifact JSON file
        </span>
        <input
          type="file"
          name="artifactFile"
          accept="application/json,.json"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm dark:file:border-neutral-700"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">
          …or paste JSON
        </span>
        <textarea
          name="artifactJson"
          rows={6}
          className={`${inputClass} font-mono`}
          placeholder='Paste the contents of a results/benchmark_*.json file'
        />
        {state.fieldErrors?.artifactJson ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.fieldErrors.artifactJson}
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
        {pending ? "Importing…" : "Import artifact"}
      </button>
    </form>
  );
}

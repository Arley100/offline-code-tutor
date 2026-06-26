"use client";

type DeleteAction = (formData: FormData) => Promise<void>;

/**
 * Renders a small form whose submit is gated by a browser confirm dialog, so a
 * destructive server action only runs after explicit confirmation.
 */
export function DeleteButton({
  action,
  fields,
  label = "Delete",
  confirmText = "Are you sure? This cannot be undone.",
}: {
  action: DeleteAction;
  fields: Record<string, string>;
  label?: string;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button
        type="submit"
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {label}
      </button>
    </form>
  );
}

/** Shared form-action state for useActionState-driven forms. */
export interface FormState {
  ok: boolean;
  /** Top-level error (e.g. database or authorization failure). */
  error?: string;
  /** Per-field validation errors keyed by field name. */
  fieldErrors?: Record<string, string>;
  /** Optional success message for in-place feedback. */
  message?: string;
}

export const initialFormState: FormState = { ok: false };

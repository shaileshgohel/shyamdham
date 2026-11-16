"use client";
import { startTransition, useActionState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFlash } from "./flash";

export type ActionResult = { ok?: boolean; error?: string; message?: string; redirect?: string; data?: Record<string, unknown> };
type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/**
 * A form that submits to a server action without React's automatic reset, so typed values
 * stay on screen when the server reports an error. On success it shows the message and/or
 * navigates to `redirect`, then refreshes server data.
 */
export function ActionForm({ action, children, className = "form", resetOnSuccess, id }: { action: Action; children: React.ReactNode | ((s: ActionResult, pending: boolean) => React.ReactNode); className?: string; resetOnSuccess?: boolean; id?: string }) {
  const router = useRouter();
  const flash = useFlash();
  const formRef = useRef<HTMLFormElement>(null);
  // Follow-up steps run as soon as the result arrives: the refreshed page may no longer contain
  // this form (e.g. the payment form disappears once nothing is due), so an effect would never run.
  const wrapped = useCallback(async (prev: ActionResult, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok && r.message && flash) flash(r.message);
    if (r.ok && resetOnSuccess) formRef.current?.reset();
    if (r.ok && r.redirect) router.push(r.redirect);
    else if (r.ok) router.refresh();
    return r;
  }, [action, flash, router, resetOnSuccess]);
  const [state, run, pending] = useActionState<ActionResult, FormData>(wrapped, {});
  return (
    <form
      ref={formRef}
      id={id}
      className={className}
      noValidate
      encType="multipart/form-data"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      {state.error && <p className="alert bad" role="alert">{state.error}</p>}
      {state.ok && state.message && !flash && <p className="alert ok" role="status">{state.message}</p>}
      {typeof children === "function" ? children(state, pending) : children}
    </form>
  );
}

export function Submit({ children, pending, className = "btn pri", name, value }: { children: React.ReactNode; pending?: boolean; className?: string; name?: string; value?: string }) {
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? "…" : children}
    </button>
  );
}

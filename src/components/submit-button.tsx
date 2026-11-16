"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn pri", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} {...rest}>
      {pending ? "…" : children}
    </button>
  );
}

"use server";
import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export type LoginState = { error?: "err_invalid" | "err_locked" | "err_inactive"; username?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").slice(0, 60);
  const password = String(form.get("password") ?? "").slice(0, 200);
  if (!username || !password) return { error: "err_invalid", username };
  const res = await login(username, password);
  if (!res.ok) return { error: `err_${res.error}` as LoginState["error"], username };
  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

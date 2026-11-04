"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signUp");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email) return setError("Please enter your email.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("That email doesn't look right.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setError(null);
    setBusy(true);
    try {
      await signIn("password", { email, password, flow });
    } catch {
      setError(
        flow === "signIn"
          ? "Wrong email or password. New here? Create an account instead."
          : "Couldn't create that account. The email may already be registered — try logging in."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="card w-full max-w-md space-y-5 border-2 border-accent/60 p-8 shadow-xl shadow-accent/10"
    >
      <div>
        <h2 className="font-serif text-3xl">
          {flow === "signUp" ? "Ingrain your first chapter" : "Welcome back"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {flow === "signUp" ? "Free. Upload a PDF and start learning in about a minute." : "Pick up where you left off."}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={flow === "signUp" ? "new-password" : "current-password"}
          className="input"
        />
        {flow === "signUp" && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
        {busy ? "One moment…" : flow === "signUp" ? "Sign up" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        {flow === "signUp" ? "Already have an account?" : "New to Ingrain?"}{" "}
        <button
          type="button"
          className="font-medium text-ink underline underline-offset-2"
          onClick={() => {
            setFlow(flow === "signUp" ? "signIn" : "signUp");
            setError(null);
          }}
        >
          {flow === "signUp" ? "Log in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}

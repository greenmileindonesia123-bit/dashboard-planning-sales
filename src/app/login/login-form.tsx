"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { message: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email terdaftar</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          placeholder="nama@gmail.com"
          className="h-10"
          aria-invalid={state.message ? true : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10"
          aria-invalid={state.message ? true : undefined}
        />
      </div>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}

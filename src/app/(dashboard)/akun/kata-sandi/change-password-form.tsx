"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/(dashboard)/akun/kata-sandi/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ChangePasswordState = { status: "idle", message: null, formKey: "edit" };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <div className="space-y-4">
      {state.status === "success" && state.message ? (
        <p role="status" className="text-sm font-medium text-primary">
          {state.message}
        </p>
      ) : null}
      <form key={state.formKey} action={formAction} className="space-y-4">
        <PasswordField id="currentPassword" name="currentPassword" label="Kata sandi lama" autoComplete="current-password" />
        <PasswordField id="newPassword" name="newPassword" label="Kata sandi baru" autoComplete="new-password" />
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Konfirmasi kata sandi baru"
          autoComplete="new-password"
        />
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" className="h-10 w-full" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan kata sandi"}
        </Button>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="password" autoComplete={autoComplete} required className="h-10" />
    </div>
  );
}

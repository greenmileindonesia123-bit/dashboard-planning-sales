"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createLoginAccount,
  resetLoginPassword,
  setLoginActive,
  updateLoginAccount,
  type AccountActionResult,
} from "@/app/(dashboard)/kelola-akun/actions";
import type { LoginAccount } from "@/lib/account-admin";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountPanel({ accounts, actorEmail }: { accounts: LoginAccount[]; actorEmail: string }) {
  return (
    <div className="space-y-8">
      <AddAccountForm />
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Daftar ID login</h2>
        {accounts.length === 0 ? (
          <Notice title="Belum ada ID login">Tambahkan email di formulir di atas. Tidak ada email undangan yang dikirim.</Notice>
        ) : (
          <ul className="space-y-4">
            {accounts.map((account) => (
              <li key={account.email}>
                <AccountCard account={account} actorEmail={actorEmail} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddAccountForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    const next = await createLoginAccount(formData);
    setPending(false);
    setResult(next);
    if (next.ok) router.refresh();
  }

  return (
    <form className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10" action={submit}>
      <div className="space-y-1">
        <h2 className="font-heading text-2xl">Tambah ID login</h2>
        <p className="text-sm text-muted-foreground">
          Akun langsung bisa masuk. Tidak ada email undangan atau OTP. Email ini juga dipakai sebagai Email Google di Data Sales dan tidak dapat diubah nanti.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="email-baru" label="Email" name="email" type="email" autoComplete="off" />
        <Field id="nama-baru" label="Nama pemakai" name="name" autoComplete="off" />
        <TeamField id="team-baru" />
        <Field id="sandi-baru" label="Kata sandi sementara" name="password" type="password" autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tambah ID login"}
      </Button>
      {result ? <ResultNotice result={result} /> : null}
    </form>
  );
}

function AccountCard({ account, actorEmail }: { account: LoginAccount; actorEmail: string }) {
  return (
    <article className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium">{account.email}</h3>
          <p className="text-sm text-muted-foreground">Terakhir masuk: {account.lastSignInLabel}</p>
        </div>
        <p className="text-sm font-medium">{account.active ? "Aktif" : "Nonaktif"}</p>
      </div>
      {account.profileId ? (
        <ProfileForm account={account} />
      ) : (
        <p className="text-sm text-muted-foreground">Akun Auth ini belum punya baris Data Sales. Email login tidak diubah dari halaman ini.</p>
      )}
      <PasswordForm account={account} />
      <StatusForm account={account} actorEmail={actorEmail} />
    </article>
  );
}

function ProfileForm({ account }: { account: LoginAccount }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    const next = await updateLoginAccount(formData);
    setPending(false);
    setResult(next);
    if (next.ok) router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-[1fr_12rem_auto] md:items-end" action={submit}>
      <input type="hidden" name="profileId" value={account.profileId ?? ""} />
      <input type="hidden" name="authUserId" value={account.authUserId ?? ""} />
      <Field id={`nama-${account.email}`} label="Nama pemakai" name="name" defaultValue={account.name} autoComplete="off" />
      <TeamField id={`tim-${account.email}`} defaultValue={account.team ?? "Sales"} />
      <Button type="submit" variant="outline" disabled={pending || !account.authUserId}>
        {pending ? "Menyimpan…" : "Simpan nama dan tim"}
      </Button>
      {!account.authUserId ? <p className="text-sm text-muted-foreground md:col-span-3">Akun Auth untuk email ini belum ada.</p> : null}
      {result ? <div className="md:col-span-3"><ResultNotice result={result} /></div> : null}
    </form>
  );
}

function PasswordForm({ account }: { account: LoginAccount }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AccountActionResult | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    const next = await resetLoginPassword(formData);
    setPending(false);
    setResult(next);
  }

  return (
    <form className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end" action={submit}>
      <input type="hidden" name="authUserId" value={account.authUserId ?? ""} />
      <Field id={`sandi-${account.email}`} label="Kata sandi sementara baru" name="password" type="password" autoComplete="new-password" />
      <Button type="submit" variant="outline" disabled={pending || !account.authUserId}>
        {pending ? "Menyimpan…" : "Reset kata sandi"}
      </Button>
      {result ? <div className="md:col-span-2"><ResultNotice result={result} /></div> : null}
    </form>
  );
}

function StatusForm({ account, actorEmail }: { account: LoginAccount; actorEmail: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const router = useRouter();
  const nextActive = !account.active;
  const blocksSelf = account.active && actorEmail.trim().toLowerCase() === account.email;

  async function submit(formData: FormData) {
    setPending(true);
    const next = await setLoginActive(formData);
    setPending(false);
    setResult(next);
    if (next.ok) router.refresh();
  }

  return (
    <form className="space-y-2" action={submit}>
      <input type="hidden" name="email" value={account.email} />
      <input type="hidden" name="profileId" value={account.profileId ?? ""} />
      <input type="hidden" name="authUserId" value={account.authUserId ?? ""} />
      <input type="hidden" name="active" value={nextActive ? "true" : "false"} />
      <Button type="submit" variant={account.active ? "destructive" : "outline"} disabled={pending || !account.profileId || blocksSelf}>
        {pending ? "Menyimpan…" : account.active ? "Nonaktifkan" : "Aktifkan"}
      </Button>
      {blocksSelf ? <p className="text-sm text-muted-foreground">Super Admin tidak dapat menonaktifkan akunnya sendiri.</p> : null}
      {result ? <ResultNotice result={result} /> : null}
    </form>
  );
}

function TeamField({ id, defaultValue = "Sales" }: { id: string; defaultValue?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Tim</Label>
      <select
        id={id}
        name="team"
        defaultValue={defaultValue}
        className="block h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
      >
        <option value="Sales">Sales</option>
        <option value="PPIC">PPIC</option>
      </select>
    </div>
  );
}

function Field({
  id,
  label,
  name,
  type = "text",
  defaultValue,
  autoComplete,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} autoComplete={autoComplete} required />
    </div>
  );
}

function ResultNotice({ result }: { result: AccountActionResult }) {
  return <Notice title={result.ok ? "Tersimpan" : "Tidak dapat disimpan"}>{result.message}</Notice>;
}

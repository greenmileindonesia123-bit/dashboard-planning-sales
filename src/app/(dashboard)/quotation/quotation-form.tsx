"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuotation, updateQuotationStatus, uploadQuotePdf, type QuotationResult } from "@/app/(dashboard)/quotation/actions";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function QuotationForm({ customers }: { customers: string[] }) {
  const [rows, setRows] = useState([0]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<QuotationResult | null>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    const next = await createQuotation(formData);
    setPending(false);
    setResult(next);
    if (next.ok) router.push("/quotation");
  }

  return (
    <form className="space-y-4" action={submit}>
      <label className="space-y-2 text-sm">
        <span className="font-medium">Nama customer</span>
        <Input name="customerName" list="customer-saran" required />
        <datalist id="customer-saran">
          {customers.map((name) => <option key={name} value={name} />)}
        </datalist>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="pic" label="PIC" />
        <TextField name="phone" label="No telp" />
        <TextField name="projectAddress" label="Alamat / lokasi proyek" />
        <TextField name="projectName" label="Nama proyek" required />
        <TextField name="workType" label="Jenis produk / pekerjaan" />
        <TextField name="targetDate" label="Target tanggal penawaran" type="date" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Item</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, current.length])}>Tambah baris</Button>
        </div>
        {rows.map((row) => (
          <div key={row} className="grid gap-2 md:grid-cols-4">
            <Input name="description" placeholder="Deskripsi" aria-label="Deskripsi item" />
            <Input name="specification" placeholder="Spesifikasi / ukuran" aria-label="Spesifikasi" />
            <Input name="quantity" type="number" min="0" step="0.01" placeholder="Qty" aria-label="Qty" />
            <Input name="unit" placeholder="Satuan" aria-label="Satuan" />
          </div>
        ))}
      </div>
      <label className="space-y-2 text-sm">
        <span className="font-medium">Catatan</span>
        <textarea name="notes" className="min-h-24 w-full rounded-lg border border-input bg-card px-2.5 py-2" />
      </label>
      <label className="space-y-2 text-sm">
        <span className="font-medium">Lampiran pendukung</span>
        <Input name="lampiran" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple />
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Kirim permintaan"}</Button>
      {result && !result.ok ? <Notice title="Tidak dapat disimpan">{result.message}</Notice> : null}
    </form>
  );
}

export function ReviewerControls({ id, status }: { id: string; status: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function saveStatus(formData: FormData) {
    const result = await updateQuotationStatus(formData);
    setMessage(result.message);
  }

  async function savePdf(formData: FormData) {
    const result = await uploadQuotePdf(formData);
    setMessage(result.message);
  }

  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-end gap-2" action={saveStatus}>
        <input type="hidden" name="id" value={id} />
        <label className="space-y-1 text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue={status} className="block h-10 rounded-lg border border-input bg-card px-2.5">
            {["Baru", "Diproses", "Selesai", "Batal"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <Button type="submit" variant="outline" size="sm">Simpan status</Button>
      </form>
      <form className="flex flex-wrap items-end gap-2" action={savePdf}>
        <input type="hidden" name="id" value={id} />
        <Label className="space-y-1">
          PDF penawaran
          <Input name="pdf" type="file" accept="application/pdf,.pdf" required />
        </Label>
        <Button type="submit" size="sm">Unggah PDF</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function TextField({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input name={name} type={type} required={required} />
    </label>
  );
}

export const SYNC_COOLDOWN_MS = 2 * 60 * 1000;

export const SYNC_ALREADY_RUNNING_MESSAGE = "Sinkron masih berjalan.";
export const SYNC_RECORDED_MESSAGE =
  "Permintaan sinkron disimpan. Google belum dihubungi karena pengambil kalender belum diatur.";
export const SYNC_SENT_MESSAGE = "Permintaan sinkron dikirim. Menunggu hasil dari pengambil kalender.";
export const SYNC_WEBHOOK_FAILED_MESSAGE =
  "Permintaan sinkron disimpan, tetapi pengambil kalender tidak menjawab. Google belum dipastikan dihubungi.";
export const SYNC_DONE_MESSAGE = "Sinkron selesai.";
export const SYNC_FAILED_MESSAGE = "Sinkron gagal.";
export const SYNC_TIMEOUT_MESSAGE = "Permintaan masih berjalan. Muat ulang Planning sebentar lagi untuk melihat acara baru.";

export type SyncRequestSnapshot = {
  id: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
};

export function normalizeRequesterEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function activeSyncRequest<T extends SyncRequestSnapshot>(requests: T[], now: Date): T | null {
  const cutoff = now.getTime() - SYNC_COOLDOWN_MS;
  const active = requests
    .filter((request) => {
      if (request.status !== "pending" && request.status !== "running") return false;
      const requestedAt = new Date(request.requestedAt).getTime();
      return Number.isFinite(requestedAt) && requestedAt >= cutoff;
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return active[0] ?? null;
}

export function syncStatusMessage(status: string, workerMessage: string | null): string {
  const trimmed = workerMessage?.trim() ?? "";
  if (trimmed) return trimmed;
  if (status === "done") return SYNC_DONE_MESSAGE;
  if (status === "failed") return SYNC_FAILED_MESSAGE;
  if (status === "running" || status === "pending") return SYNC_ALREADY_RUNNING_MESSAGE;
  return SYNC_FAILED_MESSAGE;
}

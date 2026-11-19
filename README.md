# Dashboard Planning Sales

Dashboard internal Green Mile Indonesia untuk planning kegiatan, kinerja kunjungan, dan report perbandingan bulan ini dengan bulan lalu. Antarmuka berbahasa Indonesia. Semua tanggal memakai zona waktu **Asia/Jakarta**.

Login memakai email terdaftar dan kata sandi lewat `signInWithPassword`. Pendaftaran umum ditutup: email yang tidak berstatus Aktif di `sales_profiles` mendapat pesan "Email ini belum terdaftar." dan tidak mencoba Auth. Akun baru hanya dibuat Super Admin di Kelola ID login, tanpa email undangan.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
# isi kedua variable, lalu:
npm run dev
```

Aplikasi jalan di [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test
npm run lint
npm run build
```

## Environment variable

Salin ke `.env.local` untuk lokal, dan ke Vercel (Production, Preview, Development) saat deploy. Jangan commit nilai aslinya.

| Variable | Tempat | Isi |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | URL project. Project ini: `https://vetkkymhqjbhixrztvpm.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Kunci **anon** atau **publishable**. Keduanya boleh diisi di variable ini. |

Aplikasi yang berjalan hanya membaca dua variable itu. Kelola ID login memakai fungsi SQL `admin_*` dengan sesi Super Admin, bukan kunci service role.

Daftar email diperiksa lewat RPC `public.is_active_registered_email(check_email)`. Fungsi itu `security definer`, hanya mengembalikan boolean, dan di-grant ke `anon` serta `authenticated`. Hasilnya true hanya jika email (setelah trim dan huruf kecil) cocok dengan baris `sales_profiles` yang statusnya Aktif. Klien anon memanggilnya sebelum `signInWithPassword`. Email yang tidak lolos tidak memanggil Auth.

## Setup Supabase

1. Buat project Supabase baru (region dekat Indonesia, misalnya Singapore).
2. SQL Editor: jalankan `supabase/migrations/20261108134718_init_sales_planning.sql`, `supabase/seed.sql`, lalu `supabase/migrations/20261108140212_allowlist_email_rpc.sql`.
   - Migrasi awal membuat `sales_profiles` dan `visit_reports`, menyalakan RLS, dan menaruh fungsi otorisasi di schema `private`.
   - Migrasi kedua memasang `public.is_active_registered_email(check_email text)`. Di project `dashboard-planning-sales` fungsi ini sudah terpasang.
   - Seed mengisi 9 orang dari Data Sales per 8 November 2026. Tujuh punya email. Dya Ayu dan Diah Kanthi disimpan tanpa email, jadi mereka tidak bisa login.
   - Seed **tidak** mengisi laporan kunjungan. Tab Laporan Kunjungan di sheet memang masih header saja.
3. Matikan pendaftaran umum.
   - Dashboard → **Authentication → Sign In / Providers** (atau Sign In / Up).
   - Matikan **Allow new users to sign up**.
   - Di config lokal ini sudah `enable_signup = false` pada `[auth]` di `supabase/config.toml`. Yang dimatikan adalah signup user baru. Login harian tidak memakai template email.
4. Tujuh user Auth untuk project `dashboard-planning-sales` sudah dibuat dengan `email_confirm: true` dan tertaut ke `sales_profiles`. Tidak ada email undangan. Dya Ayu dan Diah Kanthi tetap tanpa akun karena tidak punya email. Akun baru setelah itu dibuat Super Admin di `/kelola-akun`, juga tanpa email undangan. Aplikasi tidak menyimpan daftar kata sandi.

   `scripts/provision-auth-users.mjs` bukan bagian dari aplikasi yang berjalan. Jangan menjalankannya lagi untuk project ini: user sudah ada. Skrip itu, kalau dipakai di project kosong, memanggil `createUser` dengan `email_confirm: true` dan tidak mengirim undangan. Jangan memakai tombol **Invite user**.

Peran tidak disimpan di `user_metadata` (bisa diubah user). Kebijakan RLS membaca `sales_profiles.team` lewat fungsi `security definer` di schema `private`. `app_metadata.team` hanya cerminan, dan tidak dipakai untuk mengizinkan akses.

## Cara login

1. Buka `/login`.
2. Masukkan email dan kata sandi, lalu pilih Masuk.
3. Server memanggil `supabase.rpc('is_active_registered_email', { check_email })` dengan kunci anon/publishable. Jika hasilnya bukan true, layar menampilkan "Email ini belum terdaftar." dan `signInWithPassword` tidak dipanggil.
4. Jika email lolos, sesi dibuat dengan `signInWithPassword`. Kata sandi yang salah menampilkan "Kata sandi salah." User baru tidak dibuat.
5. Setelah sesi terbentuk, allowlist diperiksa lagi. Jika gagal, sesi dihapus.
6. Masuk yang berhasil membuka `/planning`. Menu utama ada di sidebar kiri: Planning Kegiatan, Pengingat kunjungan ulang, Unggah laporan kunjungan (Smart Salary), Unggah jadwal kalender, Kinerja, Report, dan Tim Sales. Super Admin juga melihat **Unggah data deal (SO)**, **Kelola ID login**, dan **Template kunjungan sales**. Bagian Akun di bawah sidebar berisi **Ubah kata sandi** dan Keluar. Header tipis menampilkan Green Mile Indonesia, nama, tim, email, dan Keluar. Di layar kecil, tombol Menu membuka sidebar yang sama.
7. **Ubah kata sandi** (`/akun/kata-sandi`) meminta kata sandi lama, kata sandi baru, dan konfirmasi. Kata sandi lama dicek dengan `signInWithPassword` sebelum `updateUser`. Pengguna tetap masuk. Tidak ada email reset.

Setiap akun hanya melihat kegiatan miliknya: kalender, laporan kunjungan, pengingat, Kinerja, dan Report. Super Admin adalah Puput (`operasionalgreenmileindonesia@gmail.com`). Hanya Super Admin yang melihat seluruh tim dan filter per orang, termasuk "semua". Tim PPIC bukan Super Admin: Ilya tetap bertim PPIC di menu akun, tetapi hanya melihat data emailnya sendiri. Daftar Tim Sales terlihat oleh semua akun Aktif, termasuk baris yang belum punya email.

## Halaman

- **Planning Kegiatan** — tampilan hari, minggu, dan bulan dari tabel `calendar_events`. Akun biasa melihat kalender emailnya sendiri. Super Admin dapat melihat semua dan memfilter per orang. Jadwal diisi dengan mengunggah file `.ics` di `/unggah-jadwal`. Tidak ada acara contoh.
- **Kinerja** — filter hari / minggu / bulan / tahun, dihitung hanya dari `visit_reports`.
- **Pengingat kunjungan ulang** — daftar `follow_up_date` yang sudah diisi. Terlambat, hari ini, 14 hari ke depan, lalu yang lebih jauh. Akun biasa hanya melihat emailnya sendiri. Super Admin dapat memfilter per orang. Kosong sampai ada tanggal follow-up sungguhan. Tidak mengirim email.
- **Unggah laporan kunjungan** — impor file Smart Salary (sheet LAPORAN KUNJUNGAN SALES) atau CSV template. Upsert pada `external_id`. Akun biasa hanya menulis baris miliknya. Super Admin dapat menulis baris orang lain. Butuh migrasi tulis, lalu `supabase/migrations/20261109064200_super_admin_visibility.sql`.
- **Unggah jadwal kalender** — impor file `.ics` dari Google Calendar ke `calendar_events`. Akun biasa menyimpan sebagai dirinya sendiri. Super Admin memilih pemilik berkas. Butuh migrasi `supabase/migrations/20261109064200_super_admin_visibility.sql`.
- **Template kunjungan sales** — `/template-kunjungan`, hanya Super Admin. Menjelaskan master template dan membuka Google Sheet. Akun lain yang membuka URL mendapat penolakan, tanpa tautan. Footer tidak lagi menampilkan template.
- **Unggah data deal (SO)** — `/unggah-deal`, hanya Super Admin. Impor sheet Sales Order (.xlsx atau .csv). Nilai deal adalah Net Total, satu kali per nomor SO. Batal dan draft disimpan tetapi tidak dihitung. Butuh migrasi `supabase/migrations/20261110070400_sales_orders.sql`.
- **Kelola ID login** — `/kelola-akun`, hanya Super Admin. Menambah akun tanpa email undangan, mengubah nama dan tim, mereset kata sandi sementara, serta menonaktifkan akun. Email login tidak diubah. Butuh migrasi `supabase/migrations/20261111090700_admin_account_functions.sql`. Tidak memakai kunci service role.
- **Kinerja dan Report** — selain angka laporan kunjungan, menampilkan Jumlah SO dan Nilai deal (Net Total SO). Super Admin melihat ember Belum dipetakan. Akun lain hanya melihat SO emailnya sendiri.
- **Report** — bulan kalender berjalan dibanding bulan kalender sebelumnya (Asia/Jakarta), dengan grafik Recharts. Legenda: "Bulan ini" dan "Bulan lalu". Kalau belum ada baris, grafik tetap tampil di angka 0.
- **Tim Sales** — roster, dengan penanda email yang belum diisi.
- **Data Customer** — `/customer`, gabungan laporan kunjungan dan Sales Order. Sales hanya melihat customer datanya sendiri. Super Admin melihat semua.
- **Permintaan Quotation** — `/quotation`. Sales membuat permintaan miliknya. Reviewer (Puput, Ilya, dan email halogreenmile@gmail.com) melihat semua, mengubah status, dan mengunggah PDF. Butuh migrasi `supabase/migrations/20261111093400_customers_and_quotations.sql`.
- **Planning** juga menampilkan kunjungan ulang dari tanggal follow-up laporan, tanpa menyalinnya ke `calendar_events`.

Pipeline pada Report = jumlah laporan berstatus **Prospek** atau **Negosiasi**.

## Mengisi laporan nanti

Dashboard membaca `visit_reports`, bukan Google Sheets secara langsung. Saat tim mulai mengisi sheet, impor baris sungguhan ke tabel ini. Jangan membuat baris contoh.

| Kolom sheet | Kolom `visit_reports` |
| --- | --- |
| ID Laporan | `external_id` |
| Tanggal Kunjungan | `visit_date` |
| Waktu Mulai / Selesai | `start_time` / `end_time` |
| Durasi (jam) | `duration_hours` |
| Email Sales / Nama Sales | `sales_email` / `sales_name` |
| ID Acara Kalender | `calendar_event_id` |
| Nama Customer / Tipe / Kota / Alamat | `customer_name` / `customer_type` / `city_area` / `address` |
| Tujuan Kunjungan | `visit_purpose` |
| Status Kunjungan | `visit_status` |
| Hasil Kegiatan | `activity_result` |
| Produk yang Dibahas | `products_discussed` |
| Nilai Potensi (Rp) / Nilai Order (Rp) | `potential_value` / `order_value` |
| Status Pipeline | `pipeline_status` |
| Catatan Laporan | `notes` |
| Tanggal Follow Up | `follow_up_date` |
| Link Dokumentasi | `documentation_url` |

Nilai Rupiah disimpan sebagai angka, tanpa titik pemisah.

## Yang masih harus dilakukan koordinator

Project Supabase `dashboard-planning-sales` (`https://vetkkymhqjbhixrztvpm.supabase.co`) sudah ada. Migrasi awal, seed, RPC allowlist, dan tujuh user Auth sudah terpasang. Tidak perlu mengirim email setup lagi.

- Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kunci publishable boleh) di `.env.local` dan di Vercel. Jangan menambahkan service role.
- Pastikan public signup tetap mati, Site URL dan Redirect URL `/auth/confirm` mengarah ke origin aplikasi, dan template Magic Link memuat `{{ .Token }}`.
- Login tidak mengirim email. SMTP dan template Magic Link tidak diperlukan untuk masuk.
- Deploy ke Vercel dari repo Origin ini kalau hosting produksi dibutuhkan. Repo ini sumber kebenarannya; jangan membuat mirror GitHub.
- Impor Laporan Kunjungan saat sheet sudah berisi baris sungguhan.
- Integrasi Google Calendar masih ditunda.

## Struktur

```
src/app/login            form email + kata sandi
src/app/(dashboard)/akun/kata-sandi   ubah kata sandi sendiri
src/app/auth/confirm     tautan magic link, kalau email masih menyertakannya
src/app/(dashboard)      Planning, Kinerja, Report, Tim Sales
src/proxy.ts             refresh sesi cookie dan redirect login
src/lib/supabase         klien browser dan server (kunci anon/publishable)
src/lib/allowlist.ts     keputusan boleh/tidak mencoba signInWithPassword
supabase/migrations      skema, RLS, dan RPC is_active_registered_email
supabase/seed.sql        9 orang, tanpa laporan kunjungan
```

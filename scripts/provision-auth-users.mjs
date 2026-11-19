// One-off setup tool. The running app, including Kelola ID login, does not read a service-role key.
// createUser with email_confirm does not send an invite. Do not switch this to inviteUserByEmail.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error } = await admin
  .from("sales_profiles")
  .select("id, email, name, team, status")
  .eq("status", "Aktif")
  .not("email", "is", null)
  .order("roster_order", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

async function findUser(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw listError;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

let created = 0;
let updated = 0;

for (const profile of profiles ?? []) {
  const email = String(profile.email).toLowerCase();
  let user = await findUser(email);
  if (!user) {
    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { team: profile.team },
    });
    if (createError || !data.user) {
      console.error(`Gagal membuat ${email}: ${createError?.message ?? "tanpa user"}`);
      process.exitCode = 1;
      continue;
    }
    user = data.user;
    created += 1;
    console.log(`Dibuat tanpa email undangan: ${profile.name} <${email}>`);
  } else {
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      app_metadata: { ...user.app_metadata, team: profile.team },
    });
    if (updateError) {
      console.error(`Gagal memperbarui ${email}: ${updateError.message}`);
      process.exitCode = 1;
      continue;
    }
    updated += 1;
    console.log(`Sudah ada, app_metadata diperbarui: ${profile.name} <${email}>`);
  }

  const { error: linkError } = await admin
    .from("sales_profiles")
    .update({ auth_user_id: user.id })
    .eq("id", profile.id);
  if (linkError) {
    console.error(`Gagal menghubungkan profil ${email}: ${linkError.message}`);
    process.exitCode = 1;
  }
}

console.log(`Selesai. Dibuat: ${created}. Diperbarui: ${updated}. Tidak ada email undangan yang dikirim.`);

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const sql = postgres(required("POSTGRES_URL"), { max: 1, prepare: false, connect_timeout: 10 });
await sql`
  create table if not exists volunteer_records (
    path text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
  )
`;
await sql`alter table volunteer_records enable row level security`;
await sql.end();

const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? required("SUPABASE_SECRET_KEY");
const supabase = createClient(required("SUPABASE_URL"), key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw listError;
if (!buckets.some(bucket => bucket.id === "volunteer-files")) {
  const { error } = await supabase.storage.createBucket("volunteer-files", { public: false, fileSizeLimit: 4 * 1024 * 1024 });
  if (error) throw error;
}
console.log("Supabase volunteer storage is ready.");

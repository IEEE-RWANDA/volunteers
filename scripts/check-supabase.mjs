import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const id = randomUUID();
const path = `storage-check/${id}`;
const sql = postgres(required("POSTGRES_URL"), { max: 1, prepare: false, connect_timeout: 10 });
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? required("SUPABASE_SECRET_KEY");
const supabase = createClient(required("SUPABASE_URL"), key, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  await sql`insert into volunteer_records (path, data) values (${path + ".json"}, ${sql.json({ check: id })})`;
  const rows = await sql`select data from volunteer_records where path = ${path + ".json"}`;
  assert.equal(rows[0]?.data?.check, id);

  const bytes = new TextEncoder().encode(id);
  const uploaded = await supabase.storage.from("volunteer-files").upload(path, bytes, { contentType: "application/octet-stream" });
  if (uploaded.error) throw uploaded.error;
  const downloaded = await supabase.storage.from("volunteer-files").download(path);
  if (downloaded.error) throw downloaded.error;
  assert.equal(await downloaded.data.text(), id);
} finally {
  await sql`delete from volunteer_records where path = ${path + ".json"}`;
  await supabase.storage.from("volunteer-files").remove([path]);
  await sql.end();
}

console.log("Supabase record and file storage checks passed.");

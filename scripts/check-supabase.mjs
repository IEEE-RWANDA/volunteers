import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const id = randomUUID();
const path = `storage-check/${id}`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? required("SUPABASE_SECRET_KEY");
const supabase = createClient(required("SUPABASE_URL"), key, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  const inserted = await supabase.from("volunteer_records").insert({ path: path + ".json", data: { check: id } });
  if (inserted.error) throw inserted.error;
  const record = await supabase.from("volunteer_records").select("data").eq("path", path + ".json").single();
  if (record.error) throw record.error;
  assert.equal(record.data.data.check, id);

  const bytes = new TextEncoder().encode(id);
  const uploaded = await supabase.storage.from("volunteer-files").upload(path, bytes, { contentType: "application/octet-stream" });
  if (uploaded.error) throw uploaded.error;
  const downloaded = await supabase.storage.from("volunteer-files").download(path);
  if (downloaded.error) throw downloaded.error;
  assert.equal(await downloaded.data.text(), id);
} finally {
  await supabase.from("volunteer_records").delete().eq("path", path + ".json");
  await supabase.storage.from("volunteer-files").remove([path]);
}

console.log("Supabase record and file storage checks passed.");

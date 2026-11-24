import { get, list } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const sql = postgres(required("POSTGRES_URL"), { max: 1, prepare: false, connect_timeout: 10 });
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? required("SUPABASE_SECRET_KEY");
const supabase = createClient(required("SUPABASE_URL"), key, { auth: { persistSession: false, autoRefreshToken: false } });
let cursor;
let records = 0;
let files = 0;

do {
  const page = await list({ prefix: "volunteer-intake/", cursor });
  for (const blob of page.blobs) {
    const path = blob.pathname.slice("volunteer-intake/".length);
    const source = await get(blob.pathname, { access: "private", useCache: false });
    if (source?.statusCode !== 200) throw new Error(`Could not read ${path}`);
    const bytes = new Uint8Array(await new Response(source.stream).arrayBuffer());
    if (path.endsWith(".json")) {
      const value = JSON.parse(new TextDecoder().decode(bytes));
      await sql`insert into volunteer_records (path, data) values (${path}, ${sql.json(value)})
        on conflict (path) do update set data = excluded.data, updated_at = now()`;
      records++;
    } else {
      const { error } = await supabase.storage.from("volunteer-files").upload(path, bytes, {
        upsert: true,
        contentType: "application/octet-stream",
      });
      if (error) throw error;
      files++;
    }
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

await sql.end();
console.log(`Migrated ${records} records and ${files} files.`);

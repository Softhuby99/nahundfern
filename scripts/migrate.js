#!/usr/bin/env node
// Minimal SQL migration runner. Applies every *.sql file under db/migrations
// in lexicographic order exactly once; state is tracked in schema_migrations.
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const dir = path.resolve("db/migrations");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.warn(`migrate: ${dir} not found, nothing to apply`);
    await sql.end();
    process.exit(0);
  }

  const rows = await sql`SELECT version FROM schema_migrations`;
  const applied = new Set(rows.map((r) => r.version));

  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const contents = await fs.readFile(path.join(dir, file), "utf8");
    console.log(`migrate: applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO schema_migrations (version) VALUES (${version})`;
    });
    count++;
  }

  console.log(count === 0 ? "migrate: nothing to apply" : `migrate: applied ${count} migration(s)`);
} catch (err) {
  console.error("migrate: failed", err);
  process.exit(1);
} finally {
  await sql.end();
}

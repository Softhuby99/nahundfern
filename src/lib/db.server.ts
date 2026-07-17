import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

let _sql: Sql | null = null;

function getSql(): Sql {
  if (_sql) return _sql;
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  _sql = postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  });
  return _sql;
}

// Proxy so existing `sql\`...\`` and `sql.begin(...)` call sites keep working
// while deferring connection creation until first use.
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply(_t, _thisArg, args: unknown[]) {
    // @ts-expect-error - forward tagged-template call
    return getSql()(...args);
  },
  get(_t, prop, receiver) {
    const s = getSql() as unknown as Record<string | symbol, unknown>;
    const v = s[prop as string];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(s) : v;
  },
}) as Sql;

export async function closeDb() {
  if (_sql) await _sql.end();
}

export type TripRow = {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  region: string;
  where_text: string;
  when_text: string;
  month_label: string;
  who_text: string;
  excerpt: string;
  body_md: string;
  cover_image_id: string | null;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

export type ImageRow = {
  id: string;
  trip_id: string;
  original_path: string;
  webp_400: string;
  webp_1200: string;
  webp_2000: string;
  avif_400: string;
  avif_1200: string;
  avif_2000: string;
  width: number;
  height: number;
  mime: string;
  alt: string | null;
  sort_order: number;
  created_at: Date;
};

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function db(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (local) or Vercel env vars (deployed)."
      );
    }
    // The Neon serverless driver issues queries over fetch. Next.js caches
    // fetch GET responses by default, which would serve STALE query results
    // inside route handlers (a correctness bug). Force no-store so every query
    // hits the database.
    const sql = neon(url, { fetchOptions: { cache: "no-store" } });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export * as tables from "./schema";

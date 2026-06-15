import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);

await sql`create schema if not exists roadmap`;
await sql.query(`create table if not exists roadmap.goals (
  id uuid primary key default gen_random_uuid(),
  phase int not null,
  title text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  done_at timestamptz
)`);
await sql.query(`create table if not exists roadmap.tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid,
  title text not null,
  status text not null default 'pending',
  notes text,
  commit_sha text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)`);
await sql.query(`create table if not exists roadmap.metrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value numeric(14,4) not null,
  meta jsonb,
  recorded_at timestamptz not null default now()
)`);

const goals = [
  [0, "Provision infra (Neon, GitHub, Vercel, auto-deploy)", "in_progress"],
  [1, "Core docs (schema, auth, folders, documents, editor, versions)", "in_progress"],
  [2, "Trust layer (audit, sensitivity, permissions, share links, notarization)", "pending"],
  [3, "AI layer (chunking, embeddings, RAG, cited copilot, consensus router)", "pending"],
  [4, "Polish + launch (onboarding, landing, demo flow, usage metering)", "pending"],
];

const existing = await sql.query(`select count(*)::int as c from roadmap.goals`);
if (existing[0].c === 0) {
  for (const [phase, title, status] of goals) {
    await sql.query(
      `insert into roadmap.goals (phase, title, status) values ($1, $2, $3)`,
      [phase, title, status]
    );
  }
  console.log(`seeded ${goals.length} goals`);
} else {
  console.log(`goals already present: ${existing[0].c}`);
}

const rows = await sql.query(`select phase, status, title from roadmap.goals order by phase`);
for (const r of rows) console.log(`  P${r.phase} [${r.status}] ${r.title}`);

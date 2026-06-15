// Roadmap helper: query or update build progress stored in Neon (schema `roadmap`).
// Usage:
//   node scripts/roadmap.mjs status                 → print all goals + recent tasks
//   node scripts/roadmap.mjs goal <phase> <status>  → set a goal's status
//   node scripts/roadmap.mjs task "<title>" <status> [sha]  → upsert a task
//   node scripts/roadmap.mjs metric <name> <value> [jsonMeta]
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
const [cmd, ...rest] = process.argv.slice(2);

async function status() {
  const goals = await sql.query(`select phase, status, title from roadmap.goals order by phase`);
  console.log("=== GOALS ===");
  for (const g of goals) console.log(`  P${g.phase} [${g.status}] ${g.title}`);
  const tasks = await sql.query(
    `select title, status, commit_sha from roadmap.tasks order by updated_at desc limit 20`
  );
  if (tasks.length) {
    console.log("=== RECENT TASKS ===");
    for (const t of tasks)
      console.log(`  [${t.status}] ${t.title}${t.commit_sha ? " @" + t.commit_sha : ""}`);
  }
}

if (cmd === "status" || !cmd) {
  await status();
} else if (cmd === "goal") {
  const [phase, st] = rest;
  const done = st === "done" || st === "completed";
  await sql.query(
    `update roadmap.goals set status=$1, done_at=${done ? "now()" : "null"} where phase=$2`,
    [st, Number(phase)]
  );
  console.log(`goal P${phase} -> ${st}`);
} else if (cmd === "task") {
  const [title, st, sha] = rest;
  const found = await sql.query(`select id from roadmap.tasks where title=$1`, [title]);
  if (found.length) {
    await sql.query(
      `update roadmap.tasks set status=$1, commit_sha=$2, updated_at=now() where title=$3`,
      [st, sha ?? null, title]
    );
  } else {
    await sql.query(`insert into roadmap.tasks (title, status, commit_sha) values ($1,$2,$3)`, [
      title,
      st,
      sha ?? null,
    ]);
  }
  console.log(`task "${title}" -> ${st}`);
} else if (cmd === "metric") {
  const [name, value, meta] = rest;
  await sql.query(`insert into roadmap.metrics (name, value, meta) values ($1,$2,$3)`, [
    name,
    Number(value),
    meta ?? null,
  ]);
  console.log(`metric ${name}=${value}`);
} else {
  console.error("unknown command:", cmd);
  process.exit(1);
}

#!/usr/bin/env node
// Create an admin/editor user.
// Usage:  docker compose exec app node scripts/create-user.js you@example.com
import readline from "node:readline";
import postgres from "postgres";
import argon2 from "argon2";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/create-user.js <email>");
  process.exit(1);
}

function prompt(q, { silent = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (silent) {
      const stdin = process.stdin;
      process.stdout.write(q);
      let value = "";
      stdin.setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding("utf8");
      const onData = (ch) => {
        ch = String(ch);
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          rl.close();
          process.stdout.write("\n");
          resolve(value);
        } else if (ch === "\u0003") {
          process.exit(1);
        } else if (ch === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(q, (v) => {
        rl.close();
        resolve(v);
      });
    }
  });
}

const password = await prompt("Password: ", { silent: true });
if (!password || password.length < 10) {
  console.error("Password too short (min 10 chars).");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const hash = await argon2.hash(password, { type: argon2.argon2id });
await sql`
  INSERT INTO users (email, password_hash) VALUES (${email}, ${hash})
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
`;
console.log(`OK: user "${email}" upserted.`);
await sql.end();

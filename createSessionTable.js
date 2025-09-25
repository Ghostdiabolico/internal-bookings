// createSessionTable.js
import { pool } from "./db.js";

const sql = `
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_pkey'
  ) THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`;

async function run() {
  try {
    await pool.query(sql);
    console.log("Session table created (or already exists).");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create session table:", err);
    process.exit(1);
  }
}

run();

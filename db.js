import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

let pool;

if (process.env.DATABASE_URL) {
  // Production: Neon / Render
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required for Neon
  });
} else {
  // Local development
  pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "pguser",
    password: process.env.DB_PASSWORD || "pgpassword",
    database: process.env.DB_NAME || "internal_bookings",
    port: process.env.DB_PORT || 5432,
  });
}

// Test connection (only in dev)
if (process.env.NODE_ENV !== "production") {
  pool.query("SELECT NOW()")
    .then(res => console.log("Connected to PostgreSQL at", res.rows[0].now))
    .catch(err => console.error("PostgreSQL connection error:", err));
}

export { pool };

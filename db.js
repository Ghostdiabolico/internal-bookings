import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

// PostgreSQL connection pool
export const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  user: process.env.PG_USER || "pguser",
  password: process.env.PG_PASSWORD || "pgpassword",
  database: process.env.PG_DATABASE || "internal_bookings",
  port: process.env.PG_PORT || 5432,
});

// Optional: test connection
pool.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("PostgreSQL connection error:", err));

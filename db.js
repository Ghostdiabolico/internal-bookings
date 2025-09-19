import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

// Use DATABASE_URL if present (Render/Neon), otherwise use local env variables
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Render/Neon
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "pguser",
      password: process.env.DB_PASSWORD || "pgpassword",
      database: process.env.DB_NAME || "internal_bookings",
      port: process.env.DB_PORT || 5432,
    });

// Optional: test connection
pool.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("PostgreSQL connection error:", err));

export { pool };

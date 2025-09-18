import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

// Use DATABASE_URL if present (Render), otherwise use local env variables
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Render
    }
  : {
      host: process.env.PG_HOST || "localhost",
      user: process.env.PG_USER || "pguser",
      password: process.env.PG_PASSWORD || "pgpassword",
      database: process.env.PG_DATABASE || "internal_bookings",
      port: process.env.PG_PORT || 5432,
    };

export const pool = new Pool(connectionConfig);

// Optional: test connection
pool.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("PostgreSQL connection error:", err));

import { pool } from "./db.js";

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pool_bookings (
        id SERIAL PRIMARY KEY,
        requester TEXT,
        email TEXT,
        type_of_use TEXT,
        participants TEXT,
        supervisors TEXT,
        date DATE,
        start_time TIME,
        finish_time TIME,
        risk_file TEXT,
        equipment TEXT,
        equipment_other TEXT,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        feedback TEXT DEFAULT '',
        access_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP
      );
    `);

    console.log("Bookings table created or already exists.");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    pool.end();
  }
}

createTables();

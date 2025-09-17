// createBookingLogsTable.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function createBookingLogsTable() {
  const db = await open({
    filename: "./database.sqlite", // aggiorna con il percorso del tuo DB
    driver: sqlite3.Database,
  });

  await db.run(`
    CREATE TABLE IF NOT EXISTS booking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      requester TEXT,
      email TEXT,
      action TEXT,
      created_at TEXT
    )
  `);

  console.log("Table 'booking_logs' is ready!");
  await db.close();
}

createBookingLogsTable().catch(console.error);

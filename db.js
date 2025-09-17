import { open } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "bookings.db");

export async function initDb() {
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // ==============================
  // CREAZIONE TABELLE BASE
  // ==============================

  await db.exec(`
    CREATE TABLE IF NOT EXISTS pool_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester TEXT,
      email TEXT,
      type_of_use TEXT,
      participants INTEGER,
      supervisors TEXT,
      date TEXT,
      start_time TEXT,
      finish_time TEXT,
      risk_file TEXT,
      equipment TEXT,
      equipment_other TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS booking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      requester TEXT,
      email TEXT,
      type_of_use TEXT,
      date TEXT,
      action TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==============================
  // FUNZIONE AGGIUNTA COLONNE
  // (per compatibilità incrementale)
  // ==============================
  async function addColumnIfNotExists(table, column, type) {
    const result = await db.all(`PRAGMA table_info(${table});`);
    const exists = result.some(col => col.name === column);
    if (!exists) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`✅ Added missing column: ${column} to ${table}`);
    }
  }

 const poolBookingColumns = [
  { name: "requester", type: "TEXT" },
  { name: "email", type: "TEXT" },
  { name: "type_of_use", type: "TEXT" },
  { name: "participants", type: "INTEGER" },
  { name: "supervisors", type: "TEXT" },
  { name: "date", type: "TEXT" },
  { name: "start_time", type: "TEXT" },
  { name: "finish_time", type: "TEXT" },
  { name: "risk_file", type: "TEXT" },
  { name: "equipment", type: "TEXT" },
  { name: "equipment_other", type: "TEXT" },
  { name: "notes", type: "TEXT" },
  { name: "status", type: "TEXT DEFAULT 'pending'" },
  { name: "feedback", type: "TEXT" },
  { name: "created_at", type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
  { name: "approved_at", type: "DATETIME" },
  { name: "access_code", type: "TEXT" } // <-- NEW
];


  // Colonne booking_logs
  const bookingLogColumns = [
    { name: "booking_id", type: "INTEGER" },
    { name: "requester", type: "TEXT" },
    { name: "email", type: "TEXT" },
    { name: "type_of_use", type: "TEXT" },
    { name: "date", type: "TEXT" },
    { name: "action", type: "TEXT" },
    { name: "created_at", type: "DATETIME DEFAULT CURRENT_TIMESTAMP" }
  ];

  // Controllo colonne pool_bookings
  for (const col of poolBookingColumns) {
    await addColumnIfNotExists("pool_bookings", col.name, col.type);
  }

  // Controllo colonne booking_logs
  for (const col of bookingLogColumns) {
    await addColumnIfNotExists("booking_logs", col.name, col.type);
  }

  return db;
}

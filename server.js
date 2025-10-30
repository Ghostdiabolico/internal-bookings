// Permette a Node di ignorare certificati self-signed (solo sviluppo)
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import bodyParser from "body-parser";
import bookingRoutes from "./routes/bookingRoutes.js";
import { pool } from "./db.js";
import { startReminderScheduler } from "./utils/reminderScheduler.js"; // ADD THIS LINE

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------
// Middleware
// -------------------
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.static(path.join(process.cwd(), "public")));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: true,
  })
);

// Make the database pool accessible in routes via req.db
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// -------------------
// Routes
// -------------------
app.use("/", bookingRoutes);

// -------------------
// 404 handler
// -------------------
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// -------------------
// Start server
// -------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // START REMINDER SCHEDULER - ADD THESE LINES
  console.log('━'.repeat(60));
  startReminderScheduler();
  console.log('━'.repeat(60));
});
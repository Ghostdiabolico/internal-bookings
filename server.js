// server.js
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import bookingRoutes from "./routes/bookingRoutes.js";
import { initDb } from "./db.js";
import multer from "multer";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
export const upload = multer({ storage });

// Initialize DB and then mount routes
initDb()
  .then((db) => {
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    app.use("/", bookingRoutes);

    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to initialize database:", err);
  });

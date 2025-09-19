import express from "express";
import path from "path";
import multer from "multer";
import crypto from "crypto";
import { pool } from "../db.js";

const router = express.Router();

// -------------------
// Multer setup for file uploads
// -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// -------------------
// Home / Form
// -------------------
router.get("/", (req, res) => res.render("index", { session: req.session }));

router.get("/form", (req, res) => {
  const submitted = req.query.submitted === "1";
  const accessCode = req.query.code || null;
  const email = req.query.email || "";
  res.render("form", { submitted, accessCode, email, session: req.session });
});

// -------------------
// Create Booking
// -------------------
router.post("/form", upload.single("risk_file"), async (req, res) => {
  try {
    const {
      requester,
      email,
      type_of_use,
      type_of_use_other,
      participants,
      supervisors,
      date,
      start_time,
      finish_time,
      equipment,
      equipment_other,
      notes,
    } = req.body;

    const risk_file = req.file ? req.file.filename : null;
    const finalType = type_of_use === "Other" ? type_of_use_other : type_of_use;

    // Properly handle equipment as array
    let finalEquipment = [];
    if (Array.isArray(equipment)) finalEquipment = equipment;
    else if (equipment) finalEquipment = [equipment];
    if (equipment_other) finalEquipment.push(equipment_other);

    const accessCode = crypto.randomBytes(3).toString("hex");

    await pool.query(
      `INSERT INTO pool_bookings
       (requester,email,type_of_use,participants,supervisors,date,start_time,finish_time,risk_file,equipment,equipment_other,notes,status,feedback,access_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending','',$13)`,
      [
        requester,
        email,
        finalType,
        participants || null,
        supervisors || null,
        date || null,
        start_time || null,
        finish_time || null,
        risk_file,
        finalEquipment,
        equipment_other || "",
        notes || "",
        accessCode,
      ]
    );

    res.redirect("/form?submitted=1&code=" + accessCode);
  } catch (err) {
    console.error("Error POST /form:", err);
    res.status(500).send("Error saving booking.");
  }
});

// -------------------
// Calendar
// -------------------
router.get("/calendar", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pool_bookings WHERE status='approved' ORDER BY date,start_time"
    );
    res.render("calendar", { bookings: result.rows, session: req.session });
  } catch (err) {
    console.error("Error GET /calendar:", err);
    res.status(500).send("Error loading calendar");
  }
});

// -------------------
// My Bookings
// -------------------
router.get("/my-bookings", async (req, res) => {
  const { email, code, send_code } = req.query;

  if (send_code && email) {
    try {
      const bookingRes = await pool.query(
        "SELECT * FROM pool_bookings WHERE email=$1 ORDER BY created_at DESC LIMIT 1",
        [email]
      );
      const booking = bookingRes.rows[0];
      if (booking) {
        return res.render("my-bookings", {
          bookings: [],
          email,
          code: "",
          message: `Your latest access code is: ${booking.access_code}`,
          session: req.session,
        });
      }
      return res.render("my-bookings", {
        bookings: [],
        email,
        code: "",
        message: "No booking found for that email.",
        session: req.session,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).send("Error retrieving access code");
    }
  }

  if (!email || !code)
    return res.render("my-bookings", { bookings: [], email: "", code: "", message: "", session: req.session });

  try {
    const bookingsRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE email=$1 AND access_code=$2 ORDER BY created_at DESC",
      [email, code]
    );
    res.render("my-bookings", { bookings: bookingsRes.rows, email, code, message: "", session: req.session });
  } catch (err) {
    console.error("Error GET /my-bookings:", err);
    res.status(500).send("Error loading bookings");
  }
});

// -------------------
// Edit Booking
// -------------------
router.get("/edit-booking/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const bookingRes = await pool.query("SELECT * FROM pool_bookings WHERE id=$1", [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).send("Booking not found");
    if (booking.status !== "rejected") return res.status(403).send("Only rejected bookings can be edited.");
    res.render("edit-booking", { booking, session: req.session });
  } catch (err) {
    console.error("Error GET /edit-booking/:id:", err);
    res.status(500).send("Error loading edit form");
  }
});

router.post("/edit-booking/:id", upload.single("risk_file"), async (req, res) => {
  const { id } = req.params;
  try {
    const {
      requester,
      email,
      type_of_use,
      type_of_use_other,
      participants,
      supervisors,
      date,
      start_time,
      finish_time,
      equipment,
      equipment_other,
      notes,
      access_code,
    } = req.body;

    const newRiskFile = req.file ? req.file.filename : null;
    const finalType = type_of_use === "Other" ? type_of_use_other : type_of_use;

    // Properly handle equipment as array
    let finalEquipment = [];
    if (Array.isArray(equipment)) finalEquipment = equipment;
    else if (equipment) finalEquipment = [equipment];
    if (equipment_other) finalEquipment.push(equipment_other);

    await pool.query(
      `UPDATE pool_bookings
       SET requester=$1, email=$2, type_of_use=$3, participants=$4, supervisors=$5, date=$6, start_time=$7, finish_time=$8,
           risk_file=COALESCE($9, risk_file), equipment=$10, equipment_other=$11, notes=$12, status='pending', feedback=''
       WHERE id=$13`,
      [
        requester,
        email,
        finalType,
        participants || null,
        supervisors || null,
        date || null,
        start_time || null,
        finish_time || null,
        newRiskFile,
        finalEquipment,
        equipment_other || "",
        notes || "",
        id,
      ]
    );

    res.redirect("/my-bookings?email=" + encodeURIComponent(email) + "&code=" + encodeURIComponent(access_code));
  } catch (err) {
    console.error("Error POST /edit-booking/:id:", err);
    res.status(500).send("Error updating booking");
  }
});

// -------------------
// Admin Login & Session
// -------------------
router.get("/admin/login", (req, res) => {
  if (req.session.admin) return res.redirect("/admin");
  res.render("admin", { error: "", session: req.session, pending: [], approved: [], rejected: [] });
});

router.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect("/admin");
  } else {
    res.render("admin", { error: "Invalid username or password", session: req.session, pending: [], approved: [], rejected: [] });
  }
});

router.get("/admin/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect("/admin/login");
  });
});

// -------------------
// Admin Panel
// -------------------
router.get("/admin", async (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");
  try {
    const pendingRes = await pool.query("SELECT * FROM pool_bookings WHERE status='pending' ORDER BY created_at DESC");
    const approvedRes = await pool.query("SELECT * FROM pool_bookings WHERE status='approved' ORDER BY date,start_time");
    const rejectedRes = await pool.query("SELECT * FROM pool_bookings WHERE status='rejected' ORDER BY date,start_time");

    res.render("admin", {
      pending: pendingRes.rows,
      approved: approvedRes.rows,
      rejected: rejectedRes.rows,
      session: req.session,
      error: ""
    });
  } catch (err) {
    console.error("Error GET /admin:", err);
    res.status(500).send("Error loading admin page");
  }
});

// -------------------
// Admin Delete Booking
// -------------------
router.post("/admin/:id/delete", async (req, res) => {
  const { id } = req.params;
  try {
    const bookingRes = await pool.query("SELECT * FROM pool_bookings WHERE id=$1", [id]);
    const booking = bookingRes.rows[0];
    if (!booking) return res.status(404).send("Booking not found");

    await pool.query(
      `INSERT INTO booking_logs (booking_id, requester, email, type_of_use, date, action)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [booking.id, booking.requester, booking.email, booking.type_of_use, booking.date, "deleted"]
    );

    await pool.query("DELETE FROM pool_bookings WHERE id=$1", [id]);
    res.redirect("/admin");
  } catch (err) {
    console.error("Error POST /admin/:id/delete:", err);
    res.status(500).send("Error deleting booking");
  }
});

// -------------------
// Admin Save Feedback
// -------------------
router.post("/admin/:id/feedback", async (req, res) => {
  const { id } = req.params;
  const feedback = req.body.feedback || "";
  try {
    await pool.query("UPDATE pool_bookings SET feedback=$1 WHERE id=$2", [feedback, id]);
    res.redirect("/admin");
  } catch (err) {
    console.error("Error POST /admin/:id/feedback:", err);
    res.status(500).send("Error saving feedback");
  }
});

// -------------------
// Admin Approve / Reject
// -------------------
router.post("/admin/:id/:action", async (req, res) => {
  const { id, action } = req.params;
  if (!["approved", "rejected"].includes(action)) return res.status(400).send("Invalid action");
  try {
    const approved_at = action === "approved" ? new Date().toISOString() : null;
    await pool.query("UPDATE pool_bookings SET status=$1, approved_at=$2 WHERE id=$3", [action, approved_at, id]);
    res.redirect("/admin");
  } catch (err) {
    console.error("Error POST /admin/:id/:action:", err);
    res.status(500).send("Error updating booking");
  }
});

export default router;

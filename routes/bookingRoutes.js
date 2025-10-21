import express from "express";
import path from "path";
import multer from "multer";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import { supabase, bucketName } from "../supabase.js";
import { 
  sendRegistrationConfirmation, 
  sendBookingSubmitted, 
  sendBookingApproved, 
  sendBookingRejected 
} from '../utils/mailjetService.js';

const router = express.Router();

// -------------------
// Multer setup for file uploads (memory storage)
// -------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// -------------------
// Authentication Middleware
// -------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect('/admin/login');
}

// -------------------
// Helper function to generate recovery code
// -------------------
function generateRecoveryCode() {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `POOL-${part1}-${part2}`;
}

// -------------------
// REGISTRATION
// -------------------
router.get("/register", (req, res) => {
  res.render("register", { 
    error: null, 
    recoveryCode: null, 
    session: req.session,
    currentPage: 'register'
  });
});

router.post("/register", async (req, res) => {
  try {
    const { username, password, confirm_password, full_name, email } = req.body;

    // Validation
    if (!username || !password) {
      return res.render("register", { 
        error: "Username and password are required", 
        recoveryCode: null, 
        session: req.session,
        currentPage: 'register'
      });
    }

    if (password !== confirm_password) {
      return res.render("register", { 
        error: "Passwords do not match", 
        recoveryCode: null, 
        session: req.session,
        currentPage: 'register'
      });
    }

    if (password.length < 6) {
      return res.render("register", { 
        error: "Password must be at least 6 characters", 
        recoveryCode: null, 
        session: req.session,
        currentPage: 'register'
      });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.render("register", { 
        error: "Username already taken", 
        recoveryCode: null, 
        session: req.session,
        currentPage: 'register'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate recovery code
    const recoveryCode = generateRecoveryCode();

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, recovery_code)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, passwordHash, full_name || null, recoveryCode]
    );

    const userId = result.rows[0].id;

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmation({
        id: userId,
        username,
        full_name,
        recovery_code: recoveryCode,
        email: email || `${username}@example.com`
      });
      console.log('✅ Registration email sent');
    } catch (emailError) {
      console.error('⚠️ Registration email failed:', emailError);
      // Don't fail registration if email fails
    }

    // Show recovery code page
    res.render("register", { 
      error: null, 
      recoveryCode, 
      session: req.session,
      currentPage: 'register'
    });
  } catch (err) {
    console.error("[ERROR POST /register]", err);
    res.render("register", { 
      error: "Registration failed. Please try again.", 
      recoveryCode: null, 
      session: req.session,
      currentPage: 'register'
    });
  }
});

// -------------------
// LOGIN
// -------------------
router.get("/login", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  res.render("login", { 
    error: null, 
    success: null, 
    session: req.session,
    currentPage: 'login'
  });
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("login", { 
        error: "Username and password are required", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    // Find user
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.render("login", { 
        error: "Invalid username or password", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    const user = result.rows[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.render("login", { 
        error: "Invalid username or password", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    // Update last login
    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id]
    );

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fullName = user.full_name;

    res.redirect("/");
  } catch (err) {
    console.error("[ERROR POST /login]", err);
    res.render("login", { 
      error: "Login failed. Please try again.", 
      success: null, 
      session: req.session,
      currentPage: 'login'
    });
  }
});

// -------------------
// LOGOUT
// -------------------
router.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error("[ERROR - Logout]", err);
    res.redirect("/login");
  });
});

// -------------------
// FORGOT PASSWORD
// -------------------
router.get("/forgot-password", (req, res) => {
  res.render("forgot-password", { 
    error: null, 
    success: null, 
    session: req.session,
    currentPage: 'login'
  });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { username, recovery_code, new_password, confirm_password } = req.body;

    // Validation
    if (!username || !recovery_code || !new_password) {
      return res.render("forgot-password", { 
        error: "All fields are required", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    if (new_password !== confirm_password) {
      return res.render("forgot-password", { 
        error: "Passwords do not match", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    if (new_password.length < 6) {
      return res.render("forgot-password", { 
        error: "Password must be at least 6 characters", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    // Find user by username and recovery code
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND recovery_code = $2",
      [username, recovery_code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.render("forgot-password", { 
        error: "Invalid username or recovery code", 
        success: null, 
        session: req.session,
        currentPage: 'login'
      });
    }

    const user = result.rows[0];

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, user.id]
    );

    res.render("forgot-password", { 
      error: null, 
      success: "Password successfully reset! You can now login with your new password.", 
      session: req.session,
      currentPage: 'login'
    });
  } catch (err) {
    console.error("[ERROR POST /forgot-password]", err);
    res.render("forgot-password", { 
      error: "Password reset failed. Please try again.", 
      success: null, 
      session: req.session,
      currentPage: 'login'
    });
  }
});

// -------------------
// Home / Form
// -------------------
router.get("/", (req, res) => {
  res.render("index", { 
    session: req.session,
    currentPage: 'home'
  });
});

router.get("/form", requireAuth, (req, res) => {
  const submitted = req.query.submitted === "1";
  const accessCode = req.query.code || null;
  
  // Get user info for auto-fill
  const email = req.session.email || "";
  const requester = req.session.fullName || req.session.username || "";
  
  res.render("form", { 
    submitted, 
    accessCode, 
    email,
    requester,
    session: req.session,
    currentPage: 'form'
  });
});

// -------------------
// Create Booking
// -------------------
router.post("/form", requireAuth, upload.single("risk_file"), async (req, res) => {
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
      responsible_name,
      phone,
      age_range,
      event_name,
      pool_config,
      other_activities,
      hiring_party
    } = req.body;

    if (!date) return res.status(400).send("Date is required");

    let risk_file = null;
    if (req.file) {
      const filename = Date.now() + path.extname(req.file.originalname);
      const { error } = await supabase.storage.from(bucketName).upload(filename, req.file.buffer, { upsert: true });
      if (error) throw error;
      risk_file = filename;
    }

    const finalType = type_of_use === "Other" ? type_of_use_other : type_of_use;
    let finalEquipment = [];
    if (equipment) finalEquipment = Array.isArray(equipment) ? equipment : [equipment];
    if (equipment_other) finalEquipment.push(equipment_other);

    const accessCode = crypto.randomBytes(3).toString("hex");

    // Insert booking linked to user
    const result = await pool.query(
      `INSERT INTO pool_bookings
       (user_id, requester, email, type_of_use, type_of_use_other, participants, supervisors, date, start_time, finish_time, 
        risk_file, equipment, equipment_other, notes, status, feedback, access_code, responsible_name, phone, age_range, 
        event_name, pool_config, other_activities, hiring_party)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', '', $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        req.session.userId,
        requester,
        email,
        finalType,
        type_of_use_other || null,
        participants || null,
        supervisors || null,
        date,
        start_time || null,
        finish_time || null,
        risk_file,
        finalEquipment,
        equipment_other || "",
        notes || "",
        accessCode,
        responsible_name || null,
        phone || null,
        age_range || null,
        event_name || null,
        pool_config || null,
        other_activities || null,
        hiring_party || null
      ]
    );

    const newBooking = result.rows[0];

    // Send booking submission confirmation email
    try {
      await sendBookingSubmitted(newBooking);
      console.log('✅ Booking submission email sent');
    } catch (emailError) {
      console.error('⚠️ Booking submission email failed:', emailError);
      // Don't fail booking if email fails
    }

    res.redirect("/form?submitted=1&code=" + accessCode + "&email=" + encodeURIComponent(email));
  } catch (err) {
    console.error("[ERROR POST /form]", err);
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
    res.render("calendar", { 
      bookings: result.rows, 
      session: req.session,
      currentPage: 'calendar'
    });
  } catch (err) {
    console.error("[ERROR GET /calendar]", err);
    res.status(500).send("Error loading calendar");
  }
});

// -------------------
// My Bookings (Updated to use user session)
// -------------------
router.get("/my-bookings", requireAuth, async (req, res) => {
  try {
    // Fetch all bookings for logged-in user
    const bookingsRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE user_id=$1 ORDER BY created_at DESC",
      [req.session.userId]
    );
    
    // Format bookings for display
    const formattedBookings = bookingsRes.rows.map(b => ({
      ...b,
      date: b.date ? new Date(b.date).toISOString().split("T")[0] : "",
      start_time: b.start_time ? b.start_time.slice(0, 5) : "",
      finish_time: b.finish_time ? b.finish_time.slice(0, 5) : "",
      admin_feedback: b.feedback || null,
      type_of_use_other: b.type_of_use_other || null,
    }));

    res.render("my-bookings", { 
      bookings: formattedBookings, 
      email: "", 
      code: "", 
      message: "", 
      session: req.session,
      currentPage: 'my-bookings'
    });
  } catch (err) {
    console.error("[ERROR GET /my-bookings]", err);
    res.status(500).send("Error loading bookings");
  }
});

// -------------------
// Edit Booking
// -------------------
router.get("/edit-booking/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const bookingRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE id=$1 AND user_id=$2", 
      [id, req.session.userId]
    );
    const booking = bookingRes.rows[0];
    
    if (!booking) return res.status(404).send("Booking not found or unauthorized");
    if (booking.status !== "rejected") {
      return res.status(403).send("Only rejected bookings can be edited.");
    }
    
    res.render("edit-booking", { 
      booking, 
      session: req.session,
      currentPage: 'my-bookings'
    });
  } catch (err) {
    console.error("[ERROR GET /edit-booking/:id]", err);
    res.status(500).send("Error loading edit form");
  }
});

router.post("/edit-booking/:id", requireAuth, upload.single("risk_file"), async (req, res) => {
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
      responsible_name,
      phone,
      age_range,
      event_name,
      pool_config,
      other_activities,
      hiring_party
    } = req.body;

    if (!date) return res.status(400).send("Date is required");

    // Verify booking belongs to user
    const checkRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE id=$1 AND user_id=$2",
      [id, req.session.userId]
    );
    
    if (checkRes.rows.length === 0) {
      return res.status(403).send("Unauthorized");
    }

    // Handle new file upload
    let newRiskFile = null;
    if (req.file) {
      const filename = Date.now() + path.extname(req.file.originalname);
      const { error } = await supabase.storage.from(bucketName).upload(filename, req.file.buffer, { upsert: true });
      if (error) throw error;
      newRiskFile = filename;
    }

    const finalType = type_of_use === "Other" ? type_of_use_other : type_of_use;
    let finalEquipment = [];
    if (equipment) finalEquipment = Array.isArray(equipment) ? equipment : [equipment];
    if (equipment_other) finalEquipment.push(equipment_other);

    // Update booking and reset status to pending
    await pool.query(
      `UPDATE pool_bookings
       SET requester=$1, email=$2, type_of_use=$3, type_of_use_other=$4, participants=$5, supervisors=$6, 
           date=$7, start_time=$8, finish_time=$9, risk_file=COALESCE($10,risk_file), 
           equipment=$11, equipment_other=$12, notes=$13, status='pending', feedback='',
           responsible_name=$14, phone=$15, age_range=$16, event_name=$17, pool_config=$18, 
           other_activities=$19, hiring_party=$20
       WHERE id=$21 AND user_id=$22`,
      [
        requester, 
        email, 
        finalType,
        type_of_use_other || null,
        participants || null, 
        supervisors || null, 
        date, 
        start_time || null, 
        finish_time || null, 
        newRiskFile, 
        finalEquipment, 
        equipment_other || "", 
        notes || "",
        responsible_name || null,
        phone || null,
        age_range || null,
        event_name || null,
        pool_config || null,
        other_activities || null,
        hiring_party || null,
        id,
        req.session.userId
      ]
    );

    res.redirect("/my-bookings");
  } catch (err) {
    console.error("[ERROR POST /edit-booking/:id]", err);
    res.status(500).send("Error updating booking");
  }
});

// -------------------
// Admin Login & Session
// -------------------
router.get("/admin/login", (req, res) => {
  if (req.session.admin) return res.redirect("/admin");
  res.render("admin", { 
    error: "", 
    session: req.session, 
    pending: [], 
    approved: [], 
    rejected: [], 
    deleted: [],
    users: [],
    bucketName,
    currentPage: 'admin'
  });
});

router.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect("/admin");
  } else {
    res.render("admin", { 
      error: "Invalid username or password", 
      session: req.session, 
      pending: [], 
      approved: [], 
      rejected: [], 
      deleted: [],
      users: [],
      bucketName,
      currentPage: 'admin'
    });
  }
});

router.get("/admin/logout", (req, res) => {
  req.session.admin = false;
  res.redirect("/admin/login");
});

// -------------------
// Admin Panel
// -------------------
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const pendingRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE status='pending' ORDER BY created_at DESC"
    );
    const approvedRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE status='approved' ORDER BY date, start_time"
    );
    const rejectedRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE status='rejected' ORDER BY date, start_time"
    );
    const deletedRes = await pool.query(
      "SELECT * FROM booking_logs ORDER BY deleted_at DESC"
    );
    const usersRes = await pool.query(
      "SELECT id, username, full_name, recovery_code, created_at, last_login FROM users ORDER BY created_at DESC"
    );

    res.render("admin", {
      pending: pendingRes.rows,
      approved: approvedRes.rows,
      rejected: rejectedRes.rows,
      deleted: deletedRes.rows,
      users: usersRes.rows,
      session: req.session,
      error: "",
      bucketName,
      currentPage: 'admin'
    });
  } catch (err) {
    console.error("[ERROR GET /admin]", err);
    res.status(500).send("Error loading admin page");
  }
});

// -------------------
// Admin User Management - Reset Password
// -------------------
router.post("/admin/reset-user-password", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    // Generate a temporary password (8 characters, easy to type)
    const tempPassword = crypto.randomBytes(4).toString('hex');

    // Hash the temporary password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

    // Update the user's password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ 
      success: true, 
      tempPassword: tempPassword,
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('[ERROR] Reset user password:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset password' 
    });
  }
});

// -------------------
// Admin User Management - Delete User
// -------------------
router.post("/admin/delete-user", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    // First, delete all bookings associated with this user
    await pool.query('DELETE FROM pool_bookings WHERE user_id = $1', [userId]);

    // Then delete the user
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ 
      success: true, 
      message: 'User and associated bookings deleted successfully' 
    });
  } catch (error) {
    console.error('[ERROR] Delete user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user' 
    });
  }
});

// -------------------
// Check for Booking Conflicts (API endpoint)
// -------------------
router.post("/api/check-conflicts", async (req, res) => {
  try {
    const { date, start_time, finish_time, booking_id } = req.body;

    if (!date || !start_time || !finish_time) {
      return res.json({ conflicts: [] });
    }

    let query = `
      SELECT id, requester, type_of_use, start_time, finish_time, status
      FROM pool_bookings
      WHERE date = $1
        AND status IN ('approved', 'pending')
        AND (
          (start_time <= $2 AND finish_time > $2) OR
          (start_time < $3 AND finish_time >= $3) OR
          (start_time >= $2 AND finish_time <= $3)
        )
    `;
    
    const params = [date, start_time, finish_time];
    
    if (booking_id) {
      query += ` AND id != $4`;
      params.push(booking_id);
    }

    const result = await pool.query(query, params);

    const conflicts = result.rows.map(booking => ({
      id: booking.id,
      requester: booking.requester,
      type: booking.type_of_use,
      startTime: booking.start_time.slice(0, 5),
      finishTime: booking.finish_time.slice(0, 5),
      status: booking.status
    }));

    res.json({ conflicts });
  } catch (err) {
    console.error("[ERROR] Check conflicts:", err);
    res.status(500).json({ error: "Failed to check conflicts" });
  }
});

// -------------------
// Admin Delete Booking
// -------------------
router.post("/admin/:id/delete", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const bookingRes = await pool.query("SELECT * FROM pool_bookings WHERE id=$1", [id]);
    const booking = bookingRes.rows[0];
    
    if (!booking) return res.status(404).send("Booking not found");

    await pool.query(
      `INSERT INTO booking_logs (booking_id, requester, email, type_of_use, deleted_at, deleted_by, action)
       VALUES ($1, $2, $3, $4, NOW(), $5, 'deleted')`,
      [booking.id, booking.requester, booking.email, booking.type_of_use, 'Admin']
    );

    await pool.query("DELETE FROM pool_bookings WHERE id=$1", [id]);
    res.redirect("/admin");
  } catch (err) {
    console.error("[ERROR POST /admin/:id/delete]", err);
    res.status(500).send("Error deleting booking");
  }
});

// -------------------
// Admin Save Feedback
// -------------------
router.post("/admin/:id/feedback", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const feedback = req.body.feedback || "";
  
  try {
    await pool.query("UPDATE pool_bookings SET feedback=$1 WHERE id=$2", [feedback, id]);
    res.redirect("/admin");
  } catch (err) {
    console.error("[ERROR POST /admin/:id/feedback]", err);
    res.status(500).send("Error saving feedback");
  }
});

// -------------------
// Admin Approve / Reject (WITH EMAIL NOTIFICATIONS)
// -------------------
router.post("/admin/:id/:action", requireAdmin, async (req, res) => {
  const { id, action } = req.params;
  
  if (!["approved", "rejected"].includes(action)) {
    return res.status(400).send("Invalid action");
  }

  try {
    // Get booking details first
    const bookingRes = await pool.query(
      "SELECT * FROM pool_bookings WHERE id = $1",
      [id]
    );
    
    if (bookingRes.rows.length === 0) {
      return res.status(404).send("Booking not found");
    }
    
    const booking = bookingRes.rows[0];
    
    // Update booking status
    const approved_at = action === "approved" ? new Date().toISOString() : null;
    await pool.query(
      "UPDATE pool_bookings SET status=$1, approved_at=$2 WHERE id=$3", 
      [action, approved_at, id]
    );
    
    // Send email notification
    try {
      if (action === "approved") {
        await sendBookingApproved(booking);
        console.log('✅ Approval email sent');
      } else if (action === "rejected") {
        await sendBookingRejected(booking);
        console.log('✅ Rejection email sent');
      }
    } catch (emailError) {
      console.error("⚠️ Email notification failed:", emailError);
      // Don't fail the request if email fails - booking status is already updated
    }
    
    res.redirect("/admin");
  } catch (err) {
    console.error("[ERROR POST /admin/:id/:action]", err);
    res.status(500).send("Error updating booking");
  }
});

// -------------------
// Download file from Supabase
// -------------------
router.get("/download/:filename", async (req, res) => {
  const { filename } = req.params;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filename);

    if (error || !data) {
      console.error("[ERROR GET /download/:filename]", error);
      return res.status(404).send("File not found");
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  } catch (err) {
    console.error("[ERROR GET /download/:filename]", err);
    res.status(500).send("Error downloading file");
  }
});

export default router;
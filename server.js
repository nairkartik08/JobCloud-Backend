const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config(); // ✅ Add this line

const app = express();

// ✅ Proper CORS setup for GitHub Pages + Localhost + Render
const allowedOrigins = [
  "https://nairkartik08.github.io", // GitHub Pages domain (no trailing slash)
  "http://localhost:5500"           // Local testing
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no 'origin' (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("🚫 Blocked by CORS:", origin);
        callback(new Error("CORS not allowed for this origin"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"], // Include OPTIONS for preflight
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Handle preflight requests directly
app.options("*", cors());


app.use("/uploads", express.static("uploads")); // Serve uploaded files
app.use(express.json()); // Handle JSON payloads

// ✅ Use a connection pool (recommended for Render + Clever Cloud)
const db = mysql.createPool({
  host: process.env.DB_HOST || "byv8d8fkl1igdntxfgrm7-mysql.services.clever-cloud.com",
  user: process.env.DB_USER || "u0zuail7471hurs7",
  password: process.env.DB_PASSWORD || "veaUyTAt6BvCyWD5yJXs",
  database: process.env.DB_NAME || "byv8d8fkl1igdntxfgrm7",
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to Clever Cloud MySQL Database (using pool)!");
  connection.release();
});

// ✅ Ensure uploads folder exists
const dir = "./uploads";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// ✅ Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("❌ Only PDF or Word files allowed"), false);
  },
});

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 Job Cloud backend is running successfully!");
});

// ✅ SIGNUP
app.post("/signup", upload.single("resume"), (req, res) => {
  try {
    const {
      fullname,
      mobile,
      dob,
      gender,
      address,
      city,
      state,
      education,
      experience,
      skills,
      email,
      password,
    } = req.body || {};

    const resumePath = req.file ? req.file.filename : null;

    if (!fullname || !email || !password) {
      return res.status(400).send("❌ Missing required fields!");
    }

    const sql = `
      INSERT INTO users 
      (fullname, mobile, dob, gender, address, city, state, education, experience, skills, email, password, resume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        fullname,
        mobile,
        dob,
        gender,
        address,
        city,
        state,
        education,
        experience,
        skills,
        email,
        password,
        resumePath,
      ],
      (err) => {
        if (err) {
          console.error("❌ Database error:", err);
          return res.status(500).send("Error while signing up!");
        }
        res.send("✅ User registered successfully!");
      }
    );
  } catch (error) {
    console.error("❌ Signup error:", error);
res.status(500).json({ message: "Server error while signing up!", error: error.message });

  }
});

// ✅ LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error("❌ Error during login:", err);
      return res.status(500).json({ success: false, message: "Error while logging in" });
    }

    if (results.length > 0) {
      res.json({ success: true, message: "✅ Login successful", user: results[0] });
    } else {
      res.status(401).json({ success: false, message: "❌ Invalid email or password" });
    }
  });
});

// ✅ APPLICATION SUBMISSION
app.post("/submit-application", upload.single("resume"), (req, res) => {
  const { fullname, email, phone, cover_letter } = req.body;
  const resumePath = req.file ? req.file.path : null;

  const sql =
    "INSERT INTO applications (fullname, email, phone, cover_letter, resume_path) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [fullname, email, phone, cover_letter, resumePath], (err) => {
    if (err) {
      console.error("❌ Error submitting application:", err);
      res.status(500).send("Error submitting application");
    } else {
      res.send("✅ Application submitted successfully");
    }
  });
});

// ✅ FETCH USER PROFILE
app.get("/user/:email", (req, res) => {
  const email = req.params.email;
  const sql =
    "SELECT fullname, mobile, dob, gender, address, city, state, education, experience, skills, email, resume FROM users WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("❌ Error fetching user:", err);
      return res.status(500).send("Server error");
    }

    if (results.length > 0) res.json(results[0]);
    else res.status(404).send("❌ User not found");
  });
});

// ✅ POST JOB (Add new job)
app.post("/add-job", express.json(), (req, res) => {
  const { title, company, location, description, salary, experience, skills } = req.body;

  if (!title || !company || !description) {
    return res.status(400).send("❌ Missing required fields!");
  }

  const sql = `
    INSERT INTO jobs (title, company, location, description, salary, experience, skills)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [title, company, location, description, salary, experience, skills], (err) => {
    if (err) {
      console.error("❌ Error posting job:", err);
      return res.status(500).send("Error posting job");
    }
    res.send("✅ Job posted successfully!");
  });
});

// ✅ GET JOBS (Fetch all jobs)
app.get("/jobs", (req, res) => {
  const sql = "SELECT * FROM jobs ORDER BY posted_at DESC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching jobs:", err);
      return res.status(500).send("Error fetching jobs");
    }
    res.json(results);
  });
});


// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

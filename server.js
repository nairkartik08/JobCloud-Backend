const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use("/uploads", express.static("uploads")); // serve uploaded files

// ✅ MySQL Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "ivwksh7a",
  database: "jobcloud"
});

db.connect(err => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL Database!");
});

// ✅ Ensure uploads folder exists
const dir = "./uploads";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// ✅ Multer Configuration (handle file + text fields)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("❌ Only PDF or Word files allowed"), false);
  },
});

// ✅ Test route
app.get("/", (req, res) => {
  res.send("🚀 Backend is running successfully!");
});

// ✅ SIGNUP ROUTE (FIXED)
app.post("/signup", upload.single("resume"), (req, res) => {
  try {
    console.log("Incoming Content-Type:", req.headers["content-type"]);
    console.log("Body:", req.body); // Debugging line

    // ✅ Destructure after Multer processed the form
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
      (err, result) => {
        if (err) {
          console.error("❌ Database error:", err);
          return res.status(500).send("Error while signing up!");
        }
        console.log("✅ User inserted successfully!");
        res.send("✅ User registered successfully with all details!");
      }
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    res.status(500).send("Server error while signing up!");
  }
});

// ✅ LOGIN ROUTE
app.post("/login", express.json(), (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error("❌ Error during login:", err);
      return res.status(500).json({ success: false, message: "Error while logging in" });
    }

    if (results.length > 0) {
      const user = results[0];
      res.json({ success: true, message: "✅ Login successful", user });
    } else {
      res.status(401).json({ success: false, message: "❌ Invalid email or password" });
    }
  });
});

// ✅ APPLICATION FORM SUBMISSION
app.post("/submit-application", upload.single("resume"), (req, res) => {
  const { fullname, email, phone, cover_letter } = req.body;
  const resumePath = req.file ? req.file.path : null;

  const sql =
    "INSERT INTO applications (fullname, email, phone, cover_letter, resume_path) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [fullname, email, phone, cover_letter, resumePath], (err, result) => {
    if (err) {
      console.error("❌ Error submitting application:", err);
      res.status(500).send("Error submitting application");
    } else {
      res.send("✅ Application submitted successfully");
    }
  });
});

// ✅ Fetch user profile by email
app.get("/user/:email", (req, res) => {
  const email = req.params.email;

  const sql = "SELECT fullname, mobile, dob, gender, address, city, state, education, experience, skills, email, resume FROM users WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("❌ Error fetching user:", err);
      return res.status(500).send("Server error");
    }

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).send("❌ User not found");
    }
  });
});


app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});

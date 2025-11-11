import bcrypt from "bcryptjs";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import Razorpay from "razorpay";
import { fileURLToPath } from "url";

dotenv.config();

// --- Fix dirname for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Multer setup for profile uploads ---
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, req.body.username + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Sessions ---
app.use(
  session({
    secret: "superSecretSmartExpenseKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI || "mongodb+srv://Shreya:shreyapk@cluster0.8b57s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// --- Models ---
const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: String,
  profilePic: String,
});
const User = mongoose.models.User || mongoose.model("User", userSchema);

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);

const expenseSchema = new mongoose.Schema({
  title: String,
  amount: Number,
  category: String,
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
});
const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);

// --- Razorpay Setup ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Auth Middleware ---
const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};

// --- Routes ---

app.get("/", (req, res) => res.render("home", { user: req.session.user || null }));
app.get("/home", (req, res) => res.render("home", { user: req.session.user || null }));

// --- Register ---
app.get("/register", (req, res) => res.render("register", { error: null }));
app.post("/register", async (req, res) => {
  const { name, username, email, phone, password } = req.body;
  try {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.render("register", { error: "Username or email already exists!" });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, username, email, phone, password: hashed }).save();
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.render("register", { error: "Registration failed, try again!" });
  }
});

// --- Login ---
app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.render("login", { error: "Invalid credentials!" });

    req.session.user = user;
    req.session.userId = user._id;
    res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.render("login", { error: "Server error. Try again later." });
  }
});

// --- Logout ---
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// --- Profile ---
app.get("/profile", isAuthenticated, (req, res) => {
  res.render("profile", { user: req.session.user });
});

// Example for your route
app.post("/update-password", async (req, res) => {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.render("setting", { user: req.session.user, error: "❌ Current password is incorrect!" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Optional: force re-login for security
    req.session.destroy(() => res.redirect("/login"));
  } catch (err) {
    console.error(err);
    res.render("setting", { user: req.session.user, error: "Server error. Try again!" });
  }
});


app.post("/profile/update", upload.single("profilePic"), async (req, res) => {
  try {
    const { name, username, email, phone } = req.body;
    const updateData = { name, username, email, phone };
    if (req.file) updateData.profilePic = req.file.filename;

    const updated = await User.findByIdAndUpdate(req.session.userId, updateData, { new: true });
    req.session.user = updated;
    res.redirect("/profile");
  } catch (err) {
    console.error("Profile update error:", err);
    res.redirect("/profile");
  }
});

// --- Groups ---
app.get("/groups", isAuthenticated, async (req, res) => {
  const groups = await Group.find({ members: req.session.userId }).populate("members");
  res.render("groups", { user: req.session.user, groups });
});

app.get("/groups/new", isAuthenticated, (req, res) => {
  res.render("new_group", { user: req.session.user });
});

app.post("/groups", isAuthenticated, async (req, res) => {
  const group = new Group({
    name: req.body.name,
    createdBy: req.session.userId,
    members: [req.session.userId],
  });
  await group.save();
  res.redirect("/groups");
});

// --- Razorpay Integration ---
app.post("/create-order", isAuthenticated, async (req, res) => {
  try {
    const options = {
      amount: req.body.amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).send("Payment creation failed");
  }
});

app.post("/verify-payment", isAuthenticated, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generated = hmac.digest("hex");

  if (generated === razorpay_signature) res.json({ success: true });
  else res.json({ success: false });
});

// --- Extras ---
app.get("/about", (req, res) => res.render("about", { user: req.session.user }));
app.get("/setting", isAuthenticated, (req, res) => res.render("setting", { user: req.session.user }));

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Smart Expense Splitter running on port ${PORT}`));

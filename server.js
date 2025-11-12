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
// app.use((req, res, next) => {
//   res.locals.user = req.session.user || null;
//   next();
// });

// --- Sessions ---
app.use(
  session({
    secret: "superSecretSmartExpenseKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// make user/userId available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.userId = req.session?.userId || null;
  next();
});

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI || "mongodb+srv://Shreya:shreyapk@cluster0.8b57s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// --- RAZORPAY INSTANCE ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Models ---
const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: String,
  profilePic: String,
  // --- THIS FIELD IS NOW ADDED ---
    upiId: {
      type: String,
      trim: true,
      default: null,
    },
    // --- END ---
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model("User", userSchema);
// const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema); // removed - expenseSchema not defined yet

// --- GROUP MODEL DEFINITION ---
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // optional event/date for the group
    eventDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// safe conditional model registration
const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);

// --- EXPENSE MODEL ---
const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// register Expense safely (avoid redeclare)
const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
// ensure a single auth middleware instance
if (!globalThis.__isAuthenticated) {
  globalThis.__isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    return res.redirect("/login");
  };
}
const isAuthenticated = globalThis.__isAuthenticated;

// / --- NEW RAZORPAY CODE START ---
// --- RAZORPAY ROUTES ---

// 1. CREATE ORDER ROUTE
app.post("/create-order", isAuthenticated, async (req, res) => {
  try {
    // We're just creating a test order for ₹10
    const options = {
      amount: 10 * 100, // amount in the smallest currency unit (paisa)
      currency: "INR",
      receipt: `receipt_order_${new Date().getTime()}`,
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error creating order");
    }

    // Send the order details to the frontend
    res.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 2. VERIFY PAYMENT ROUTE
app.post("/verify-payment", isAuthenticated, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const secret = process.env.RAZORPAY_KEY_SECRET;

  // Create the HMAC signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generated_signature = hmac.digest("hex");

  if (generated_signature === razorpay_signature) {
    // Payment is authentic
    console.log("Payment Verified Successfully!");
    // Here you would save the payment details to your database
    // e.g., Update User model, save a Payment record, etc.
    res.json({ status: "success" });
  } else {
    console.log("Payment Verification Failed!");
    res.json({ status: "failure" });
  }
});
// --- NEW RAZORPAY CODE END ---

// Define schema for contact
const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  date: { type: Date, default: Date.now }
});

// Create model
const Contact = mongoose.model("Contact", contactSchema);

// POST route
app.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.json({ success: false, message: "All fields are required." });
    }

    const contactEntry = new Contact({ name, email, message });
    await contactEntry.save();

    res.json({ success: true, message: "Message stored successfully!" });
  } catch (error) {
    console.error("Contact save error:", error);
    res.status(500).json({ success: false, message: "Server error. Try again later." });
  }
});

// --- Razorpay Setup ---
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// --- Routes ---
app.get("/", (req, res) => res.render("home", {   user: req.session.user|| null }));
app.get("/home", (req, res) => res.render("home", {  user: req.session.user|| null }));

// --- Register ---
app.get("/register", (req, res) => res.render("register", { error: null }));
app.post("/register", async (req, res) => {
  const { name, username, email, phone, password } = req.body;
  try {
    const normalizedEmail = email && String(email).toLowerCase();
    const existing = await User.findOne({ $or: [{ username }, { email: normalizedEmail }] });
    if (existing) return res.render("register", { error: "Username or email already exists!" });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, username, email: normalizedEmail, phone, password: hashed }).save();
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.render("register", { error: "Registration failed, try again!" });
  }
});

app.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render("profile", {
      appName: "Smart Expense Splitter",
      userId: req.session.userId,
      user: user,
      message: req.query.message || null, // For showing a success message
    });
  } catch (error) {
    console.error("Error fetching user for profile:", error);
    res.redirect("/groups");
  }
});

// POST route to update the profile
app.post("/profile", isAuthenticated, async (req, res) => {
  const { upiId } = req.body;
  try {
    await User.findByIdAndUpdate(req.session.userId, { upiId: upiId });
    // Redirect back with a success message
    res.redirect("/profile?message=Profile updated successfully!");
  } catch (error) {
    console.error("Error updating profile:", error);
    res.redirect("/profile");
  }
});
// --- NEW PROFILE ROUTES END ---


// --- GROUPS LIST ROUTE ---
app.get("/groups", isAuthenticated, async (req, res) => {
  try {
    const rawUserId = req.session.userId || (req.session.user && req.session.user._id);
    if (!rawUserId) return res.redirect("/login");

    const userId = String(rawUserId);

    // build a permissive $in array so we match both stored ObjectId and stored string ids
    const inArray = [userId];
    if (mongoose.isValidObjectId(userId)) {
      inArray.push(mongoose.Types.ObjectId(userId));
    }

    console.log('[GET /groups] session.userId=', userId); // debug
    const groups = await Group.find({
      members: { $in: inArray }
    })
      .populate("members", "name username email")
      .lean();

    console.log('[GET /groups] found groups count=', (groups && groups.length) || 0); // debug

    res.render("groups", {
      appName: "Smart Expense Splitter",
      groups,
      user: req.session.user || null,
      userId,
    });
  } catch (error) {
    console.error("GET /groups error:", error);
    res.status(500).send("Error loading groups");
  }
});

// --- GROUPS CREATION ROUTES ---

// GET route to show the Create New Group form
app.get("/groups/new", isAuthenticated, (req, res) => {
  res.render("new_group", {
    appName: "Smart Expense Splitter",
    user: req.session.user || null,
    userId: req.session.userId || (req.session.user && req.session.user._id) || null,
    message: null,
  });
});

// POST route to handle the "Add New Group" form submission
app.post("/groups", isAuthenticated, async (req, res) => {
  try {
    const { name, description, members, date } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).render("new_group", {
        appName: "Smart Expense Splitter",
        user: req.session.user || null,
        userId: req.session.userId || null,
        message: "Group name is required.",
      });
    }

    let membersCandidates = [];
    if (members) {
      membersCandidates = Array.isArray(members)
        ? members
        : String(members).split(",").map((s) => s.trim()).filter(Boolean);
    }

    const resolvedMembers = [];
    for (const cand of membersCandidates) {
      if (!cand) continue;
      if (cand.includes("@")) {
        const user = await User.findOne({ email: cand.toLowerCase() });
        if (user) resolvedMembers.push(String(user._id));
      } else if (/^[0-9a-fA-F]{24}$/.test(cand)) {
        resolvedMembers.push(cand);
      }
    }

    const creatorId = String(req.session.userId || (req.session.user && req.session.user._id));
    if (!resolvedMembers.includes(creatorId)) resolvedMembers.push(creatorId);

    const membersArr = [...new Set(resolvedMembers)];

    let eventDate = null;
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed)) eventDate = parsed;
    }

    const groupDoc = new Group({
      name: name.trim(),
      description: description || "",
      members: membersArr,
      createdBy: creatorId,
      eventDate,
    });

    // IMPORTANT: actually save the document
    await groupDoc.save();

    return res.redirect("/groups");
  } catch (err) {
    console.error("POST /groups error", err);
    return res.status(500).render("new_group", {
      appName: "Smart Expense Splitter",
      user: req.session.user || null,
      userId: req.session.userId || null,
      message: "Server error creating group.",
    });
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


app.get("/about", (req, res) => res.render("about", { user: req.session.user }));
app.get("/setting", isAuthenticated, (req, res) => res.render("setting", { user: req.session.user }));

// --- Start Server ---

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});

export default app;
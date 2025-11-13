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
  // const express = require("express");
  // const crypto = require("crypto");
  // const router = express.Router();
  // const Expense = require("../models/Expense");

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
    req.user = req.session.user || null;
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
  // --- GROUP MODEL DEFINITION ---
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        default: [],
      },
    ],
    expenses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Expense",
        default: [],
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
      participants: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      splits: {
        type: Map,
        of: Number, // who owes how much
        default: {},
      },
      paidSplits: {
        type: Map,
        of: Boolean, // who has paid
        default: {},
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
    { timestamps: true }
  );

  export const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);

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
      const { amount } = req.body;

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount." });
      }

      const options = {
        amount: Math.round(amount * 100), // convert to paisa
        currency: "INR",
        receipt: `receipt_order_${new Date().getTime()}`,
      };

      const order = await razorpay.orders.create(options);
      res.json(order);
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // --- UPDATE PASSWORD ROUTE ---
  app.post("/update-password", isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.session.userId);

      if (!user) {
        return res.status(401).json({ success: false, message: "User not found!" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Current password is incorrect!" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      await user.save();

      req.session.destroy(() => {
        res.json({ success: true, message: "Password updated successfully!" });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error. Try again later." });
    }
  });

  // 2. VERIFY PAYMENT ROUTE
  app.post("/verify-payment", isAuthenticated, async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, expenseId } = req.body;

      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ status: "failure", message: "Invalid signature" });
      }

      const userId = req.session.userId?.toString();
      if (!userId) {
        return res.status(401).json({ status: "error", message: "User not authenticated" });
      }

      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return res.status(404).json({ status: "error", message: "Expense not found" });
      }

      // ✅ Mark current user as paid
      expense.paidSplits.set(userId, true);
      await expense.save();

      // ✅ Check if everyone has paid, then auto-delete
      const allPaid = Object.values(expense.paidSplits || {}).every(Boolean);
      if (allPaid) {
        await Expense.findByIdAndDelete(expenseId);
        console.log("✅ Expense auto-deleted since everyone paid!");
      }

      return res.json({ status: "success", message: "Payment verified and updated" });

    } catch (err) {
      console.error("Payment verification failed:", err);
      res.status(500).json({ status: "error", message: "Server error" });
    }
  });

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
      res.status(500).json({
        success: false,
        message: "Server error. Try again later."
      });
    }
  });

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
  // --- NEW PROFILE ROUTES END ---git push origin shreya-branch

  // --- GROUPS LIST ROUTE ---
  app.get("/groups", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect("/login");
    }

    const groups = await Group.find({ members: req.session.userId });
    const userId = req.session.userId;

    for (const group of groups) {
      const expenses = Array.isArray(group.expenses) ? group.expenses : [];
      for (const expense of group.expenses) {
        // ✅ Check how much this user has paid
        const userPaid = expense.paidSplits && expense.paidSplits[userId];

        // ✅ Check if all members have paid
        const allPaid = Object.values(expense.paidSplits || {}).every(Boolean);

        // ✅ Set status accordingly
        const status = allPaid
          ? "settled"
          : userPaid
          ? "paid"
          : "pending";

        expense.status = status;

        // ✅ Auto-delete settled expenses
        if (allPaid) {
          console.log(`✅ Expense auto-deleted since everyone paid! (${expense.description})`);
          await Expense.findByIdAndDelete(expense._id);
        } else {
          await expense.save();
        }
      }
    }

    res.render("groups", { groups, userId });
  } catch (error) {
    console.error("Error loading groups:", error);
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
  app.get("/login", (req, res) => {
    res.render("login", { error: null });
  });

  app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.render("login", { error: "User not found!" });
    }

    // Compare the entered password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    // ⚙️ Fallback for plain-text passwords (for testing only)
    if (!isMatch && password === user.password) {
      req.session.user = user;
      req.session.userId = user._id;
      return res.redirect("/home");
    }

    if (!isMatch) {
      return res.render("login", { error: "Invalid credentials!" });
    }

    // ✅ Password matched — log the user in
    req.session.user = user;
    req.session.userId = user._id;
    res.redirect("/home");

  } catch (err) {
    console.error(err);
    res.render("login", { error: "Something went wrong. Try again!" });
  }
});

  // --- Logout ---
  app.post("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });


  // --- SINGLE GROUP DETAILS PAGE ---
  app.get("/group/:id", isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.id;

      // Fetch the group info and members
      const group = await Group.findById(groupId)
        .populate("members", "name username email profilePic")
        .lean();

      if (!group) {
        return res.status(404).send("Group not found");
      }

      // Fetch related expenses for this group
      const expenses = await Expense.find({ group: groupId })
        .populate("paidBy", "name username email")
        .lean();

      // Render your group_details.ejs
      res.render("group_details", {
        group,
        expenses,
        user: req.session.user || null,
        userId: req.session.userId,
        message: null,
      });
    } catch (error) {
      console.error("Error loading group details:", error);
      res.status(500).send("Error loading group details");
    }
  });

// --- MARK EXPENSE AS SETTLED ---
app.post("/expenses/:id/settle", isAuthenticated, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.session.userId;

    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).send("Expense not found");
    }

    // ✅ Only the payer can mark as settled
    if (String(expense.paidBy) !== String(userId)) {
      return res.status(403).send("Only the payer can mark this as settled");
    }

    // ✅ Check if everyone has paid
    const allPaid = Array.from(expense.participants).every(pid =>
      expense.paidSplits.get(String(pid))
    );

    if (!allPaid) {
      return res.status(400).send("Not all participants have paid yet!");
    }

    // ✅ Delete the expense once it's settled
    await Expense.findByIdAndDelete(expenseId);
    console.log(`Expense ${expenseId} settled and removed.`);

    res.redirect("/expenses");
  } catch (error) {
    console.error("POST /expenses/:id/settle error:", error);
    res.status(500).send("Error settling expense");
  }
});

  // --- ABOUT & SETTINGS PAGES ---
  app.get("/about", (req, res) => res.render("about", { user: req.session.user }));
  app.get("/setting", isAuthenticated, (req, res) => res.render("setting", { user: req.session.user }));

  // --- MARK PAYMENT AS DONE ---
  app.post("/expenses/:id/pay", isAuthenticated, async (req, res) => {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) return res.status(404).send("Expense not found");

      const userId = String(req.session.userId);
      expense.paidSplits.set(userId, true);

      // check if everyone paid → mark settled if yes
      const allPaid = Object.values(expense.paidSplits.toObject()).every(Boolean);
      if (allPaid) {
        expense.status = "settled"; // optional: add this field if you want explicit state
      }

      await expense.save();
      res.redirect("/expenses");
    } catch (err) {
      console.error("❌ Error marking paid:", err);
      res.status(500).send("Server error");
    }
  });

  // --- MARK PAYMENT AS DONE ---
app.post("/expenses/:id/pay", isAuthenticated, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).send("Expense not found");

    const userId = String(req.session.userId);
    expense.paidSplits.set(userId, true);

    // ✅ Check if everyone has paid
    const allPaid = Object.values(expense.paidSplits.toObject()).every(Boolean);

    if (allPaid) {
      // Optional status
      expense.status = "settled";

      // ✅ Auto delete once all paid
      await Expense.findByIdAndDelete(expense._id);
      console.log("✅ Expense auto-deleted since everyone paid!");
      return res.redirect("/expenses");
    }

    await expense.save();
    res.redirect("/expenses");
  } catch (err) {
    console.error("❌ Error marking paid:", err);
    res.status(500).send("Server error");
  }
});

// 🗑️ Delete Expense route
app.post("/expenses/:id/delete", isAuthenticated, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expense = await Expense.findById(expenseId);
    if (!expense) return res.status(404).send("Expense not found");

    // Allow only payer to delete (or group admin, if you add that later)
    if (String(expense.paidBy) !== String(req.session.userId)) {
      return res.status(403).send("You are not authorized to delete this expense");
    }

    await Expense.findByIdAndDelete(expenseId);
    res.redirect("/expenses");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Failed to delete expense");
  }
});

// --- EXPENSE LIST PAGE ---
app.get("/expenses", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const groups = await Group.find({ members: userId }).select("_id");

    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { group: { $in: groups.map((g) => g._id) } },
      ],
    })
      .populate("paidBy", "name username email")
      .populate({
        path: "group",
        populate: { path: "members", select: "name username email" },
      })
      .sort({ date: -1 })
      .lean();

    res.render("expenses", {
      user: req.session.user || null,
      userId,
      expenses,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("GET /expenses error:", err);
    res.status(500).send("Server error");
  }
});

// --- SUBMIT NEW EXPENSE (Equal Split) ---
app.post("/expenses", isAuthenticated, async (req, res) => {
  try {
    const { group, amount, description, date } = req.body;
    const userId = String(req.session.userId);

    if (!group || !amount) {
      return res.status(400).render("new_expense", {
        user: req.session.user,
        userId,
        groups: await Group.find({ members: userId }).lean(),
        message: "Group and amount are required.",
      });
    }

    const numericAmount = Number(parseFloat(amount));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).render("new_expense", {
        user: req.session.user,
        userId,
        groups: await Group.find({ members: userId }).lean(),
        message: "Invalid amount entered.",
      });
    }

    // 🩷 Get group members
    const groupDoc = await Group.findById(group).lean();
    if (!groupDoc || !groupDoc.members || groupDoc.members.length === 0) {
      return res.status(400).render("new_expense", {
        user: req.session.user,
        userId,
        groups: await Group.find({ members: userId }).lean(),
        message: "Group not found or has no members.",
      });
    }

    const participants = groupDoc.members.map((m) => String(m));
    const perPerson = Number((numericAmount / participants.length).toFixed(2));

    // 🩷 Create split mapping
    const splits = {};
    const paidSplits = {}; // ✅ define here (this was missing!)

    participants.forEach((pid) => {
      splits[pid] = perPerson;
      paidSplits[pid] = pid === userId; // payer already paid
    });

    // 🩷 Adjust rounding remainder (for perfect sum)
    const totalSplit = participants.reduce((sum, pid) => sum + splits[pid], 0);
    const remainder = Number((numericAmount - totalSplit).toFixed(2));
    if (remainder !== 0) {
      splits[userId] = Number((splits[userId] + remainder).toFixed(2));
    }

    // 🩷 Save the expense
    const expense = new Expense({
      group,
      amount: numericAmount,
      description: description || "Untitled Expense",
      paidBy: userId,
      date: date || new Date(),
      participants,
      splits,
      paidSplits, // ✅ correctly used here
    });

    await expense.save();
    res.redirect("/expenses");
  } catch (error) {
    console.error("POST /expenses error:", error);
    res.status(500).send("Error adding expense");
  }
});

// Route: Show Add Expense page
app.get("/expenses/new", async (req, res) => {
  try {
    // check if logged in
    if (!req.session.userId) {
      return res.redirect("/login");
    }

    const userId = String(req.session.userId);
    const groups = await Group.find({ members: userId }).lean();

    res.render("new_expense", {
      user: req.session.user,
      userId,
      groups,
      message: null
    });
  } catch (err) {
    console.error("Error rendering new expense page:", err);
    res.status(500).send("Internal Server Error");
  }
});

  // ADD MEMBER TO GROUP ---
  app.post("/group/:id/add", isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.id;
      const { email } = req.body;

      const userToAdd = await User.findOne({ email: email.toLowerCase() });
      if (!userToAdd) {
        const group = await Group.findById(groupId)
          .populate("members", "name username email profilePic")
          .lean();

        return res.render("group_details", {
          group,
          expenses: [],
          user: req.session.user,
          userId: req.session.userId,
          message: "User not found!",
        });
      }

      await Group.findByIdAndUpdate(groupId, {
        $addToSet: { members: userToAdd._id },
      });

      res.redirect(`/group/${groupId}`);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).send("Error adding member to group");
    }
  });

  // 🗑️ DELETE GROUP (only creator can delete)
app.post("/group/:id/delete", isAuthenticated, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = String(req.session.userId);

    // ✅ Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).send("Group not found");
    }

    // ✅ Only the creator can delete
    if (String(group.createdBy) !== userId) {
      return res.status(403).send("Only the creator can delete this group");
    }

    // ✅ Delete all related expenses
    await Expense.deleteMany({ group: groupId });

    // ✅ Delete the group itself
    await Group.findByIdAndDelete(groupId);

    console.log(`🗑️ Group '${group.name}' and its expenses deleted by creator.`);
    res.redirect("/groups");
  } catch (error) {
    console.error("❌ Error deleting group:", error);
    res.status(500).send("Error deleting group");
  }
});

// --- REMOVE MEMBER FROM GROUP ---
app.post("/group/:groupId/remove/:memberId", isAuthenticated, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.session.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).send("Group not found");

    // ✅ Only the group creator can remove members
    if (String(group.createdBy) !== String(userId)) {
      return res.status(403).send("Only the group creator can remove members!");
    }

    // ❌ Prevent removing creator themselves
    if (String(group.createdBy) === String(memberId)) {
      return res.status(400).send("Creator cannot remove themselves!");
    }

    // ✅ Remove the member from the group
    group.members = group.members.filter(id => String(id) !== String(memberId));
    await group.save();

    // ✅ Also remove the member from all related expenses
    const expenses = await Expense.find({ group: groupId });

    for (const exp of expenses) {
      exp.participants = exp.participants.filter(id => String(id) !== String(memberId));

      // Remove from splits map and paidSplits map
      exp.splits.delete(String(memberId));
      exp.paidSplits.delete(String(memberId));

      await exp.save();
    }

    console.log(`🧹 Member ${memberId} removed from group ${groupId} and related expenses cleaned up.`);

    res.redirect(`/group/${groupId}`);
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).send("Server error removing member");
  }
});

    export default app;
  // --- Start Server ---

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
  });
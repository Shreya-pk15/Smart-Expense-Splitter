const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
const path = require("path");

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose.connect("mongodb+srv://Shreya:shreyapk@cluster0.8b57s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err));

// // Default route
// app.get("/", (req, res) => {
//   res.send("Welcome to Smart Expense Splitter API 🚀");
// });

// Homepage route
app.get("/home", (req, res) => {
  res.render("home", { appName: "Smart Expense Splitter" });
});

// expenses
// =============================
// PERSONAL EXPENSE ROUTES
// =============================

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) return next();
  res.redirect("/login");
};

// --- GET all personal expenses ---
app.get("/expenses", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  try {
    const expenses = await Expense.find({ user: userId }).sort({ date: -1 });
    res.render("expenses", {
      appName: "Smart Expense Splitter",
      userId,
      expenses,
      message: null,
    });
  } catch (err) {
    console.error("❌ Error loading expenses:", err);
    res.status(500).send("Server Error");
  }
});

// --- FILTER expenses ---
app.get("/expenses/filter", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { category, date, minAmount, maxAmount } = req.query;

    let query = { user: userId };

    if (category && category.trim() !== "") {
      query.category = { $regex: new RegExp(category, "i") };
    }

    if (date && date.trim() !== "") {
      const selectedDate = new Date(date);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);
      query.date = { $gte: selectedDate, $lt: nextDay };
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }

    const expenses = await Expense.find(query).sort({ date: -1 });

    res.render("expenses", {
      appName: "Smart Expense Splitter",
      userId,
      expenses,
      message: null,
    });
  } catch (error) {
    console.error("❌ Error filtering expenses:", error);
    res.status(500).send("Server Error");
  }
});

// --- ADD a new expense ---
app.post("/expenses/add", isAuthenticated, async (req, res) => {
  const { title, amount, category } = req.body;
  const userId = req.session.userId;
  try {
    const newExpense = new Expense({
      title,
      amount: parseFloat(amount),
      category,
      user: userId,
    });
    await newExpense.save();
    res.redirect("/expenses");
  } catch (err) {
    console.error("❌ Error adding expense:", err);
    res.status(500).send("Server Error");
  }
});

// --- DELETE an expense ---
app.post("/expenses/:id/delete", isAuthenticated, async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.redirect("/expenses");
  } catch (err) {
    console.error("❌ Error deleting expense:", err);
    res.status(500).send("Server Error");
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

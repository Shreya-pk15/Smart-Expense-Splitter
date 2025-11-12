# 💸 Smart Expense Splitter

A friendly full-stack web app that makes splitting group expenses effortless and fun!
Built using **Node.js**, **Express**, and **MongoDB**, the app has a pleasant, soft-pink color scheme to make the experience feel friendly and inviting 🌸

It lets users create groups, add shared expenses, track who owes what, change passwords, and contact support — all in a secure, responsive design.

---

## ✨ Features

* 👥 **Group Expense Management:** Create groups and add shared expenses.
* 💰 **Smart Split Calculations:** Automatically divides costs among group members.
* 🔒 **Account Settings:** Change passwords securely with strength check and validation.
* 📬 **Contact Support:** Simple contact form with toast notifications.
* ❓ **FAQs Section:** Interactive accordion for common questions.
* 🌈 **Responsive Design:** Works smoothly across mobile, tablet, and desktop.
* 💾 **Secure Backend:** Passwords are encrypted, and user sessions are protected.

---

## 🧠 Tech Stack

**Frontend:**

* HTML5, CSS3 (Custom pink theme)
* Bootstrap 5 + Bootstrap Icons
* JavaScript (Vanilla for interactivity)

**Backend:**

* Node.js + Express.js
* MongoDB (via Mongoose)
* Razorpay (for payment gateway integration — optional)

**Other Tools:**

* bcrypt.js (for password hashing)
* dotenv (for environment variables)
* multer (for file uploads)
* express-session (for authentication sessions)

---

## 🧩 Folder Structure

Smart-Expense-Splitter/
│
├── public/
│   ├── styles/
│   │   ├── style.css
│   │   └── navbar.css
│   └── images/
│
├── views/
│   ├── partials/
│   │   └── navbar.ejs
│   ├── settings.ejs
│   ├── groups.ejs
│   ├── expenses.ejs
│   └── ...
│
├── routes/
│   ├── authRoutes.js
│   ├── groupRoutes.js
│   ├── expenseRoutes.js
│   └── settingsRoutes.js
│
├── models/
│   ├── User.js
│   ├── Group.js
│   └── Expense.js
│
├── server.js
├── package.json
└── README.md

---

## ⚙️ Installation & Setup

1. **Clone the repository**
   git clone [https://github.com/](https://github.com/)<your-username>/smart-expense-splitter.git
   cd smart-expense-splitter

2. **Install dependencies**
   npm install

3. **Create a `.env` file**
   MONGO_URI=your_mongodb_connection_string
   SESSION_SECRET=your_secret_key
   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   PORT=5000

4. **Run the app**
   npm start

   or for development:
   nodemon server.js

5. **Visit the app**
   [http://localhost:5000](http://localhost:5000)

---

## 🔐 Key Pages

| Page          | Description                         |
| ------------- | ----------------------------------- |
| `/register`   | User registration                   |
| `/login`      | User login                          |
| `/dashboard`  | Overview of groups and expenses     |
| `/groups/:id` | Detailed view of a group’s expenses |
| `/settings`   | Change password, FAQs, contact form |
| `/contact`    | Send feedback or inquiries          |

---

## 💅 UI Highlights

* **Pastel pink color palette** for a cheerful experience
* Smooth animations (`fadeIn`, `slideIn`) for transitions
* **Interactive password strength indicator**
* **Toast notifications** for success/error feedback
* **Fully responsive layout** that adapts to any device

---

## 🧪 Testing (Optional)

You can set up automated tests using **Jest**, **Supertest**, and **mongodb-memory-server**.

npm install --save-dev jest supertest mongodb-memory-server
API Testing

---

## 🏁 Future Enhancements

* 💳 Integration with Razorpay for real expense settlement
* 📊 Visual charts for expense summaries
* 📱 Progressive Web App (PWA) support
* 🔔 Email notifications for group updates

---

### 🌸 “Splitting bills doesn’t have to split friendships!” 🌸

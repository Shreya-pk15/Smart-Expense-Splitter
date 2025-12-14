# Smart Expense Splitter

Smart Expense Splitter is a full-stack web application designed to simplify group expense management. It allows users to create groups, add shared expenses, track balances, and settle payments — all through a clean, responsive, and user-friendly interface.

---

## About the Project

Managing shared expenses in trips, hostels, or group activities can be tedious and error-prone. Smart Expense Splitter solves this problem by providing a centralized platform where users can register, create groups, add expenses, and clearly see who owes whom.

The application focuses on usability, clarity, and scalability, making it suitable for both academic projects and real-world use cases.

---

## Features

* User registration and login with secure sessions
* Create groups and manage group members
* Add expenses with amount, description, and date
* Automatic balance calculation and settlement view
* User profile management with avatar upload
* Optional Razorpay integration for payments
* Responsive UI using EJS, Bootstrap, and custom CSS

---

## Tech Stack

**Frontend**

* EJS Templates
* HTML, CSS, Bootstrap
* Vanilla JavaScript

**Backend**

* Server.js

**Database**

* MongoDB (Atlas)

**Other Tools**

* Express-session for authentication
* Multer for file uploads
* Razorpay API

---

## MongoDB Setup

1. Create a MongoDB Atlas cluster.
2. Create a database (e.g., `expenseDB`).
3. Add collections:

   * `users`
   * `groups`
   * `expenses`
4. Obtain the MongoDB connection string:

```
mongodb+srv://<username>:<password>@cluster0.mongodb.net/expenseDB
```

---

## Environment Variables

Create a `.env` file in the project root:

```
PORT=5000
MONGO_URI=your_mongo_uri
SESSION_SECRET=your_session_secret
RAZORPAY_KEY_ID=your_razorpay_key_id      # optional
RAZORPAY_KEY_SECRET=your_razorpay_key_secret  # optional
```

---

## Installation

1. Clone the repository
2. Navigate to the project directory

```bash
npm install
```

---

## Running the Application

### Local Development

```bash
npm start
```

Open your browser and navigate to:

```
http://localhost:5000
```

### Production Quickstart

* Set environment variables on the hosting platform
* Run the server using a process manager such as `pm2`
* Use cloud storage (S3 / Cloudinary) for uploads in production

---

## Project Structure

```
Smart-Expense-Splitter/
│── server.js           # Main application entry
│── package.json        # Dependencies and scripts
│── views/              # EJS templates
│   ├── new_expense.ejs
│   ├── profile.ejs
│   ├── about.ejs
│   ├── expenses.ejs
|   ├── home.ejs
|   ├── new_group.ejs
|   ├── group_details.ejs
|   ├── groups.ejs
|   ├── register.ejs
|   ├── login.ejs
│   └── setting.ejs
│── public/              # Static assets
│   ├── css/
│   │   └── style.css
│   ├── js/
│   └── images/
│── uploads/             # Uploaded profile images
│── .env                 # Environment variables (ignored in git)
```

---

## Notes

* EJS views expect controllers to pass `user`, `groups`, and `message` objects.
* Uploaded avatars are stored locally by default.
* For production, enable HTTPS, secure sessions, and proper CORS configuration.

---

## Future Enhancements

* Expense analytics and visual charts
* Group chat and notifications
* Complete payment workflows (Razorpay / Stripe)
* Admin dashboard and reporting tools

---

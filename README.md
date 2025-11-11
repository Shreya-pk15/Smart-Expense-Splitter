# Smart Expense Splitter

A friendly web app to split group expenses, track payments, and manage groups — built with Node.js, Express, MongoDB and a pink aesthetic UI.
Welcome to Smart Expense Splitter, a full-stack web application designed to make splitting group expenses effortless. Users can register, create groups, add expenses, and track who owes what — all in a friendly pink-themed interface. 🌸

## Features
- User registration & login (secure sessions)
- Create groups and add members
- Add expenses to groups (amount, description, date)
- View group balances and settle up
- Profile with avatar upload and settings (change password)
- Razorpay integration for payments (optional)
- Responsive UI using EJS templates, Bootstrap & custom pink CSS

## Tech Stack
- Backend: Node.js (v18+), Express.js, MongoDB (Mongoose), express-session, bcrypt, dotenv, multer, Razorpay
- Frontend: EJS templates, HTML, CSS, Bootstrap, Vanilla JS
- Storage: Local `uploads/` for avatars (consider S3/Cloudinary for production)

## MongoDB Setup
1. Create a MongoDB Atlas cluster.
2. Create a database (e.g., expenseDB) and collections: users, groups, expenses.
3. Get connection string, e.g.:
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/expenseDB
4. Put it in your .env:
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/expenseDB

## Environment Variables
Create a `.env` file in the project root:
PORT=5000
MONGO_URI=your_mongo_uri
SESSION_SECRET=your_session_secret
RAZORPAY_KEY_ID=your_razorpay_key_id   # optional
RAZORPAY_KEY_SECRET=your_razorpay_key_secret   # optional

## Running the App (local)
1. Open the project folder in a terminal (Windows):
   cd "d:\3rd year\Full Stack\practice\Smart-Expense-Splitter-1"
2. Install dependencies:
   npm install
3. Start the server:
   npm start
4. Open: http://localhost:5000 (or the PORT you set)

## Quickstart (production)
1. Set environment variables (in host or `.env`):
   PORT=5000
   MONGO_URI=your_mongo_uri
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
2. Run the server:
   npm start
Use a process manager (pm2) or a suitable hosting platform (Heroku, Railway, DigitalOcean, etc.). Persist uploads or use cloud storage.

## Folder Structure
Smart-Expense-Splitter/
- server.js                # Main app entry, routes & middleware
- package.json             # Dependencies & scripts
- views/                   # EJS templates (UI)
  - new_expense.ejs
  - profile.ejs
  - setting.ejs
  - partials/
    - navbar.ejs
    - head.ejs
    - footer.ejs
- public/                  # Static assets
  - css/
    - style.css
  - js/
  - images/
- uploads/                 # Uploaded profile images
- .env                     # Environment variables (ignored in git)

## Notes
- Views expect controllers to pass `user`, `groups`, and `message` to EJS templates (e.g., `views/new_expense.ejs`).
- Uploaded avatars are stored locally; for production use S3/Cloudinary.
- Configure secure sessions, HTTPS, and proper CORS for production.

## Future Enhancements
- Expense analytics & charts
- Group chat integration
- Full payment flows with Razorpay/Stripe
- Admin dashboard and reporting

👩‍💻 Made with 💖 by Students for Students
Crafted with curiosity, teamwork, and a touch of pink! Built using Node.js, Express, MongoDB, and Bootstrap — to make splitting bills fun, fast, and fair! 💕

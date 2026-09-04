// ============================================================
// 4BITTERZS - Authentication Routes
// ============================================================

const express = require("express");
const { createRateLimiter } = require("../middleware/rateLimit");

const {
    register,
    login,
    me
} = require("../controllers/authController");

const {
    authenticate
} = require("../middleware/auth");


const router = express.Router();

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many authentication attempts. Please try again later."
});


// Customer registration
router.post("/register", authLimiter, register);


// Customer/admin login
router.post("/login", authLimiter, login);


// Current logged-in user
router.get("/me", authenticate, me);


module.exports = router;
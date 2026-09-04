// ============================================================
// 4BITTERZS - Checkout Routes
// ============================================================

const express = require("express");

const {
    authenticate
} = require("../middleware/auth");

const {
    checkout
} = require("../controllers/checkoutController");


const router = express.Router();


// Checkout requires authentication.
router.use(authenticate);


// Create order from cart
router.post("/", checkout);


module.exports = router;
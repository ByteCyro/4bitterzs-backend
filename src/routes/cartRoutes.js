// ============================================================
// 4BITTERZS - Cart Routes
// ============================================================

const express = require("express");

const {
    authenticate
} = require("../middleware/auth");

const {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart
} = require("../controllers/cartController");


const router = express.Router();


// All cart operations require authentication.
router.use(authenticate);


// Get current user's cart
router.get("/", getCart);


// Add product to cart
router.post("/:productId", addToCart);


// Update cart item
router.put("/:itemId", updateCartItem);


// Remove cart item
router.delete("/:itemId", removeCartItem);


// Clear entire cart
router.delete("/", clearCart);


module.exports = router;
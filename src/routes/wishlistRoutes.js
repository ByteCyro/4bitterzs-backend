// ============================================================
// 4BITTERZS - Wishlist Routes
// ============================================================

const express = require("express");

const {
    authenticate
} = require("../middleware/auth");

const {
    getWishlist,
    addToWishlist,
    removeFromWishlist
} = require("../controllers/wishlistController");


const router = express.Router();


// All wishlist operations require authentication.
router.use(authenticate);


// Get current user's wishlist
router.get("/", getWishlist);


// Add product
router.post("/:productId", addToWishlist);


// Remove product
router.delete("/:productId", removeFromWishlist);


module.exports = router;
// ============================================================
// 4BITTERZS - Product Images + Inventory Routes
// ============================================================

const express = require("express");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const {
    getInventory,
    setInventory,
    deleteInventory
} = require("../controllers/inventoryController");

const {
    getImages,
    addImage,
    deleteImage
} = require("../controllers/imageController");


const router = express.Router();


// ============================================================
// INVENTORY
// ============================================================

// Public
router.get(
    "/:productId/inventory",
    getInventory
);


// Admin
router.post(
    "/:productId/inventory",
    authenticate,
    requireAdmin,
    setInventory
);


router.delete(
    "/:productId/inventory/:inventoryId",
    authenticate,
    requireAdmin,
    deleteInventory
);


// ============================================================
// IMAGES
// ============================================================

// Public
router.get(
    "/:productId/images",
    getImages
);


// Admin
router.post(
    "/:productId/images",
    authenticate,
    requireAdmin,
    addImage
);


router.delete(
    "/:productId/images/:imageId",
    authenticate,
    requireAdmin,
    deleteImage
);


module.exports = router;
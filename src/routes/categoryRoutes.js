// ============================================================
// 4BITTERZS - Category Routes
// ============================================================

const express = require("express");

const {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");


const router = express.Router();


// ------------------------------------------------------------
// PUBLIC
// ------------------------------------------------------------

router.get("/", getCategories);

router.get("/:id", getCategory);


// ------------------------------------------------------------
// ADMIN
// ------------------------------------------------------------

router.post(
    "/",
    authenticate,
    requireAdmin,
    createCategory
);

router.put(
    "/:id",
    authenticate,
    requireAdmin,
    updateCategory
);

router.delete(
    "/:id",
    authenticate,
    requireAdmin,
    deleteCategory
);


module.exports = router;
// ============================================================
// 4BITTERZS - Customer Routes
// ============================================================

const express = require("express");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const {
    getCustomers,
    getCustomerById
} = require("../controllers/customerController");

const router = express.Router();


// ============================================================
// ADMIN CUSTOMER ROUTES
// ============================================================

router.use(authenticate);
router.use(requireAdmin);


// ------------------------------------------------------------
// GET ALL CUSTOMERS / SEARCH CUSTOMERS
// ------------------------------------------------------------

router.get(
    "/",
    getCustomers
);


// ------------------------------------------------------------
// GET SINGLE CUSTOMER
// ------------------------------------------------------------

router.get(
    "/:id",
    getCustomerById
);


module.exports = router;
// ============================================================
// 4BITTERZS - Admin Routes
// ============================================================

const express = require("express");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const router = express.Router();

// Reserved for future admin-only endpoints.
router.use(authenticate, requireAdmin);

module.exports = router;

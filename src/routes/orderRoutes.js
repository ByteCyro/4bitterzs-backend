// ============================================================
// 4BITTERZS - Order Routes
// ============================================================

const express = require("express");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const {
    getMyOrders,
    getMyOrderById,
    getAllOrders,
    getAdminOrderById,
    updateOrderStatus,
    verifyDeliveryOtp,
    confirmDelivery,
    cancelDelivery
} = require("../controllers/orderController");

const router = express.Router();


// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authenticate);


// ============================================================
// ADMIN ROUTES FIRST
// ============================================================

router.get(
    "/admin/all",
    requireAdmin,
    getAllOrders
);

router.get(
    "/admin/:id",
    requireAdmin,
    getAdminOrderById
);

router.patch(
    "/admin/:id/status",
    requireAdmin,
    updateOrderStatus
);


// ============================================================
// CUSTOMER ROUTES
// ============================================================

router.get(
    "/",
    getMyOrders
);


// ============================================================
// DELIVERY OTP - ADMIN VERIFICATION
// ============================================================

router.post(
    "/admin/:id/delivery-otp/verify",
    requireAdmin,
    verifyDeliveryOtp
);

router.post(
    "/admin/:id/delivery/confirm",
    requireAdmin,
    confirmDelivery
);

router.post(
    "/admin/:id/delivery/cancel",
    requireAdmin,
    cancelDelivery
);


// ============================================================
// CUSTOMER ORDER DETAILS
// ============================================================

router.get(
    "/:id",
    getMyOrderById
);


module.exports = router;
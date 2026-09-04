// ============================================================
// 4BITTERZS - Coupon Routes
// ============================================================

const express = require("express");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCoupon
} = require("../controllers/couponController");


const router = express.Router();


// ------------------------------------------------------------
// ADMIN
// ------------------------------------------------------------

router.post(
    "/",
    authenticate,
    requireAdmin,
    createCoupon
);

router.get(
    "/",
    authenticate,
    requireAdmin,
    getAllCoupons
);

router.get(
    "/:id",
    authenticate,
    requireAdmin,
    getCouponById
);

router.put(
    "/:id",
    authenticate,
    requireAdmin,
    updateCoupon
);

router.delete(
    "/:id",
    authenticate,
    requireAdmin,
    deleteCoupon
);


// ------------------------------------------------------------
// CUSTOMER VALIDATION
// ------------------------------------------------------------

router.post(
    "/validate",
    authenticate,
    validateCoupon
);


module.exports = router;
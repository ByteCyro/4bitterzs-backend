// ============================================================
// 4BITTERZS - Coupon Controller
// ============================================================

const pool = require("../db/pool");


// ------------------------------------------------------------
// CREATE COUPON - ADMIN
// ------------------------------------------------------------

async function createCoupon(req, res) {

    try {

        const {
            code,
            discount_type,
            discount_value,
            minimum_order = 0,
            maximum_discount = null,
            starts_at = null,
            expires_at = null,
            usage_limit = null,
            active = true
        } = req.body;


        if (!code || !discount_type || discount_value === undefined) {

            return res.status(400).json({
                success: false,
                message: "Code, discount type and discount value are required."
            });

        }


        const normalizedCode = String(code).trim().toUpperCase();


        if (!["percentage", "fixed"].includes(discount_type)) {

            return res.status(400).json({
                success: false,
                message: "Discount type must be percentage or fixed."
            });

        }


        const value = Number(discount_value);
        const minimum = Number(minimum_order);

        if (!Number.isFinite(value) || value <= 0) {

            return res.status(400).json({
                success: false,
                message: "Discount value must be greater than zero."
            });

        }


        if (!Number.isFinite(minimum) || minimum < 0) {

            return res.status(400).json({
                success: false,
                message: "Minimum order cannot be negative."
            });

        }


        if (discount_type === "percentage" && value > 100) {

            return res.status(400).json({
                success: false,
                message: "Percentage discount cannot exceed 100%."
            });

        }


        if (
            maximum_discount !== null &&
            (
                !Number.isFinite(Number(maximum_discount)) ||
                Number(maximum_discount) <= 0
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Maximum discount must be greater than zero."
            });

        }


        if (
            usage_limit !== null &&
            (
                !Number.isInteger(Number(usage_limit)) ||
                Number(usage_limit) <= 0
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Usage limit must be a positive integer."
            });

        }


        const result = await pool.query(`
            INSERT INTO coupons
                (
                    code,
                    discount_type,
                    discount_value,
                    minimum_order,
                    maximum_discount,
                    starts_at,
                    expires_at,
                    usage_limit,
                    active
                )

            VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9
                )

            RETURNING
                id,
                code,
                discount_type,
                discount_value,
                minimum_order,
                maximum_discount,
                starts_at,
                expires_at,
                usage_limit,
                usage_count,
                active,
                created_at
        `, [
            normalizedCode,
            discount_type,
            value,
            minimum,
            maximum_discount,
            starts_at,
            expires_at,
            usage_limit,
            active
        ]);


        return res.status(201).json({

            success: true,

            message: "Coupon created successfully.",

            coupon: result.rows[0]

        });

    } catch (error) {

        console.error("Create coupon error:", error);

        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "A coupon with this code already exists."
            });

        }


        return res.status(500).json({
            success: false,
            message: "Unable to create coupon."
        });

    }

}


// ------------------------------------------------------------
// GET ALL COUPONS - ADMIN
// ------------------------------------------------------------

async function getAllCoupons(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                id,
                code,
                discount_type,
                discount_value,
                minimum_order,
                maximum_discount,
                starts_at,
                expires_at,
                usage_limit,
                usage_count,
                active,
                created_at

            FROM coupons

            ORDER BY created_at DESC
        `);


        return res.json({

            success: true,

            coupons: result.rows

        });

    } catch (error) {

        console.error("Get coupons error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to retrieve coupons."

        });

    }

}


// ------------------------------------------------------------
// GET SINGLE COUPON - ADMIN
// ------------------------------------------------------------

async function getCouponById(req, res) {

    try {

        const { id } = req.params;


        const result = await pool.query(`
            SELECT
                id,
                code,
                discount_type,
                discount_value,
                minimum_order,
                maximum_discount,
                starts_at,
                expires_at,
                usage_limit,
                usage_count,
                active,
                created_at

            FROM coupons

            WHERE id = $1
        `, [id]);


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Coupon not found."

            });

        }


        return res.json({

            success: true,

            coupon: result.rows[0]

        });

    } catch (error) {

        console.error("Get coupon error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to retrieve coupon."

        });

    }

}


// ------------------------------------------------------------
// UPDATE COUPON - ADMIN
// ------------------------------------------------------------

async function updateCoupon(req, res) {

    try {

        const { id } = req.params;

        const {
            code,
            discount_type,
            discount_value,
            minimum_order,
            maximum_discount,
            starts_at,
            expires_at,
            usage_limit,
            active
        } = req.body;


        const existing = await pool.query(`
            SELECT *
            FROM coupons
            WHERE id = $1
        `, [id]);


        if (existing.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Coupon not found."

            });

        }


        const current = existing.rows[0];


        const finalCode =
            code !== undefined
                ? String(code).trim().toUpperCase()
                : current.code;


        const finalType =
            discount_type !== undefined
                ? discount_type
                : current.discount_type;


        const finalValue =
            discount_value !== undefined
                ? Number(discount_value)
                : Number(current.discount_value);


        const finalMinimum =
            minimum_order !== undefined
                ? Number(minimum_order)
                : Number(current.minimum_order);


        const finalMaximum =
            maximum_discount !== undefined
                ? maximum_discount
                : current.maximum_discount;


        const finalStarts =
            starts_at !== undefined
                ? starts_at
                : current.starts_at;


        const finalExpires =
            expires_at !== undefined
                ? expires_at
                : current.expires_at;


        const finalUsageLimit =
            usage_limit !== undefined
                ? usage_limit
                : current.usage_limit;


        const finalActive =
            active !== undefined
                ? active
                : current.active;


        if (!["percentage", "fixed"].includes(finalType)) {

            return res.status(400).json({

                success: false,

                message: "Discount type must be percentage or fixed."

            });

        }


        if (
            !Number.isFinite(finalValue) ||
            finalValue <= 0
        ) {

            return res.status(400).json({

                success: false,

                message: "Discount value must be greater than zero."

            });

        }


        if (
            finalType === "percentage" &&
            finalValue > 100
        ) {

            return res.status(400).json({

                success: false,

                message: "Percentage discount cannot exceed 100%."

            });

        }


        if (
            !Number.isFinite(finalMinimum) ||
            finalMinimum < 0
        ) {

            return res.status(400).json({

                success: false,

                message: "Minimum order cannot be negative."

            });

        }


        const result = await pool.query(`
            UPDATE coupons

            SET
                code = $1,
                discount_type = $2,
                discount_value = $3,
                minimum_order = $4,
                maximum_discount = $5,
                starts_at = $6,
                expires_at = $7,
                usage_limit = $8,
                active = $9

            WHERE id = $10

            RETURNING
                id,
                code,
                discount_type,
                discount_value,
                minimum_order,
                maximum_discount,
                starts_at,
                expires_at,
                usage_limit,
                usage_count,
                active,
                created_at
        `, [
            finalCode,
            finalType,
            finalValue,
            finalMinimum,
            finalMaximum,
            finalStarts,
            finalExpires,
            finalUsageLimit,
            finalActive,
            id
        ]);


        return res.json({

            success: true,

            message: "Coupon updated successfully.",

            coupon: result.rows[0]

        });

    } catch (error) {

        console.error("Update coupon error:", error);

        if (error.code === "23505") {

            return res.status(409).json({

                success: false,

                message: "A coupon with this code already exists."

            });

        }


        return res.status(500).json({

            success: false,

            message: "Unable to update coupon."

        });

    }

}


// ------------------------------------------------------------
// DELETE COUPON - ADMIN
// ------------------------------------------------------------

async function deleteCoupon(req, res) {

    try {

        const { id } = req.params;


        const result = await pool.query(`
            DELETE FROM coupons

            WHERE id = $1

            RETURNING id, code
        `, [id]);


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Coupon not found."

            });

        }


        return res.json({

            success: true,

            message: "Coupon deleted successfully."

        });

    } catch (error) {

        console.error("Delete coupon error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to delete coupon."

        });

    }

}


// ------------------------------------------------------------
// VALIDATE COUPON - CUSTOMER
// ------------------------------------------------------------

async function validateCoupon(req, res) {

    try {

        const {
            code,
            subtotal
        } = req.body;


        if (!code) {

            return res.status(400).json({

                success: false,

                message: "Coupon code is required."

            });

        }


        const orderSubtotal = Number(subtotal);


        if (
            !Number.isFinite(orderSubtotal) ||
            orderSubtotal < 0
        ) {

            return res.status(400).json({

                success: false,

                message: "A valid subtotal is required."

            });

        }


        const normalizedCode =
            String(code).trim().toUpperCase();


        const result = await pool.query(`
            SELECT
                id,
                code,
                discount_type,
                discount_value,
                minimum_order,
                maximum_discount,
                starts_at,
                expires_at,
                usage_limit,
                usage_count,
                active

            FROM coupons

            WHERE code = $1
        `, [normalizedCode]);


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Invalid coupon code."

            });

        }


        const coupon = result.rows[0];


        if (!coupon.active) {

            return res.status(400).json({

                success: false,

                message: "This coupon is inactive."

            });

        }


        const now = new Date();


        if (
            coupon.starts_at &&
            now < new Date(coupon.starts_at)
        ) {

            return res.status(400).json({

                success: false,

                message: "This coupon is not active yet."

            });

        }


        if (
            coupon.expires_at &&
            now > new Date(coupon.expires_at)
        ) {

            return res.status(400).json({

                success: false,

                message: "This coupon has expired."

            });

        }


        if (
            coupon.usage_limit !== null &&
            coupon.usage_count >= coupon.usage_limit
        ) {

            return res.status(400).json({

                success: false,

                message: "This coupon has reached its usage limit."

            });

        }


        if (
            orderSubtotal <
            Number(coupon.minimum_order)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    `Minimum order value is ₹${coupon.minimum_order}.`

            });

        }


        let discount = 0;


        if (coupon.discount_type === "percentage") {

            discount =
                orderSubtotal *
                Number(coupon.discount_value) /
                100;

        } else {

            discount =
                Number(coupon.discount_value);

        }


        if (
            coupon.maximum_discount !== null &&
            discount > Number(coupon.maximum_discount)
        ) {

            discount =
                Number(coupon.maximum_discount);

        }


        // Never allow discount to exceed subtotal.
        discount =
            Math.min(discount, orderSubtotal);


        discount =
            Math.round(discount * 100) / 100;


        const finalSubtotal =
            Math.max(
                0,
                orderSubtotal - discount
            );


        return res.json({

            success: true,

            valid: true,

            coupon: {
                id: coupon.id,
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value
            },

            discount_amount: discount,

            subtotal: orderSubtotal,

            subtotal_after_discount: finalSubtotal

        });

    } catch (error) {

        console.error("Validate coupon error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to validate coupon."

        });

    }

}


module.exports = {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCoupon
};
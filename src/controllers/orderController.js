// ============================================================
// 4BITTERZS - Order Controller
// ============================================================

const crypto = require("crypto");
const pool = require("../db/pool");


// ============================================================
// DECRYPT DELIVERY OTP FOR AUTHORIZED SERVER-SIDE USE
// ============================================================

function decryptDeliveryOtp(otpEncrypted) {

    if (!otpEncrypted || !process.env.DELIVERY_OTP_SECRET) {
        return null;
    }

    try {

        const encryptionKey = crypto
            .createHash("sha256")
            .update(process.env.DELIVERY_OTP_SECRET)
            .digest();

        const parts = String(otpEncrypted).split(":");

        if (parts.length !== 2) {
            return null;
        }

        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            encryptionKey,
            Buffer.from(parts[0], "hex")
        );

        let otp = decipher.update(parts[1], "hex", "utf8");
        otp += decipher.final("utf8");

        return /^\d{6}$/.test(otp) ? otp : null;

    } catch (error) {
        console.error("Delivery OTP decryption error:", error);
        return null;
    }
}


// ============================================================
// GET CUSTOMER ORDERS
// ============================================================

async function getMyOrders(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                o.id,
                o.status,
                o.payment_status,
                o.payment_method,
                o.shipping_method,
                o.shipping_name,
                o.shipping_phone,
                o.shipping_address,
                o.subtotal,
                o.shipping_cost,
                o.discount_amount,
                o.total,
                o.coupon_code,
                o.created_at,
                o.updated_at,
                COUNT(oi.id)::integer AS item_count
            FROM orders o
            LEFT JOIN order_items oi
                ON oi.order_id = o.id
            WHERE o.user_id = $1
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [req.user.userId]);

        return res.json({
            success: true,
            orders: result.rows
        });

    } catch (error) {

        console.error("Get my orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve orders."
        });

    }
}


// ============================================================
// GET SINGLE CUSTOMER ORDER
// ============================================================

async function getMyOrderById(req, res) {

    try {

        const { id } = req.params;

        const orderResult = await pool.query(`
            SELECT
                id,
                user_id,
                status,
                payment_status,
                payment_method,
                shipping_method,
                shipping_name,
                shipping_phone,
                shipping_address,
                subtotal,
                shipping_cost,
                discount_amount,
                total,
                coupon_code,
                created_at,
                updated_at
            FROM orders
            WHERE id = $1
              AND user_id = $2
        `, [
            id,
            req.user.userId
        ]);

        if (orderResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        const order = orderResult.rows[0];


        // ----------------------------------------------------
        // GET DELIVERY OTP
        // ----------------------------------------------------

        const otpResult = await pool.query(`
            SELECT
                otp_encrypted,
                expires_at,
                used_at
            FROM order_delivery_otps
            WHERE order_id = $1
        `, [id]);

        let deliveryOtp = null;
        let deliveryOtpExpiresAt = null;
        let deliveryOtpUsed = false;

        if (otpResult.rows.length > 0) {

            const otpRecord = otpResult.rows[0];

            deliveryOtpExpiresAt =
                otpRecord.expires_at;

            deliveryOtpUsed =
                Boolean(otpRecord.used_at);

            if (otpRecord.otp_encrypted) {

                try {

                    if (!process.env.DELIVERY_OTP_SECRET) {
                        throw new Error(
                            "DELIVERY_OTP_SECRET is not configured."
                        );
                    }

                    const encryptionKey = crypto
                        .createHash("sha256")
                        .update(
                            process.env.DELIVERY_OTP_SECRET
                        )
                        .digest();

                    const parts =
                        otpRecord.otp_encrypted.split(":");

                    if (parts.length !== 2) {
                        throw new Error(
                            "Invalid encrypted OTP format."
                        );
                    }

                    const ivHex = parts[0];
                    const encryptedHex = parts[1];

                    const decipher =
                        crypto.createDecipheriv(
                            "aes-256-cbc",
                            encryptionKey,
                            Buffer.from(ivHex, "hex")
                        );

                    deliveryOtp =
                        decipher.update(
                            encryptedHex,
                            "hex",
                            "utf8"
                        );

                    deliveryOtp +=
                        decipher.final("utf8");

                } catch (otpError) {

                    console.error(
                        "OTP decryption error:",
                        otpError
                    );

                    deliveryOtp = null;
                }
            }
        }


        // ----------------------------------------------------
        // GET ORDER ITEMS
        // ----------------------------------------------------

        const itemsResult = await pool.query(`
            SELECT
                id,
                product_id,
                product_name,
                product_sku,
                size,
                quantity,
                unit_price,
                sale_discount
            FROM order_items
            WHERE order_id = $1
            ORDER BY id ASC
        `, [id]);


        return res.json({

            success: true,

            order: {
                ...order,

                delivery_otp: deliveryOtp,

                delivery_otp_expires_at:
                    deliveryOtpExpiresAt,

                delivery_otp_used:
                    deliveryOtpUsed,

                items: itemsResult.rows
            }

        });

    } catch (error) {

        console.error(
            "Get order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve order."
        });

    }
}


// ============================================================
// GET ALL ORDERS - ADMIN
// ============================================================

async function getAllOrders(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                o.id,
                o.user_id,

                u.name AS customer_name,
                u.email AS customer_email,

                o.status,
                o.payment_status,
                o.payment_method,
                o.shipping_method,
                o.shipping_name,
                o.shipping_phone,
                o.shipping_address,
                o.subtotal,
                o.shipping_cost,
                o.discount_amount,
                o.total,
                o.coupon_code,
                o.created_at,
                o.updated_at,

                COUNT(oi.id)::integer AS item_count

            FROM orders o

            LEFT JOIN users u
                ON u.id = o.user_id

            LEFT JOIN order_items oi
                ON oi.order_id = o.id

            GROUP BY
                o.id,
                u.name,
                u.email

            ORDER BY o.created_at DESC
        `);

        return res.json({
            success: true,
            orders: result.rows
        });

    } catch (error) {

        console.error(
            "Admin get orders error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve orders."
        });

    }
}


// ============================================================
// GET SINGLE ORDER - ADMIN
// ============================================================

async function getAdminOrderById(req, res) {

    try {

        const { id } = req.params;

        const orderResult = await pool.query(`
            SELECT
                o.id,
                o.user_id,

                u.name AS customer_name,
                u.email AS customer_email,

                o.status,
                o.payment_status,
                o.payment_method,
                o.shipping_method,
                o.shipping_name,
                o.shipping_phone,
                o.shipping_address,
                o.subtotal,
                o.shipping_cost,
                o.discount_amount,
                o.total,
                o.coupon_code,
                o.created_at,
                o.updated_at

            FROM orders o

            LEFT JOIN users u
                ON u.id = o.user_id

            WHERE o.id = $1
        `, [id]);

        if (orderResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        const otpResult = await pool.query(`
            SELECT
                otp_encrypted,
                expires_at,
                used_at
            FROM order_delivery_otps
            WHERE order_id = $1
        `, [id]);

        const otpRecord = otpResult.rows[0] || null;
        const deliveryOtpUsed = Boolean(otpRecord?.used_at);
        const deliveryOtp = decryptDeliveryOtp(otpRecord?.otp_encrypted);

        const itemsResult = await pool.query(`
            SELECT
                id,
                product_id,
                product_name,
                product_sku,
                size,
                quantity,
                unit_price,
                sale_discount

            FROM order_items

            WHERE order_id = $1

            ORDER BY id ASC
        `, [id]);

        return res.json({

            success: true,

            order: {
                ...orderResult.rows[0],
                delivery_otp: deliveryOtp,
                delivery_otp_expires_at: otpRecord?.expires_at || null,
                delivery_otp_used: deliveryOtpUsed,
                items: itemsResult.rows
            }

        });

    } catch (error) {

        console.error(
            "Admin get order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve order."
        });

    }
}


// ============================================================
// UPDATE ORDER STATUS - ADMIN
// ============================================================

async function updateOrderStatus(req, res) {

    const client = await pool.connect();

    try {

        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "refunded"
        ];

        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({
                success: false,
                message: "Invalid order status."
            });

        }

        await client.query("BEGIN");

        const orderResult = await client.query(`
            SELECT
                id,
                status,
                payment_status

            FROM orders

            WHERE id = $1

            FOR UPDATE
        `, [id]);

        if (orderResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        const order = orderResult.rows[0];
        const oldStatus = order.status;

        if (oldStatus === status) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: `Order is already ${status}.`
            });

        }

        if (
            oldStatus === "delivered" ||
            oldStatus === "refunded" ||
            oldStatus === "cancelled"
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    `A ${oldStatus} order cannot be changed.`
            });

        }


        // ----------------------------------------------------
        // CANCEL ORDER - RESTORE INVENTORY
        // ----------------------------------------------------

        if (status === "cancelled") {

            const itemsResult = await client.query(`
                SELECT
                    product_id,
                    size,
                    quantity

                FROM order_items

                WHERE order_id = $1
            `, [id]);

            for (const item of itemsResult.rows) {

                if (
                    item.product_id !== null &&
                    item.size !== null
                ) {

                    await client.query(`
                        UPDATE inventory

                        SET quantity = quantity + $1

                        WHERE product_id = $2
                          AND size = $3
                    `, [
                        item.quantity,
                        item.product_id,
                        item.size
                    ]);

                }
            }
        }


        // ----------------------------------------------------
        // UPDATE STATUS
        // ----------------------------------------------------

        const updateResult = await client.query(`
            UPDATE orders

            SET
                status = $1,
                updated_at = NOW()

            WHERE id = $2

            RETURNING
                id,
                user_id,
                status,
                payment_status,
                subtotal,
                shipping_cost,
                discount_amount,
                total,
                coupon_code,
                created_at,
                updated_at
        `, [
            status,
            id
        ]);

        await client.query("COMMIT");

        return res.json({

            success: true,

            message:
                `Order status updated from ${oldStatus} to ${status}.`,

            order: updateResult.rows[0]

        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (_) {}

        console.error(
            "Update order status error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update order status."
        });

    } finally {

        client.release();

    }
}


// ============================================================
// VERIFY DELIVERY OTP
// ============================================================

async function verifyDeliveryOtp(req, res) {

    const client = await pool.connect();

    try {

        const { id } = req.params;
        const { otp } = req.body;


        // ----------------------------------------------------
        // VALIDATE OTP
        // ----------------------------------------------------

        if (
            !otp ||
            !/^\d{6}$/.test(String(otp))
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid 6-digit OTP is required."
            });

        }


        await client.query("BEGIN");


        // ----------------------------------------------------
        // LOCK ORDER
        // ----------------------------------------------------

        const orderResult = await client.query(`
            SELECT
                id,
                status,
                payment_method

            FROM orders

            WHERE id = $1

            FOR UPDATE
        `, [id]);

        if (orderResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found."
            });

        }

        const order = orderResult.rows[0];


        // ----------------------------------------------------
        // ALREADY DELIVERED
        // ----------------------------------------------------

        if (order.status === "delivered") {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Order has already been delivered."
            });

        }


        // ----------------------------------------------------
        // CANCELLED
        // ----------------------------------------------------

        if (order.status === "cancelled") {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Cancelled orders cannot be delivered."
            });

        }


        // ----------------------------------------------------
        // GET + LOCK OTP
        // ----------------------------------------------------

        const otpResult = await client.query(`
            SELECT
                id,
                otp_encrypted,
                expires_at,
                attempts,
                used_at

            FROM order_delivery_otps

            WHERE order_id = $1

            FOR UPDATE
        `, [id]);

        if (otpResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message:
                    "Delivery OTP not found."
            });

        }

        const otpRecord = otpResult.rows[0];


        // ----------------------------------------------------
        // OTP ALREADY USED
        // ----------------------------------------------------

        if (otpRecord.used_at) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "This delivery OTP has already been used."
            });

        }


        // ----------------------------------------------------
        // OTP EXPIRED
        // ----------------------------------------------------

        if (
            otpRecord.expires_at &&
            new Date(otpRecord.expires_at) < new Date()
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Delivery OTP has expired."
            });

        }


        // ----------------------------------------------------
        // MAX ATTEMPTS
        // ----------------------------------------------------

        if (Number(otpRecord.attempts) >= 5) {

            await client.query("ROLLBACK");

            return res.status(429).json({
                success: false,
                message:
                    "Too many incorrect OTP attempts."
            });

        }


        // ----------------------------------------------------
        // CHECK SECRET
        // ----------------------------------------------------

        if (!process.env.DELIVERY_OTP_SECRET) {

            await client.query("ROLLBACK");

            console.error(
                "DELIVERY_OTP_SECRET is not configured."
            );

            return res.status(500).json({
                success: false,
                message:
                    "Delivery OTP system is not configured."
            });

        }


        // ----------------------------------------------------
        // DECRYPT OTP
        // ----------------------------------------------------

        let decryptedOtp;

        try {

            if (!otpRecord.otp_encrypted) {
                throw new Error(
                    "Encrypted OTP is missing."
                );
            }

            const encryptionKey = crypto
                .createHash("sha256")
                .update(
                    process.env.DELIVERY_OTP_SECRET
                )
                .digest();

            const parts =
                otpRecord.otp_encrypted.split(":");

            if (parts.length !== 2) {
                throw new Error(
                    "Invalid encrypted OTP format."
                );
            }

            const ivHex = parts[0];
            const encryptedHex = parts[1];

            const decipher =
                crypto.createDecipheriv(
                    "aes-256-cbc",
                    encryptionKey,
                    Buffer.from(ivHex, "hex")
                );

            decryptedOtp =
                decipher.update(
                    encryptedHex,
                    "hex",
                    "utf8"
                );

            decryptedOtp +=
                decipher.final("utf8");

        } catch (decryptError) {

            await client.query("ROLLBACK");

            console.error(
                "OTP decryption error:",
                decryptError
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to process delivery OTP."
            });

        }


        // ----------------------------------------------------
        // CHECK OTP
        // ----------------------------------------------------

        if (
            String(otp) !==
            String(decryptedOtp)
        ) {

            await client.query(`
                UPDATE order_delivery_otps

                SET attempts = attempts + 1

                WHERE id = $1
            `, [otpRecord.id]);

            await client.query("COMMIT");

            return res.status(400).json({
                success: false,
                message:
                    "Incorrect delivery OTP."
            });

        }


        // ----------------------------------------------------
        // MARK OTP VERIFIED
        // ----------------------------------------------------

        await client.query(`
            UPDATE order_delivery_otps

            SET used_at = NOW()

            WHERE id = $1
        `, [otpRecord.id]);

        // OTP verification is intentionally a separate step from
        // final delivery confirmation. The delivery agent must
        // confirm that the COD amount was received before the order
        // becomes delivered/paid.
        const verifiedOrder = await client.query(`
            SELECT
                id,
                status,
                payment_status,
                payment_method,
                total,
                updated_at
            FROM orders
            WHERE id = $1
        `, [id]);

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Delivery OTP verified. Confirm or cancel the delivery.",
            order: verifiedOrder.rows[0]
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (_) {}

        console.error(
            "Verify delivery OTP error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to verify delivery OTP."
        });

    } finally {

        client.release();

    }
}


// ============================================================
// CONFIRM DELIVERY AFTER OTP VERIFICATION
// ============================================================

async function confirmDelivery(req, res) {

    const client = await pool.connect();

    try {

        const { id } = req.params;

        await client.query("BEGIN");

        const orderResult = await client.query(`
            SELECT
                id,
                status,
                payment_status,
                payment_method,
                total
            FROM orders
            WHERE id = $1
            FOR UPDATE
        `, [id]);

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const order = orderResult.rows[0];

        if (order.status === "delivered") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Order has already been delivered." });
        }

        if (order.status === "cancelled") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Cancelled orders cannot be delivered." });
        }

        const otpResult = await client.query(`
            SELECT used_at
            FROM order_delivery_otps
            WHERE order_id = $1
            FOR UPDATE
        `, [id]);

        if (otpResult.rows.length === 0 || !otpResult.rows[0].used_at) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Verify the delivery OTP before confirming delivery."
            });
        }

        const updatedOrder = await client.query(`
            UPDATE orders
            SET
                status = 'delivered',
                payment_status = CASE
                    WHEN payment_method = 'cod' THEN 'paid'
                    ELSE payment_status
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                status,
                payment_status,
                payment_method,
                total,
                updated_at
        `, [id]);

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Delivery confirmed. Order marked as delivered.",
            order: updatedOrder.rows[0]
        });

    } catch (error) {

        try { await client.query("ROLLBACK"); } catch (_) {}

        console.error("Confirm delivery error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to confirm delivery."
        });

    } finally {
        client.release();
    }
}


// ============================================================
// CANCEL DELIVERY AFTER OTP VERIFICATION
// ============================================================

async function cancelDelivery(req, res) {

    const client = await pool.connect();

    try {

        const { id } = req.params;

        await client.query("BEGIN");

        const orderResult = await client.query(`
            SELECT
                id,
                status,
                payment_status,
                payment_method,
                total
            FROM orders
            WHERE id = $1
            FOR UPDATE
        `, [id]);

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const order = orderResult.rows[0];

        if (order.status === "delivered") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Delivered orders cannot be cancelled from the delivery flow." });
        }

        if (order.status === "cancelled") {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Order is already cancelled." });
        }

        const otpResult = await client.query(`
            SELECT used_at
            FROM order_delivery_otps
            WHERE order_id = $1
            FOR UPDATE
        `, [id]);

        if (otpResult.rows.length === 0 || !otpResult.rows[0].used_at) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Verify the delivery OTP before cancelling this delivery."
            });
        }

        const updatedOrder = await client.query(`
            UPDATE orders
            SET
                status = 'cancelled',
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                status,
                payment_status,
                payment_method,
                total,
                updated_at
        `, [id]);

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Delivery cancelled. Order remains unpaid.",
            order: updatedOrder.rows[0]
        });

    } catch (error) {

        try { await client.query("ROLLBACK"); } catch (_) {}

        console.error("Cancel delivery error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to cancel delivery."
        });

    } finally {
        client.release();
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getMyOrders,
    getMyOrderById,
    getAllOrders,
    getAdminOrderById,
    updateOrderStatus,
    verifyDeliveryOtp,
    confirmDelivery,
    cancelDelivery
};
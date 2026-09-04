const crypto = require("crypto");
const pool = require("../db/pool");


// ============================================================
// CHECKOUT
// ============================================================

async function checkout(req, res) {

    const client = await pool.connect();

    try {

        const {
            address_id = null,
            shipping_name,
            shipping_phone,
            shipping_address,
            shipping_method = "standard",
            payment_method = "cod",
            coupon_code = null
        } = req.body;

        let normalizedShippingName = String(shipping_name || "").trim();
        let normalizedShippingPhone = String(shipping_phone || "").trim();
        let normalizedShippingAddress = String(shipping_address || "").trim();


        // ----------------------------------------------------
        // VALIDATION
        // ----------------------------------------------------

        if (
            (!address_id && (!normalizedShippingName || !normalizedShippingPhone || !normalizedShippingAddress))
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Shipping name, phone and address are required."
            });

        }


        if (!["standard", "express"].includes(shipping_method)) {
            return res.status(400).json({
                success: false,
                message: "Invalid shipping method."
            });
        }

        if (payment_method !== "cod") {
            return res.status(400).json({
                success: false,
                message: "Only Cash on Delivery is currently available."
            });
        }

        if (!process.env.DELIVERY_OTP_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Checkout is not configured correctly."
            });
        }

        // ----------------------------------------------------
        // START TRANSACTION
        // ----------------------------------------------------

        await client.query("BEGIN");

        // If a saved address was selected, resolve it server-side and
        // verify ownership. The order stores a snapshot of the address.
        if (address_id != null && String(address_id).trim() !== "") {
            const parsedAddressId = Number(address_id);
            if (!Number.isInteger(parsedAddressId) || parsedAddressId <= 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "Invalid address ID."
                });
            }

            const addressResult = await client.query(
                `SELECT full_name, phone, address_line_1, address_line_2,
                        city, state, postal_code, country
                 FROM addresses
                 WHERE id = $1 AND user_id = $2`,
                [parsedAddressId, req.user.userId]
            );

            if (!addressResult.rows.length) {
                await client.query("ROLLBACK");
                return res.status(404).json({
                    success: false,
                    message: "Selected address was not found."
                });
            }

            const savedAddress = addressResult.rows[0];
            normalizedShippingName = String(savedAddress.full_name).trim();
            normalizedShippingPhone = String(savedAddress.phone).trim();
            normalizedShippingAddress = [
                savedAddress.address_line_1,
                savedAddress.address_line_2,
                savedAddress.city,
                savedAddress.state,
                savedAddress.postal_code,
                savedAddress.country
            ].filter(Boolean).join(", ");
        }

        if (!normalizedShippingName || !normalizedShippingPhone || !normalizedShippingAddress) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "A valid shipping address is required."
            });
        }


        // ----------------------------------------------------
        // GET CART
        // ----------------------------------------------------

        const cartResult = await client.query(`
            SELECT
                ci.id,
                ci.product_id,
                ci.size,
                ci.quantity,

                p.name,
                p.sku,
                p.price,
                p.is_active

            FROM cart_items ci

            INNER JOIN products p
                ON p.id = ci.product_id

            WHERE ci.user_id = $1

            ORDER BY ci.id

            FOR UPDATE OF ci, p
        `, [
            req.user.userId
        ]);


        if (cartResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });

        }

        // ----------------------------------------------------
        // VARIABLES
        // ----------------------------------------------------

        let subtotal = 0;

        const orderItems = [];


        // ====================================================
        // PROCESS CART ITEMS
        // ====================================================

        for (const item of cartResult.rows) {


            // ------------------------------------------------
            // PRODUCT ACTIVE CHECK
            // ------------------------------------------------

            if (!item.is_active) {

                throw new Error(
                    `Product "${item.name}" is no longer available.`
                );

            }


            // ------------------------------------------------
            // INVENTORY CHECK
            // ------------------------------------------------

            if (item.size !== null) {

                const inventoryResult =
                    await client.query(`
                        SELECT
                            id,
                            size,
                            quantity

                        FROM inventory

                        WHERE product_id = $1
                          AND size = $2

                        FOR UPDATE
                    `, [
                        item.product_id,
                        item.size
                    ]);


                if (inventoryResult.rows.length === 0) {

                    throw new Error(
                        `Size ${item.size} is no longer available for "${item.name}".`
                    );

                }


                const availableStock =
                    Number(
                        inventoryResult.rows[0].quantity
                    );


                if (item.quantity > availableStock) {

                    throw new Error(
                        `Only ${availableStock} item(s) available for "${item.name}" size ${item.size}.`
                    );

                }

            }


            // =================================================
            // FIND BEST ACTIVE SALE
            // =================================================

            const saleResult = await client.query(`

                SELECT

                    s.id,
                    s.name,
                    s.discount_percent,
                    s.scope

                FROM sales s

                LEFT JOIN products p
                    ON p.id = $1

                LEFT JOIN sale_products sp
                    ON sp.sale_id = s.id
                    AND sp.product_id = $1

                WHERE

                    s.active = TRUE

                    AND NOW() >= s.starts_at

                    AND NOW() <= s.ends_at

                    AND (

                        s.scope = 'sitewide'

                        OR (

                            s.scope = 'category'

                            AND s.category_id =
                                p.category_id

                        )

                        OR (

                            s.scope = 'products'

                            AND sp.product_id IS NOT NULL

                        )

                    )

                ORDER BY
                    s.discount_percent DESC

                LIMIT 1

            `, [
                item.product_id
            ]);


            const sale =
                saleResult.rows[0] || null;


            // =================================================
            // CALCULATE SALE PRICE
            // =================================================

            const originalUnitPrice =
                Number(item.price);


            let unitPrice =
                originalUnitPrice;


            let saleDiscount =
                0;


            if (sale) {

                const discountPercent =
                    Number(
                        sale.discount_percent
                    );


                saleDiscount =
                    Math.round(

                        originalUnitPrice *
                        discountPercent /
                        100 *
                        100

                    ) / 100;


                unitPrice =
                    Math.round(

                        (
                            originalUnitPrice -
                            saleDiscount
                        ) * 100

                    ) / 100;

            }


            // ------------------------------------------------
            // ITEM SUBTOTAL
            // ------------------------------------------------

            const itemSubtotal =
                Math.round(
                    unitPrice *
                    Number(item.quantity) *
                    100
                ) / 100;


            subtotal += itemSubtotal;


            // ------------------------------------------------
            // STORE ORDER ITEM
            // ------------------------------------------------

            orderItems.push({

                product_id:
                    item.product_id,

                product_name:
                    item.name,

                product_sku:
                    item.sku,

                size:
                    item.size,

                quantity:
                    Number(item.quantity),

                // Actual price customer pays
                unit_price:
                    unitPrice,

                // Per-unit sale discount
                sale_discount:
                    saleDiscount

            });

        }


        // ====================================================
        // ROUND SUBTOTAL
        // ====================================================

        subtotal =
            Math.round(
                subtotal * 100
            ) / 100;


        // ====================================================
        // COUPON
        // ====================================================

        let discountAmount =
            0;


        let appliedCouponCode =
            null;


        if (coupon_code) {


            const normalizedCode =
                String(coupon_code)
                    .trim()
                    .toUpperCase();


            // ------------------------------------------------
            // LOCK COUPON ROW
            // ------------------------------------------------

            const couponResult =
                await client.query(`

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

                    FOR UPDATE

                `, [
                    normalizedCode
                ]);


            if (couponResult.rows.length === 0) {

                throw new Error(
                    "Invalid coupon code."
                );

            }


            const coupon =
                couponResult.rows[0];


            // ------------------------------------------------
            // ACTIVE
            // ------------------------------------------------

            if (!coupon.active) {

                throw new Error(
                    "This coupon is inactive."
                );

            }


            // ------------------------------------------------
            // DATE VALIDATION
            // ------------------------------------------------

            const now =
                new Date();


            if (
                coupon.starts_at &&
                now <
                new Date(coupon.starts_at)
            ) {

                throw new Error(
                    "This coupon is not active yet."
                );

            }


            if (
                coupon.expires_at &&
                now >
                new Date(coupon.expires_at)
            ) {

                throw new Error(
                    "This coupon has expired."
                );

            }


            // ------------------------------------------------
            // USAGE LIMIT
            // ------------------------------------------------

            if (

                coupon.usage_limit !== null &&

                Number(coupon.usage_count) >=
                Number(coupon.usage_limit)

            ) {

                throw new Error(
                    "This coupon has reached its usage limit."
                );

            }


            // ------------------------------------------------
            // MINIMUM ORDER
            // ------------------------------------------------

            if (
                subtotal <
                Number(coupon.minimum_order)
            ) {

                throw new Error(
                    `Minimum order value is ₹${coupon.minimum_order}.`
                );

            }


            // ------------------------------------------------
            // CALCULATE COUPON DISCOUNT
            // ------------------------------------------------

            if (
                coupon.discount_type ===
                "percentage"
            ) {

                discountAmount =

                    subtotal *
                    Number(coupon.discount_value) /
                    100;

            }

            else {

                discountAmount =
                    Number(
                        coupon.discount_value
                    );

            }


            // ------------------------------------------------
            // MAXIMUM DISCOUNT
            // ------------------------------------------------

            if (

                coupon.maximum_discount !== null &&

                discountAmount >
                Number(coupon.maximum_discount)

            ) {

                discountAmount =
                    Number(
                        coupon.maximum_discount
                    );

            }


            // Never discount more than subtotal

            discountAmount =
                Math.min(
                    discountAmount,
                    subtotal
                );


            // Round

            discountAmount =
                Math.round(
                    discountAmount * 100
                ) / 100;


            appliedCouponCode =
                coupon.code;


            // ------------------------------------------------
            // INCREMENT USAGE
            // ------------------------------------------------

            await client.query(`

                UPDATE coupons

                SET usage_count =
                    usage_count + 1

                WHERE id = $1

            `, [
                coupon.id
            ]);

        }


        // ====================================================
        // SHIPPING
        // ====================================================

        const amountAfterDiscount =
            Math.max(
                subtotal -
                discountAmount,
                0
            );


        const shippingCost =
            shipping_method === "express"
                ? 199
                : amountAfterDiscount >= 2000
                    ? 0
                    : 99;


        // ====================================================
        // FINAL TOTAL
        // ====================================================

        const total =
            Math.round(

                (
                    subtotal +
                    shippingCost -
                    discountAmount

                ) * 100

            ) / 100;


        // ====================================================
        // CREATE ORDER
        // ====================================================

        const orderResult =
            await client.query(`

                INSERT INTO orders
                (

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

                    coupon_code

                )

                VALUES
                (

                    $1,

                    'pending',

                    'pending',

                    $2,

                    $3,

                    $4,

                    $5,

                    $6,

                    $7,

                    $8,

                    $9,

                    $10,

                    $11

                )

                RETURNING

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

                    created_at

            `, [

                req.user.userId,

                payment_method,

                shipping_method,

                normalizedShippingName,

                normalizedShippingPhone,

                normalizedShippingAddress,

                subtotal,

                shippingCost,

                discountAmount,

                total,

                appliedCouponCode

            ]);


        const order =
            orderResult.rows[0];
	// ====================================================
// GENERATE + ENCRYPT DELIVERY OTP
// ====================================================

const deliveryOtp =
    crypto.randomInt(100000, 1000000).toString();

const encryptionKey = crypto
    .createHash("sha256")
    .update(process.env.DELIVERY_OTP_SECRET)
    .digest();

const iv = crypto.randomBytes(16);

const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    encryptionKey,
    iv
);

let encryptedOtp = cipher.update(
    deliveryOtp,
    "utf8",
    "hex"
);

encryptedOtp += cipher.final("hex");

const otpEncrypted =
    iv.toString("hex") + ":" + encryptedOtp;

await client.query(`
    INSERT INTO order_delivery_otps
    (
        order_id,
        otp_encrypted,
        expires_at
    )
    VALUES
    (
        $1,
        $2,
        NOW() + INTERVAL '30 days'
    )
`, [
    order.id,
    otpEncrypted
]);
        // ====================================================
        // CREATE ORDER ITEMS + UPDATE INVENTORY
        // ====================================================

        for (const item of orderItems) {


            // ------------------------------------------------
            // ORDER ITEM
            // ------------------------------------------------

            await client.query(`

                INSERT INTO order_items
                (

                    order_id,

                    product_id,

                    product_name,

                    product_sku,

                    size,

                    quantity,

                    unit_price,

                    sale_discount

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

                    $8

                )

            `, [

                order.id,

                item.product_id,

                item.product_name,

                item.product_sku,

                item.size,

                item.quantity,

                item.unit_price,

                item.sale_discount

            ]);


            // ------------------------------------------------
            // INVENTORY
            // ------------------------------------------------

            if (item.size !== null) {

                const stockUpdate =
                    await client.query(`

                        UPDATE inventory

                        SET quantity =
                            quantity - $1

                        WHERE product_id = $2

                          AND size = $3

                          AND quantity >= $1

                        RETURNING
                            id,
                            quantity

                    `, [

                        item.quantity,

                        item.product_id,

                        item.size

                    ]);


                if (
                    stockUpdate.rows.length === 0
                ) {

                    throw new Error(
                        `Unable to update inventory for "${item.product_name}".`
                    );

                }

            }

        }


        // ====================================================
        // CLEAR CART
        // ====================================================

        await client.query(`

            DELETE FROM cart_items

            WHERE user_id = $1

        `, [
            req.user.userId
        ]);


        // ====================================================
        // COMMIT
        // ====================================================

        await client.query(
            "COMMIT"
        );


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.status(201).json({

            success: true,

            message:
                "Order created successfully.",

            order: {

                id:
                    order.id,
		delivery_otp: deliveryOtp,
                status:
                    order.status,

                payment_status:
                    order.payment_status,

                subtotal:
                    order.subtotal,

                shipping_cost:
                    order.shipping_cost,

                discount_amount:
                    order.discount_amount,

                total:
                    order.total,

                coupon_code:
                    order.coupon_code,

                shipping_name:
                    order.shipping_name,

                shipping_phone:
                    order.shipping_phone,

                shipping_address:
                    order.shipping_address,

                created_at:
                    order.created_at

            }

        });


    } catch (error) {


        // ====================================================
        // ROLLBACK
        // ====================================================

        try {
            await client.query(
                "ROLLBACK"
            );
        } catch (rollbackError) {
            console.error(
                "Rollback error:",
                rollbackError
            );
        }


        console.error(
            "Checkout error:",
            error
        );


        return res.status(400).json({

            success: false,

            message:
                error.message ||
                "Unable to complete checkout."

        });


    } finally {

        client.release();

    }

}


module.exports = {
    checkout
};
// ============================================================
// 4BITTERZS - Customer Controller
// ============================================================

const pool = require("../db/pool");


// ============================================================
// GET CUSTOMERS - ADMIN
// ============================================================

async function getCustomers(req, res) {

    try {

        const search = String(
            req.query.search || ""
        ).trim();

        const page = Math.max(
            parseInt(req.query.page, 10) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                parseInt(req.query.limit, 10) || 20,
                1
            ),
            100
        );

        const offset = (page - 1) * limit;


        // ----------------------------------------------------
        // SEARCH CONDITION
        // ----------------------------------------------------

        const searchParams = [];
        let searchCondition = "";

        if (search) {

            searchParams.push(`%${search}%`);

            searchCondition = `
                AND (
                    u.name ILIKE $1
                    OR u.email ILIKE $1
                    OR EXISTS (
                        SELECT 1
                        FROM orders phone_orders
                        WHERE phone_orders.user_id = u.id
                          AND phone_orders.shipping_phone ILIKE $1
                    )
                )
            `;
        }


        // ----------------------------------------------------
        // TOTAL CUSTOMERS
        // ----------------------------------------------------

        const countResult = await pool.query(`
            SELECT COUNT(*)::integer AS total
            FROM users u
            WHERE u.role = 'customer'
            ${searchCondition}
        `, searchParams);

        const total = countResult.rows[0].total;


        // ----------------------------------------------------
        // CUSTOMER DATA
        // ----------------------------------------------------

        const dataParams = [...searchParams];

        dataParams.push(limit);
        const limitParam = `$${dataParams.length}`;

        dataParams.push(offset);
        const offsetParam = `$${dataParams.length}`;


        const result = await pool.query(`
            SELECT

                u.id,
                u.name,
                u.email,
                u.created_at,
                u.updated_at,

                COUNT(DISTINCT o.id)::integer
                    AS order_count,

                COALESCE(
                    SUM(
                        CASE
                            WHEN o.payment_status = 'paid'
                            THEN o.total
                            ELSE 0
                        END
                    ),
                    0
                )::numeric(12,2)
                    AS total_spent,

                MAX(o.created_at)
                    AS last_order_at,

                (
                    SELECT
                        o2.shipping_phone

                    FROM orders o2

                    WHERE o2.user_id = u.id
                      AND o2.shipping_phone IS NOT NULL

                    ORDER BY o2.created_at DESC

                    LIMIT 1
                ) AS phone

            FROM users u

            LEFT JOIN orders o
                ON o.user_id = u.id

            WHERE u.role = 'customer'

            ${searchCondition}

            GROUP BY
                u.id,
                u.name,
                u.email,
                u.created_at,
                u.updated_at

            ORDER BY
                u.created_at DESC

            LIMIT ${limitParam}
            OFFSET ${offsetParam}
        `, dataParams);


        const totalPages =
            Math.ceil(total / limit);


        return res.json({

            success: true,

            customers: result.rows,

            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages
            }

        });


    } catch (error) {

        console.error(
            "Get customers error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve customers."
        });

    }

}


// ============================================================
// GET SINGLE CUSTOMER - ADMIN
// ============================================================

async function getCustomerById(req, res) {

    try {

        const { id } = req.params;


        const customerResult = await pool.query(`
            SELECT
                u.id,
                u.name,
                u.email,
                u.created_at,
                u.updated_at,

                COUNT(DISTINCT o.id)::integer
                    AS order_count,

                COALESCE(
                    SUM(
                        CASE
                            WHEN o.payment_status = 'paid'
                            THEN o.total
                            ELSE 0
                        END
                    ),
                    0
                )::numeric(12,2)
                    AS total_spent,

                MAX(o.created_at)
                    AS last_order_at,

                (
                    SELECT
                        o2.shipping_phone

                    FROM orders o2

                    WHERE o2.user_id = u.id
                      AND o2.shipping_phone IS NOT NULL

                    ORDER BY o2.created_at DESC

                    LIMIT 1
                ) AS phone

            FROM users u

            LEFT JOIN orders o
                ON o.user_id = u.id

            WHERE u.id = $1
              AND u.role = 'customer'

            GROUP BY
                u.id,
                u.name,
                u.email,
                u.created_at,
                u.updated_at
        `, [id]);


        if (customerResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });

        }


        // ----------------------------------------------------
        // CUSTOMER ORDERS
        // ----------------------------------------------------

        const ordersResult = await pool.query(`
            SELECT
                id,
                status,
                payment_status,
                payment_method,
                shipping_method,
                subtotal,
                shipping_cost,
                discount_amount,
                total,
                coupon_code,
                created_at

            FROM orders

            WHERE user_id = $1

            ORDER BY created_at DESC
        `, [id]);


        return res.json({

            success: true,

            customer: {
                ...customerResult.rows[0],

                orders: ordersResult.rows

            }

        });


    } catch (error) {

        console.error(
            "Get customer error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve customer."
        });

    }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getCustomers,
    getCustomerById
};
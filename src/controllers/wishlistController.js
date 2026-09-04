// ============================================================
// 4BITTERZS - Wishlist Controller
// ============================================================

const pool = require("../db/pool");


// ------------------------------------------------------------
// GET CURRENT USER WISHLIST
// ------------------------------------------------------------

async function getWishlist(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                w.user_id,
                w.product_id,
                w.created_at,

                p.name,
                p.slug,
                p.price,
                p.sku,

                c.id AS category_id,
                c.name AS category_name,
                c.slug AS category_slug,

                (
                    SELECT pi.image_url
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY pi.sort_order ASC, pi.id ASC
                    LIMIT 1
                ) AS image_url

            FROM wishlist_items w

            INNER JOIN products p
                ON p.id = w.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            WHERE w.user_id = $1

            ORDER BY w.created_at DESC
        `, [req.user.userId]);


        const wishlist = result.rows.map(item => ({

            user_id: item.user_id,

            product_id: item.product_id,

            created_at: item.created_at,

            product: {
                id: item.product_id,
                name: item.name,
                slug: item.slug,
                price: item.price,
                sku: item.sku,

                category: item.category_id
                    ? {
                        id: item.category_id,
                        name: item.category_name,
                        slug: item.category_slug
                    }
                    : null,

                image_url: item.image_url
            }

        }));


        return res.json({
            success: true,
            wishlist
        });

    } catch (error) {

        console.error("Get wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve wishlist."
        });

    }

}


// ------------------------------------------------------------
// ADD PRODUCT TO WISHLIST
// ------------------------------------------------------------

async function addToWishlist(req, res) {

    try {

        const { productId } = req.params;


        // ----------------------------------------------------
        // Make sure product exists and is active.
        // ----------------------------------------------------

        const product = await pool.query(`
            SELECT
                id,
                name

            FROM products

            WHERE id = $1
              AND is_active = TRUE
        `, [productId]);


        if (product.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }


        // ----------------------------------------------------
        // Add wishlist item.
        //
        // The table uses:
        // PRIMARY KEY (user_id, product_id)
        //
        // Therefore duplicates are prevented automatically.
        // ----------------------------------------------------

        const result = await pool.query(`
            INSERT INTO wishlist_items
                (user_id, product_id)

            VALUES
                ($1, $2)

            ON CONFLICT (user_id, product_id)
            DO NOTHING

            RETURNING
                user_id,
                product_id,
                created_at
        `, [
            req.user.userId,
            productId
        ]);


        // ----------------------------------------------------
        // Already existed
        // ----------------------------------------------------

        if (result.rows.length === 0) {

            return res.json({

                success: true,

                message: "Product is already in your wishlist.",

                already_exists: true

            });

        }


        return res.status(201).json({

            success: true,

            message: "Product added to wishlist.",

            already_exists: false,

            item: result.rows[0]

        });

    } catch (error) {

        console.error("Add wishlist error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to add product to wishlist."

        });

    }

}


// ------------------------------------------------------------
// REMOVE PRODUCT FROM WISHLIST
// ------------------------------------------------------------

async function removeFromWishlist(req, res) {

    try {

        const { productId } = req.params;


        const result = await pool.query(`
            DELETE FROM wishlist_items

            WHERE user_id = $1
              AND product_id = $2

            RETURNING
                user_id,
                product_id
        `, [
            req.user.userId,
            productId
        ]);


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Product is not in your wishlist."

            });

        }


        return res.json({

            success: true,

            message: "Product removed from wishlist."

        });

    } catch (error) {

        console.error("Remove wishlist error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to remove product from wishlist."

        });

    }

}


module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};
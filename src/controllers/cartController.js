// ============================================================
// 4BITTERZS - Cart Controller
// ============================================================

const pool = require("../db/pool");


// ------------------------------------------------------------
// GET CURRENT USER CART
// ------------------------------------------------------------

async function getCart(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                ci.id,
                ci.user_id,
                ci.product_id,
                ci.size,
                ci.quantity,
                ci.created_at,

                p.name,
                p.slug,
                p.description,
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
                ) AS image_url,

                COALESCE(
                    (
                        SELECT i.quantity
                        FROM inventory i
                        WHERE i.product_id = p.id
                          AND i.size = ci.size
                    ),
                    0
                ) AS available_stock

            FROM cart_items ci

            INNER JOIN products p
                ON p.id = ci.product_id

            LEFT JOIN categories c
                ON c.id = p.category_id

            WHERE ci.user_id = $1

            ORDER BY ci.created_at DESC
        `, [req.user.userId]);


        const items = result.rows.map(item => ({

            id: item.id,

            product_id: item.product_id,

            size: item.size,

            quantity: item.quantity,

            available_stock: Number(item.available_stock),

            product: {
                id: item.product_id,
                name: item.name,
                slug: item.slug,
                description: item.description,
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
            items
        });

    } catch (error) {

        console.error("Get cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve cart."
        });

    }

}


// ------------------------------------------------------------
// ADD PRODUCT TO CART
// ------------------------------------------------------------

async function addToCart(req, res) {

    try {

        const { productId } = req.params;

        const {
            size = null,
            quantity = 1
        } = req.body;


        const numericQuantity = Number(quantity);


        // ----------------------------------------------------
        // Validate quantity
        // ----------------------------------------------------

        if (
            !Number.isInteger(numericQuantity) ||
            numericQuantity <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive integer."
            });

        }


        // ----------------------------------------------------
        // Get active product
        // ----------------------------------------------------

        const productResult = await pool.query(`
            SELECT
                id,
                name,
                price
            FROM products
            WHERE id = $1
              AND is_active = TRUE
        `, [productId]);


        if (productResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }


        // ----------------------------------------------------
        // Check inventory
        //
        // If product has inventory entries, a size is required.
        // ----------------------------------------------------

        const inventoryResult = await pool.query(`
            SELECT
                id,
                size,
                quantity
            FROM inventory
            WHERE product_id = $1
            ORDER BY size ASC
        `, [productId]);


        if (inventoryResult.rows.length > 0) {

            if (!size) {

                return res.status(400).json({
                    success: false,
                    message: "Please select a size."
                });

            }


            const selectedInventory =
                inventoryResult.rows.find(
                    item => item.size === String(size).trim()
                );


            if (!selectedInventory) {

                return res.status(400).json({
                    success: false,
                    message: "Selected size is not available."
                });

            }


            // ------------------------------------------------
            // Check existing cart quantity too.
            // ------------------------------------------------

            const existingCart = await pool.query(`
                SELECT quantity
                FROM cart_items

                WHERE user_id = $1
                  AND product_id = $2
                  AND size = $3
            `, [
                req.user.userId,
                productId,
                String(size).trim()
            ]);


            const existingQuantity =
                existingCart.rows.length > 0
                    ? existingCart.rows[0].quantity
                    : 0;


            const newQuantity =
                existingQuantity + numericQuantity;


            if (newQuantity > selectedInventory.quantity) {

                return res.status(400).json({
                    success: false,
                    message: `Only ${selectedInventory.quantity} item(s) available for size ${selectedInventory.size}.`,
                    available_stock: selectedInventory.quantity,
                    requested_quantity: newQuantity
                });

            }

        }


        // ----------------------------------------------------
        // Insert / increase existing cart item
        // ----------------------------------------------------

        const normalizedSize =
            size === null
                ? null
                : String(size).trim();


        const result = await pool.query(`
            INSERT INTO cart_items
                (
                    user_id,
                    product_id,
                    size,
                    quantity
                )

            VALUES
                ($1, $2, $3, $4)

            ON CONFLICT (user_id, product_id, size)

            DO UPDATE SET
                quantity = cart_items.quantity + EXCLUDED.quantity

            RETURNING
                id,
                user_id,
                product_id,
                size,
                quantity,
                created_at
        `, [
            req.user.userId,
            productId,
            normalizedSize,
            numericQuantity
        ]);


        return res.status(201).json({

            success: true,

            message: "Product added to cart.",

            item: result.rows[0]

        });

    } catch (error) {

        console.error("Add cart error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to add product to cart."

        });

    }

}


// ------------------------------------------------------------
// UPDATE CART ITEM QUANTITY
// ------------------------------------------------------------

async function updateCartItem(req, res) {

    try {

        const { itemId } = req.params;

        const { quantity } = req.body;


        const numericQuantity = Number(quantity);


        if (
            !Number.isInteger(numericQuantity) ||
            numericQuantity <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive integer."
            });

        }


        // ----------------------------------------------------
        // Get cart item + stock
        // ----------------------------------------------------

        const itemResult = await pool.query(`
            SELECT
                ci.id,
                ci.product_id,
                ci.size,

                COALESCE(
                    (
                        SELECT i.quantity
                        FROM inventory i
                        WHERE i.product_id = ci.product_id
                          AND i.size = ci.size
                    ),
                    0
                ) AS available_stock

            FROM cart_items ci

            INNER JOIN products p
                ON p.id = ci.product_id

            WHERE ci.id = $1
              AND ci.user_id = $2
              AND p.is_active = TRUE
        `, [
            itemId,
            req.user.userId
        ]);


        if (itemResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });

        }


        const item = itemResult.rows[0];

        const availableStock =
            Number(item.available_stock);


        if (
            item.size !== null &&
            numericQuantity > availableStock
        ) {

            return res.status(400).json({
                success: false,
                message: `Only ${availableStock} item(s) are available.`,
                available_stock: availableStock
            });

        }


        const result = await pool.query(`
            UPDATE cart_items

            SET quantity = $1

            WHERE id = $2
              AND user_id = $3

            RETURNING
                id,
                user_id,
                product_id,
                size,
                quantity,
                created_at
        `, [
            numericQuantity,
            itemId,
            req.user.userId
        ]);


        return res.json({

            success: true,

            message: "Cart item updated successfully.",

            item: result.rows[0]

        });

    } catch (error) {

        console.error("Update cart error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to update cart item."

        });

    }

}


// ------------------------------------------------------------
// REMOVE CART ITEM
// ------------------------------------------------------------

async function removeCartItem(req, res) {

    try {

        const { itemId } = req.params;


        const result = await pool.query(`
            DELETE FROM cart_items

            WHERE id = $1
              AND user_id = $2

            RETURNING id
        `, [
            itemId,
            req.user.userId
        ]);


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });

        }


        return res.json({

            success: true,

            message: "Cart item removed successfully."

        });

    } catch (error) {

        console.error("Remove cart error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to remove cart item."

        });

    }

}


// ------------------------------------------------------------
// CLEAR CART
// ------------------------------------------------------------

async function clearCart(req, res) {

    try {

        await pool.query(`
            DELETE FROM cart_items
            WHERE user_id = $1
        `, [req.user.userId]);


        return res.json({

            success: true,

            message: "Cart cleared successfully."

        });

    } catch (error) {

        console.error("Clear cart error:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to clear cart."

        });

    }

}


module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart
};
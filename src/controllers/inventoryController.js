// ============================================================
// 4BITTERZS - Inventory Controller
// ============================================================

const pool = require("../db/pool");


// ------------------------------------------------------------
// GET PRODUCT INVENTORY
// Public
// ------------------------------------------------------------

async function getInventory(req, res) {

    try {

        const { productId } = req.params;

        const product = await pool.query(
            "SELECT id FROM products WHERE id = $1 AND is_active = TRUE",
            [productId]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }


        const result = await pool.query(`
            SELECT
                id,
                size,
                quantity
            FROM inventory
            WHERE product_id = $1
            ORDER BY size ASC
        `, [productId]);


        return res.json({
            success: true,
            inventory: result.rows
        });

    } catch (error) {

        console.error("Get inventory error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve inventory."
        });

    }

}


// ------------------------------------------------------------
// SET / UPDATE INVENTORY
// Admin only
//
// Example body:
// {
//     "size": "8",
//     "quantity": 10
// }
// ------------------------------------------------------------

async function setInventory(req, res) {

    try {

        const { productId } = req.params;
        const { size, quantity } = req.body;


        if (!size || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "Size and quantity are required."
            });
        }


        const numericQuantity = Number(quantity);


        if (
            !Number.isInteger(numericQuantity) ||
            numericQuantity < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a non-negative integer."
            });
        }


        // Make sure product exists.
        const product = await pool.query(
            "SELECT id FROM products WHERE id = $1",
            [productId]
        );


        if (product.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }


        // Insert the size or update it if it already exists.
        const result = await pool.query(`
            INSERT INTO inventory
                (product_id, size, quantity)

            VALUES
                ($1, $2, $3)

            ON CONFLICT (product_id, size)

            DO UPDATE SET
                quantity = EXCLUDED.quantity

            RETURNING
                id,
                product_id,
                size,
                quantity
        `, [
            productId,
            String(size).trim(),
            numericQuantity
        ]);


        return res.json({
            success: true,
            message: "Inventory updated successfully.",
            inventory: result.rows[0]
        });

    } catch (error) {

        console.error("Set inventory error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update inventory."
        });

    }

}


// ------------------------------------------------------------
// REMOVE SIZE
// Admin only
// ------------------------------------------------------------

async function deleteInventory(req, res) {

    try {

        const {
            productId,
            inventoryId
        } = req.params;


        const result = await pool.query(`
            DELETE FROM inventory

            WHERE id = $1
              AND product_id = $2

            RETURNING id
        `, [
            inventoryId,
            productId
        ]);


        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Inventory entry not found."
            });
        }


        return res.json({
            success: true,
            message: "Inventory entry removed successfully."
        });

    } catch (error) {

        console.error("Delete inventory error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove inventory entry."
        });

    }

}


module.exports = {
    getInventory,
    setInventory,
    deleteInventory
};
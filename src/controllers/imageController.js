// ============================================================
// 4BITTERZS - Product Image Controller
// ============================================================

const pool = require("../db/pool");


// ------------------------------------------------------------
// GET PRODUCT IMAGES
// Public
// ------------------------------------------------------------

async function getImages(req, res) {

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
                image_url,
                sort_order
            FROM product_images
            WHERE product_id = $1
            ORDER BY sort_order ASC, id ASC
        `, [productId]);


        return res.json({
            success: true,
            images: result.rows
        });

    } catch (error) {

        console.error("Get images error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve product images."
        });

    }

}


// ------------------------------------------------------------
// ADD PRODUCT IMAGE
// Admin only
// ------------------------------------------------------------

async function addImage(req, res) {

    try {

        const { productId } = req.params;

        const {
            image_url,
            sort_order = 0
        } = req.body;


        if (!image_url) {
            return res.status(400).json({
                success: false,
                message: "Image URL is required."
            });
        }


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


        const numericSortOrder = Number(sort_order);


        if (
            !Number.isInteger(numericSortOrder) ||
            numericSortOrder < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Sort order must be a non-negative integer."
            });
        }


        const result = await pool.query(`
            INSERT INTO product_images
                (product_id, image_url, sort_order)

            VALUES
                ($1, $2, $3)

            RETURNING
                id,
                product_id,
                image_url,
                sort_order
        `, [
            productId,
            image_url.trim(),
            numericSortOrder
        ]);


        return res.status(201).json({
            success: true,
            message: "Image added successfully.",
            image: result.rows[0]
        });

    } catch (error) {

        console.error("Add image error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add product image."
        });

    }

}


// ------------------------------------------------------------
// DELETE PRODUCT IMAGE
// Admin only
// ------------------------------------------------------------

async function deleteImage(req, res) {

    try {

        const {
            productId,
            imageId
        } = req.params;


        const result = await pool.query(`
            DELETE FROM product_images

            WHERE id = $1
              AND product_id = $2

            RETURNING id
        `, [
            imageId,
            productId
        ]);


        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Image not found."
            });
        }


        return res.json({
            success: true,
            message: "Image removed successfully."
        });

    } catch (error) {

        console.error("Delete image error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove product image."
        });

    }

}


module.exports = {
    getImages,
    addImage,
    deleteImage
};
// ============================================================
// 4BITTERZS - Product Controller
// ============================================================

const pool = require("../db/pool");


// ============================================================
// GET BEST ACTIVE SALE FOR A PRODUCT
// ============================================================

async function getBestSaleForProduct(productId) {

    const result = await pool.query(`
        SELECT
            s.id,
            s.name,
            s.discount_percent,
            s.scope,
            s.starts_at,
            s.ends_at

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
                    AND s.category_id = p.category_id
                )

                OR (
                    s.scope = 'products'
                    AND sp.product_id IS NOT NULL
                )
            )

        ORDER BY s.discount_percent DESC

        LIMIT 1
    `, [productId]);

    return result.rows[0] || null;
}


// ============================================================
// GET ALL PRODUCTS
// Public
// ============================================================

async function getProducts(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.sku,
                p.is_active,
                p.created_at,

                c.id AS category_id,
                c.name AS category_name,
                c.slug AS category_slug

            FROM products p

            LEFT JOIN categories c
                ON p.category_id = c.id

            WHERE p.is_active = TRUE

            ORDER BY p.created_at DESC
        `);

        const products = await Promise.all(
            result.rows.map(async product => {
                const sale = await getBestSaleForProduct(product.id);

                const originalPrice = Number(product.price);

                let salePrice = originalPrice;
                let discountPercent = 0;

                if (sale) {
                    discountPercent = Number(sale.discount_percent);

                    salePrice =
                        Math.round(
                            originalPrice *
                            (1 - discountPercent / 100) *
                            100
                        ) / 100;
                }

                return {
                    ...product,

                    sale_price: sale
                        ? salePrice.toFixed(2)
                        : null,

                    discount_percent: sale
                        ? discountPercent
                        : 0,

                    sale: sale
                        ? {
                            id: sale.id,
                            name: sale.name,
                            discount_percent: discountPercent,
                            scope: sale.scope,
                            starts_at: sale.starts_at,
                            ends_at: sale.ends_at
                        }
                        : null
                };
            })
        );

        res.json({
            success: true,
            products
        });

    } catch (error) {
        console.error(
            "Get products error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to retrieve products."
        });
    }
}


// ============================================================
// GET SINGLE PRODUCT BY SLUG
// Public
// ============================================================

async function getProductBySlug(req, res) {

    try {

        const { slug } = req.params;


        const productResult = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.sku,
                p.is_active,
                p.created_at,

                c.id AS category_id,
                c.name AS category_name,
                c.slug AS category_slug

            FROM products p

            LEFT JOIN categories c
                ON p.category_id = c.id

            WHERE p.slug = $1
              AND p.is_active = TRUE
        `, [slug]);


        if (productResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }


        const product = productResult.rows[0];

        const sale =
            await getBestSaleForProduct(product.id);

        const originalPrice =
            Number(product.price);

        let salePrice = originalPrice;
        let discountPercent = 0;


        if (sale) {

            discountPercent =
                Number(sale.discount_percent);

            salePrice =
                Math.round(
                    originalPrice *
                    (1 - discountPercent / 100) *
                    100
                ) / 100;
        }


        const imagesResult = await pool.query(`
            SELECT
                id,
                image_url,
                sort_order

            FROM product_images

            WHERE product_id = $1

            ORDER BY sort_order ASC, id ASC
        `, [product.id]);


        const inventoryResult = await pool.query(`
            SELECT
                id,
                size,
                quantity

            FROM inventory

            WHERE product_id = $1

            ORDER BY size ASC
        `, [product.id]);


        const formattedProduct = {

            id: product.id,

            name: product.name,

            slug: product.slug,

            description: product.description,

            price: product.price,

            sale_price: sale
                ? salePrice.toFixed(2)
                : null,

            discount_percent: sale
                ? discountPercent
                : 0,

            sale: sale
                ? {
                    id: sale.id,
                    name: sale.name,
                    discount_percent:
                        discountPercent,
                    scope: sale.scope,
                    starts_at: sale.starts_at,
                    ends_at: sale.ends_at
                }
                : null,

            sku: product.sku,

            is_active: product.is_active,

            created_at: product.created_at,


            category: product.category_id
                ? {
                    id: product.category_id,
                    name: product.category_name,
                    slug: product.category_slug
                }
                : null,


            images:
                imagesResult.rows.map(image => ({
                    id: image.id,
                    url: image.image_url,
                    sort_order: image.sort_order
                })),


            inventory:
                inventoryResult.rows.map(item => ({
                    id: item.id,
                    size: item.size,
                    quantity: item.quantity
                }))

        };


        return res.json({
            success: true,
            product: formattedProduct
        });

    } catch (error) {

        console.error(
            "Get product details error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve product."
        });

    }

}


// ============================================================
// GET ALL PRODUCTS FOR ADMIN
// ============================================================

async function getAdminProducts(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.price,
                p.sku,
                p.is_active,
                p.created_at,
                p.updated_at,

                c.id AS category_id,
                c.name AS category_name,
                c.slug AS category_slug

            FROM products p

            LEFT JOIN categories c
                ON p.category_id = c.id

            ORDER BY p.created_at DESC
        `);

        const products = await Promise.all(
            result.rows.map(async product => {

                const inventoryResult = await pool.query(`
                    SELECT
                        id,
                        size,
                        quantity

                    FROM inventory

                    WHERE product_id = $1

                    ORDER BY size ASC
                `, [product.id]);

                return {
                    ...product,

                    inventory: inventoryResult.rows.map(item => ({
                        id: item.id,
                        size: item.size,
                        quantity: item.quantity
                    }))
                };
            })
        );

        res.json({
            success: true,
            products
        });

    } catch (error) {

        console.error(
            "Admin get products error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to retrieve products."
        });

    }

}


// ============================================================
// CREATE PRODUCT
// Admin only
// ============================================================

async function createProduct(req, res) {

    try {

        const {
            name,
            slug,
            description,
            price,
            sku,
            category_id
        } = req.body;


        if (
            !name ||
            !slug ||
            price === undefined
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Name, slug and price are required."
            });

        }


        const numericPrice = Number(price);


        if (
            !Number.isFinite(numericPrice) ||
            numericPrice < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Price must be a valid non-negative number."
            });

        }


        if (
            category_id !== undefined &&
            category_id !== null
        ) {

            const category = await pool.query(
                "SELECT id FROM categories WHERE id = $1",
                [category_id]
            );


            if (category.rows.length === 0) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Selected category does not exist."
                });

            }

        }


        const result = await pool.query(`
            INSERT INTO products
            (
                name,
                slug,
                description,
                price,
                sku,
                category_id
            )

            VALUES
                ($1, $2, $3, $4, $5, $6)

            RETURNING
                id,
                name,
                slug,
                description,
                price,
                sku,
                category_id,
                is_active,
                created_at
        `, [
            name.trim(),
            slug.trim().toLowerCase(),
            description || null,
            numericPrice,
            sku || null,
            category_id || null
        ]);


        res.status(201).json({
            success: true,
            message:
                "Product created successfully.",
            product: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Create product error:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message:
                    "A product with this slug or SKU already exists."
            });

        }


        res.status(500).json({
            success: false,
            message:
                "Unable to create product."
        });

    }

}


// ============================================================
// UPDATE PRODUCT
// Admin only
// ============================================================

async function updateProduct(req, res) {

    try {

        const { id } = req.params;

        const {
            name,
            slug,
            description,
            price,
            sku,
            category_id,
            is_active
        } = req.body;


        if (
            !name ||
            !slug ||
            price === undefined
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Name, slug and price are required."
            });

        }


        const numericPrice = Number(price);


        if (
            !Number.isFinite(numericPrice) ||
            numericPrice < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Price must be a valid non-negative number."
            });

        }


        if (
            category_id !== undefined &&
            category_id !== null
        ) {

            const category = await pool.query(
                "SELECT id FROM categories WHERE id = $1",
                [category_id]
            );


            if (category.rows.length === 0) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Selected category does not exist."
                });

            }

        }


        const result = await pool.query(`
            UPDATE products

            SET
                name = $1,
                slug = $2,
                description = $3,
                price = $4,
                sku = $5,
                category_id = $6,
                is_active = $7,
                updated_at = NOW()

            WHERE id = $8

            RETURNING
                id,
                name,
                slug,
                description,
                price,
                sku,
                category_id,
                is_active,
                created_at,
                updated_at
        `, [
            name.trim(),
            slug.trim().toLowerCase(),
            description || null,
            numericPrice,
            sku || null,
            category_id || null,
            is_active !== false,
            id
        ]);


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }


        res.json({
            success: true,
            message:
                "Product updated successfully.",
            product: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Update product error:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message:
                    "A product with this slug or SKU already exists."
            });

        }


        res.status(500).json({
            success: false,
            message:
                "Unable to update product."
        });

    }

}


// ============================================================
// DELETE PRODUCT
// Deactivate instead of physical delete
// ============================================================

async function deleteProduct(req, res) {

    try {

        const { id } = req.params;


        const result = await pool.query(`
            UPDATE products

            SET
                is_active = FALSE,
                updated_at = NOW()

            WHERE id = $1

            RETURNING id, name, is_active
        `, [id]);


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }


        res.json({
            success: true,
            message:
                "Product deactivated successfully.",
            product: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Delete product error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to deactivate product."
        });

    }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getProducts,
    getProductBySlug,
    getAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getBestSaleForProduct
};
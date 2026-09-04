const pool = require("../db/pool");

// ============================================================
// CREATE SALE - ADMIN
// ============================================================

async function createSale(req, res) {
    try {
        const {
            name,
            description = null,
            discount_percent,
            scope,
            category_id = null,
            starts_at,
            ends_at,
            active = true,
            product_ids = []
        } = req.body;

        if (!name || discount_percent === undefined || !scope || !starts_at || !ends_at) {
            return res.status(400).json({
                success: false,
                message: "Name, discount percentage, scope, start date and end date are required."
            });
        }

        const discount = Number(discount_percent);

        if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
            return res.status(400).json({
                success: false,
                message: "Discount must be between 0 and 100 percent."
            });
        }

        if (!["sitewide", "category", "products"].includes(scope)) {
            return res.status(400).json({
                success: false,
                message: "Scope must be sitewide, category or products."
            });
        }

        if (scope === "category" && !category_id) {
            return res.status(400).json({
                success: false,
                message: "category_id is required for category sales."
            });
        }

        if (scope !== "category" && category_id !== null) {
            return res.status(400).json({
                success: false,
                message: "category_id can only be used for category sales."
            });
        }

        if (scope === "products" && (!Array.isArray(product_ids) || product_ids.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "product_ids is required for product sales."
            });
        }

        const startDate = new Date(starts_at);
        const endDate = new Date(ends_at);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid sale start or end date."
            });
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                success: false,
                message: "Sale end date must be after the start date."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const saleResult = await client.query(`
                INSERT INTO sales
                    (
                        name,
                        description,
                        discount_percent,
                        scope,
                        category_id,
                        starts_at,
                        ends_at,
                        active
                    )
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                name.trim(),
                description,
                discount,
                scope,
                category_id,
                starts_at,
                ends_at,
                active
            ]);

            const sale = saleResult.rows[0];

            if (scope === "products") {
                for (const productId of product_ids) {
                    await client.query(`
                        INSERT INTO sale_products
                            (sale_id, product_id)
                        VALUES
                            ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [sale.id, productId]);
                }
            }

            await client.query("COMMIT");

            return res.status(201).json({
                success: true,
                message: "Sale created successfully.",
                sale
            });

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error("Create sale error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create sale."
        });
    }
}


// ============================================================
// GET ALL SALES - ADMIN
// ============================================================

async function getAllSales(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                s.*,
                c.name AS category_name,
                COUNT(sp.product_id)::int AS product_count

            FROM sales s

            LEFT JOIN categories c
                ON c.id = s.category_id

            LEFT JOIN sale_products sp
                ON sp.sale_id = s.id

            GROUP BY
                s.id,
                c.name

            ORDER BY s.created_at DESC
        `);

        return res.json({
            success: true,
            sales: result.rows
        });

    } catch (error) {
        console.error("Get sales error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve sales."
        });
    }
}


// ============================================================
// GET SINGLE SALE
// ============================================================

async function getSaleById(req, res) {
    try {
        const { id } = req.params;

        const saleResult = await pool.query(`
            SELECT
                s.*,
                c.name AS category_name

            FROM sales s

            LEFT JOIN categories c
                ON c.id = s.category_id

            WHERE s.id = $1
        `, [id]);

        if (saleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        const productsResult = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.slug,
                p.price,
                p.sku
            FROM sale_products sp
            INNER JOIN products p
                ON p.id = sp.product_id
            WHERE sp.sale_id = $1
            ORDER BY p.name
        `, [id]);

        return res.json({
            success: true,
            sale: {
                ...saleResult.rows[0],
                products: productsResult.rows
            }
        });

    } catch (error) {
        console.error("Get sale error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve sale."
        });
    }
}


// ============================================================
// UPDATE SALE - ADMIN
// ============================================================

async function updateSale(req, res) {
    try {
        const { id } = req.params;

        const {
            name,
            description,
            discount_percent,
            scope,
            category_id,
            starts_at,
            ends_at,
            active
        } = req.body;

        const existing = await pool.query(`
            SELECT *
            FROM sales
            WHERE id = $1
        `, [id]);

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        const current = existing.rows[0];

        const finalName =
            name !== undefined ? name.trim() : current.name;

        const finalDescription =
            description !== undefined
                ? description
                : current.description;

        const finalDiscount =
            discount_percent !== undefined
                ? Number(discount_percent)
                : Number(current.discount_percent);

        const finalScope =
            scope !== undefined
                ? scope
                : current.scope;

        const finalCategory =
            category_id !== undefined
                ? category_id
                : current.category_id;

        const finalStarts =
            starts_at !== undefined
                ? starts_at
                : current.starts_at;

        const finalEnds =
            ends_at !== undefined
                ? ends_at
                : current.ends_at;

        const finalActive =
            active !== undefined
                ? active
                : current.active;

        if (!["sitewide", "category", "products"].includes(finalScope)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sale scope."
            });
        }

        if (
            !Number.isFinite(finalDiscount) ||
            finalDiscount <= 0 ||
            finalDiscount > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Discount must be between 0 and 100 percent."
            });
        }

        if (finalScope === "category" && !finalCategory) {
            return res.status(400).json({
                success: false,
                message: "category_id is required for category sales."
            });
        }

        if (finalScope !== "category") {
            if (finalCategory !== null) {
                return res.status(400).json({
                    success: false,
                    message: "category_id can only be used for category sales."
                });
            }
        }

        const startDate = new Date(finalStarts);
        const endDate = new Date(finalEnds);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            endDate <= startDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Sale dates are invalid."
            });
        }

        const result = await pool.query(`
            UPDATE sales

            SET
                name = $1,
                description = $2,
                discount_percent = $3,
                scope = $4,
                category_id = $5,
                starts_at = $6,
                ends_at = $7,
                active = $8

            WHERE id = $9

            RETURNING *
        `, [
            finalName,
            finalDescription,
            finalDiscount,
            finalScope,
            finalCategory,
            finalStarts,
            finalEnds,
            finalActive,
            id
        ]);

        return res.json({
            success: true,
            message: "Sale updated successfully.",
            sale: result.rows[0]
        });

    } catch (error) {
        console.error("Update sale error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update sale."
        });
    }
}


// ============================================================
// DELETE SALE - ADMIN
// ============================================================

async function deleteSale(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            DELETE FROM sales
            WHERE id = $1
            RETURNING id, name
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        return res.json({
            success: true,
            message: "Sale deleted successfully."
        });

    } catch (error) {
        console.error("Delete sale error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete sale."
        });
    }
}


// ============================================================
// ADD PRODUCTS TO SALE
// ============================================================

async function addProductsToSale(req, res) {
    try {
        const { id } = req.params;
        const { product_ids } = req.body;

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "product_ids must be a non-empty array."
            });
        }

        const sale = await pool.query(`
            SELECT id, scope
            FROM sales
            WHERE id = $1
        `, [id]);

        if (sale.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        if (sale.rows[0].scope !== "products") {
            return res.status(400).json({
                success: false,
                message: "Products can only be attached to a products-scope sale."
            });
        }

        for (const productId of product_ids) {
            await pool.query(`
                INSERT INTO sale_products
                    (sale_id, product_id)
                VALUES
                    ($1, $2)
                ON CONFLICT DO NOTHING
            `, [id, productId]);
        }

        return res.json({
            success: true,
            message: "Products added to sale successfully."
        });

    } catch (error) {
        console.error("Add sale products error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add products to sale."
        });
    }
}


// ============================================================
// REMOVE PRODUCT FROM SALE
// ============================================================

async function removeProductFromSale(req, res) {
    try {
        const {
            id,
            productId
        } = req.params;

        const result = await pool.query(`
            DELETE FROM sale_products
            WHERE sale_id = $1
              AND product_id = $2
            RETURNING sale_id, product_id
        `, [
            id,
            productId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product is not attached to this sale."
            });
        }

        return res.json({
            success: true,
            message: "Product removed from sale."
        });

    } catch (error) {
        console.error("Remove sale product error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove product from sale."
        });
    }
}


// ============================================================
// GET BEST SALE FOR PRODUCT
// ============================================================

async function getBestSaleForProduct(productId) {
    const result = await pool.query(`
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
                    AND s.category_id = p.category_id
                )
                OR (
                    s.scope = 'products'
                    AND sp.product_id IS NOT NULL
                )
            )

        ORDER BY
            s.discount_percent DESC

        LIMIT 1
    `, [productId]);

    return result.rows[0] || null;
}


module.exports = {
    createSale,
    getAllSales,
    getSaleById,
    updateSale,
    deleteSale,
    addProductsToSale,
    removeProductFromSale,
    getBestSaleForProduct
};
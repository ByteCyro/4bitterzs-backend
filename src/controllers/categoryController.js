// ============================================================
// 4BITTERZS - Category Controller
// ============================================================

const pool = require("../db/pool");


// ------------------------------------------------------------
// GET ALL CATEGORIES
// Public
// ------------------------------------------------------------

async function getCategories(req, res) {

    try {

        const result = await pool.query(`
            SELECT
                id,
                name,
                slug,
                description,
                created_at
            FROM categories
            ORDER BY name ASC
        `);

        res.json({
            success: true,
            categories: result.rows
        });

    } catch (error) {

        console.error("Get categories error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve categories."
        });

    }

}


// ------------------------------------------------------------
// GET SINGLE CATEGORY
// Public
// ------------------------------------------------------------

async function getCategory(req, res) {

    try {

        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                id,
                name,
                slug,
                description,
                created_at
            FROM categories
            WHERE id = $1
        `, [id]);


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Category not found."
            });

        }


        res.json({
            success: true,
            category: result.rows[0]
        });

    } catch (error) {

        console.error("Get category error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve category."
        });

    }

}


// ------------------------------------------------------------
// CREATE CATEGORY
// Admin only
// ------------------------------------------------------------

async function createCategory(req, res) {

    try {

        const {
            name,
            slug,
            description
        } = req.body;


        if (!name || !slug) {

            return res.status(400).json({
                success: false,
                message: "Name and slug are required."
            });

        }


        const result = await pool.query(`
            INSERT INTO categories
                (name, slug, description)
            VALUES
                ($1, $2, $3)
            RETURNING
                id,
                name,
                slug,
                description,
                created_at
        `, [
            name.trim(),
            slug.trim().toLowerCase(),
            description || null
        ]);


        res.status(201).json({
            success: true,
            message: "Category created successfully.",
            category: result.rows[0]
        });

    } catch (error) {

        console.error("Create category error:", error);


        // PostgreSQL unique constraint
        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "A category with this name or slug already exists."
            });

        }


        res.status(500).json({
            success: false,
            message: "Unable to create category."
        });

    }

}


// ------------------------------------------------------------
// UPDATE CATEGORY
// Admin only
// ------------------------------------------------------------

async function updateCategory(req, res) {

    try {

        const { id } = req.params;

        const {
            name,
            slug,
            description
        } = req.body;


        if (!name || !slug) {

            return res.status(400).json({
                success: false,
                message: "Name and slug are required."
            });

        }


        const result = await pool.query(`
            UPDATE categories

            SET
                name = $1,
                slug = $2,
                description = $3

            WHERE id = $4

            RETURNING
                id,
                name,
                slug,
                description,
                created_at
        `, [
            name.trim(),
            slug.trim().toLowerCase(),
            description || null,
            id
        ]);


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Category not found."
            });

        }


        res.json({
            success: true,
            message: "Category updated successfully.",
            category: result.rows[0]
        });

    } catch (error) {

        console.error("Update category error:", error);


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message: "A category with this name or slug already exists."
            });

        }


        res.status(500).json({
            success: false,
            message: "Unable to update category."
        });

    }

}


// ------------------------------------------------------------
// DELETE CATEGORY
// Admin only
// ------------------------------------------------------------

async function deleteCategory(req, res) {

    try {

        const { id } = req.params;


        const result = await pool.query(`
            DELETE FROM categories
            WHERE id = $1
            RETURNING id
        `, [id]);


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Category not found."
            });

        }


        res.json({
            success: true,
            message: "Category deleted successfully."
        });

    } catch (error) {

        console.error("Delete category error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete category."
        });

    }

}


module.exports = {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory
};
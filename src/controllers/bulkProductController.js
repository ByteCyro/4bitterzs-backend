// ============================================================
// 4BITTERZS - Bulk Product Import Controller
// ============================================================

const pool = require("../db/pool");
const { parse } = require("csv-parse/sync");
const XLSX = require("xlsx");


// ============================================================
// HELPERS
// ============================================================

function cleanValue(value) {

    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}


function slugify(value) {

    return cleanValue(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function parseNumber(value) {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function isValidQuantity(value) {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return true;
    }

    const number = Number(value);

    return (
        Number.isInteger(number) &&
        number >= 0
    );
}


function getFileExtension(filename) {

    return filename
        .toLowerCase()
        .split(".")
        .pop();
}


// ============================================================
// IMPORT PRODUCTS
// ============================================================

async function bulkImportProducts(req, res) {

    if (!req.file) {

        return res.status(400).json({
            success: false,
            message:
                "Please upload a CSV, XLSX, or XLS file using the 'file' field."
        });

    }


    const extension =
        getFileExtension(req.file.originalname);

    if (!["csv", "xlsx", "xls"].includes(extension)) {
        return res.status(400).json({
            success: false,
            message: "Only CSV, XLSX, or XLS files are supported for bulk import."
        });
    }

    let rows;

    try {

        if (extension === "csv") {

            rows = parse(req.file.buffer.toString("utf8"), {
                columns: true,
                skip_empty_lines: true,
                bom: true,
                trim: true
            });

        } else {

            const workbook = XLSX.read(req.file.buffer, {
                type: "buffer",
                cellDates: false
            });

            if (!workbook.SheetNames.length) {
                throw new Error("The uploaded Excel file contains no worksheets.");
            }

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

            if (!firstSheet) {
                throw new Error("Unable to read the first worksheet.");
            }

            rows = XLSX.utils.sheet_to_json(firstSheet, {
                defval: "",
                raw: false
            });

        }

    } catch (error) {

        console.error("Bulk import file parsing error:", error);

        return res.status(400).json({
            success: false,
            message:
                extension === "csv"
                    ? "Unable to read the uploaded CSV file."
                    : "Unable to read the uploaded Excel file."
        });

    }

    if (!rows.length) {

        return res.status(400).json({
            success: false,
            message:
                "The uploaded file contains no product rows."
        });

    }


    if (rows.length > 1000) {

        return res.status(400).json({
            success: false,
            message:
                "Maximum 1000 products can be imported at once."
        });

    }


    const results = [];

    const client = await pool.connect();


    try {

        await client.query("BEGIN");


        for (
            let index = 0;
            index < rows.length;
            index++
        ) {

            const row = rows[index];

            const rowNumber = index + 2;


            try {

                await client.query(
                    `SAVEPOINT product_import_row`
                );


                // ------------------------------------------------
                // READ PRODUCT DATA
                // ------------------------------------------------

                const name =
                    cleanValue(row.name);

                const description =
                    cleanValue(row.description);

                const sku =
                    cleanValue(row.sku);

                const suppliedSlug =
                    cleanValue(row.slug);

                const category =
                    cleanValue(row.category);

                const price =
                    parseNumber(row.price);


                // ------------------------------------------------
                // VALIDATE BASIC DATA
                // ------------------------------------------------

                if (!name) {

                    throw new Error(
                        "Name is required."
                    );

                }


                if (price === null) {

                    throw new Error(
                        "Price must be a valid number."
                    );

                }


                if (price < 0) {

                    throw new Error(
                        "Price cannot be negative."
                    );

                }


                if (!sku) {

                    throw new Error(
                        "SKU is required."
                    );

                }


                // ------------------------------------------------
                // SLUG
                // ------------------------------------------------

                let slug =
                    suppliedSlug
                        ? slugify(suppliedSlug)
                        : slugify(name);


                if (!slug) {

                    throw new Error(
                        "Unable to generate a valid slug."
                    );

                }


                // ------------------------------------------------
                // CHECK SKU
                // ------------------------------------------------

                const skuCheck =
                    await client.query(`
                        SELECT id
                        FROM products
                        WHERE sku = $1
                        LIMIT 1
                    `, [sku]);


                if (skuCheck.rows.length > 0) {

                    throw new Error(
                        `SKU '${sku}' already exists.`
                    );

                }


                // ------------------------------------------------
                // CHECK SLUG
                // ------------------------------------------------

                const slugCheck =
                    await client.query(`
                        SELECT id
                        FROM products
                        WHERE slug = $1
                        LIMIT 1
                    `, [slug]);


                if (slugCheck.rows.length > 0) {

                    throw new Error(
                        `Slug '${slug}' already exists.`
                    );

                }


                // ------------------------------------------------
                // CATEGORY
                // ------------------------------------------------

                let categoryId = null;


                if (category) {

                    const categoryResult =
                        await client.query(`
                            SELECT id
                            FROM categories

                            WHERE
                                LOWER(name) =
                                    LOWER($1)

                                OR

                                LOWER(slug) =
                                    LOWER($1)

                            LIMIT 1
                        `, [category]);


                    if (
                        categoryResult.rows.length === 0
                    ) {

                        throw new Error(
                            `Category '${category}' does not exist.`
                        );

                    }


                    categoryId =
                        categoryResult.rows[0].id;
                }


                // ------------------------------------------------
                // CREATE PRODUCT
                // ------------------------------------------------

                const productResult =
                    await client.query(`
                        INSERT INTO products
                        (
                            category_id,
                            name,
                            slug,
                            description,
                            price,
                            sku,
                            is_active
                        )

                        VALUES
                        (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            TRUE
                        )

                        RETURNING
                            id,
                            name,
                            slug,
                            price,
                            sku
                    `, [
                        categoryId,
                        name,
                        slug,
                        description || null,
                        price,
                        sku
                    ]);


                const product =
                    productResult.rows[0];


                // ------------------------------------------------
                // PRODUCT IMAGES
                //
                // Optional image columns are supported by bulk import:
                // image_url = primary/first image
                // image_1, image_2, image_3, ... = ordered gallery images
                //
                // Blank image cells are ignored.
                // ------------------------------------------------

                const imageColumns = Object.keys(row)
                    .filter(key => {
                        const normalized = key.toLowerCase().trim();

                        return (
                            normalized === "image_url" ||
                            /^image_\d+$/.test(normalized)
                        );
                    })
                    .sort((a, b) => {
                        const aNormalized = a.toLowerCase().trim();
                        const bNormalized = b.toLowerCase().trim();

                        if (aNormalized === "image_url") return -1;
                        if (bNormalized === "image_url") return 1;

                        return (
                            Number(aNormalized.substring(6)) -
                            Number(bNormalized.substring(6))
                        );
                    });

                const images =
                    [];

                for (const key of imageColumns) {

                    const imageUrl =
                        cleanValue(row[key]);

                    if (!imageUrl) {
                        continue;
                    }

                    const duplicateImage =
                        images.some(
                            image => image.url === imageUrl
                        );

                    if (duplicateImage) {
                        continue;
                    }

                    const imageResult =
                        await client.query(`
                            INSERT INTO product_images
                            (
                                product_id,
                                image_url,
                                sort_order
                            )

                            VALUES
                            (
                                $1,
                                $2,
                                $3
                            )

                            RETURNING
                                id,
                                image_url,
                                sort_order
                        `, [
                            product.id,
                            imageUrl,
                            images.length
                        ]);

                    images.push({
                        id: imageResult.rows[0].id,
                        url: imageResult.rows[0].image_url,
                        sort_order: imageResult.rows[0].sort_order
                    });
                }


                // ------------------------------------------------
                // INVENTORY
                //
                // Any column beginning with size_
                // becomes an inventory size.
                //
                // Example:
                // size_7 = 10
                // size_8 = 15
                // size_9 = 4
                // ------------------------------------------------

                const inventory =
                    [];


                for (const key of Object.keys(row)) {

                    if (
                        !key
                            .toLowerCase()
                            .startsWith("size_")
                    ) {
                        continue;
                    }


                    const size =
                        cleanValue(
                            key.substring(5)
                        );


                    if (!size) {
                        continue;
                    }


                    const quantityValue =
                        row[key];


                    if (
                        !isValidQuantity(
                            quantityValue
                        )
                    ) {

                        throw new Error(
                            `Invalid quantity for size '${size}'.`
                        );

                    }


                    if (
                        quantityValue === "" ||
                        quantityValue === null ||
                        quantityValue === undefined
                    ) {
                        continue;
                    }


                    const quantity =
                        Number(quantityValue);


                    await client.query(`
                        INSERT INTO inventory
                        (
                            product_id,
                            size,
                            quantity
                        )

                        VALUES
                        (
                            $1,
                            $2,
                            $3
                        )
                    `, [
                        product.id,
                        size,
                        quantity
                    ]);


                    inventory.push({
                        size,
                        quantity
                    });

                }


                // ------------------------------------------------
                // SAVE ROW
                // ------------------------------------------------

                await client.query(
                    `RELEASE SAVEPOINT product_import_row`
                );


                results.push({

                    row: rowNumber,

                    success: true,

                    product: {
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        price: product.price,
                        sku: product.sku
                    },

                    images,

                    inventory

                });


            } catch (rowError) {

                await client.query(
                    `ROLLBACK TO SAVEPOINT product_import_row`
                );


                results.push({

                    row: rowNumber,

                    success: false,

                    error:
                        rowError.message ||
                        "Unable to import row."

                });

            }

        }


        await client.query("COMMIT");


        const successful =
            results.filter(
                item => item.success
            ).length;


        const failed =
            results.filter(
                item => !item.success
            ).length;


        return res.status(200).json({

            success: true,

            message:
                "Bulk product import completed.",

            summary: {
                total_rows: rows.length,
                successful,
                failed
            },

            results

        });


    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (_) {}


        console.error(
            "Bulk product import error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Bulk product import failed."
        });


    } finally {

        client.release();

    }

}


module.exports = {
    bulkImportProducts
};
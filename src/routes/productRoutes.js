// ============================================================
// 4BITTERZS - Product Routes
// ============================================================

const express = require("express");

const {
    getProducts,
    getProductBySlug,
    getAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const {
    bulkImportProducts
} = require("../controllers/bulkProductController");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const multer = require("multer");
const { createRateLimiter } = require("../middleware/rateLimit");


const router = express.Router();

const bulkImportLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many bulk imports. Please try again later."
});


// ============================================================
// FILE UPLOAD CONFIG
// ============================================================

const upload = multer({

    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const allowedExtensions = [
            ".csv",
            ".xlsx",
            ".xls"
        ];

        const extension =
            file.originalname
                .toLowerCase()
                .substring(
                    file.originalname
                        .lastIndexOf(".")
                );


        if (
            allowedExtensions.includes(
                extension
            )
        ) {

            cb(null, true);

        } else {

            cb(
                new Error(
                    "Only CSV, XLSX, or XLS files are allowed."
                )
            );

        }

    }

});


// ============================================================
// PUBLIC PRODUCT ROUTES
// ============================================================

// Get active products
router.get(
    "/",
    getProducts
);


// Get one active product
router.get(
    "/slug/:slug",
    getProductBySlug
);


// ============================================================
// ADMIN PRODUCT ROUTES
// ============================================================

// Get ALL products
router.get(
    "/admin/all",
    authenticate,
    requireAdmin,
    getAdminProducts
);


// ------------------------------------------------------------
// BULK PRODUCT IMPORT
// IMPORTANT: This must be BEFORE /:id
// ------------------------------------------------------------

router.post(
    "/bulk-import",
    authenticate,
    requireAdmin,
    upload.single("file"),
    bulkImportProducts
);


// ------------------------------------------------------------
// CREATE PRODUCT
// ------------------------------------------------------------

router.post(
    "/",
    authenticate,
    requireAdmin,
    createProduct
);


// ------------------------------------------------------------
// UPDATE PRODUCT
// ------------------------------------------------------------

router.put(
    "/:id",
    authenticate,
    requireAdmin,
    updateProduct
);


// ------------------------------------------------------------
// DEACTIVATE PRODUCT
// ------------------------------------------------------------

router.delete(
    "/:id",
    authenticate,
    requireAdmin,
    deleteProduct
);


module.exports = router;
const express = require("express");

const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const {
    createSale,
    getAllSales,
    getSaleById,
    updateSale,
    deleteSale,
    addProductsToSale,
    removeProductFromSale
} = require("../controllers/saleController");

const router = express.Router();

// ------------------------------------------------------------
// ADMIN
// ------------------------------------------------------------

router.post(
    "/",
    authenticate,
    requireAdmin,
    createSale
);

router.get(
    "/",
    authenticate,
    requireAdmin,
    getAllSales
);

router.get(
    "/:id",
    authenticate,
    requireAdmin,
    getSaleById
);

router.put(
    "/:id",
    authenticate,
    requireAdmin,
    updateSale
);

router.delete(
    "/:id",
    authenticate,
    requireAdmin,
    deleteSale
);

router.post(
    "/:id/products",
    authenticate,
    requireAdmin,
    addProductsToSale
);

router.delete(
    "/:id/products/:productId",
    authenticate,
    requireAdmin,
    removeProductFromSale
);

module.exports = router;
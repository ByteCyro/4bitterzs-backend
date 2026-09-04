const express = require("express");
const { authenticate } = require("../middleware/auth");
const {
    getAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} = require("../controllers/addressController");

const router = express.Router();

router.use(authenticate);
router.get("/", getAddresses);
router.post("/", createAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);
router.post("/:id/default", setDefaultAddress);

module.exports = router;

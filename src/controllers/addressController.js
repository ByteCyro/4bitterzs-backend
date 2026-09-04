const pool = require("../db/pool");

function normalizeAddress(body = {}) {
    return {
        full_name: String(body.full_name || "").trim(),
        phone: String(body.phone || "").trim(),
        address_line_1: String(body.address_line_1 || "").trim(),
        address_line_2: String(body.address_line_2 || "").trim(),
        city: String(body.city || "").trim(),
        state: String(body.state || "").trim(),
        postal_code: String(body.postal_code || "").trim(),
        country: String(body.country || "India").trim() || "India"
    };
}

function validateAddress(address) {
    if (!address.full_name || !address.phone || !address.address_line_1 ||
        !address.city || !address.state || !address.postal_code || !address.country) {
        return "Full name, phone, address, city, state, postal code and country are required.";
    }

    if (address.full_name.length > 150) return "Full name is too long.";
    if (address.phone.length > 30) return "Phone number is too long.";
    if (address.city.length > 100) return "City is too long.";
    if (address.state.length > 100) return "State is too long.";
    if (address.postal_code.length > 20) return "Postal code is too long.";
    if (address.country.length > 100) return "Country is too long.";
    if (address.address_line_1.length > 2000 || address.address_line_2.length > 2000) {
        return "Address is too long.";
    }

    return null;
}

async function getAddresses(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, address_line_1, address_line_2,
                    city, state, postal_code, country, is_default, created_at
             FROM addresses
             WHERE user_id = $1
             ORDER BY is_default DESC, created_at DESC, id DESC`,
            [req.user.userId]
        );

        return res.json({ success: true, addresses: result.rows });
    } catch (error) {
        console.error("Get addresses error:", error);
        return res.status(500).json({ success: false, message: "Unable to load addresses." });
    }
}

async function createAddress(req, res) {
    const address = normalizeAddress(req.body);
    const validationError = validateAddress(address);

    if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const countResult = await client.query(
            "SELECT COUNT(*)::int AS count FROM addresses WHERE user_id = $1",
            [req.user.userId]
        );
        const makeDefault = Number(countResult.rows[0].count) === 0;

        if (makeDefault) {
            await client.query(
                "UPDATE addresses SET is_default = FALSE WHERE user_id = $1",
                [req.user.userId]
            );
        }

        const result = await client.query(
            `INSERT INTO addresses
                (user_id, full_name, phone, address_line_1, address_line_2,
                 city, state, postal_code, country, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id, full_name, phone, address_line_1, address_line_2,
                       city, state, postal_code, country, is_default, created_at`,
            [req.user.userId, address.full_name, address.phone, address.address_line_1,
             address.address_line_2 || null, address.city, address.state,
             address.postal_code, address.country, makeDefault]
        );

        await client.query("COMMIT");
        return res.status(201).json({ success: true, address: result.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Create address error:", error);
        return res.status(500).json({ success: false, message: "Unable to save address." });
    } finally {
        client.release();
    }
}

async function updateAddress(req, res) {
    const address = normalizeAddress(req.body);
    const validationError = validateAddress(address);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const addressId = Number(req.params.id);
    if (!Number.isInteger(addressId) || addressId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid address ID." });
    }

    try {
        const result = await pool.query(
            `UPDATE addresses
             SET full_name=$1, phone=$2, address_line_1=$3, address_line_2=$4,
                 city=$5, state=$6, postal_code=$7, country=$8
             WHERE id=$9 AND user_id=$10
             RETURNING id, full_name, phone, address_line_1, address_line_2,
                       city, state, postal_code, country, is_default, created_at`,
            [address.full_name, address.phone, address.address_line_1,
             address.address_line_2 || null, address.city, address.state,
             address.postal_code, address.country, addressId, req.user.userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        return res.json({ success: true, address: result.rows[0] });
    } catch (error) {
        console.error("Update address error:", error);
        return res.status(500).json({ success: false, message: "Unable to update address." });
    }
}

async function deleteAddress(req, res) {
    const addressId = Number(req.params.id);
    if (!Number.isInteger(addressId) || addressId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid address ID." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const deleted = await client.query(
            `DELETE FROM addresses
             WHERE id=$1 AND user_id=$2
             RETURNING id, is_default`,
            [addressId, req.user.userId]
        );

        if (!deleted.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        if (deleted.rows[0].is_default) {
            await client.query(
                `UPDATE addresses
                 SET is_default = TRUE
                 WHERE id = (
                     SELECT id FROM addresses
                     WHERE user_id = $1
                     ORDER BY created_at DESC, id DESC
                     LIMIT 1
                 )`,
                [req.user.userId]
            );
        }

        await client.query("COMMIT");
        return res.json({ success: true, message: "Address deleted." });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Delete address error:", error);
        return res.status(500).json({ success: false, message: "Unable to delete address." });
    } finally {
        client.release();
    }
}

async function setDefaultAddress(req, res) {
    const addressId = Number(req.params.id);
    if (!Number.isInteger(addressId) || addressId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid address ID." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const owned = await client.query(
            "SELECT id FROM addresses WHERE id=$1 AND user_id=$2",
            [addressId, req.user.userId]
        );
        if (!owned.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        await client.query("UPDATE addresses SET is_default=FALSE WHERE user_id=$1", [req.user.userId]);
        const result = await client.query(
            `UPDATE addresses SET is_default=TRUE
             WHERE id=$1 AND user_id=$2
             RETURNING id, full_name, phone, address_line_1, address_line_2,
                       city, state, postal_code, country, is_default, created_at`,
            [addressId, req.user.userId]
        );

        await client.query("COMMIT");
        return res.json({ success: true, address: result.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Set default address error:", error);
        return res.status(500).json({ success: false, message: "Unable to set default address." });
    } finally {
        client.release();
    }
}

module.exports = {
    getAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
};

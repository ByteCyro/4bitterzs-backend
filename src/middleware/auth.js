// ============================================================
// 4BITTERZS - Authentication + Authorization Middleware
// ============================================================

const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"]
            }
        );

        if (!decoded.userId || !decoded.role) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token."
            });
        }

        req.user = decoded;
        next();
    } catch (_) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token."
        });
    }
}

async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    try {
        // Do not trust a stale role claim from an old JWT.
        const result = await pool.query(
            `SELECT id, role
             FROM users
             WHERE id = $1`,
            [req.user.userId]
        );

        if (
            result.rows.length === 0 ||
            result.rows[0].role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message: "Administrator access required."
            });
        }

        req.user.role = "admin";
        next();
    } catch (error) {
        console.error("Admin authorization error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to verify administrator access."
        });
    }
}

module.exports = {
    authenticate,
    requireAdmin
};

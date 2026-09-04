// ============================================================
// 4BITTERZS - Authentication Controller
// ============================================================

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db/pool");


// ------------------------------------------------------------
// Helper: Create JWT
// ------------------------------------------------------------

function createToken(user) {

    return jwt.sign(
        {
            userId: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

}


// ------------------------------------------------------------
// REGISTER CUSTOMER
// ------------------------------------------------------------

async function register(req, res) {

    try {

        const { name, email, password } = req.body;

        // Basic validation
        if (!name || !email || !password) {

            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });

        }

        if (password.length < 8) {

            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });

        }

        const normalizedEmail = email.trim().toLowerCase();

        if (
            normalizedEmail.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }


        // Check whether account already exists
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });

        }


        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);


        // Create customer
        const result = await pool.query(
            `
            INSERT INTO users
                (name, email, password_hash, role)
            VALUES
                ($1, $2, $3, 'customer')
            RETURNING id, name, email, role, created_at
            `,
            [
                name.trim(),
                normalizedEmail,
                passwordHash
            ]
        );

        const user = result.rows[0];

        const token = createToken(user);


        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token,
            user
        });

    } catch (error) {

        console.error("Register error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create account."
        });

    }

}


// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------

async function login(req, res) {

    try {

        const { email, password } = req.body;


        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });

        }


        const normalizedEmail = email.trim().toLowerCase();

        if (
            normalizedEmail.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }



        // Find user
        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                password_hash,
                role,
                created_at
            FROM users
            WHERE email = $1
            `,
            [normalizedEmail]
        );


        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });

        }


        const user = result.rows[0];


        // Verify password
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );


        if (!passwordMatches) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });

        }


        // Never send password hash to browser
        delete user.password_hash;


        const token = createToken(user);


        return res.json({
            success: true,
            message: "Login successful.",
            token,
            user
        });

    } catch (error) {

        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to login."
        });

    }

}


// ------------------------------------------------------------
// GET CURRENT USER
// ------------------------------------------------------------

async function me(req, res) {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                role,
                created_at
            FROM users
            WHERE id = $1
            `,
            [req.user.userId]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found."
            });

        }


        return res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {

        console.error("Me error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve account."
        });

    }

}


module.exports = {
    register,
    login,
    me
};
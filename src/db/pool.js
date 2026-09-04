// ============================================================
// PostgreSQL Database Connection
// ============================================================

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Test the connection when the backend starts.
pool.on("connect", () => {
    console.log("✅ Connected to PostgreSQL");
});

pool.on("error", (error) => {
    console.error("❌ PostgreSQL pool error:", error);
});

module.exports = pool;
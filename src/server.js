// ============================================================
// 4BITTERZS Backend Server
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./db/pool");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const productDetailRoutes = require("./routes/productDetailRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const orderRoutes = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const saleRoutes = require("./routes/saleRoutes");
const customerRoutes = require("./routes/customerRoutes");
const addressRoutes = require("./routes/addressRoutes");

const app = express();

// ------------------------------------------------------------
// Required environment validation
// ------------------------------------------------------------

const requiredEnv = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "JWT_SECRET",
    "DELIVERY_OTP_SECRET"
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

if (process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET must be at least 32 characters long.");
    process.exit(1);
}

if (process.env.DELIVERY_OTP_SECRET.length < 32) {
    console.error(
        "DELIVERY_OTP_SECRET must be at least 32 characters long."
    );
    process.exit(1);
}

// ------------------------------------------------------------
// Security / middleware
// ------------------------------------------------------------

app.disable("x-powered-by");

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
});

const allowedOrigins = (
    process.env.FRONTEND_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // Non-browser clients such as curl/Postman do not send Origin.
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
}));

app.use(express.json({
    limit: "1mb"
}));

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products", productDetailRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/sales", saleRoutes);

// ------------------------------------------------------------
// Basic test route
// ------------------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "4BITTERZS API is running"
    });
});

// ------------------------------------------------------------
// Database health route
// ------------------------------------------------------------

app.get("/api/health/db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS time");

        res.json({
            success: true,
            database: "connected",
            time: result.rows[0].time
        });
    } catch (error) {
        console.error("Database health error:", error);

        res.status(500).json({
            success: false,
            database: "connection failed"
        });
    }
});

// ------------------------------------------------------------
// 404
// ------------------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

// ------------------------------------------------------------
// Centralized error handler
// ------------------------------------------------------------

app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error);

    if (error && error.message === "CORS origin not allowed.") {
        return res.status(403).json({
            success: false,
            message: "Request origin is not allowed."
        });
    }

    if (error && error.name === "MulterError") {
        return res.status(400).json({
            success: false,
            message: "File upload failed."
        });
    }

    if (
        error &&
        error.message ===
        "Only CSV and XLSX files are allowed."
    ) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
    console.log(`
==================================================
  4BITTERZS BACKEND
==================================================

  Server:   http://localhost:${PORT}
  Database: ${process.env.DB_NAME}

==================================================
`);
});

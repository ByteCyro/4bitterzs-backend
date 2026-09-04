-- ============================================================
-- 4BITTERZS DATABASE SCHEMA
-- PostgreSQL
-- ============================================================

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,

    slug VARCHAR(120) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,

    category_id BIGINT REFERENCES categories(id)
        ON DELETE SET NULL,

    name VARCHAR(200) NOT NULL,

    slug VARCHAR(220) NOT NULL UNIQUE,

    description TEXT,

    price NUMERIC(12, 2) NOT NULL
        CHECK (price >= 0),

    sku VARCHAR(100) UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- PRODUCT IMAGES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_images (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    image_url TEXT NOT NULL,

    sort_order INTEGER NOT NULL DEFAULT 0
);


-- ------------------------------------------------------------
-- INVENTORY
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    size VARCHAR(50) NOT NULL,

    quantity INTEGER NOT NULL DEFAULT 0
        CHECK (quantity >= 0),

    UNIQUE(product_id, size)
);


-- ------------------------------------------------------------
-- WISHLIST
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(user_id, product_id)
);


-- ------------------------------------------------------------
-- CART
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    size VARCHAR(50),

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, product_id, size)
);


-- ------------------------------------------------------------
-- ADDRESSES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    full_name VARCHAR(150) NOT NULL,

    phone VARCHAR(30) NOT NULL,

    address_line_1 TEXT NOT NULL,

    address_line_2 TEXT,

    city VARCHAR(100) NOT NULL,

    state VARCHAR(100) NOT NULL,

    postal_code VARCHAR(20) NOT NULL,

    country VARCHAR(100) NOT NULL DEFAULT 'India',

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'processing',
                'shipped',
                'delivered',
                'cancelled',
                'refunded'
            )
        ),

    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            payment_status IN (
                'pending',
                'paid',
                'failed',
                'refunded'
            )
        ),

    payment_method VARCHAR(50),

    shipping_method VARCHAR(50),

    shipping_name VARCHAR(150),

    shipping_phone VARCHAR(30),

    shipping_address TEXT,

    subtotal NUMERIC(12, 2) NOT NULL
        CHECK (subtotal >= 0),

    shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (shipping_cost >= 0),

    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),

    total NUMERIC(12, 2) NOT NULL
        CHECK (total >= 0),

    coupon_code VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- ORDER ITEMS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id BIGINT
        REFERENCES products(id)
        ON DELETE SET NULL,

    product_name VARCHAR(200) NOT NULL,

    product_sku VARCHAR(100),

    size VARCHAR(50),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(12, 2) NOT NULL
        CHECK (unit_price >= 0),

    sale_discount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (sale_discount >= 0)
);


-- ------------------------------------------------------------
-- COUPONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(100) NOT NULL UNIQUE,

    discount_type VARCHAR(20) NOT NULL
        CHECK (discount_type IN ('percentage', 'fixed')),

    discount_value NUMERIC(12, 2) NOT NULL
        CHECK (discount_value > 0),

    minimum_order NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (minimum_order >= 0),

    maximum_discount NUMERIC(12, 2),

    starts_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    usage_limit INTEGER,

    usage_count INTEGER NOT NULL DEFAULT 0
        CHECK (usage_count >= 0),

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        expires_at IS NULL
        OR starts_at IS NULL
        OR expires_at > starts_at
    )
);


-- ------------------------------------------------------------
-- SALES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(200) NOT NULL,

    description TEXT,

    discount_percent NUMERIC(5, 2) NOT NULL
        CHECK (
            discount_percent > 0
            AND discount_percent <= 100
        ),

    scope VARCHAR(20) NOT NULL
        CHECK (
            scope IN (
                'sitewide',
                'category',
                'products'
            )
        ),

    category_id BIGINT
        REFERENCES categories(id)
        ON DELETE SET NULL,

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (ends_at > starts_at),

    CHECK (
        (scope = 'category' AND category_id IS NOT NULL)
        OR
        (scope <> 'category')
    )
);


-- ------------------------------------------------------------
-- SALE PRODUCTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sale_products (
    sale_id BIGINT NOT NULL
        REFERENCES sales(id)
        ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    PRIMARY KEY(sale_id, product_id)
);


-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_active
    ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_product_images_product
    ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product
    ON inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_cart_user
    ON cart_items(user_id);

CREATE INDEX IF NOT EXISTS idx_wishlist_user
    ON wishlist_items(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_user
    ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);

CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_coupons_code
    ON coupons(code);

CREATE INDEX IF NOT EXISTS idx_sales_active
    ON sales(active);

CREATE INDEX IF NOT EXISTS idx_sales_dates
    ON sales(starts_at, ends_at);


-- ============================================================
-- END OF SCHEMA
-- ============================================================
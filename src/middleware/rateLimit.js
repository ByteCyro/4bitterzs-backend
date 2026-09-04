// ============================================================
// 4BITTERZS - Simple in-memory rate limiter
// ============================================================

function createRateLimiter({
    windowMs,
    max,
    message = "Too many requests. Please try again later."
}) {
    const clients = new Map();

    const cleanup = setInterval(() => {
        const now = Date.now();

        for (const [key, entry] of clients) {
            if (entry.resetAt <= now) {
                clients.delete(key);
            }
        }
    }, Math.min(windowMs, 60_000));

    cleanup.unref();

    return (req, res, next) => {
        const key = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();

        let entry = clients.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = {
                count: 0,
                resetAt: now + windowMs
            };
            clients.set(key, entry);
        }

        entry.count += 1;

        res.setHeader(
            "RateLimit-Limit",
            String(max)
        );
        res.setHeader(
            "RateLimit-Remaining",
            String(Math.max(0, max - entry.count))
        );

        if (entry.count > max) {
            res.setHeader(
                "Retry-After",
                String(Math.ceil((entry.resetAt - now) / 1000))
            );

            return res.status(429).json({
                success: false,
                message
            });
        }

        next();
    };
}

module.exports = {
    createRateLimiter
};

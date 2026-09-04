# 4BITTERZS Backend Security Audit

## Fixed in this build

- Removed the committed/uploaded `.env` from the distributable backend.
- Added `.env.example` with placeholders only.
- Restricted CORS to `FRONTEND_ORIGINS` instead of allowing every browser origin.
- Added basic security response headers and disabled `X-Powered-By`.
- Added JSON body size limit.
- Added JSON 404 and centralized error responses so upload/CORS errors do not fall through to Express's default HTML error page.
- Added authentication rate limiting for login/register.
- Added bulk-import rate limiting.
- `requireAdmin` now checks the current database role instead of trusting a stale JWT role claim.
- Delivery OTP verification now checks that a non-admin user owns the order being verified.
- Added stronger registration/login input validation.
- Added checkout validation for shipping/payment methods and shipping field lengths.
- Bulk import is limited to 10 MB uploads, 20 imports/hour per client IP, and 1000 rows per import. CSV parsing uses `csv-parse`; Excel files currently use the existing `xlsx` dependency and should be reviewed/updated before production if a maintained replacement is available.

## Critical action before deployment

The uploaded development `.env` contained live-looking database/JWT/OTP secrets. Treat all of those values as compromised because they were included in an uploaded project archive.

Before production deployment, rotate:
1. PostgreSQL database password
2. JWT signing secret
3. Delivery OTP encryption secret

Do not put the replacement values in source control or a frontend bundle. Configure them as backend hosting environment variables.

## Remaining security work before production

- Move authentication from browser-readable bearer tokens to secure, HttpOnly, SameSite cookies if practical.
- Use HTTPS only in production.
- Set the production Netlify origin in `FRONTEND_ORIGINS`.
- Use a managed PostgreSQL instance with TLS and a least-privileged database user.
- Add a persistent/distributed rate limiter if the backend is deployed across multiple instances.
- Add automated tests for authorization, checkout concurrency, OTP ownership, order-status transitions, and admin actions.
- Review payment integration before enabling any non-COD payment method.
- Add request validation consistently to every admin CRUD endpoint.
- Review image URL policy and frontend rendering for XSS-safe handling.
- Add logging/monitoring without logging passwords, tokens, OTPs, or other secrets.

## Important business/security note

The current product design intentionally makes the delivery OTP visible to the customer on their own order page. That is compatible with the requested UX, but it means the customer can know the OTP. The delivery verification workflow should therefore be designed around the intended verifier (for example, a delivery/admin workflow) before production. This audit only prevents a customer from using their authenticated account to verify someone else's order.

## Fixes applied in this audit build

- Prevented cancelled orders from being moved back into another status, avoiding repeated inventory restoration.
- Removed the unused development-only `/api/admin/test` endpoint.
- Kept bulk CSV/XLSX/XLS support consistent between upload validation and parser messages.

## Deployment gate

The backend archive must not contain a real `.env` file. Rotate any credentials that were ever included in an uploaded/development archive before production.

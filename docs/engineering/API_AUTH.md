# Authentication API contract

All routes are prefixed with `/v1`.

| Method | Route                   | Request                                   | Response                                         |
| ------ | ----------------------- | ----------------------------------------- | ------------------------------------------------ |
| POST   | `/auth/signup`          | `{ "email": string, "password": string }` | `{ user, accessToken, refreshToken, expiresIn }` |
| POST   | `/auth/login`           | `{ "email": string, "password": string }` | `{ user, accessToken, refreshToken, expiresIn }` |
| POST   | `/auth/refresh`         | `{ "refreshToken": string }`              | `{ accessToken, refreshToken, expiresIn }`       |
| POST   | `/auth/password/forgot` | `{ "email": string }`                     | Generic recovery acknowledgement                 |
| POST   | `/auth/password/reset`  | `{ "token": string, "password": string }` | `{ "success": true }`                            |
| POST   | `/auth/logout`          | `Authorization: Bearer <accessToken>`     | `{ "success": true }`                            |
| GET    | `/auth/me`              | `Authorization: Bearer <accessToken>`     | `{ id, email, role, status, entitlements }`      |

Passwords are stored with salted scrypt hashes. Access tokens expire after 24 hours. Refresh tokens are signed, stored only as hashes, rotate on every successful refresh, and replay of a revoked token is rejected. Login failures are rate-limited per caller key. Responses never include password hashes, refresh-token hashes, or provider payloads.

Recovery requests return the same acknowledgement whether or not the email exists. Reset tokens are one-time, hashed at rest, expire after 30 minutes, and invalidate all active sessions after a successful password change. Mail delivery is accessed through the `PasswordResetMailer` port; development uses an in-process sink.

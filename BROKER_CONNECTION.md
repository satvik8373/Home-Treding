# mStock production connection

Use a Type A API key and the broker account that belongs to your dashboard workspace.

1. Open Connect mStock. Use the remembered verification method. If mStock shows Disable TOTP, Authenticator is enabled and SMS OTP is not sent. Otherwise select SMS OTP.
2. Enter your client code, API key and password. Complete the six-digit verification code.
3. Wait for the account check to confirm the session. A temporary read failure retries automatically using the encrypted saved token; do not generate another code just because the market stream reconnects.
4. Use the read-only account checks to verify funds, permissions and data access. Order-book access is not proof of a live fill.

When TOTP is enabled, mStock does not send an SMS OTP for the trading API login. Use the current authenticator code. The app does not remove or disable broker two-factor verification.

Access tokens expire within 12 hours or at midnight IST, whichever comes first. Expired or rejected tokens require a fresh login; passwords and OTPs are not stored for unattended renewal. Temporary verification failures use bounded retries (5–60 seconds); invalid credentials/API keys do not loop indefinitely.

Market streaming is separate from broker authentication. A stream reconnect does not log out the broker. Quiet subscribed contracts do not tear down a stream that is delivering other instruments. Outside normal weekday market hours, absent ticks alone do not force reconnects. Missing or stale prices never become executable prices just because the socket is open.

Execution IP setup is under API key & execution IP setup. Register the engine's observed outbound IP in mStock, not the browser/device IP or Vercel website address. IP registration must be completed in mStock. A fresh verified broker login can move a connection from a stopped, flat workspace with no pending order. The previous workspace keeps its history and loses its broker credentials; active sessions cannot be moved.

Official references:
- https://tradingapi.mstock.com/docs/v1/typeA/User/
- https://tradingapi.mstock.com/docs/v1/Introduction/
- https://tradingapi.mstock.com/docs/v1/typeA/error-codes/

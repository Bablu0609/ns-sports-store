NS SPORTS — CRICKET EQUIPMENT STORE (CUSTOMIZED PROJECT)
=======================================================

PROJECT FILES
-------------
ns_sports_website.html : Frontend storefront (HTML/CSS/JavaScript)
server.js              : Node.js + Express API, MySQL, secure Razorpay verification
database_setup.sql     : MySQL database and sample products
package.json           : Dependencies and start command
.env.example           : Safe environment template (copy to .env)
.gitignore             : Excludes secrets and node_modules

SETUP (WINDOWS)
---------------
1. Install Node.js LTS and MySQL.
2. Open MySQL Workbench, run database_setup.sql.
3. Copy .env.example to .env and enter your own MySQL credentials.
4. Use Razorpay TEST API keys in .env to test checkout. Do not use live keys until your account is approved.
5. Open PowerShell in this folder and run: npm install
6. Start backend: npm start
7. Open http://localhost:3000/api/health to check the API/database.
8. Serve ns_sports_website.html from a local web server (for example VS Code Live Server).
   Keep the backend at http://localhost:3000 or update the API constant in the HTML.

PRODUCT IMAGES
--------------
Products now show built-in illustrations by default. Use the product's Upload Photo control
to choose your own genuine product photo. Uploaded photos are currently saved in that browser's
localStorage, so they do not automatically sync across devices or browsers.

PAYMENTS — IMPORTANT
--------------------
- Razorpay checkout requires your own Razorpay TEST keys in .env. The server creates gateway
  orders and verifies the payment signature before saving an order as Paid.
- UPI/manual orders are NOT automatically marked Paid. Verify receipt/reference in your UPI
  merchant app before changing an order's status. A UPI deep link or screenshot alone is not proof.
- Configure your own business WhatsApp number, UPI ID and QR code before publishing. The previous
  project's personal payment/contact details and QR image have been removed/replaced with setup hints.
- Never put RAZORPAY_KEY_SECRET in the HTML or share the .env file.
- Before public deployment, restrict CORS to your real domain, use HTTPS, add admin authentication,
  and test inventory/payment failure cases.

PROJECT CUSTOMIZATION
---------------------
Store branding is NS SPORTS. Update product names/prices/stock in database_setup.sql or MySQL.
Update your verified contact details in the website and Admin > Contact Settings before launch.

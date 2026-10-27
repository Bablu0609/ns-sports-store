const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ns_sports_bablu',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();
const PORT = Number(process.env.APP_PORT || 3000);
const money = value => Number(value || 0);
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ok:true, service:'NS SPORTS API', database:'connected'}); }
  catch (_err) { res.status(503).json({ok:false, service:'NS SPORTS API', database:'unavailable'}); }
});

app.get('/api/products', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products ORDER BY created_at, id');
    res.json(rows);
  } catch (_err) { res.status(503).json({error:'Product database unavailable. Check MySQL setup.'}); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({error:'Product not found'});
    res.json(rows[0]);
  } catch (_err) { res.status(503).json({error:'Product database unavailable.'}); }
});

function validateCustomer(body) {
  if (!validText(body.customer_name, 100)) return 'Enter a valid customer name.';
  if (typeof body.customer_phone !== 'string' || !/^\d{10}$/.test(body.customer_phone)) return 'Enter a valid 10-digit phone number.';
  if (!validText(body.customer_address, 1000)) return 'Enter a complete delivery address.';
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) return 'Cart is empty or contains too many items.';
  for (const item of body.items) {
    if (!item || typeof item.product_id !== 'string' || item.product_id.length > 20 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 50) return 'Invalid product or quantity in cart.';
  }
  return null;
}

async function calculateCart(items, promoCode) {
  const ids = [...new Set(items.map(i => i.product_id))];
  const [products] = await db.query('SELECT id, name, price, stock FROM products WHERE id IN (?)', [ids]);
  const byId = new Map(products.map(p => [String(p.id), p]));
  let subtotal = 0;
  const validated = [];
  for (const item of items) {
    const p = byId.get(item.product_id);
    const quantity = Number(item.quantity);
    if (!p) throw new Error(`Product ${item.product_id} was not found.`);
    if (Number(p.stock) < quantity) throw new Error(`${p.name} does not have enough stock.`);
    const unitPrice = money(p.price);
    subtotal += unitPrice * quantity;
    validated.push({ product_id: p.id, product_name: p.name, quantity, unit_price: unitPrice, total_price: unitPrice * quantity });
  }
  const discount = String(promoCode || '').trim().toUpperCase() === 'NSSPORTS10' ? Math.round(subtotal * 0.10) : 0;
  const delivery = subtotal >= 1499 ? 0 : 60;
  return {items: validated, subtotal, discount, delivery, total: subtotal - discount + delivery};
}

// Razorpay secrets stay on the server. Never put the secret key in website JavaScript.
app.post('/api/payments/razorpay/order', async (req, res) => {
  const problem = validateCustomer(req.body || {});
  if (problem) return res.status(400).json({error:problem});
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({error:'Online payment is not configured. Add Razorpay test keys to .env before checkout.'});
  }
  try {
    const cart = await calculateCart(req.body.items, req.body.promo_code);
    const Razorpay = require('razorpay');
    const gateway = new Razorpay({key_id:process.env.RAZORPAY_KEY_ID, key_secret:process.env.RAZORPAY_KEY_SECRET});
    const order = await gateway.orders.create({amount:cart.total * 100, currency:'INR', receipt:`nss_${Date.now()}`, notes:{store:'NS SPORTS'}});
    res.json({razorpay_order_id:order.id, amount:order.amount, currency:order.currency, key_id:process.env.RAZORPAY_KEY_ID});
  } catch (err) {
    res.status(400).json({error:err.message || 'Could not create payment order.'});
  }
});

app.post('/api/payments/razorpay/verify', async (req, res) => {
  const body = req.body || {};
  const problem = validateCustomer(body);
  if (problem) return res.status(400).json({error:problem});
  if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({error:'Payment verification is not configured.'});
  const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = body;
  if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(v => typeof v === 'string' && v.length < 256)) {
    return res.status(400).json({error:'Missing payment verification fields.'});
  }
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(razorpay_signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({error:'Payment signature could not be verified.'});
  const Razorpay = require('razorpay');
  const gateway = new Razorpay({key_id:process.env.RAZORPAY_KEY_ID, key_secret:process.env.RAZORPAY_KEY_SECRET});
  let gatewayOrder, gatewayPayment;
  try {
    [gatewayOrder, gatewayPayment] = await Promise.all([gateway.orders.fetch(razorpay_order_id), gateway.payments.fetch(razorpay_payment_id)]);
  } catch (_err) { return res.status(400).json({error:'Could not verify payment details with Razorpay.'}); }
  if (gatewayPayment.order_id !== razorpay_order_id || !['authorized','captured'].includes(gatewayPayment.status)) return res.status(400).json({error:'Payment is not authorized or captured for this order.'});
  const connection = await db.getConnection();
  try {
    const cart = await calculateCart(body.items, body.promo_code);
    if (Number(gatewayOrder.amount) !== cart.total * 100 || Number(gatewayPayment.amount) !== cart.total * 100 || gatewayOrder.currency !== 'INR' || gatewayPayment.currency !== 'INR') {
      throw new Error('Paid amount does not match the validated cart. Contact the store before retrying.');
    }
    const [existingPayment] = await connection.query('SELECT id FROM payments WHERE razorpay_id = ? LIMIT 1', [razorpay_payment_id]);
    if (existingPayment.length) return res.status(409).json({error:'This payment has already been used for an order.'});
    await connection.beginTransaction();
    const [orderResult] = await connection.query(
      'INSERT INTO orders (customer_name, customer_phone, customer_address, total_amount, delivery_charge, discount_amount, promo_code, payment_method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [body.customer_name.trim(), body.customer_phone, body.customer_address.trim(), cart.total, cart.delivery, cart.discount, body.promo_code || null, 'Razorpay', 'Paid', `Gateway order: ${razorpay_order_id}`]
    );
    const orderId = orderResult.insertId;
    const values = cart.items.map(i => [orderId, i.product_id, i.product_name, i.quantity, i.unit_price, i.total_price]);
    await connection.query('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES ?', [values]);
    await connection.query('INSERT INTO payments (order_id, amount, payment_method, razorpay_id, status, paid_at) VALUES (?, ?, ?, ?, ?, NOW())', [orderId, cart.total, 'Razorpay', razorpay_payment_id, 'Paid']);
    for (const item of cart.items) await connection.query('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.product_id, item.quantity]);
    await connection.commit();
    res.json({success:true, order_id:orderId, message:'Payment verified and order saved.'});
  } catch (err) {
    await connection.rollback();
    res.status(400).json({error:err.message || 'Could not save verified order.'});
  } finally { connection.release(); }
});

// Keep the existing WhatsApp/manual order API, but derive all prices from MySQL.
app.post('/api/orders', async (req, res) => {
  const body = req.body || {};
  const problem = validateCustomer(body);
  if (problem) return res.status(400).json({error:problem});
  const connection = await db.getConnection();
  try {
    const cart = await calculateCart(body.items, body.promo_code);
    const method = ['UPI','COD','WhatsApp'].includes(body.payment_method) ? body.payment_method : 'WhatsApp';
    const paymentRef = typeof body.payment_ref === 'string' && body.payment_ref.trim() ? 'Customer-reported ref: ' + body.payment_ref.trim().slice(0, 60) : null;
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO orders (customer_name, customer_phone, customer_address, total_amount, delivery_charge, discount_amount, promo_code, payment_method, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [body.customer_name.trim(), body.customer_phone, body.customer_address.trim(), cart.total, cart.delivery, cart.discount, body.promo_code || null, method, method === 'COD' ? 'Pending - cash on delivery' : 'Pending payment verification', paymentRef]
    );
    const values = cart.items.map(i => [result.insertId, i.product_id, i.product_name, i.quantity, i.unit_price, i.total_price]);
    await connection.query('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES ?', [values]);
    await connection.commit();
    res.status(201).json({success:true, order_id:result.insertId, total_amount:cart.total, message:'Order request saved; payment has not been verified.'});
  } catch (err) {
    await connection.rollback(); res.status(400).json({error:err.message || 'Could not save order.'});
  } finally { connection.release(); }
});

app.get('/api/orders', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT id, customer_name, customer_phone, total_amount, payment_method, status, created_at FROM orders ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (_err) { res.status(503).json({error:'Order database unavailable.'}); }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const allowed = ['Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled', 'Pending payment verification'];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({error:'Invalid order status.'});
  try {
    const [result] = await db.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({error:'Order not found.'});
    res.json({success:true});
  } catch (_err) { res.status(503).json({error:'Could not update order status.'}); }
});

app.post('/api/users', async (req, res) => {
  const {name, phone, email, address, city, pincode} = req.body || {};
  if (!validText(name,100) || typeof phone !== 'string' || !/^\d{10}$/.test(phone)) return res.status(400).json({error:'Valid name and 10-digit phone are required.'});
  try {
    const [result] = await db.query('INSERT INTO users (name, phone, email, address, city, pincode) VALUES (?, ?, ?, ?, ?, ?)', [name.trim(), phone, email || null, address || null, city || 'Mumbai', pincode || null]);
    res.status(201).json({success:true, user_id:result.insertId});
  } catch (err) { res.status(400).json({error:err.code === 'ER_DUP_ENTRY' ? 'Phone number already registered.' : 'Could not save customer.'}); }
});


// ---- Store settings (UPI QR) editable from the Admin panel ----
const fs = require('fs');
const path = require('path');
const SETTINGS_FILE = path.join(__dirname, 'store_settings.json');
const readSettings = () => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (_e) { return {}; } };
const adminOk = req => {
  const expected = process.env.ADMIN_PASSWORD || '';
  const given = String(req.get('x-admin-key') || '');
  if (!expected) return 'not-configured';
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Public: the storefront reads the current UPI details/QR from here.
app.get('/api/settings', (_req, res) => {
  const u = readSettings().upi || {};
  res.json({ upi: { id: u.id || '', payee: u.payee || '', qrImage: u.qrImage || '' } });
});

// Admin only: change UPI ID, name and QR image. Needs ADMIN_PASSWORD in .env.
app.put('/api/settings/upi', (req, res) => {
  const ok = adminOk(req);
  if (ok === 'not-configured') return res.status(503).json({ error: 'Set ADMIN_PASSWORD in .env and restart the server.' });
  if (!ok) return res.status(401).json({ error: 'Wrong admin password.' });
  const { id, payee, qrImage } = req.body || {};
  if (typeof id !== 'string' || !/^[\w.\-]{2,}@[\w]{2,}$/.test(id.trim())) return res.status(400).json({ error: 'Enter a valid UPI ID, like name@bank.' });
  if (!validText(payee, 60)) return res.status(400).json({ error: 'Enter the payee name (max 60 characters).' });
  if (typeof qrImage !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(qrImage) || qrImage.length > 800000)
    return res.status(400).json({ error: 'QR image must be a PNG/JPG/WebP under about 600 KB.' });
  const settings = readSettings();
  settings.upi = { id: id.trim(), payee: payee.trim(), qrImage };
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings)); }
  catch (_e) { return res.status(500).json({ error: 'Could not save settings on the server.' }); }
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`NS SPORTS API running on http://localhost:${PORT}`));

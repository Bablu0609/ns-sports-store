-- NS Sports Database Setup
-- Run this in MySQL Workbench

CREATE DATABASE IF NOT EXISTS ns_sports;
USE ns_sports;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) DEFAULT 'NS Sports',
  category VARCHAR(50) NOT NULL,
  price INT NOT NULL,
  original_price INT,
  stock INT DEFAULT 20,
  badge VARCHAR(50),
  description TEXT,
  emoji VARCHAR(10) DEFAULT '🏏',
  rating DECIMAL(2,1) DEFAULT 5.0,
  reviews INT DEFAULT 0,
  bought_label VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(100),
  address TEXT,
  city VARCHAR(50) DEFAULT 'Mumbai',
  pincode VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(15) NOT NULL,
  customer_address TEXT,
  total_amount INT NOT NULL,
  delivery_charge INT DEFAULT 0,
  discount_amount INT DEFAULT 0,
  promo_code VARCHAR(20),
  payment_method VARCHAR(20) DEFAULT 'UPI',
  status VARCHAR(30) DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id VARCHAR(20) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL,
  total_price INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  amount INT NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  upi_reference VARCHAR(100),
  razorpay_id VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'Pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Insert Products
INSERT IGNORE INTO products (id, name, category, price, original_price, stock, badge, description, emoji, rating, reviews, bought_label) VALUES
('p1', 'NS Sports Thunder Strike Pro — Grade 1 English Willow Box Cricket Bat', 'pro', 3499, 4999, 12, '#1 Best Seller', 'Grade 1 English Willow crafted specifically for box cricket.', '🏏', 4.9, 128, '200+ bought last month'),
('p2', 'NS Sports Street Warrior — Kashmir Willow Box Cricket Bat', 'starter', 999, NULL, 28, 'Value Pick', 'Kashmir willow entry-level bat perfect for colony cricket.', '🪵', 4.3, 64, '500+ bought last month'),
('p3', 'NS Sports Lightning Rod — Carbon Composite Handle | Elite English Willow', 'pro', 5299, NULL, 5, 'New Arrival', 'Ultra-light carbon composite handle with premium English Willow blade.', '⚡', 4.8, 42, '50+ bought last month'),
('p4', 'NS Sports Blaze Master — Wide Edge Kashmir Willow | Club Cricket Bat', 'club', 2199, 2799, 18, '21% Off', 'Wide edge profile and reinforced spine for club tournament.', '🔥', 4.4, 87, '150+ bought last month'),
('p5', 'NS Sports Young Gun — Junior Box Cricket Bat | Size 4/5/6', 'junior', 799, NULL, 22, 'Junior Pick', 'Specially designed lightweight bat for junior players aged 8-16.', '🎯', 4.7, 31, '100+ bought last month'),
('a1', 'NS Batting Gloves', 'accessories', 499, NULL, 15, '', 'Premium batting gloves for box cricket.', '🧤', 4.2, 0, ''),
('a2', 'NS Batting Pads', 'accessories', 699, NULL, 12, '', 'Lightweight batting pads for protection.', '🦵', 4.1, 0, ''),
('a3', 'NS Cricket Helmet', 'accessories', 899, NULL, 10, '', 'Safety cricket helmet with strong grill.', '⛑️', 4.3, 0, ''),
('a4', 'NS Bat Grip Tape', 'accessories', 199, NULL, 50, '', 'Anti-slip bat grip tape.', '🎿', 4.0, 0, ''),
('a5', 'NS Cricket Bag', 'accessories', 1299, NULL, 8, '', 'Spacious cricket kit bag.', '🎒', 4.4, 0, ''),
('a6', 'NS Ball Pack (6)', 'accessories', 349, NULL, 30, '', 'Pack of 6 tennis balls for box cricket.', '🏏', 4.2, 0, '');

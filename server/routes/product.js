import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../models/db.js';
import { createProduct, getApprovedProducts, getApprovedProductsCount, getProductById, searchProducts, searchProductsCount, getCategories } from '../models/product.js';

const router = express.Router();

// ensure upload directory exists under project root (../img/uploads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', '..', 'img', 'uploads');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  console.error('Failed to create upload directory', uploadDir, e);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}



// Show all approved products or search by query with pagination
router.get('/products', async (req, res) => {
  const q = req.query.q;
  const categoryId = req.query.categoryId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  let products, totalCount;
  
  if (q || categoryId) {
    products = await searchProducts(q, categoryId, limit, offset);
    totalCount = await searchProductsCount(q, categoryId);
  } else {
    products = await getApprovedProducts(limit, offset);
    totalCount = await getApprovedProductsCount();
  }
  
  const totalPages = Math.ceil(totalCount / limit);
  
  res.json({
    products,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
});

// Product detail
router.get('/products/:id', async (req, res) => {
  const product = await getProductById(req.params.id);
  if (!product) return res.status(404).send('Not found');
  res.json(product);
});

// User submits a new product
router.post('/products', requireLogin, upload.single('image'), async (req, res) => {
  const { name, price, categoryId, description } = req.body;
  let imagePath = '';
  if (req.file) {
    // expose path relative to served static root
    imagePath = `/img/uploads/${req.file.filename}`;
  }
  if (!name || !price || !imagePath || !categoryId || !description) return res.status(400).send('All fields required');

  // Sanitize price: remove currency symbols/commas and parse to float
  const cleaned = String(price).replace(/[^0-9.\-]/g, '');
  const numericPrice = parseFloat(cleaned);
  if (Number.isNaN(numericPrice)) return res.status(400).send('Invalid price');

  try {
    await createProduct({ 
      name, 
      price: numericPrice, 
      image: imagePath, 
      userId: req.session.user.id, 
      categoryId,
      description 
    });
    
    res.send('Product posted');
  } catch (err) {
    console.error('Error creating product', err);
    res.status(500).send('Failed to save product');
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  const categories = await getCategories();
  res.json(categories);
});


export default router;

/**
 * Product Controller
 *
 * ⚠️ DELIBERATELY FLAWED — Contains bugs for the Swarm to fix.
 * Bug 1: getProductById - no bounds checking on array index conversion
 * Bug 2: searchProducts - crashes on regex construction with special chars
 * Bug 3: applyDiscount - division by zero when discount is 100%
 */

const products = [
  { id: '1', name: 'Mechanical Keyboard', price: 149.99, category: 'electronics', stock: 25, tags: ['gaming', 'peripherals'] },
  { id: '2', name: 'Wireless Mouse', price: 59.99, category: 'electronics', stock: 50, tags: ['gaming', 'wireless'] },
  { id: '3', name: 'USB-C Hub', price: 39.99, category: 'electronics', stock: 100, tags: ['accessories'] },
  { id: '4', name: 'Standing Desk', price: 499.99, category: 'furniture', stock: 10, tags: ['ergonomic', 'office'] },
  { id: '5', name: 'Monitor Arm', price: 89.99, category: 'furniture', stock: 0, tags: ['ergonomic'] },
];

/**
 * GET /api/products
 */
exports.getAllProducts = (req, res) => {
  const { category } = req.query;
  let result = products;
  if (category) {
    result = products.filter(p => p.category === category);
  }
  res.json({ success: true, data: result, count: result.length });
};

/**
 * GET /api/products/:id
 * 🐛 BUG: Uses parseInt without validation — NaN causes crash on .toUpperCase()
 */
exports.getProductById = (req, res, next) => {
  try {
    const product = products.find(p => p.id === req.params.id);
    // BUG: Accessing property on potentially undefined product
    if (!product) { return res.status(404).json({ success: false, message: 'Product not found' }); }
const displayName = product.name.toUpperCase();
    res.json({ success: true, data: { ...product, displayName } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/search?q=...
 * 🐛 BUG: Directly uses user input as regex — special chars like ( or [ crash it
 */
exports.searchProducts = (req, res, next) => {
  try {
    const query = req.query.q;
    // BUG: User-supplied string used directly in RegExp without escaping
    const regex = new RegExp(query, 'i');
    const results = products.filter(p => regex.test(p.name));
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/:id/discount
 * 🐛 BUG: Division by zero when discount = 100, and no check for discount > 100
 */
exports.applyDiscount = (req, res, next) => {
  try {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      return next(err);
    }
    
    const { discount_percent } = req.body;
    // BUG: No validation. If discount_percent is 100, we get division by zero.
    // If > 100, we get negative prices.
    const factor = 100 / (100 - discount_percent);
    const originalPrice = product.price * factor;
    product.price = product.price * (1 - discount_percent / 100);

    res.json({
      success: true,
      data: product,
      savings: originalPrice - product.price
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products
 */
exports.createProduct = (req, res, next) => {
  try {
    const { name, price, category, stock, tags } = req.body;
    // BUG: No null check on name — .toLowerCase() crashes
    const normalizedCategory = category.toLowerCase();
    const newProduct = {
      id: String(products.length + 1),
      name,
      price: parseFloat(price) || 0,
      category: normalizedCategory,
      stock: parseInt(stock) || 0,
      tags: tags || []
    };
    products.push(newProduct);
    res.status(201).json({ success: true, data: newProduct });
  } catch (err) {
    next(err);
  }
};

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getAllProducts);
router.get('/search', productController.searchProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.post('/:id/discount', productController.applyDiscount);

module.exports = router;

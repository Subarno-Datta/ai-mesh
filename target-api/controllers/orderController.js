/**
 * Order Controller
 *
 * ⚠️ DELIBERATELY FLAWED — Contains bugs for the Swarm to fix.
 * Bug 1: createOrder - crashes when items array is undefined (no body validation)
 * Bug 2: getOrderTotal - reduce on empty array without initial value
 * Bug 3: cancelOrder - doesn't check status before canceling (double-cancel crash)
 */

const orders = [
  {
    id: 'ORD-001',
    userId: '1',
    items: [
      { productId: '1', quantity: 2, price: 149.99 },
      { productId: '3', quantity: 1, price: 39.99 }
    ],
    status: 'completed',
    createdAt: '2026-05-01T10:00:00Z'
  },
  {
    id: 'ORD-002',
    userId: '2',
    items: [
      { productId: '2', quantity: 1, price: 59.99 }
    ],
    status: 'pending',
    createdAt: '2026-05-07T14:30:00Z'
  }
];

let orderCount = 3;

/**
 * GET /api/orders
 */
exports.getAllOrders = (req, res) => {
  const { userId } = req.query;
  let result = orders;
  if (userId) {
    result = orders.filter(o => o.userId === userId);
  }
  res.json({ success: true, data: result, count: result.length });
};

/**
 * GET /api/orders/:id
 */
exports.getOrderById = (req, res, next) => {
  try {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      return next(err);
    }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders
 * 🐛 BUG: No validation on req.body.items — calling .map on undefined crashes
 */
exports.createOrder = (req, res, next) => {
  try {
    const { userId, items } = req.body;
    // BUG: items could be undefined, .map() on undefined throws TypeError
    const processedItems = items.map(item => ({
       productId: item.productId,
       quantity: item.quantity,
       price: item.price,
       subtotal: item.quantity * item.price
    }));

    const newOrder = {
      id: `ORD-${String(orderCount++).padStart(3, '0')}`,
      userId,
      items: processedItems,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    res.status(201).json({ success: true, data: newOrder });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id/total
 * 🐛 BUG: reduce without initial value on potentially empty items array
 */
exports.getOrderTotal = (req, res, next) => {
  try {
    const order = orders.find(o => o.id === req.params.id);
    // BUG: No null check on order
    // BUG: reduce without initial value crashes on empty array
    const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity));
    
    res.json({ success: true, orderId: order.id, total: total.toFixed(2) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders/:id/cancel
 * 🐛 BUG: Doesn't check current status — cancelling a 'cancelled' order crashes
 *          because it tries to access .refund on undefined config
 */
exports.cancelOrder = (req, res, next) => {
  try {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      return next(err);
    }

    const statusConfig = {
      pending: { refund: true, notify: true },
      completed: { refund: true, notify: true },
    };

    // BUG: If status is 'cancelled', statusConfig['cancelled'] is undefined
    // Accessing .refund on undefined throws TypeError
    const config = statusConfig[order.status];
    if (config.refund) {
      // Process refund...
    }

    order.status = 'cancelled';
    res.json({ success: true, data: order, refunded: config.refund });
  } catch (err) {
    next(err);
  }
};

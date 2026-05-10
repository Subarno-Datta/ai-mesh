/**
 * User Controller
 * 
 * ⚠️ DELIBERATELY FLAWED — These contain bugs that the Swarm will detect and fix.
 * Bug 1: getUserById - doesn't check if user exists before accessing properties
 * Bug 2: createUser - no validation on required fields, crashes on null name
 * Bug 3: updateUser - accesses nested property without null checks
 */

// In-memory "database" for demonstration
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', profile: { bio: 'Engineer', avatar: 'alice.png' } },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'user', profile: { bio: 'Designer', avatar: 'bob.png' } },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'user', profile: { bio: 'Manager', avatar: null } },
];

let nextId = 4;

/**
 * GET /api/users
 */
exports.getAllUsers = (req, res) => {
  res.json({ success: true, data: users, count: users.length });
};

/**
 * GET /api/users/:id
 * 🐛 BUG: No null check — if user not found, accessing .name throws TypeError
 */
exports.getUserById = (req, res, next) => {
  try {
    const user = users.find(u => u.id === req.params.id);
    // BUG: Accessing .name on potentially undefined 'user'
    if (!user) {
  return res.status(404).json({ success: false, message: 'User not found' });
}
const greeting = `Hello, ${user.name}!`;
res.json({ success: true, data: user, greeting });
    res.json({ success: true, data: user, greeting });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users
 * 🐛 BUG: No validation — crashes when name is null/undefined during .trim()
 */
exports.createUser = (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    // BUG: Calling .trim() on potentially null/undefined 'name'
    const sanitizedName = (name || '').trim();
    const newUser = {
      id: String(nextId++),
      name: sanitizedName,
      email: email,
      role: role || 'user',
      profile: { bio: '', avatar: null }
    };
    users.push(newUser);
    res.status(201).json({ success: true, data: newUser });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * 🐛 BUG: Accesses nested profile.bio.length without checking if profile or bio exists
 */
exports.updateUser = (req, res, next) => {
  try {
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }

    const { name, email, profile } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;

    // BUG: Accessing nested property without null check
    if (profile) {
      const bioLength = profile.bio ? profile.bio.length : 0;  // crashes if bio is null
      if (bioLength > 500) {
        const err = new Error('Bio too long');
        err.statusCode = 400;
        return next(err);
      }
      user.profile = { ...user.profile, ...profile };
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 */
exports.deleteUser = (req, res, next) => {
  try {
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) {
      const err = new Error('User not found');
      err.statusCode = 404;
      return next(err);
    }
    const deleted = users.splice(index, 1);
    res.json({ success: true, data: deleted[0] });
  } catch (err) {
    next(err);
  }
};

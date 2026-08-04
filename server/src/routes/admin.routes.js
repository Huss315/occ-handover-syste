const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = express.Router();

// All routes here require Admin role
router.use(authMiddleware, requireRole('Admin'));

// POST /api/admin/users
// Body: { fullName, username, email, password, roleName }
router.post('/users', async (req, res) => {
  try {
    const { fullName, username, email, password, roleName } = req.body;

    if (!fullName || !username || !password || !roleName) {
      return res.status(400).json({ error: 'fullName, username, password, and roleName are required.' });
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return res.status(400).json({ error: `Role "${roleName}" does not exist.` });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName,
        username,
        email: email || null,
        passwordHash,
        roleId: role.id,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'Create',
        entityName: 'User',
        entityId: newUser.id,
        details: `Created user ${username}`,
      },
    });

    // Don't send back the password hash
    const { passwordHash: _, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the user.' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { fullName: 'asc' },
    });
    const safeUsers = users.map(({ passwordHash, ...u }) => u);
    res.json({ users: safeUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching users.' });
  }
});

// PATCH /api/admin/users/:id
// Body: any of { fullName, email, roleName, isActive }
router.patch('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { fullName, email, roleName, isActive } = req.body;

    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email;
    if (isActive !== undefined) data.isActive = isActive;

    if (roleName !== undefined) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        return res.status(400).json({ error: `Role "${roleName}" does not exist.` });
      }
      data.roleId = role.id;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'AdminChange',
        entityName: 'User',
        entityId: userId,
        details: `Updated user fields: ${Object.keys(data).join(', ')}`,
      },
    });

    const { passwordHash: _, ...safeUser } = updatedUser;
    res.json({ user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the user.' });
  }
});

// PATCH /api/admin/users/:id/deactivate
router.patch('/users/:id/deactivate', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'AdminChange',
        entityName: 'User',
        entityId: userId,
        details: 'Deactivated user',
      },
    });

    const { passwordHash: _, ...safeUser } = updatedUser;
    res.json({ user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deactivating the user.' });
  }
});

module.exports = router;
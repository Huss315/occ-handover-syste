const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Find user, including their role name
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/refresh — issue a fresh token for a logged-in, still-active user
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account is no longer active.' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong refreshing the session.' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.get('/admin-only', authMiddleware, requireRole('Admin'), (req, res) => {
  res.json({ message: 'Welcome, Admin! This route is protected by role.' });
});

// GET /api/auth/employees — active non-Admin users, for employee-selection lists
router.get('/employees', authMiddleware, async (req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { not: 'Admin' } },
      },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
    res.json({ employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching employees.' });
  }
});

module.exports = router;
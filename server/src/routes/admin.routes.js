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
// POST /api/admin/fixed-tasks
// Body: { taskName, description, shiftId }
router.post('/fixed-tasks', async (req, res) => {
  try {
    const { taskName, description, shiftId } = req.body;

    if (!taskName || !shiftId) {
      return res.status(400).json({ error: 'taskName and shiftId are required.' });
    }

    const newTask = await prisma.fixedTask.create({
      data: {
        taskName,
        description: description || null,
        shiftId,
        isActive: true,
        createdById: req.user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'Create',
        entityName: 'FixedTask',
        entityId: newTask.id,
        details: `Created fixed task "${taskName}"`,
      },
    });

    res.status(201).json({ fixedTask: newTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the fixed task.' });
  }
});

// GET /api/admin/fixed-tasks
router.get('/fixed-tasks', async (req, res) => {
  try {
    const tasks = await prisma.fixedTask.findMany({
      include: { shift: true },
      orderBy: { taskName: 'asc' },
    });
    res.json({ fixedTasks: tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching fixed tasks.' });
  }
});

// PATCH /api/admin/fixed-tasks/:id
// Body: any of { taskName, description, shiftId, isActive }
router.patch('/fixed-tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { taskName, description, shiftId, isActive } = req.body;

    const data = {};
    if (taskName !== undefined) data.taskName = taskName;
    if (description !== undefined) data.description = description;
    if (shiftId !== undefined) data.shiftId = shiftId;
    if (isActive !== undefined) data.isActive = isActive;

    const updatedTask = await prisma.fixedTask.update({
      where: { id: taskId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'AdminChange',
        entityName: 'FixedTask',
        entityId: taskId,
        details: `Updated fixed task fields: ${Object.keys(data).join(', ')}`,
      },
    });

    res.json({ fixedTask: updatedTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the fixed task.' });
  }
});

// PATCH /api/admin/fixed-tasks/:id/deactivate
router.patch('/fixed-tasks/:id/deactivate', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);

    const updatedTask = await prisma.fixedTask.update({
      where: { id: taskId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'AdminChange',
        entityName: 'FixedTask',
        entityId: taskId,
        details: 'Deactivated fixed task',
      },
    });

    res.json({ fixedTask: updatedTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deactivating the fixed task.' });
  }
});
// POST /api/admin/fixed-notes
router.post('/fixed-notes', async (req, res) => {
  try {
    const { noteText, shiftId } = req.body;
    if (!noteText || !shiftId) {
      return res.status(400).json({ error: 'noteText and shiftId are required.' });
    }
    const newNote = await prisma.fixedNote.create({
      data: { noteText, shiftId, isActive: true, createdById: req.user.userId },
    });
    await prisma.auditLog.create({
      data: { userId: req.user.userId, actionType: 'Create', entityName: 'FixedNote', entityId: newNote.id, details: 'Created fixed note' },
    });
    res.status(201).json({ fixedNote: newNote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the fixed note.' });
  }
});

// GET /api/admin/fixed-notes
router.get('/fixed-notes', async (req, res) => {
  try {
    const notes = await prisma.fixedNote.findMany({ include: { shift: true }, orderBy: { createdAt: 'desc' } });
    res.json({ fixedNotes: notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching fixed notes.' });
  }
});

// PATCH /api/admin/fixed-notes/:id/deactivate
router.patch('/fixed-notes/:id/deactivate', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const updated = await prisma.fixedNote.update({ where: { id: noteId }, data: { isActive: false } });
    await prisma.auditLog.create({
      data: { userId: req.user.userId, actionType: 'AdminChange', entityName: 'FixedNote', entityId: noteId, details: 'Deactivated fixed note' },
    });
    res.json({ fixedNote: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deactivating the fixed note.' });
  }
});
module.exports = router;
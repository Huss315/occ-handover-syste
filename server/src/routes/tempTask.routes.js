const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/temp-tasks
// Body: { taskTitle: "...", description: "...", targetDate: "2026-08-05", targetShiftId: 3 }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { taskTitle, description, targetDate, targetShiftId } = req.body;

    if (!taskTitle || !targetDate || !targetShiftId) {
      return res.status(400).json({ error: 'taskTitle, targetDate, and targetShiftId are required.' });
    }

    const tempTask = await prisma.temporaryTask.create({
      data: {
        taskTitle,
        description: description || null,
        targetDate: new Date(targetDate),
        targetShiftId,
        createdById: req.user.userId,
      },
    });

    res.status(201).json({ tempTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the temporary task.' });
  }
});

module.exports = router;
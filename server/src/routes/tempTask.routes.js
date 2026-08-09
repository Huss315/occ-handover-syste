const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/temp-tasks — all temp tasks, any authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tempTasks = await prisma.temporaryTask.findMany({
      include: { targetShift: true, createdBy: { select: { fullName: true } } },
      orderBy: { targetDate: 'asc' },
    });
    res.json({ tempTasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching temporary tasks.' });
  }
});
// POST /api/temp-tasks
// Body: { taskTitle: "...", description: "...", targetDate: "2026-08-05", targetShiftId: 3 }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { taskTitle, description, targetDate, targetShiftId } = req.body;

   if (!taskTitle || !targetDate || !targetShiftId) {
      return res.status(400).json({ error: 'taskTitle, targetDate, and targetShiftId are required.' });
    }

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const parsedTargetDate = new Date(targetDate);

    if (parsedTargetDate < todayUTC) {
      return res.status(400).json({ error: 'Target date must be today or in the future.' });
    }

    const conflictingSession = await prisma.shiftSession.findFirst({
      where: { shiftDate: parsedTargetDate, shiftId: targetShiftId },
    });
    if (conflictingSession) {
      return res.status(400).json({ error: 'That shift has already started or completed for that date.' });
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
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const existing = await prisma.temporaryTask.findUnique({ where: { id: taskId } });
    if (!existing) return res.status(404).json({ error: 'Temporary task not found.' });
    if (existing.isDelivered) {
      return res.status(400).json({ error: 'This task\'s shift has already started and can no longer be edited.' });
    }

    const { taskTitle, description, targetDate, targetShiftId } = req.body;
    const data = {};
    if (taskTitle !== undefined) data.taskTitle = taskTitle;
    if (description !== undefined) data.description = description;
    if (targetShiftId !== undefined) data.targetShiftId = targetShiftId;
    if (targetDate !== undefined) {
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const parsedTargetDate = new Date(targetDate);
      if (parsedTargetDate < todayUTC) {
        return res.status(400).json({ error: 'Target date must be today or in the future.' });
      }
      const checkShiftId = targetShiftId !== undefined ? targetShiftId : existing.targetShiftId;
      const conflictingSession = await prisma.shiftSession.findFirst({
        where: { shiftDate: parsedTargetDate, shiftId: checkShiftId },
      });
      if (conflictingSession) {
        return res.status(400).json({ error: 'That shift has already started or completed for that date.' });
      }
      data.targetDate = parsedTargetDate;
    }

    const updated = await prisma.temporaryTask.update({ where: { id: taskId }, data });
    res.json({ tempTask: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the temporary task.' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const existing = await prisma.temporaryTask.findUnique({ where: { id: taskId } });
    if (!existing) return res.status(404).json({ error: 'Temporary task not found.' });
    if (existing.isDelivered) {
      return res.status(400).json({ error: 'This task\'s shift has already started and can no longer be deleted.' });
    }
    await prisma.temporaryTask.delete({ where: { id: taskId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deleting the temporary task.' });
  }
});

module.exports = router;
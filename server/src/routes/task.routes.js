const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// PATCH /api/tasks/:id
// Body: { status: "Running" }  -- allowed values: NotDone, Running, Done
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const allowedStatuses = ['NotDone', 'Running', 'Done'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be NotDone, Running, or Done.' });
    }

    // Confirm the task exists
    const existingTask = await prisma.sessionTask.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Update the task atomically, tracking who updated it and when
    const updatedTask = await prisma.sessionTask.update({
      where: { id: taskId },
      data: {
        status,
        updatedById: req.user.userId,
      },
    });

    // Write an audit log entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'Update',
        entityName: 'SessionTask',
        entityId: taskId,
        details: `Status changed to ${status}`,
      },
    });

    res.json({ task: updatedTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the task.' });
  }
});

module.exports = router;
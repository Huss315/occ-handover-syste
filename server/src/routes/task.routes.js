const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

const ALLOWED_STATUSES = ['NotDone', 'Running', 'Done', 'Ignore'];

// PATCH /api/tasks/:id
// Body: { status: "Running" }
// Body: { status: "Ignore", ignoreReason: "Vendor postponed maintenance" }
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { status, ignoreReason } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be NotDone, Running, Done, or Ignore.' });
    }

    const reason = typeof ignoreReason === 'string' ? ignoreReason.trim() : '';
    if (status === 'Ignore' && !reason) {
      return res.status(400).json({ error: 'Please enter a reason for ignoring this task.' });
    }

    const existingTask = await prisma.sessionTask.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const updatedTask = await prisma.sessionTask.update({
      where: { id: taskId },
      data: {
        status,
        // Keep the reason only while the task is ignored
        ignoreReason: status === 'Ignore' ? reason : null,
        updatedById: req.user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'Update',
        entityName: 'SessionTask',
        entityId: taskId,
        details: status === 'Ignore'
          ? `Status changed to Ignore. Reason: ${reason}`
          : `Status changed to ${status}`,
      },
    });

    res.json({ task: updatedTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the task.' });
  }
});

module.exports = router;
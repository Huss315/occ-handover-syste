const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/shifts/previous?shiftId=1
// Returns the most recent ENDED session's carry-forward tasks (Running/Not Done)
router.get('/previous', authMiddleware, async (req, res) => {
  try {
    const lastSession = await prisma.shiftSession.findFirst({
      where: { status: 'Ended' },
      orderBy: { endedAt: 'desc' },
      include: {
        tasks: {
          where: {
            status: { in: ['Running', 'NotDone'] },
          },
        },
        shift: true,
      },
    });

    if (!lastSession) {
      return res.json({ previousSession: null, carryForwardTasks: [] });
    }

    res.json({
      previousSession: {
        id: lastSession.id,
        shiftDate: lastSession.shiftDate,
        shiftName: lastSession.shift.name,
      },
      carryForwardTasks: lastSession.tasks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong loading previous shift.' });
  }
});

module.exports = router;
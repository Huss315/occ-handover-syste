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
// POST /api/shifts/start
// Body: { shiftId: 1, employeeIds: [1, 2, 3] }
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { shiftId, employeeIds } = req.body;

    if (!shiftId || !employeeIds || employeeIds.length === 0) {
      return res.status(400).json({ error: 'shiftId and at least one employeeId are required.' });
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Prevent duplicate active session for same date + shift
    const existing = await prisma.shiftSession.findFirst({
      where: {
        shiftId,
        shiftDate: today,
        status: 'Started',
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'A shift session for this date and shift is already active.' });
    }

    // Create the session
    const session = await prisma.shiftSession.create({
      data: {
        shiftId,
        shiftDate: today,
        startedById: req.user.userId,
        status: 'Started',
        employees: {
          create: employeeIds.map((userId) => ({ userId })),
        },
      },
      include: { employees: true },
    });

    // Load Fixed Tasks for this shift
    const fixedTasks = await prisma.fixedTask.findMany({
      where: { shiftId, isActive: true },
    });

    // Create SessionTask rows for each fixed task
    const fixedSessionTasks = await Promise.all(
      fixedTasks.map((task) =>
        prisma.sessionTask.create({
          data: {
            sessionId: session.id,
            fixedTaskId: task.id,
            taskTitle: task.taskName,
            taskType: 'Fixed',
            status: 'NotDone',
            updatedById: req.user.userId,
          },
        })
      )
    );
    // Load due Notes for this date + shift, mark them delivered
    const dueNotes = await prisma.handoverNote.findMany({
      where: {
        targetDate: today,
        targetShiftId: shiftId,
        isDelivered: false,
      },
    });
    await prisma.handoverNote.updateMany({
      where: { id: { in: dueNotes.map((n) => n.id) } },
      data: { isDelivered: true },
    });

    // Load due Temporary Tasks for this date + shift, mark them delivered, add as SessionTasks
    const dueTempTasks = await prisma.temporaryTask.findMany({
      where: {
        targetDate: today,
        targetShiftId: shiftId,
        isDelivered: false,
      },
    });
    const tempSessionTasks = await Promise.all(
      dueTempTasks.map((tempTask) =>
        prisma.sessionTask.create({
          data: {
            sessionId: session.id,
            tempTaskId: tempTask.id,
            taskTitle: tempTask.taskTitle,
            taskType: 'Temporary',
            status: 'NotDone',
            updatedById: req.user.userId,
          },
        })
      )
    );
    await prisma.temporaryTask.updateMany({
      where: { id: { in: dueTempTasks.map((t) => t.id) } },
      data: { isDelivered: true },
    });

    // Find previous ended session's carry-forward tasks (Running/Not Done)
    const lastSession = await prisma.shiftSession.findFirst({
      where: { status: 'Ended' },
      orderBy: { endedAt: 'desc' },
      include: {
        tasks: { where: { status: { in: ['Running', 'NotDone'] } } },
      },
    });

    let carriedTasks = [];
    if (lastSession) {
      carriedTasks = await Promise.all(
        lastSession.tasks.map((oldTask) =>
          prisma.sessionTask.create({
            data: {
              sessionId: session.id,
              taskTitle: oldTask.taskTitle,
              taskType: 'CarryForward',
              status: oldTask.status,
              updatedById: req.user.userId,
              sourceSessionTaskId: oldTask.id,
            },
          })
        )
      );
    }

    res.status(201).json({
      session,
      tasks: [...fixedSessionTasks, ...carriedTasks, ...tempSessionTasks],
      dueNotes,
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong starting the shift.' });
  }
});

module.exports = router;
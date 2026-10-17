const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/shifts/list
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ shifts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching shifts.' });
  }
});
// GET /api/shifts/my-active — find any Started session this user is part of
router.get('/my-active', authMiddleware, async (req, res) => {
  try {
    const activeSession = await prisma.shiftSession.findFirst({
      where: {
        status: 'Started',
        employees: { some: { userId: req.user.userId } },
      },
      include: { shift: true },
    });
    res.json({ activeSession });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong checking for an active shift.' });
  }
});

// GET /api/shifts/previous — most recently ENDED session, its carry-forward tasks, notes, employees
router.get('/previous', authMiddleware, async (req, res) => {
  try {
    const lastSession = await prisma.shiftSession.findFirst({
      where: { status: 'Ended' },
      orderBy: { endedAt: 'desc' },
      include: {
        tasks: { where: { status: { in: ['Running', 'NotDone'] } } },
        shift: true,
        employees: { include: { user: true } },
      },
    });

    if (!lastSession) {
      return res.json({ previousSession: null, carryForwardTasks: [], previousNotes: [], previousEmployees: [] });
    }

    const previousNotes = await prisma.handoverNote.findMany({
      where: { targetDate: lastSession.shiftDate, targetShiftId: lastSession.shiftId },
    });

    res.json({
      previousSession: {
        id: lastSession.id,
        shiftDate: lastSession.shiftDate,
        shiftName: lastSession.shift.name,
        endedAt: lastSession.endedAt,
      },
      carryForwardTasks: lastSession.tasks,
      previousNotes,
      previousEmployees: lastSession.employees.map((e) => e.user.fullName),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong loading previous shift.' });
  }
});

router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const session = await prisma.shiftSession.findUnique({
      where: { id: sessionId },
      include: {
        shift: { include: { fixedNotes: { where: { isActive: true } } } },
        employees: { include: { user: true } },
        tasks: true,
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Notes scheduled for this exact date + shift (created via Add Note)
    const notes = await prisma.handoverNote.findMany({
      where: { targetDate: session.shiftDate, targetShiftId: session.shiftId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ session: { ...session, notes } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching the session.' });
  }
});

// POST /api/shifts/start
router.post('/start', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'Admin') {
      return res.status(403).json({ error: 'Admin accounts cannot start shifts. Please use a staff account.' });
    }

    const { shiftId, employeeIds } = req.body;

    if (!shiftId || !employeeIds || employeeIds.length < 1) {
      return res.status(400).json({ error: 'shiftId and at least one employee are required.' });
    }
    if (employeeIds.length > 4) {
      return res.status(400).json({ error: 'A shift can have at most 4 employees.' });
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const [existing, fixedTasks, fixedNotes, dueNotes, dueTempTasks, lastSession] = await Promise.all([
prisma.shiftSession.findFirst({ where: { shiftId, shiftDate: today } }),      prisma.fixedTask.findMany({ where: { shiftId, isActive: true } }),
      prisma.fixedNote.findMany({ where: { shiftId, isActive: true } }),
      prisma.handoverNote.findMany({ where: { targetDate: today, targetShiftId: shiftId, isDelivered: false } }),
      prisma.temporaryTask.findMany({ where: { targetDate: today, targetShiftId: shiftId, isDelivered: false } }),
      prisma.shiftSession.findFirst({
        where: { status: 'Ended' },
        orderBy: { endedAt: 'desc' },
        include: { tasks: { where: { status: { in: ['Running', 'NotDone'] } } } },
      }),
    ]);

   if (existing) {
      const msg = existing.status === 'Started'
        ? 'A shift session for this date and shift is already active.'
        : 'A shift session for this date and shift has already been completed today.';
      return res.status(400).json({ error: msg });
    }

    const session = await prisma.shiftSession.create({
      data: {
        shiftId,
        shiftDate: today,
        startedById: req.user.userId,
        status: 'Started',
        employees: { create: employeeIds.map((userId) => ({ userId })) },
      },
      include: { employees: { include: { user: true } } },
    });

    const allSessionTasksData = [
      ...fixedTasks.map((task) => ({
        sessionId: session.id, fixedTaskId: task.id, taskTitle: task.taskName,
        taskType: 'Fixed', status: 'NotDone', updatedById: req.user.userId,
      })),
      ...(lastSession
        ? lastSession.tasks.map((oldTask) => ({
            sessionId: session.id, taskTitle: oldTask.taskTitle, taskType: 'CarryForward',
            status: oldTask.status, updatedById: req.user.userId, sourceSessionTaskId: oldTask.id,
          }))
        : []),
      ...dueTempTasks.map((tempTask) => ({
        sessionId: session.id, tempTaskId: tempTask.id, taskTitle: tempTask.taskTitle,
        taskType: 'Temporary', status: 'NotDone', updatedById: req.user.userId,
      })),
    ];

    const remainingWrites = [];
    if (allSessionTasksData.length > 0) {
      remainingWrites.push(prisma.sessionTask.createMany({ data: allSessionTasksData }));
    }
    if (dueNotes.length > 0) {
      remainingWrites.push(prisma.handoverNote.updateMany({
        where: { id: { in: dueNotes.map((n) => n.id) } }, data: { isDelivered: true },
      }));
    }
    if (dueTempTasks.length > 0) {
      remainingWrites.push(prisma.temporaryTask.updateMany({
        where: { id: { in: dueTempTasks.map((t) => t.id) } }, data: { isDelivered: true },
      }));
    }
    await Promise.all(remainingWrites);

    const tasks = await prisma.sessionTask.findMany({ where: { sessionId: session.id } });

    res.status(201).json({ session, tasks, dueNotes, fixedNotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong starting the shift.' });
  }
});

// POST /api/shifts/:sessionId/end
router.post('/:sessionId/end', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'Admin') {
      return res.status(403).json({ error: 'Admin accounts cannot end shifts. Please use a staff account.' });
    }

    const sessionId = parseInt(req.params.sessionId, 10);
    const session = await prisma.shiftSession.findUnique({
      where: { id: sessionId },
      include: { shift: true, employees: { include: { user: true } }, tasks: true },
    });

    if (!session) return res.status(404).json({ error: 'Shift session not found.' });
    if (session.status === 'Ended') return res.status(400).json({ error: 'This shift has already ended.' });

    const isEmployeeOfShift = session.employees.some((e) => e.userId === req.user.userId);
    if (!isEmployeeOfShift) {
      return res.status(403).json({ error: 'Only employees in this shift can end it.' });
    }

    const endedSession = await prisma.shiftSession.update({
      where: { id: sessionId },
      data: { status: 'Ended', endedById: req.user.userId, endedAt: new Date() },
    });

    const notesForThisShift = await prisma.handoverNote.findMany({
      where: { targetDate: session.shiftDate, targetShiftId: session.shiftId },
    });

    const doneTasks = session.tasks.filter((t) => t.status === 'Done');
    const runningTasks = session.tasks.filter((t) => t.status === 'Running');
    const notDoneTasks = session.tasks.filter((t) => t.status === 'NotDone');

    const reportContent = `
OCC Shift Handover Report
Shift: ${session.shift.name}
Date: ${session.shiftDate.toISOString().split('T')[0]}
Employees: ${session.employees.map((e) => e.user.fullName).join(', ')}

DONE TASKS:
${doneTasks.map((t) => `- ${t.taskTitle}`).join('\n') || 'None'}

RUNNING TASKS:
${runningTasks.map((t) => `- ${t.taskTitle}`).join('\n') || 'None'}

NOT DONE TASKS:
${notDoneTasks.map((t) => `- ${t.taskTitle}`).join('\n') || 'None'}

NOTES:
${notesForThisShift.map((n) => `- ${n.noteText}`).join('\n') || 'None'}
    `.trim();

    const report = await prisma.generatedReport.create({
      data: {
        sessionId: session.id,
        reportTitle: `OCC Handover Report - ${session.shift.name} Shift - ${session.shiftDate.toISOString().split('T')[0]}`,
        generatedById: req.user.userId,
        reportContent,
        emailSent: false,
      },
    });


    await prisma.auditLog.create({
      data: { userId: req.user.userId, actionType: 'EndShift', entityName: 'ShiftSession', entityId: session.id, details: 'Shift ended and report generated.' },
    });

    res.json({ session: endedSession, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong ending the shift.' });
  }
});

module.exports = router;

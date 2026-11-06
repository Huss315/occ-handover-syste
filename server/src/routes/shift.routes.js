const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const { getCurrentSlot, isCurrentSlot } = require('../lib/shiftClock');

const router = express.Router();

const MAX_EMPLOYEES = 4;
const START_SHIFT_LOCK_ID = 727001;

// The oldest shift that has not been ended yet, if there is one
function findActiveSession(db) {
  return db.shiftSession.findFirst({
    where: { status: 'Started' },
    orderBy: { startedAt: 'asc' },
    include: {
      shift: true,
      startedBy: { select: { fullName: true } },
      employees: { include: { user: { select: { fullName: true } } } },
      tasks: { select: { status: true } },
    },
  });
}

function summarizeActiveSession(session, slot) {
  if (!session) return null;
  return {
    id: session.id,
    shiftName: session.shift.name,
    shiftDate: session.shiftDate.toISOString().split('T')[0],
    startedAt: session.startedAt,
    startedBy: session.startedBy.fullName,
    employees: session.employees.map((e) => e.user.fullName),
    openTasks: session.tasks.filter((t) => t.status === 'NotDone' || t.status === 'Running').length,
    isCurrentShift: isCurrentSlot(session, session.shift.name, slot),
  };
}

// GET /api/shifts/list — ordered Morning, Afternoon, Night
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
    res.json({ shifts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching shifts.' });
  }
});

// GET /api/shifts/current — the shift that is on right now, worked out from the clock
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const slot = getCurrentSlot();
    const shift = await prisma.shift.findUnique({ where: { name: slot.shiftName } });
    if (!shift) {
      return res.status(500).json({ error: `Shift "${slot.shiftName}" is not configured.` });
    }

    const [slotSession, activeSession] = await Promise.all([
      prisma.shiftSession.findFirst({
        where: { shiftId: shift.id, shiftDate: slot.shiftDate },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true },
      }),
      findActiveSession(prisma),
    ]);

    res.json({
      shift: { id: shift.id, name: shift.name },
      shiftDate: slot.dateStr,
      startsAt: slot.startsAt,
      next: { name: slot.nextShiftName, startsAt: slot.nextStartsAt },
      slotSession,
      activeSession: summarizeActiveSession(activeSession, slot),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong loading the current shift.' });
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

// GET /api/shifts/:sessionId — full session details
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

// POST /api/shifts/start — the shift and date come from the clock, not from the client
// Body: { employeeIds: [1, 2] }
router.post('/start', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'Admin') {
      return res.status(403).json({ error: 'Admin accounts cannot start shifts. Please use a staff account.' });
    }

    const { employeeIds } = req.body;

    if (!employeeIds || employeeIds.length < 1) {
      return res.status(400).json({ error: 'At least one employee is required.' });
    }
    if (employeeIds.length > MAX_EMPLOYEES) {
      return res.status(400).json({ error: `A shift can have at most ${MAX_EMPLOYEES} employees.` });
    }

    const slot = getCurrentSlot();
    const today = slot.shiftDate;

    const result = await prisma.$transaction(async (tx) => {
      // One start at a time, so two people pressing Start cannot both get through
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${START_SHIFT_LOCK_ID})`);

      const shift = await tx.shift.findUnique({ where: { name: slot.shiftName } });
      if (!shift) {
        return { status: 500, body: { error: `Shift "${slot.shiftName}" is not configured.` } };
      }
      const shiftId = shift.id;

      const active = await findActiveSession(tx);
      if (active) {
        const activeSession = summarizeActiveSession(active, slot);
        if (activeSession.isCurrentShift) {
          return {
            status: 400,
            body: { error: `The ${shift.name} shift is already running. Ask someone on it to add you.` },
          };
        }
        return {
          status: 409,
          body: { code: 'PREVIOUS_SHIFT_ACTIVE', error: 'The previous shift has not been ended.', activeSession },
        };
      }

      const existing = await tx.shiftSession.findFirst({ where: { shiftId, shiftDate: today } });
      if (existing) {
        return {
          status: 400,
          body: { error: `The ${shift.name} shift has already been completed. The ${slot.nextShiftName} shift opens at ${slot.nextStartsAt}.` },
        };
      }

      const fixedTasks = await tx.fixedTask.findMany({ where: { shiftId, isActive: true } });
      const fixedNotes = await tx.fixedNote.findMany({ where: { shiftId, isActive: true } });
      const dueNotes = await tx.handoverNote.findMany({ where: { targetDate: today, targetShiftId: shiftId, isDelivered: false } });
      const dueTempTasks = await tx.temporaryTask.findMany({ where: { targetDate: today, targetShiftId: shiftId, isDelivered: false } });
      const lastSession = await tx.shiftSession.findFirst({
        where: { status: 'Ended' },
        orderBy: { endedAt: 'desc' },
        include: { tasks: { where: { status: { in: ['Running', 'NotDone'] } } } },
      });

      const session = await tx.shiftSession.create({
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

      if (allSessionTasksData.length > 0) {
        await tx.sessionTask.createMany({ data: allSessionTasksData });
      }
      if (dueNotes.length > 0) {
        await tx.handoverNote.updateMany({
          where: { id: { in: dueNotes.map((n) => n.id) } }, data: { isDelivered: true },
        });
      }
      if (dueTempTasks.length > 0) {
        await tx.temporaryTask.updateMany({
          where: { id: { in: dueTempTasks.map((t) => t.id) } }, data: { isDelivered: true },
        });
      }

      const tasks = await tx.sessionTask.findMany({ where: { sessionId: session.id } });

      return { status: 201, body: { session, tasks, dueNotes, fixedNotes } };
    }, { timeout: 20000, maxWait: 10000 });

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong starting the shift.' });
  }
});

// POST /api/shifts/:sessionId/employees — add employees to a running shift
// Body: { employeeIds: [3, 4] }
router.post('/:sessionId/employees', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'Admin') {
      return res.status(403).json({ error: 'Admin accounts cannot change shift employees.' });
    }

    const sessionId = parseInt(req.params.sessionId, 10);
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one employee to add.' });
    }

    const session = await prisma.shiftSession.findUnique({
      where: { id: sessionId },
      include: { employees: true },
    });

    if (!session) return res.status(404).json({ error: 'Shift session not found.' });
    if (session.status !== 'Started') {
      return res.status(400).json({ error: 'Employees can only be added while the shift is running.' });
    }

    const isEmployeeOfShift = session.employees.some((e) => e.userId === req.user.userId);
    if (!isEmployeeOfShift) {
      return res.status(403).json({ error: 'Only employees in this shift can add others.' });
    }

    const currentIds = session.employees.map((e) => e.userId);
    const newIds = [...new Set(employeeIds.map((id) => parseInt(id, 10)))]
      .filter((id) => !currentIds.includes(id));

    if (newIds.length === 0) {
      return res.status(400).json({ error: 'Those employees are already in this shift.' });
    }
    if (currentIds.length + newIds.length > MAX_EMPLOYEES) {
      return res.status(400).json({ error: `A shift can have at most ${MAX_EMPLOYEES} employees.` });
    }

    // Only active, non-Admin users can be added
    const validUsers = await prisma.user.findMany({
      where: { id: { in: newIds }, isActive: true, role: { name: { not: 'Admin' } } },
      select: { id: true, fullName: true },
    });
    if (validUsers.length !== newIds.length) {
      return res.status(400).json({ error: 'One or more selected employees cannot be added.' });
    }

    await prisma.shiftEmployee.createMany({
      data: newIds.map((userId) => ({ sessionId, userId })),
      skipDuplicates: true,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'Update',
        entityName: 'ShiftSession',
        entityId: sessionId,
        details: `Added employees: ${validUsers.map((u) => u.fullName).join(', ')}`,
      },
    });

    const employees = await prisma.shiftEmployee.findMany({
      where: { sessionId },
      include: { user: true },
    });

    res.status(201).json({ employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong adding employees.' });
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
    // Anyone on staff may close a shift whose time has passed, so the next shift is not stuck
    const isOverdue = !isCurrentSlot(session, session.shift.name);
    if (!isEmployeeOfShift && !isOverdue) {
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
    const ignoredTasks = session.tasks.filter((t) => t.status === 'Ignore');

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

IGNORED TASKS:
${ignoredTasks.map((t) => `- ${t.taskTitle} (Reason: ${t.ignoreReason || 'not given'})`).join('\n') || 'None'}

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
      data: { userId: req.user.userId, actionType: 'EndShift', entityName: 'ShiftSession', entityId: session.id, details: isEmployeeOfShift ? 'Shift ended and report generated.' : 'Previous shift closed by the next employee and report generated.' },
    });

    res.json({ session: endedSession, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong ending the shift.' });
  }
});

module.exports = router;
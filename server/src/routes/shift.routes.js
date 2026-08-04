const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const { sendShiftReportEmail } = require('../services/email.service');

const router = express.Router();
// GET /api/shifts/list — all active shifts, any logged-in user can see this
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ shifts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching shifts.' });
  }
});
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
// GET /api/shifts/:sessionId — full session details with tasks
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const session = await prisma.shiftSession.findUnique({
      where: { id: sessionId },
      include: {
        shift: true,
        employees: { include: { user: true } },
        tasks: true,
      },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching the session.' });
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

    // Run independent lookups in PARALLEL instead of one-by-one
    const [existing, fixedTasks, dueNotes, dueTempTasks, lastSession] = await Promise.all([
      prisma.shiftSession.findFirst({
        where: { shiftId, shiftDate: today, status: 'Started' },
      }),
      prisma.fixedTask.findMany({ where: { shiftId, isActive: true } }),
      prisma.handoverNote.findMany({
        where: { targetDate: today, targetShiftId: shiftId, isDelivered: false },
      }),
      prisma.temporaryTask.findMany({
        where: { targetDate: today, targetShiftId: shiftId, isDelivered: false },
      }),
      prisma.shiftSession.findFirst({
        where: { status: 'Ended' },
        orderBy: { endedAt: 'desc' },
        include: { tasks: { where: { status: { in: ['Running', 'NotDone'] } } } },
      }),
    ]);

    if (existing) {
      return res.status(400).json({ error: 'A shift session for this date and shift is already active.' });
    }

    // Create the session (with employees nested in the same call)
    const session = await prisma.shiftSession.create({
      data: {
        shiftId,
        shiftDate: today,
        startedById: req.user.userId,
        status: 'Started',
        employees: { create: employeeIds.map((userId) => ({ userId })) },
      },
      include: { employees: true },
    });

    // Build ALL session tasks (fixed + carry-forward + temp) as one array
    const allSessionTasksData = [
      ...fixedTasks.map((task) => ({
        sessionId: session.id,
        fixedTaskId: task.id,
        taskTitle: task.taskName,
        taskType: 'Fixed',
        status: 'NotDone',
        updatedById: req.user.userId,
      })),
      ...(lastSession
        ? lastSession.tasks.map((oldTask) => ({
            sessionId: session.id,
            taskTitle: oldTask.taskTitle,
            taskType: 'CarryForward',
            status: oldTask.status,
            updatedById: req.user.userId,
            sourceSessionTaskId: oldTask.id,
          }))
        : []),
      ...dueTempTasks.map((tempTask) => ({
        sessionId: session.id,
        tempTaskId: tempTask.id,
        taskTitle: tempTask.taskTitle,
        taskType: 'Temporary',
        status: 'NotDone',
        updatedById: req.user.userId,
      })),
    ];

    // ONE batched insert instead of many individual creates
    const remainingWrites = [];

    if (allSessionTasksData.length > 0) {
      remainingWrites.push(prisma.sessionTask.createMany({ data: allSessionTasksData }));
    }
    if (dueNotes.length > 0) {
      remainingWrites.push(
        prisma.handoverNote.updateMany({
          where: { id: { in: dueNotes.map((n) => n.id) } },
          data: { isDelivered: true },
        })
      );
    }
    if (dueTempTasks.length > 0) {
      remainingWrites.push(
        prisma.temporaryTask.updateMany({
          where: { id: { in: dueTempTasks.map((t) => t.id) } },
          data: { isDelivered: true },
        })
      );
    }

    // Run all remaining writes in PARALLEL
    await Promise.all(remainingWrites);

    // Fetch the created tasks back (createMany doesn't return rows, so one more query)
    const tasks = await prisma.sessionTask.findMany({ where: { sessionId: session.id } });

    res.status(201).json({ session, tasks, dueNotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong starting the shift.' });
  }
});
// POST /api/shifts/:sessionId/end
router.post('/:sessionId/end', authMiddleware, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);

    const session = await prisma.shiftSession.findUnique({
      where: { id: sessionId },
      include: {
        shift: true,
        employees: { include: { user: true } },
        tasks: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Shift session not found.' });
    }

    if (session.status === 'Ended') {
      return res.status(400).json({ error: 'This shift has already ended.' });
    }

    // Confirm the person ending the shift is one of the shift's employees
    const isEmployeeOfShift = session.employees.some((e) => e.userId === req.user.userId);
    if (!isEmployeeOfShift) {
      return res.status(403).json({ error: 'Only employees in this shift can end it.' });
    }

    // Mark session as Ended
    const endedSession = await prisma.shiftSession.update({
      where: { id: sessionId },
      data: {
        status: 'Ended',
        endedById: req.user.userId,
        endedAt: new Date(),
      },
    });

    // Get any notes that were delivered to this session's date+shift
    const notesForThisShift = await prisma.handoverNote.findMany({
      where: {
        targetDate: session.shiftDate,
        targetShiftId: session.shiftId,
      },
    });

    // Build the report content (simple readable text snapshot)
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
    // Send the report by email to all employees in this shift
    const recipientEmails = session.employees
      .map((e) => e.user.email)
      .filter((email) => !!email);

    const emailResult = await sendShiftReportEmail({
      toEmails: recipientEmails,
      subject: report.reportTitle,
      reportContent,
    });

    if (emailResult.sent) {
      await prisma.generatedReport.update({
        where: { id: report.id },
        data: { emailSent: true },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        actionType: 'EndShift',
        entityName: 'ShiftSession',
        entityId: session.id,
        details: 'Shift ended and report generated.',
      },
    });

    res.json({ session: endedSession, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong ending the shift.' });
  }
});
module.exports = router;
const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = express.Router();

// GET /api/reports/search?date=2026-08-04&shiftId=1
router.get('/search', authMiddleware, requireRole('Admin', 'Manager'), async (req, res) => {
  try {
    const { date, shiftId } = req.query;

    if (!date || !shiftId) {
      return res.status(400).json({ error: 'date and shiftId query parameters are required.' });
    }

    const targetDate = new Date(date);

    const session = await prisma.shiftSession.findFirst({
      where: {
        shiftDate: targetDate,
        shiftId: parseInt(shiftId, 10),
      },
      include: {
        shift: true,
        employees: { include: { user: true } },
        tasks: true,
        report: true,
      },
    });

    if (!session || !session.report) {
      return res.status(404).json({ error: 'No report found for that date and shift.' });
    }

    res.json({
      report: session.report,
      session: {
        id: session.id,
        shiftDate: session.shiftDate,
        shiftName: session.shift.name,
        status: session.status,
        employees: session.employees.map((e) => e.user.fullName),
      },
      tasks: session.tasks,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong searching for the report.' });
  }
});

module.exports = router;
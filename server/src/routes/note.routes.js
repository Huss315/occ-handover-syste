const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/notes
// Body: { noteText: "...", targetDate: "2026-08-05", targetShiftId: 3 }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { noteText, targetDate, targetShiftId } = req.body;

    if (!noteText || !targetDate || !targetShiftId) {
      return res.status(400).json({ error: 'noteText, targetDate, and targetShiftId are required.' });
    }

    const note = await prisma.handoverNote.create({
      data: {
        noteText,
        targetDate: new Date(targetDate),
        targetShiftId,
        createdById: req.user.userId,
      },
    });

    res.status(201).json({ note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the note.' });
  }
});

module.exports = router;
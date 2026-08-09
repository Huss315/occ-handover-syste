const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/notes — all notes, any authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notes = await prisma.handoverNote.findMany({
      include: { targetShift: true, createdBy: { select: { fullName: true } } },
      orderBy: { targetDate: 'asc' },
    });
    res.json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching notes.' });
  }
});
// POST /api/notes
// Body: { noteText: "...", targetDate: "2026-08-05", targetShiftId: 3 }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { noteText, targetDate, targetShiftId } = req.body;

   if (!noteText || !targetDate || !targetShiftId) {
      return res.status(400).json({ error: 'noteText, targetDate, and targetShiftId are required.' });
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

// PATCH /api/notes/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const { noteText, targetDate, targetShiftId } = req.body;

    const data = {};
    if (noteText !== undefined) data.noteText = noteText;
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

    const updated = await prisma.handoverNote.update({ where: { id: noteId }, data });
    res.json({ note: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the note.' });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const existing = await prisma.handoverNote.findUnique({ where: { id: noteId } });
    if (!existing) return res.status(404).json({ error: 'Note not found.' });
    if (existing.isDelivered) {
      return res.status(400).json({ error: 'This note\'s shift has already started and can no longer be edited.' });
    }

    const { noteText, targetDate, targetShiftId } = req.body;
    const data = {};
    if (noteText !== undefined) data.noteText = noteText;
    if (targetShiftId !== undefined) data.targetShiftId = targetShiftId;
    if (targetDate !== undefined) {
      const now = new Date();
      const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const parsedTargetDate = new Date(targetDate);
      if (parsedTargetDate < todayUTC) {
        return res.status(400).json({ error: 'Target date must be today or in the future.' });
      }
      data.targetDate = parsedTargetDate;
    }

    const updated = await prisma.handoverNote.update({ where: { id: noteId }, data });
    res.json({ note: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the note.' });
  }
});
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const existing = await prisma.handoverNote.findUnique({ where: { id: noteId } });
    if (!existing) return res.status(404).json({ error: 'Note not found.' });
    if (existing.isDelivered) {
      return res.status(400).json({ error: 'This note\'s shift has already started and can no longer be deleted.' });
    }
    await prisma.handoverNote.delete({ where: { id: noteId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deleting the note.' });
  }
});
const SHIFT_ORDER = ['Morning', 'Evening', 'Night'];

// POST /api/notes/:id/carry-forward — copies this note to the next shift in the daily cycle
router.post('/:id/carry-forward', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const note = await prisma.handoverNote.findUnique({
      where: { id: noteId },
      include: { targetShift: true },
    });
    if (!note) return res.status(404).json({ error: 'Note not found.' });

    const currentIndex = SHIFT_ORDER.indexOf(note.targetShift.name);
    if (currentIndex === -1) {
      return res.status(400).json({ error: 'Cannot determine shift order for this note.' });
    }

    const isLastInDay = currentIndex === SHIFT_ORDER.length - 1;
    const nextShiftName = SHIFT_ORDER[(currentIndex + 1) % SHIFT_ORDER.length];

    const nextShift = await prisma.shift.findUnique({ where: { name: nextShiftName } });
    if (!nextShift) return res.status(400).json({ error: `Shift "${nextShiftName}" not configured.` });

    const nextDate = new Date(note.targetDate);
    if (isLastInDay) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    }

    const carriedNote = await prisma.handoverNote.create({
      data: {
        noteText: note.noteText,
        targetDate: nextDate,
        targetShiftId: nextShift.id,
        createdById: req.user.userId,
      },
    });

    res.status(201).json({ note: carriedNote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong carrying the note forward.' });
  }
});
module.exports = router;
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getShiftsList, createNote, updateNote } from '../api/shifts';

function AddNotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionId = location.state?.sessionId;
  const editingNote = location.state?.note;
  const backTo = sessionId ? '/dashboard' : '/notes';

  const [shifts, setShifts] = useState([]);
  const [targetDate, setTargetDate] = useState(editingNote ? editingNote.targetDate.split('T')[0] : '');
  const [targetShiftId, setTargetShiftId] = useState(editingNote?.targetShiftId || '');
  const [noteText, setNoteText] = useState(editingNote?.noteText || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getShiftsList().then(setShifts).catch(() => setError('Failed to load shifts.'));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!targetDate || !targetShiftId || !noteText.trim()) {
      setError('Please fill in date, shift, and note text.');
      return;
    }
    setSaving(true);
    try {
      if (editingNote) {
        await updateNote(editingNote.id, { noteText, targetDate, targetShiftId: parseInt(targetShiftId, 10) });
      } else {
        await createNote(noteText, targetDate, parseInt(targetShiftId, 10));
      }
      navigate(backTo, {
        replace: true,
        state: { sessionId, flash: editingNote ? 'Note updated successfully.' : 'Note added successfully.' },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save note.');
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 460 }}>
      <div className="page-header">
        <h1>{editingNote ? 'Edit Note' : 'Add Note'}</h1>
      </div>
      <form onSubmit={handleSave}>
        <div className="field">
          <label>Target Date</label>
          <input type="date" value={targetDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Target Shift</label>
          <select value={targetShiftId} onChange={(e) => setTargetShiftId(e.target.value)}>
            <option value="">-- Choose a shift --</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Note</label>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="btn-row">
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : editingNote ? 'Update' : 'Save'}
          </button>
          <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => navigate(backTo, { state: { sessionId } })}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddNotePage;

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getShiftsList, createNote } from '../api/shifts';

function AddNotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionId = location.state?.sessionId;

  const [shifts, setShifts] = useState([]);
  const [targetDate, setTargetDate] = useState('');
  const [targetShiftId, setTargetShiftId] = useState('');
  const [noteText, setNoteText] = useState('');
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
      await createNote(noteText, targetDate, parseInt(targetShiftId, 10));
      navigate('/dashboard', { state: { sessionId } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save note.');
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Add Note for Future Shift</h1>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>Target Date:</label>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ padding: 8 }} />

        <label>Target Shift:</label>
        <select value={targetShiftId} onChange={(e) => setTargetShiftId(e.target.value)} style={{ padding: 8 }}>
          <option value="">-- Choose a shift --</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <label>Note:</label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          style={{ padding: 8 }}
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" disabled={saving} style={{ padding: 10, flex: 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard', { state: { sessionId } })} style={{ padding: 10, flex: 1 }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddNotePage;

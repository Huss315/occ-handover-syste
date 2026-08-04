import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getShiftsList, createTempTask } from '../api/shifts';

function AddTempTaskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionId = location.state?.sessionId;

  const [shifts, setShifts] = useState([]);
  const [targetDate, setTargetDate] = useState('');
  const [targetShiftId, setTargetShiftId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getShiftsList().then(setShifts).catch(() => setError('Failed to load shifts.'));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!targetDate || !targetShiftId || !taskTitle.trim()) {
      setError('Please fill in date, shift, and task title.');
      return;
    }
    setSaving(true);
    try {
      await createTempTask(taskTitle, description, targetDate, parseInt(targetShiftId, 10));
      navigate('/dashboard', { state: { sessionId } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save temporary task.');
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Add Temporary Task for Future Shift</h1>
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

        <label>Task Title:</label>
        <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} style={{ padding: 8 }} />

        <label>Description (optional):</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
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

export default AddTempTaskPage;

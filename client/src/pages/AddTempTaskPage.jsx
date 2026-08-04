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
    <div className="page" style={{ maxWidth: 460 }}>
      <div className="page-header">
        <h1>Add Temporary Task</h1>
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
          <label>Task Title</label>
          <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="btn-row">
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => navigate('/dashboard', { state: { sessionId } })}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddTempTaskPage;

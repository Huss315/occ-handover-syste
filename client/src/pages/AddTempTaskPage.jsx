import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getShiftsList, createTempTask, updateTempTask } from '../api/shifts';
import Toast from '../components/Toast';

// Today's date in the user's own timezone, as YYYY-MM-DD
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Open the calendar when clicking anywhere in the date field
function openPicker(e) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // some browsers only allow this on direct clicks; ignore
  }
}

function AddTempTaskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionId = location.state?.sessionId;
  const editingTask = location.state?.tempTask;
  const backTo = sessionId ? '/dashboard' : '/temp-tasks';

  const [shifts, setShifts] = useState([]);
  const [targetDate, setTargetDate] = useState(editingTask ? editingTask.targetDate.split('T')[0] : '');
  const [targetShiftId, setTargetShiftId] = useState(editingTask?.targetShiftId || '');
  const [taskTitle, setTaskTitle] = useState(editingTask?.taskTitle || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getShiftsList().then(setShifts).catch(() => setError('Failed to load shifts.'));
  }, []);

  function goBack() {
    navigate(backTo, {
      state: {
        sessionId,
        flash: savedCount > 0 ? `${savedCount} temporary task(s) added successfully.` : undefined,
      },
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!targetDate || !targetShiftId || !taskTitle.trim()) {
      setError('Please fill in date, shift, and task title.');
      return;
    }
    setSaving(true);
    try {
      if (editingTask) {
        await updateTempTask(editingTask.id, { taskTitle, targetDate, targetShiftId: parseInt(targetShiftId, 10) });
        navigate(backTo, { replace: true, state: { sessionId, flash: 'Temporary task updated successfully.' } });
        return;
      }

      await createTempTask(taskTitle, targetDate, parseInt(targetShiftId, 10));
      // Stay on the page so another task can be added for the same date and shift
      setTaskTitle('');
      setSavedCount((c) => c + 1);
      setToast({ message: 'Temporary task added. You can add another one.', type: 'success' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save temporary task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 460 }}>
      <div className="page-header">
        <h1>{editingTask ? 'Edit Temporary Task' : 'Add Temporary Task'}</h1>
        {!editingTask && savedCount > 0 && <span className="readout">{savedCount} added</span>}
      </div>
      <form onSubmit={handleSave}>
        <div className="field">
          <label>Target Date</label>
          <input
            type="date"
            value={targetDate}
            min={todayLocal()}
            onClick={openPicker}
            onChange={(e) => setTargetDate(e.target.value)}
          />
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

        {error && <p className="error-text">{error}</p>}

        <div className="btn-row">
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving...' : editingTask ? 'Update' : 'Save'}
          </button>
          <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={goBack}>
            {savedCount > 0 ? 'Done' : 'Cancel'}
          </button>
        </div>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AddTempTaskPage;
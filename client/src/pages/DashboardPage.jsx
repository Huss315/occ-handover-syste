import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateTaskStatus, endShift, getSession } from '../api/shifts';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

function statusLed(status) {
  if (status === 'Done') return 'led-done';
  if (status === 'Running') return 'led-running';
  return 'led-notdone';
}

function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sessionId] = useState(location.state?.sessionId || null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No active shift session found. Please start a shift first.');
      setLoading(false);
      return;
    }
    loadSessionData();
  }, [sessionId]);

  async function loadSessionData() {
    try {
      const sessionData = await getSession(sessionId);
      setTasks(sessionData.tasks);
      setLoading(false);
    } catch (err) {
      setError('Failed to load shift data.');
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    try {
      const updated = await updateTaskStatus(taskId, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setError('Failed to update task status.');
    }
  }

  function handleEndShiftClick() {
    setShowEndConfirm(true);
  }

  async function confirmEndShift() {
    setShowEndConfirm(false);
    setEnding(true);
    try {
      await endShift(sessionId);
      setToast({ message: 'Shift ended and report sent successfully.', type: 'success' });
      setTimeout(() => navigate('/shift-start'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to end shift.');
      setEnding(false);
    }
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Shift Dashboard</h1>
        <button className="btn-ghost" onClick={logout}>Logout</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!sessionId && (
        <button className="btn-primary" onClick={() => navigate('/shift-start')}>Go to Shift Start</button>
      )}

      {sessionId && (
        <>
          <p className="readout">Session #{sessionId}</p>

          <div className="card">
            <h3>Tasks</h3>
            {tasks.length === 0 && <p>No tasks for this shift.</p>}
            {tasks.map((task) => (
              <div className="status-row" key={task.id}>
                <div className="status-label">
                  <span className={`led ${statusLed(task.status)}`}></span>
                  <div>
                    <div className="status-title">{task.taskTitle}</div>
                    <div className="status-type">{task.taskType}</div>
                  </div>
                </div>
                <select
                  className="status-select"
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                >
                  <option value="NotDone">Not Done</option>
                  <option value="Running">Running</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            ))}
          </div>

          <div className="btn-row" style={{ marginTop: 24 }}>
            <button className="btn-ghost" onClick={() => navigate('/add-note', { state: { sessionId } })}>Add Note</button>
            <button className="btn-ghost" onClick={() => navigate('/add-temp-task', { state: { sessionId } })}>Add Temp Task</button>
            <button className="btn-danger" style={{ marginLeft: 'auto' }} onClick={handleEndShiftClick} disabled={ending}>
              {ending ? 'Ending...' : 'End Shift'}
            </button>
          </div>
        </>
      )}

      {showEndConfirm && (
        <ConfirmModal
          title="Confirm End Shift"
          message="Are you sure you want to end this shift?"
          confirmLabel="Yes, End Shift"
          cancelLabel="No"
          onConfirm={confirmEndShift}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default DashboardPage;

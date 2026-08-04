import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateTaskStatus, endShift, getSession } from '../api/shifts';
import apiClient from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // sessionId is passed via navigation state from ShiftStartPage
  const [sessionId] = useState(location.state?.sessionId || null);
  const [session, setSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
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
      setSession(sessionData);
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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>OCC Handover — Shift Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!sessionId && (
        <button onClick={() => navigate('/shift-start')} style={{ padding: 10, marginTop: 16 }}>
          Go to Shift Start
        </button>
      )}

      {sessionId && (
        <>
          <p>Session ID: {sessionId}</p>

          <div style={{ marginTop: 24 }}>
            <h3>Tasks</h3>
            {tasks.length === 0 && <p>No tasks loaded yet — this page will show real task data shortly.</p>}
            {tasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <span>{task.taskTitle} <em>({task.taskType})</em></span>
                <select value={task.status} onChange={(e) => handleStatusChange(task.id, e.target.value)}>
                  <option value="NotDone">Not Done</option>
                  <option value="Running">Running</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
            <button onClick={() => navigate('/add-note', { state: { sessionId } })}>Add Note</button>
            <button onClick={() => navigate('/add-temp-task', { state: { sessionId } })}>Add Temp Task</button>
            <button onClick={handleEndShiftClick} disabled={ending} style={{ marginLeft: 'auto', background: '#c0392b', color: 'white', border: 'none', padding: '8px 16px', cursor: 'pointer' }}>
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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default DashboardPage;

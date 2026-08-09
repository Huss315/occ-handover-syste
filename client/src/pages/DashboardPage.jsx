import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateTaskStatus, endShift, getSession, getPreviousShift, deleteNote, deleteTempTask, carryNoteForward } from '../api/shifts';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

function statusLed(status) {
  if (status === 'Done') return 'led-done';
  if (status === 'Running') return 'led-running';
  return 'led-notdone';
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sessionId] = useState(location.state?.sessionId || null);
  const [session, setSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [fixedNotes, setFixedNotes] = useState([]);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
      const [sessionData, previousData] = await Promise.all([
        getSession(sessionId),
        getPreviousShift(),
      ]);
      setSession(sessionData);
      setTasks(sessionData.tasks);
      setNotes(sessionData.notes || []);
      setFixedNotes(sessionData.shift?.fixedNotes || []);
      setPrevious(previousData);
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

  async function handleCarryForward(noteId) {
    try {
      await carryNoteForward(noteId);
      setToast({ message: 'Note carried forward to the next shift.', type: 'success' });
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to carry note forward.', type: 'error' });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'note') {
        await deleteNote(deleteTarget.id);
        setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      } else {
        await deleteTempTask(deleteTarget.id);
        setTasks((prev) => prev.filter((t) => t.tempTaskId !== deleteTarget.id));
      }
      setToast({ message: 'Deleted successfully.', type: 'success' });
    } catch (err) {
      setError('Failed to delete.');
    } finally {
      setDeleteTarget(null);
    }
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  const mainTasks = tasks.filter((t) => t.taskType === 'Fixed');
  const tempTasks = tasks.filter((t) => t.taskType === 'Temporary');
  const carryForwardTasks = tasks.filter((t) => t.taskType === 'CarryForward');

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div className="header-brand">
          <img src="/afs_logo.png" alt="" className="header-logo" />
          <h1>Shift Dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => navigate('/notes')}>Notes</button>
          <button className="btn-ghost" onClick={() => navigate('/temp-tasks')}>Temp Tasks</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!sessionId && (
        <button className="btn-primary" onClick={() => navigate('/shift-start')}>Go to Shift Start</button>
      )}

      {sessionId && session && (
        <>
          <p className="readout" style={{ marginBottom: 20 }}>
            Session #{sessionId} · {session.shift?.name}
          </p>

          <div className="grid-2">
            <div className="card">
              <h3>Shift Employees</h3>
              <p style={{ marginBottom: 4 }}><strong>Logged in as:</strong> {user?.fullName}</p>
              <p className="readout">{session.employees.map((e) => e.user.fullName).join(', ')}</p>
            </div>

            <div className="card">
              <h3>Fixed Notes</h3>
              {fixedNotes.length === 0 && <p>No fixed notes for this shift.</p>}
              {fixedNotes.map((n) => (
                <p key={n.id} style={{ fontSize: 13, marginBottom: 6 }}>— {n.noteText}</p>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Previous Shift</h3>
            {previous?.previousSession ? (
              <p className="readout">
                {previous.previousSession.shiftName} — {new Date(previous.previousSession.shiftDate).toLocaleDateString()}
              </p>
            ) : (
              <p>No previous shift data.</p>
            )}

            {carryForwardTasks.length > 0 && (
              <>
                <h3 style={{ marginTop: 16 }}>Carried-Forward Tasks</h3>
                {carryForwardTasks.map((task) => (
                  <div className="status-row" key={task.id}>
                    <div className="status-label">
                      <span className={`led ${statusLed(task.status)}`}></span>
                      <span className="status-title">{task.taskTitle}</span>
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
              </>
            )}
          </div>

          <div className="card">
            <h3>Tasks</h3>
            {mainTasks.length === 0 && <p>No tasks for this shift.</p>}
            {mainTasks.map((task) => (
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

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Temporary Tasks</h3>
              <button className="btn-ghost" onClick={() => navigate('/add-temp-task', { state: { sessionId } })}>+ Add</button>
            </div>
            {tempTasks.length === 0 && <p>No temporary tasks for this shift.</p>}
            {tempTasks.map((task) => (
              <div className="status-row" key={task.id}>
                <div className="status-label">
                  <span className={`led ${statusLed(task.status)}`}></span>
                  <span className="status-title">{task.taskTitle}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="status-select"
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  >
                    <option value="NotDone">Not Done</option>
                    <option value="Running">Running</option>
                    <option value="Done">Done</option>
                  </select>
                  <button
                    className="btn-ghost"
                    onClick={() => navigate('/add-temp-task', {
                      state: {
                        sessionId,
                        tempTask: { id: task.tempTaskId, taskTitle: task.taskTitle, targetDate: session.shiftDate, targetShiftId: session.shiftId },
                      },
                    })}
                  >
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => setDeleteTarget({ type: 'tempTask', id: task.tempTaskId })}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Notes</h3>
              <button className="btn-ghost" onClick={() => navigate('/add-note', { state: { sessionId } })}>+ Add</button>
            </div>
            {notes.length === 0 && <p>No notes for this shift.</p>}
            {notes.map((n) => (
              <div className="list-row" key={n.id}>
                <span>{n.noteText}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => handleCarryForward(n.id)}>Carry to Next Shift</button>
                  {!n.isDelivered && (
                    <>
                      <button className="btn-ghost" onClick={() => navigate('/add-note', { state: { sessionId, note: n } })}>Edit</button>
                      <button className="btn-danger" onClick={() => setDeleteTarget({ type: 'note', id: n.id })}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="btn-row" style={{ marginTop: 24 }}>
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

      {deleteTarget && (
        <ConfirmModal
          title="Confirm Delete"
          message="Are you sure you want to delete this? This cannot be undone."
          confirmLabel="Yes, Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default DashboardPage;

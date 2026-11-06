import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  updateTaskStatus, endShift, getSession, getPreviousShift,
  deleteNote, carryNoteForward, getEmployeesList, addShiftEmployees,
} from '../api/shifts';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import StatusButtons from '../components/StatusButtons';

const MAX_EMPLOYEES = 4;
const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutes
const STATUS_ORDER = { NotDone: 0, Running: 1, Done: 2, Ignore: 3 };

function statusLed(status) {
  if (status === 'Done') return 'led-done';
  if (status === 'Running') return 'led-running';
  if (status === 'Ignore') return 'led-ignore';
  return 'led-notdone';
}

// Not Done first, then Running, then Done, then Ignore
function sortTasks(list) {
  return [...list].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.id - b.id
  );
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
  const [toast, setToast] = useState(
    location.state?.flash ? { message: location.state.flash, type: 'success' } : null
  );

  // Ignore reason popup
  const [ignoreTarget, setIgnoreTarget] = useState(null);
  const [ignoreText, setIgnoreText] = useState('');
  const [ignoreError, setIgnoreError] = useState('');

  // Add employee popup
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [toAdd, setToAdd] = useState([]);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Clear the one-time success message so a refresh doesn't show it again
  useEffect(() => {
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: { sessionId } });
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setError('No active shift session found. Please start a shift first.');
      setLoading(false);
      return;
    }

    loadSessionData();

    // Reload every 10 minutes, and whenever the tab becomes visible again
    const timer = setInterval(() => loadSessionData(true), AUTO_REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === 'visible') loadSessionData(true);
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sessionId]);

  async function loadSessionData(silent = false) {
    try {
      const [sessionData, previousData] = await Promise.all([
        getSession(sessionId),
        getPreviousShift(),
      ]);

      if (silent && sessionData.status === 'Ended') {
        setToast({ message: 'This shift was ended by a teammate.', type: 'success' });
        setTimeout(() => navigate('/shift-start'), 2000);
        return;
      }

      setSession(sessionData);
      setTasks(sessionData.tasks);
      setNotes(sessionData.notes || []);
      setFixedNotes(sessionData.shift?.fixedNotes || []);
      setPrevious(previousData);
    } catch (err) {
      if (!silent) setError('Failed to load shift data.');
    } finally {
      setLoading(false);
    }
  }

  // Ignore needs a reason first, every other status saves right away
  function handleStatusClick(task, newStatus) {
    if (newStatus === 'Ignore') {
      setIgnoreTarget(task);
      setIgnoreText('');
      setIgnoreError('');
      return;
    }
    saveStatus(task.id, newStatus);
  }

  async function saveStatus(taskId, newStatus, reason) {
    try {
      const updated = await updateTaskStatus(taskId, newStatus, reason);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return true;
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to update task status.', type: 'error' });
      return false;
    }
  }

  async function confirmIgnore(e) {
    e.preventDefault();
    if (!ignoreText.trim()) {
      setIgnoreError('Please write why this task is ignored.');
      return;
    }
    const ok = await saveStatus(ignoreTarget.id, 'Ignore', ignoreText.trim());
    if (ok) setIgnoreTarget(null);
  }

  async function openAddEmployee() {
    setAddError('');
    setToAdd([]);
    try {
      setAllEmployees(await getEmployeesList());
      setShowAddEmployee(true);
    } catch {
      setToast({ message: 'Failed to load employees.', type: 'error' });
    }
  }

  function toggleToAdd(id) {
    const slotsLeft = MAX_EMPLOYEES - session.employees.length;
    setToAdd((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= slotsLeft) {
        setAddError(`A shift can have at most ${MAX_EMPLOYEES} employees.`);
        return prev;
      }
      setAddError('');
      return [...prev, id];
    });
  }

  async function confirmAddEmployees() {
    if (toAdd.length === 0) {
      setAddError('Select at least one employee.');
      return;
    }
    setAdding(true);
    try {
      const employees = await addShiftEmployees(sessionId, toAdd);
      setSession((prev) => ({ ...prev, employees }));
      setShowAddEmployee(false);
      setToast({ message: 'Employees added to the shift.', type: 'success' });
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add employees.');
    } finally {
      setAdding(false);
    }
  }

  async function confirmEndShift() {
    setShowEndConfirm(false);
    setEnding(true);
    try {
      await endShift(sessionId);
      setToast({ message: 'Shift ended. Report saved.', type: 'success' });
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
      await deleteNote(deleteTarget.id);
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setToast({ message: 'Note deleted.', type: 'success' });
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to delete.', type: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  }

  function renderTaskRow(task) {
    return (
      <div className="status-row" key={task.id}>
        <div className="status-label">
          <span className={`led ${statusLed(task.status)}`}></span>
          <div>
            <div className="status-title">{task.taskTitle}</div>
            {task.status === 'Ignore' && task.ignoreReason && (
              <div className="ignore-reason">Ignored: {task.ignoreReason}</div>
            )}
          </div>
        </div>
        <StatusButtons value={task.status} onChange={(s) => handleStatusClick(task, s)} />
      </div>
    );
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  const mainTasks = sortTasks(tasks.filter((t) => t.taskType === 'Fixed'));
  const tempTasks = sortTasks(tasks.filter((t) => t.taskType === 'Temporary'));
  const carryForwardTasks = sortTasks(tasks.filter((t) => t.taskType === 'CarryForward'));

  const shiftDateLabel = session
    ? new Date(session.shiftDate).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      })
    : '';
  const startedLabel = session
    ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const currentIds = session ? session.employees.map((e) => e.userId) : [];
  const addableEmployees = allEmployees.filter((emp) => !currentIds.includes(emp.id));
  const shiftIsFull = session && session.employees.length >= MAX_EMPLOYEES;

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
          <button className="btn-ghost" onClick={() => navigate('/reports')}>Reports</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {!sessionId && (
        <button className="btn-primary" onClick={() => navigate('/shift-start')}>Go to Shift Start</button>
      )}

      {sessionId && session && (
        <>
          {/* Shift details */}
          <div className="shift-banner">
            <div>
              <div className="readout">Current Shift</div>
              <h2 className="shift-banner-name">{session.shift?.name} Shift</h2>
              <div className="shift-banner-meta">
                <span>{shiftDateLabel}</span>
                <span>Started {startedLabel}</span>
              </div>
            </div>
            <div>
              <div className="card-head" style={{ marginBottom: 8 }}>
                <div className="readout">
                  Team on shift ({session.employees.length}/{MAX_EMPLOYEES})
                </div>
                <button
                  className="btn-ghost btn-small"
                  onClick={openAddEmployee}
                  disabled={shiftIsFull}
                  title={shiftIsFull ? 'This shift already has 4 employees' : ''}
                >
                  + Add Employee
                </button>
              </div>
              <div className="chip-list">
                {session.employees.map((e) => (
                  <span key={e.id} className={`chip ${e.userId === user?.id ? 'chip-you' : ''}`}>
                    {e.user.fullName}{e.userId === user?.id ? ' · you' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed notes — big and clear */}
          {fixedNotes.length > 0 && (
            <div className="card fixed-notes-card">
              <h3>Fixed Notes</h3>
              {fixedNotes.map((n) => (
                <div key={n.id} className="fixed-note-item">{n.noteText}</div>
              ))}
            </div>
          )}

          <div className="card notes-card">
            <div className="card-head">
              <h3>Notes</h3>
              <button className="btn-ghost btn-small" onClick={() => navigate('/add-note', { state: { sessionId } })}>+ Add</button>
            </div>
            {notes.length === 0 && <p>No notes for this shift.</p>}
            {notes.map((n) => (
              <div className="note-item" key={n.id}>
                <div className="note-item-text">{n.noteText}</div>
                <div className="note-item-actions">
                  <button className="btn-ghost btn-small btn-carry" onClick={() => handleCarryForward(n.id)}>Carry to Next Shift</button>
                  {!n.isDelivered && (
                    <>
                      <button className="btn-ghost btn-small" onClick={() => navigate('/add-note', { state: { sessionId, note: n } })}>Edit</button>
                      <button className="btn-danger btn-small" onClick={() => setDeleteTarget(n)}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Temporary Tasks</h3>
              <button className="btn-ghost btn-small" onClick={() => navigate('/add-temp-task', { state: { sessionId } })}>+ Add</button>
            </div>
            {tempTasks.length === 0 && <p>No temporary tasks for this shift.</p>}
            {tempTasks.map(renderTaskRow)}
          </div>

          {/* Previous shift section only appears if something was carried forward */}
          {carryForwardTasks.length > 0 && (
            <div className="card">
              <h3>Previous Shift — Carried Forward</h3>
              {previous?.previousSession && (
                <p className="readout">
                  From {previous.previousSession.shiftName} · {new Date(previous.previousSession.shiftDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                </p>
              )}
              {carryForwardTasks.map(renderTaskRow)}
            </div>
          )}

          <div className="card">
            <h3>Tasks</h3>
            {mainTasks.length === 0 && <p>No tasks for this shift.</p>}
            {mainTasks.map(renderTaskRow)}
          </div>

          <div className="btn-row" style={{ marginTop: 24 }}>
            <button className="btn-danger" style={{ marginLeft: 'auto' }} onClick={() => setShowEndConfirm(true)} disabled={ending}>
              {ending ? 'Ending...' : 'End Shift'}
            </button>
          </div>
        </>
      )}

      {/* Ignore reason popup */}
      {ignoreTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Ignore task</h3>
            <p>{ignoreTarget.taskTitle}</p>
            <form onSubmit={confirmIgnore}>
              <div className="field">
                <label>Reason</label>
                <textarea
                  value={ignoreText}
                  onChange={(e) => setIgnoreText(e.target.value)}
                  rows={3}
                  placeholder="Why is this task ignored?"
                  autoFocus
                />
              </div>
              {ignoreError && <p className="error-text">{ignoreError}</p>}
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" className="btn-ghost" onClick={() => setIgnoreTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add employee popup */}
      {showAddEmployee && session && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Add employees to this shift</h3>
            <p>{MAX_EMPLOYEES - session.employees.length} place(s) left</p>
            {addableEmployees.length === 0 ? (
              <p>No other employees available.</p>
            ) : (
              <div className="checklist" style={{ textAlign: 'left' }}>
                {addableEmployees.map((emp) => (
                  <label key={emp.id} className="checklist-item">
                    <input
                      type="checkbox"
                      checked={toAdd.includes(emp.id)}
                      onChange={() => toggleToAdd(emp.id)}
                    />
                    <span>{emp.fullName} ({emp.username})</span>
                  </label>
                ))}
              </div>
            )}
            {addError && <p className="error-text" style={{ marginTop: 12 }}>{addError}</p>}
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="btn-primary" onClick={confirmAddEmployees} disabled={adding}>
                {adding ? 'Adding...' : 'Add'}
              </button>
              <button className="btn-ghost" onClick={() => setShowAddEmployee(false)}>Cancel</button>
            </div>
          </div>
        </div>
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
          message="Are you sure you want to delete this note?"
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
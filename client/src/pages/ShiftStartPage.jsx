import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentShift, getEmployeesList, getPreviousShift, startShift, endShift, getMyActiveShift } from '../api/shifts';
import Toast from '../components/Toast';

function statusLed(status) {
  if (status === 'Done') return 'led-done';
  if (status === 'Running') return 'led-running';
  return 'led-notdone';
}

// "2026-11-06" -> "06/11/2026"
function formatShiftDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

const MAX_EMPLOYEES = 4;
const CLOCK_CHECK_MS = 30 * 1000; // so the next shift appears on time on an open page

function ShiftStartPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [previousShift, setPreviousShift] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [blockingShift, setBlockingShift] = useState(null);
  const [endingPrevious, setEndingPrevious] = useState(false);
  const [popupError, setPopupError] = useState('');
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === 'Admin') {
      navigate('/admin', { replace: true });
    }
  }, [user]);

  async function refreshShiftState() {
    const [currentData, previousData, myActive] = await Promise.all([
      getCurrentShift(),
      getPreviousShift(),
      getMyActiveShift(),
    ]);
    setCurrent(currentData);
    setPreviousShift(previousData);
    setActiveShift(myActive);
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [employeesData] = await Promise.all([getEmployeesList(), refreshShiftState()]);
        setEmployees(employeesData);
        if (user?.id) setSelectedEmployeeIds([user.id]);
      } catch {
        setError('Failed to load shift data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();

    function refreshQuietly() {
      refreshShiftState().catch(() => {});
    }
    function onVisible() {
      if (document.visibilityState === 'visible') refreshQuietly();
    }
    const timer = setInterval(refreshQuietly, CLOCK_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  function toggleEmployee(id) {
    if (id === user?.id) return;
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(id)) return prev.filter((e) => e !== id);
      if (prev.length >= MAX_EMPLOYEES) {
        setError(`You can select at most ${MAX_EMPLOYEES} employees.`);
        return prev;
      }
      setError('');
      return [...prev, id];
    });
  }

  async function handleStartShift() {
    setError('');
    setSubmitting(true);
    try {
      const result = await startShift(selectedEmployeeIds);
      navigate('/dashboard', { state: { sessionId: result.session.id } });
    } catch (err) {
      if (err.response?.data?.code === 'PREVIOUS_SHIFT_ACTIVE') {
        setPopupError('');
        setBlockingShift(err.response.data.activeSession);
      } else {
        setError(err.response?.data?.error || 'Failed to start shift.');
        refreshShiftState().catch(() => {});
      }
      setSubmitting(false);
    }
  }

  async function confirmEndPrevious() {
    setPopupError('');
    setEndingPrevious(true);
    try {
      await endShift(blockingShift.id);
      setToast({
        message: `${blockingShift.shiftName} shift ended and its report saved. You can now start your shift.`,
        type: 'success',
      });
      setBlockingShift(null);
      await refreshShiftState();
    } catch (err) {
      setPopupError(err.response?.data?.error || 'Failed to end the previous shift.');
    } finally {
      setEndingPrevious(false);
    }
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  const today = new Date().toLocaleDateString();
  const hasCarry = previousShift?.carryForwardTasks?.length > 0;

  const isRunningNow = current?.activeSession?.isCurrentShift;
  const isCompleted = !isRunningNow && current?.slotSession?.status === 'Ended';
  const canStart = current && !isRunningNow && !isCompleted;
  const isOnRunningShift = isRunningNow && activeShift?.id === current.activeSession.id;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div className="header-brand">
          <img src="/afs_logo.png" alt="" className="header-logo" />
          <div>
            <h1>Welcome, {user?.fullName}</h1>
            <p className="readout">{today}</p>
          </div>
        </div>
        <div className="header-actions">
          {user?.role === 'Admin' && (
            <button className="btn-ghost" onClick={() => navigate('/admin')}>Admin Dashboard</button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/notes')}>Notes</button>
          <button className="btn-ghost" onClick={() => navigate('/temp-tasks')}>Temp Tasks</button>
          <button className="btn-ghost" onClick={() => navigate('/reports')}>Reports</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {activeShift && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3>Active Shift In Progress</h3>
          <p>You're part of an active <strong>{activeShift.shift.name}</strong> shift.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard', { state: { sessionId: activeShift.id } })}>
            Join Shift
          </button>
        </div>
      )}

      <div className={hasCarry ? 'grid-2' : ''}>
        <div className="card">
          {current && (
            <div className="current-shift">
              <div className="readout">Current Shift</div>
              <h2 className="shift-banner-name">{current.shift.name} Shift</h2>
              <div className="shift-banner-meta">
                <span>{formatShiftDate(current.shiftDate)}</span>
                <span>Starts {current.startsAt}</span>
              </div>
            </div>
          )}

          {isRunningNow && !isOnRunningShift && (
            <p className="shift-state-message">
              This shift is already running ({current.activeSession.employees.join(', ')}).
              Ask someone on the shift to add you.
            </p>
          )}

          {isCompleted && (
            <p className="shift-state-message">
              This shift has been completed. The {current.next.name} shift opens at {current.next.startsAt}.
            </p>
          )}

          {canStart && (
            <>
              <h3 style={{ marginTop: 20 }}>Employees in Shift ({selectedEmployeeIds.length}/{MAX_EMPLOYEES})</h3>
              <div className="checklist">
                {employees.map((emp) => {
                  const isSelf = emp.id === user?.id;
                  return (
                    <label key={emp.id} className={`checklist-item ${isSelf ? 'locked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.id)}
                        disabled={isSelf}
                        onChange={() => toggleEmployee(emp.id)}
                      />
                      <span>{emp.fullName} ({emp.username}) {isSelf && '· you'}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Only shown when the previous shift left Not Done / Running tasks */}
        {hasCarry && (
          <div className="card">
            <h3>Previous Shift Summary</h3>
            <p className="readout" style={{ marginBottom: 12 }}>
              {previousShift.previousSession.shiftName} — {new Date(previousShift.previousSession.shiftDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}
            </p>
            {[...previousShift.carryForwardTasks]
              .sort((a, b) => (a.status === 'NotDone' ? 0 : 1) - (b.status === 'NotDone' ? 0 : 1) || a.id - b.id)
              .map((t) => (
              <div className="status-row" key={t.id}>
                <div className="status-label">
                  <span className={`led ${statusLed(t.status)}`}></span>
                  <span className="status-title">{t.taskTitle}</span>
                </div>
                <span className="readout">{t.status === 'NotDone' ? 'Not Done' : t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {canStart && (
        <button className="btn-primary btn-full" onClick={handleStartShift} disabled={submitting}>
          {submitting ? 'Starting...' : `Start ${current.shift.name} Shift`}
        </button>
      )}

      {blockingShift && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>The last shift has not been ended</h3>
            <p>End it before starting the {current?.shift.name} shift.</p>
            <dl className="shift-details">
              <dt>Shift</dt>
              <dd>{blockingShift.shiftName}</dd>
              <dt>Date</dt>
              <dd>{formatShiftDate(blockingShift.shiftDate)}</dd>
              <dt>Started</dt>
              <dd>{new Date(blockingShift.startedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })} by {blockingShift.startedBy}</dd>
              <dt>Team</dt>
              <dd>{blockingShift.employees.join(', ')}</dd>
              <dt>Open tasks</dt>
              <dd>{blockingShift.openTasks}</dd>
            </dl>
            {popupError && <p className="error-text">{popupError}</p>}
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: 20 }}>
              <button className="btn-danger" onClick={confirmEndPrevious} disabled={endingPrevious}>
                {endingPrevious ? 'Ending...' : 'End Previous Shift'}
              </button>
              <button className="btn-ghost" onClick={() => setBlockingShift(null)} disabled={endingPrevious}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default ShiftStartPage;

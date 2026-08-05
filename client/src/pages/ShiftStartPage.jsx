import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getShiftsList, getEmployeesList, getPreviousShift, startShift, getMyActiveShift } from '../api/shifts';
function statusLed(status) {
  if (status === 'Done') return 'led-done';
  if (status === 'Running') return 'led-running';
  return 'led-notdone';
}

const MAX_EMPLOYEES = 4;

function ShiftStartPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [previousShift, setPreviousShift] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  useEffect(() => {
    if (user?.role === 'Admin') {
      navigate('/admin', { replace: true });
    }
  }, [user]);

  useEffect(() => {
    async function loadData() {
      try {
        const [shiftsData, employeesData, previousData, myActive] = await Promise.all([
          getShiftsList(),
          getEmployeesList(),
          getPreviousShift(),
          getMyActiveShift(),
        ]);
        setShifts(shiftsData);
        setEmployees(employeesData);
        setPreviousShift(previousData);
        setActiveShift(myActive);
        if (user?.id) setSelectedEmployeeIds([user.id]);
      } catch (err) {
        setError('Failed to load shift data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function toggleEmployee(id) {
    if (id === user?.id) return; // self is always locked in
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
    if (!selectedShiftId) {
      setError('Please select a shift.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await startShift(parseInt(selectedShiftId, 10), selectedEmployeeIds);
      navigate('/dashboard', { state: { sessionId: result.session.id } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start shift.');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  const today = new Date().toLocaleDateString();

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div>
          <h1>Welcome, {user?.fullName}</h1>
          <p className="readout">{today}</p>
        </div>
        <div className="header-actions">
          {user?.role === 'Admin' && (
            <button className="btn-ghost" onClick={() => navigate('/admin')}>Admin Dashboard</button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/reports')}>Historical Reports</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>
          {activeShift && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3>Active Shift In Progress</h3>
          <p>You're already part of an active <strong>{activeShift.shift.name}</strong> shift, started by someone else on your team.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard', { state: { sessionId: activeShift.id } })}>
            Join Shift
          </button>
        </div>
      )}

  
      <div className="grid-2">
        <div className="card">
          <h3>Select Shift</h3>
          <select value={selectedShiftId} onChange={(e) => setSelectedShiftId(e.target.value)}>
            <option value="">-- Choose a shift --</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

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
        </div>

        <div className="card">
          <h3>Previous Shift Summary</h3>
          {previousShift?.previousSession ? (
            <>
              <p className="readout">
                {previousShift.previousSession.shiftName} — {new Date(previousShift.previousSession.shiftDate).toLocaleDateString()}
              </p>
              <p className="readout" style={{ marginBottom: 12 }}>
                {previousShift.previousEmployees?.join(', ')}
              </p>
              {previousShift.carryForwardTasks.length === 0 && <p>No carry-forward tasks.</p>}
              {previousShift.carryForwardTasks.map((t) => (
                <div className="status-row" key={t.id}>
                  <div className="status-label">
                    <span className={`led ${statusLed(t.status)}`}></span>
                    <span className="status-title">{t.taskTitle}</span>
                  </div>
                  <span className="readout">{t.status}</span>
                </div>
              ))}
              {previousShift.previousNotes?.length > 0 && (
                <>
                  <h3 style={{ marginTop: 16 }}>Notes</h3>
                  {previousShift.previousNotes.map((n) => (
                    <p key={n.id} style={{ fontSize: 13 }}>— {n.noteText}</p>
                  ))}
                </>
              )}
            </>
          ) : (
            <p>No previous shift data available.</p>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn-primary btn-full" onClick={handleStartShift} disabled={submitting}>
        {submitting ? 'Starting...' : 'Start Shift'}
      </button>
    </div>
  );
}

export default ShiftStartPage;

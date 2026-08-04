import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getShiftsList, getPreviousShift, startShift } from '../api/shifts';

function statusLed(status) {
  if (status === 'Done') return 'led-done';
  if (status === 'Running') return 'led-running';
  return 'led-notdone';
}

function ShiftStartPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [previousShift, setPreviousShift] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [shiftsData, previousData] = await Promise.all([
          getShiftsList(),
          getPreviousShift(),
        ]);
        setShifts(shiftsData);
        setPreviousShift(previousData);
        if (user?.id) setSelectedEmployeeIds([user.id]);
      } catch (err) {
        setError('Failed to load shift data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
    <div className="page">
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

      <div className="card">
        <h3>Select Shift</h3>
        <select value={selectedShiftId} onChange={(e) => setSelectedShiftId(e.target.value)}>
          <option value="">-- Choose a shift --</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <h3>Previous Shift Summary</h3>
        {previousShift?.previousSession ? (
          <>
            <p className="readout">
              {previousShift.previousSession.shiftName} — {new Date(previousShift.previousSession.shiftDate).toLocaleDateString()}
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
          </>
        ) : (
          <p>No previous shift data available.</p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn-primary btn-full" onClick={handleStartShift} disabled={submitting}>
        {submitting ? 'Starting...' : 'Start Shift'}
      </button>
    </div>
  );
}

export default ShiftStartPage;

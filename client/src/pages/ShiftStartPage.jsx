import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getShiftsList, getEmployeesList, getPreviousShift, startShift } from '../api/shifts';

function ShiftStartPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [previousShift, setPreviousShift] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [shiftsData, employeesData, previousData] = await Promise.all([
          getShiftsList(),
          getEmployeesList(),
          getPreviousShift(),
        ]);
        setShifts(shiftsData);
        setEmployees(employeesData);
        setPreviousShift(previousData);

        // Auto-select the logged-in user as an employee by default
        if (user?.id) {
          setSelectedEmployeeIds([user.id]);
        }
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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  const today = new Date().toLocaleDateString();

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Welcome, {user?.fullName}</h1>
        <button onClick={logout}>Logout</button>
      </div>
      <p>Today's Date: {today}</p>

      <div style={{ marginTop: 24 }}>
        <label>Select Shift:</label><br />
        <select value={selectedShiftId} onChange={(e) => setSelectedShiftId(e.target.value)} style={{ padding: 8, width: '100%' }}>
          <option value="">-- Choose a shift --</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Employee:</label>
        <div style={{ border: '1px solid #ccc', padding: 8, background: '#f5f5f5' }}>
          {user?.fullName} ({user?.username})
        </div>
      </div>

      <div style={{ marginTop: 24, border: '1px solid #ddd', padding: 12 }}>
        <h3>Previous Shift Summary</h3>
        {previousShift?.previousSession ? (
          <>
            <p>{previousShift.previousSession.shiftName} — {new Date(previousShift.previousSession.shiftDate).toLocaleDateString()}</p>
            <ul>
              {previousShift.carryForwardTasks.map((t) => (
                <li key={t.id}>{t.taskTitle} — {t.status}</li>
              ))}
              {previousShift.carryForwardTasks.length === 0 && <li>No carry-forward tasks.</li>}
            </ul>
          </>
        ) : (
          <p>No previous shift data available.</p>
        )}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={handleStartShift} disabled={submitting} style={{ marginTop: 24, padding: 12, fontSize: 16, width: '100%', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Starting...' : 'Start Shift'}
      </button>
    </div>
  );
}

export default ShiftStartPage;

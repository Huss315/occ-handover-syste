import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getShiftsList, searchReport } from '../api/shifts';

function HistoricalSearchPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [date, setDate] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    getShiftsList().then(setShifts).catch(() => setError('Failed to load shifts.'));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setSearched(false);

    if (!date || !shiftId) {
      setError('Please select both a date and a shift.');
      return;
    }

    setSearching(true);
    try {
      const data = await searchReport(date, shiftId);
      setResult(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setResult(null);
      } else {
        setError(err.response?.data?.error || 'Search failed.');
      }
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Search Old Handover Report</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/shift-start')}>Back to Shift Start</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 24 }}>
        <div>
          <label>Date:</label><br />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 8 }} />
        </div>
        <div>
          <label>Shift:</label><br />
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} style={{ padding: 8 }}>
            <option value="">-- Choose --</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={searching} style={{ padding: 10 }}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p style={{ color: 'red', marginTop: 16 }}>{error}</p>}

      {searched && !result && !error && (
        <p style={{ marginTop: 24 }}>No report found for that date and shift.</p>
      )}

      {result && (
        <div style={{ marginTop: 24, border: '1px solid #ddd', padding: 16, borderRadius: 6 }}>
          <h3>{result.report.reportTitle}</h3>
          <p><strong>Employees:</strong> {result.session.employees.join(', ')}</p>
          <p><strong>Status:</strong> {result.session.status}</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f9f9f9', padding: 12, borderRadius: 4 }}>
            {result.report.reportContent}
          </pre>
        </div>
      )}
    </div>
  );
}

export default HistoricalSearchPage;

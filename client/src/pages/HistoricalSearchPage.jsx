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
      if (err.response?.status !== 404) {
        setError(err.response?.data?.error || 'Search failed.');
      }
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Search Handover Reports</h1>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => navigate('/shift-start')}>Back</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            <label>Shift</label>
            <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">-- Choose --</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {error && <p className="error-text">{error}</p>}

      {searched && !result && !error && (
        <p>No report found for that date and shift.</p>
      )}

      {result && (
        <div className="card">
          <h3>{result.report.reportTitle}</h3>
          <p className="readout">{result.session.employees.join(', ')} · {result.session.status}</p>
          <div className="report-content">{result.report.reportContent}</div>
        </div>
      )}
    </div>
  );
}

export default HistoricalSearchPage;

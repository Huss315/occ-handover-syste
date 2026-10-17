import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllTempTasks, deleteTempTask, getMyActiveShift } from '../api/shifts';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

function TempTasksPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tasks, setTasks] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(
    location.state?.flash ? { message: location.state.flash, type: 'success' } : null
  );

  useEffect(() => {
    if (location.state?.flash) navigate(location.pathname, { replace: true, state: {} });
    load();
    getMyActiveShift().then(setActiveShift).catch(() => {});
  }, []);

  async function load() {
    try {
      setTasks(await getAllTempTasks());
    } catch {
      setError('Failed to load temporary tasks.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    try {
      await deleteTempTask(deleteTarget.id);
      setToast({ message: 'Temporary task deleted.', type: 'success' });
      load();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to delete task.', type: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div className="header-brand">
          <img src="/afs_logo.png" alt="" className="header-logo" />
          <h1>Temporary Tasks</h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>
          {activeShift ? (
            <button className="btn-ghost" onClick={() => navigate('/dashboard', { state: { sessionId: activeShift.id } })}>Shift</button>
          ) : (
            <button className="btn-ghost" onClick={() => navigate('/shift-start')}>Shift Start</button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/notes')}>Notes</button>
          <button className="btn-ghost" onClick={() => navigate('/reports')}>Reports</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>All Temporary Tasks</h3>
          <button className="btn-primary" onClick={() => navigate('/add-temp-task')}>+ Add Task</button>
        </div>

        {tasks.length === 0 && <p style={{ marginTop: 12 }}>No temporary tasks yet.</p>}

        {tasks.map((t) => (
          <div className="list-row" key={t.id}>
            <div>
              <div>{t.taskTitle}</div>
              <div className="readout">
                {new Date(t.targetDate).toLocaleDateString(undefined, { timeZone: 'UTC' })} · {t.targetShift?.name}
                {t.isDelivered && <span className="badge badge-inactive" style={{ marginLeft: 8 }}>Delivered</span>}
              </div>
            </div>
            {!t.isDelivered ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/add-temp-task', { state: { tempTask: t } })}>Edit</button>
                <button className="btn-danger" onClick={() => setDeleteTarget(t)}>Delete</button>
              </div>
            ) : (
              <span className="readout">Locked</span>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Temporary Task"
          message="Are you sure you want to delete this task?"
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

export default TempTasksPage;

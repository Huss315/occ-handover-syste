import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllNotes, deleteNote , getMyActiveShift} from '../api/shifts';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

function NotesPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

const [activeShift, setActiveShift] = useState(null);

  useEffect(() => {
    load();
    getMyActiveShift().then(setActiveShift).catch(() => {});
  }, []);

  async function load() {
    try {
      setNotes(await getAllNotes());
    } catch {
      setError('Failed to load notes.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    try {
      await deleteNote(deleteTarget.id);
      setToast({ message: 'Note deleted.', type: 'success' });
      load();
    } catch (err) {
      setToast({ message: err.response?.data?.error || 'Failed to delete note.', type: 'error' });
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
          <h1>Notes</h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>
          {activeShift ? (
            <button className="btn-ghost" onClick={() => navigate('/dashboard', { state: { sessionId: activeShift.id } })}>Shift</button>
          ) : (
            <button className="btn-ghost" onClick={() => navigate('/shift-start')}>Shift Start</button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/temp-tasks')}>Temp Tasks</button>
          <button className="btn-ghost" onClick={() => navigate('/reports')}>Reports</button>
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>All Notes</h3>
          <button className="btn-primary" onClick={() => navigate('/add-note')}>+ Add Note</button>
        </div>

        {notes.length === 0 && <p style={{ marginTop: 12 }}>No notes yet.</p>}

        {notes.map((n) => (
          <div className="list-row" key={n.id}>
            <div>
              <div>{n.noteText}</div>
              <div className="readout">
                {new Date(n.targetDate).toLocaleDateString()} · {n.targetShift?.name}
                {n.isDelivered && <span className="badge badge-inactive" style={{ marginLeft: 8 }}>Delivered</span>}
              </div>
            </div>
            {!n.isDelivered ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/add-note', { state: { note: n } })}>Edit</button>
                <button className="btn-danger" onClick={() => setDeleteTarget(n)}>Delete</button>
              </div>
            ) : (
              <span className="readout">Locked</span>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Note"
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

export default NotesPage;

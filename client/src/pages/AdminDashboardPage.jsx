import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUsers, createUser, deactivateUser,
  getFixedTasks, createFixedTask, deactivateFixedTask,
  getFixedNotes, createFixedNote, deactivateFixedNote,
  getShiftsList,
  resetUserPassword,
} from '../api/shifts';
import Toast from '../components/Toast';

function AdminDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('menu');
  const [users, setUsers] = useState([]);
  const [fixedTasks, setFixedTasks] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const [newUser, setNewUser] = useState({ fullName: '', username: '', email: '', password: '', roleName: 'User' });
  const [newTask, setNewTask] = useState({ taskName: '', description: '', shiftId: '' });
  const [fixedNotes, setFixedNotes] = useState([]);
  const [newNote, setNewNote] = useState({ noteText: '', shiftId: '' });

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    getShiftsList().then(setShifts).catch(() => {});
  }, []);

  async function loadUsers() {
    try { setUsers(await getUsers()); setView('users'); }
    catch { setError('Failed to load users.'); }
  }

  async function loadTasks() {
    try { setFixedTasks(await getFixedTasks()); setView('tasks'); }
    catch { setError('Failed to load fixed tasks.'); }
  }

  async function loadNotes() {
    try { setFixedNotes(await getFixedNotes()); setView('notes'); }
    catch { setError('Failed to load fixed notes.'); }
  }

  async function handleCreateNote(e) {
    e.preventDefault();
    setError('');
    try {
      await createFixedNote({ ...newNote, shiftId: parseInt(newNote.shiftId, 10) });
      setToast({ message: 'Fixed note created successfully.', type: 'success' });
      setNewNote({ noteText: '', shiftId: '' });
      loadNotes();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create fixed note.');
    }
  }

  async function handleDeactivateNote(id) {
    try { await deactivateFixedNote(id); setToast({ message: 'Fixed note deactivated.', type: 'success' }); loadNotes(); }
    catch { setError('Failed to deactivate fixed note.'); }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setError('');
    try {
      await createUser(newUser);
      setToast({ message: 'User created successfully.', type: 'success' });
      setNewUser({ fullName: '', username: '', email: '', password: '', roleName: 'User' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  }

  async function handleDeactivateUser(id) {
    try { await deactivateUser(id); setToast({ message: 'User deactivated.', type: 'success' }); loadUsers(); }
    catch { setError('Failed to deactivate user.'); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError('');
    try {
      await resetUserPassword(resetTarget.id, resetPassword);
      setToast({ message: `Password updated for ${resetTarget.fullName}.`, type: 'success' });
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to reset password.');
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    setError('');
    try {
      await createFixedTask({ ...newTask, shiftId: parseInt(newTask.shiftId, 10) });
      setToast({ message: 'Fixed task created successfully.', type: 'success' });
      setNewTask({ taskName: '', description: '', shiftId: '' });
      loadTasks();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create fixed task.');
    }
  }

  async function handleDeactivateTask(id) {
    try { await deactivateFixedTask(id); setToast({ message: 'Fixed task deactivated.', type: 'success' }); loadTasks(); }
    catch { setError('Failed to deactivate fixed task.'); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-brand">
          <img src="/afs_logo.png" alt="" className="header-logo" />
          <h1>Admin Dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {view === 'menu' && (
        <div className="menu-grid">
          <button className="btn-primary" style={{ padding: 20 }} onClick={loadUsers}>Manage Users</button>
          <button className="btn-primary" style={{ padding: 20 }} onClick={loadTasks}>Manage Fixed Tasks</button>
          <button className="btn-primary" style={{ padding: 20 }} onClick={loadNotes}>Manage Fixed Notes</button>
          <button className="btn-primary" style={{ padding: 20 }} onClick={() => navigate('/reports')}>View Reports</button>
        </div>
      )}

      {view === 'users' && (
        <>
          <button className="btn-ghost" style={{ marginBottom: 16 }} onClick={() => setView('menu')}>← Back</button>

          <div className="card">
            <h3>Create New User</h3>
            <form onSubmit={handleCreateUser}>
              <div className="field"><label>Full Name</label><input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} /></div>
              <div className="field"><label>Username</label><input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /></div>
              <div className="field"><label>Email</label><input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
              <div className="field"><label>Password</label><input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
              <div className="field">
                <label>Role</label>
                <select value={newUser.roleName} onChange={(e) => setNewUser({ ...newUser, roleName: e.target.value })}>
                  <option value="User">User</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="btn-primary btn-full">Create User</button>
            </form>
          </div>

          <div className="card">
            <h3>All Users</h3>
            {users.map((u) => (
              <div className="list-row" key={u.id}>
                <span>{u.fullName} <span className="readout">({u.username}) · {u.role.name}</span> {!u.isActive && <span className="badge badge-inactive">Inactive</span>}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-ghost"
                    disabled={!u.isActive}
                    title={!u.isActive ? 'Inactive users cannot be reset' : ''}
                    onClick={() => { setResetTarget(u); setResetPassword(''); setResetError(''); }}
                  >
                    Reset Password
                  </button>
                  {u.isActive && <button className="btn-danger" onClick={() => handleDeactivateUser(u.id)}>Deactivate</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'tasks' && (
        <>
          <button className="btn-ghost" style={{ marginBottom: 16 }} onClick={() => setView('menu')}>← Back</button>

          <div className="card">
            <h3>Create New Fixed Task</h3>
            <form onSubmit={handleCreateTask}>
              <div className="field"><label>Task Name</label><input value={newTask.taskName} onChange={(e) => setNewTask({ ...newTask, taskName: e.target.value })} /></div>
              <div className="field"><label>Description</label><textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} /></div>
              <div className="field">
                <label>Shift</label>
                <select value={newTask.shiftId} onChange={(e) => setNewTask({ ...newTask, shiftId: e.target.value })}>
                  <option value="">-- Choose Shift --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary btn-full">Create Fixed Task</button>
            </form>
          </div>

          <div className="card">
            <h3>All Fixed Tasks</h3>
            {fixedTasks.map((t) => (
              <div className="list-row" key={t.id}>
                <span>{t.taskName} <span className="readout">· {t.shift.name}</span> {!t.isActive && <span className="badge badge-inactive">Inactive</span>}</span>
                {t.isActive && <button className="btn-danger" onClick={() => handleDeactivateTask(t.id)}>Deactivate</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'notes' && (
        <>
          <button className="btn-ghost" style={{ marginBottom: 16 }} onClick={() => setView('menu')}>← Back</button>

          <div className="card">
            <h3>Create New Fixed Note</h3>
            <form onSubmit={handleCreateNote}>
              <div className="field"><label>Note Text</label><textarea value={newNote.noteText} onChange={(e) => setNewNote({ ...newNote, noteText: e.target.value })} /></div>
              <div className="field">
                <label>Shift</label>
                <select value={newNote.shiftId} onChange={(e) => setNewNote({ ...newNote, shiftId: e.target.value })}>
                  <option value="">-- Choose Shift --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary btn-full">Create Fixed Note</button>
            </form>
          </div>

          <div className="card">
            <h3>All Fixed Notes</h3>
            {fixedNotes.map((n) => (
              <div className="list-row" key={n.id}>
                <span>{n.noteText} <span className="readout">· {n.shift.name}</span> {!n.isActive && <span className="badge badge-inactive">Inactive</span>}</span>
                {n.isActive && <button className="btn-danger" onClick={() => handleDeactivateNote(n.id)}>Deactivate</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {resetTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Reset password</h3>
            <p>New password for {resetTarget.fullName} ({resetTarget.username})</p>
            <form onSubmit={handleResetPassword}>
              <div className="field">
                <input
                  type="password"
                  placeholder="New password (min 6 characters)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoFocus
                />
              </div>
              {resetError && <p className="error-text">{resetError}</p>}
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" className="btn-ghost" onClick={() => setResetTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminDashboardPage;
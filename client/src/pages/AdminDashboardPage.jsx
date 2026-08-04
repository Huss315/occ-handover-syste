import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUsers, createUser, deactivateUser,
  getFixedTasks, createFixedTask, deactivateFixedTask,
  getShiftsList,
} from '../api/shifts';
import Toast from '../components/Toast';

function AdminDashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('menu'); // menu | users | tasks
  const [users, setUsers] = useState([]);
  const [fixedTasks, setFixedTasks] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  // New user form
  const [newUser, setNewUser] = useState({ fullName: '', username: '', email: '', password: '', roleName: 'User' });
  // New fixed task form
  const [newTask, setNewTask] = useState({ taskName: '', description: '', shiftId: '' });

  useEffect(() => {
    getShiftsList().then(setShifts).catch(() => {});
  }, []);

  async function loadUsers() {
    try {
      setUsers(await getUsers());
      setView('users');
    } catch (err) {
      setError('Failed to load users.');
    }
  }

  async function loadTasks() {
    try {
      setFixedTasks(await getFixedTasks());
      setView('tasks');
    } catch (err) {
      setError('Failed to load fixed tasks.');
    }
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
    try {
      await deactivateUser(id);
      setToast({ message: 'User deactivated.', type: 'success' });
      loadUsers();
    } catch (err) {
      setError('Failed to deactivate user.');
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
    try {
      await deactivateFixedTask(id);
      setToast({ message: 'Fixed task deactivated.', type: 'success' });
      loadTasks();
    } catch (err) {
      setError('Failed to deactivate fixed task.');
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/shift-start')}>Back to Shift Start</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {view === 'menu' && (
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={loadUsers} style={{ padding: 16, flex: 1 }}>Manage Users</button>
          <button onClick={loadTasks} style={{ padding: 16, flex: 1 }}>Manage Fixed Tasks</button>
          <button onClick={() => navigate('/reports')} style={{ padding: 16, flex: 1 }}>View Reports</button>
        </div>
      )}

      {view === 'users' && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setView('menu')}>← Back</button>
          <h3>Create New User</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 350 }}>
            <input placeholder="Full Name" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} style={{ padding: 8 }} />
            <input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} style={{ padding: 8 }} />
            <input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} style={{ padding: 8 }} />
            <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={{ padding: 8 }} />
            <select value={newUser.roleName} onChange={(e) => setNewUser({ ...newUser, roleName: e.target.value })} style={{ padding: 8 }}>
              <option value="User">User</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
            <button type="submit" style={{ padding: 10 }}>Create User</button>
          </form>

          <h3 style={{ marginTop: 24 }}>All Users</h3>
          {users.map((u) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span>{u.fullName} ({u.username}) — {u.role.name} {!u.isActive && '(Inactive)'}</span>
              {u.isActive && (
                <button onClick={() => handleDeactivateUser(u.id)} style={{ color: '#c0392b' }}>Deactivate</button>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'tasks' && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setView('menu')}>← Back</button>
          <h3>Create New Fixed Task</h3>
          <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 350 }}>
            <input placeholder="Task Name" value={newTask.taskName} onChange={(e) => setNewTask({ ...newTask, taskName: e.target.value })} style={{ padding: 8 }} />
            <textarea placeholder="Description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} style={{ padding: 8 }} />
            <select value={newTask.shiftId} onChange={(e) => setNewTask({ ...newTask, shiftId: e.target.value })} style={{ padding: 8 }}>
              <option value="">-- Choose Shift --</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="submit" style={{ padding: 10 }}>Create Fixed Task</button>
          </form>

          <h3 style={{ marginTop: 24 }}>All Fixed Tasks</h3>
          {fixedTasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span>{t.taskName} — {t.shift.name} {!t.isActive && '(Inactive)'}</span>
              {t.isActive && (
                <button onClick={() => handleDeactivateTask(t.id)} style={{ color: '#c0392b' }}>Deactivate</button>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AdminDashboardPage;

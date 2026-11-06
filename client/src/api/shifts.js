import apiClient from './client';

export async function addShiftEmployees(sessionId, employeeIds) {
  const res = await apiClient.post(`/shifts/${sessionId}/employees`, { employeeIds });
  return res.data.employees;
}

export async function refreshSession() {
  const res = await apiClient.post('/auth/refresh');
  return res.data;
}

export async function getShiftsList() {
  const res = await apiClient.get('/shifts/list');
  return res.data.shifts;
}

export async function getEmployeesList() {
  const res = await apiClient.get('/auth/employees');
  return res.data.employees;
}

export async function getPreviousShift() {
  const res = await apiClient.get('/shifts/previous');
  return res.data;
}

export async function getCurrentShift() {
  const res = await apiClient.get('/shifts/current');
  return res.data;
}

export async function startShift(employeeIds) {
  const res = await apiClient.post('/shifts/start', { employeeIds });
  return res.data;
}
export async function updateTaskStatus(taskId, status, ignoreReason) {
  const res = await apiClient.patch(`/tasks/${taskId}`, { status, ignoreReason });
  return res.data.task;
}

export async function endShift(sessionId) {
  const res = await apiClient.post(`/shifts/${sessionId}/end`);
  return res.data;
}
export async function getSession(sessionId) {
  const res = await apiClient.get(`/shifts/${sessionId}`);
  return res.data.session;
}
export async function createNote(noteText, targetDate, targetShiftId) {
  const res = await apiClient.post('/notes', { noteText, targetDate, targetShiftId });
  return res.data.note;
}

export async function createTempTask(taskTitle, targetDate, targetShiftId) {
  const res = await apiClient.post('/temp-tasks', { taskTitle, targetDate, targetShiftId });
  return res.data.tempTask;
}
export async function searchReport(date, shiftId) {
  const res = await apiClient.get(`/reports/search?date=${date}&shiftId=${shiftId}`);
  return res.data;
}
export async function getUsers() {
  const res = await apiClient.get('/admin/users');
  return res.data.users;
}

export async function createUser(data) {
  const res = await apiClient.post('/admin/users', data);
  return res.data.user;
}

export async function deactivateUser(userId) {
  const res = await apiClient.patch(`/admin/users/${userId}/deactivate`);
  return res.data.user;
}

export async function getFixedTasks() {
  const res = await apiClient.get('/admin/fixed-tasks');
  return res.data.fixedTasks;
}

export async function createFixedTask(data) {
  const res = await apiClient.post('/admin/fixed-tasks', data);
  return res.data.fixedTask;
}

export async function deactivateFixedTask(taskId) {
  const res = await apiClient.patch(`/admin/fixed-tasks/${taskId}/deactivate`);
  return res.data.fixedTask;
}
export async function deleteFixedTask(taskId) {
  await apiClient.delete(`/admin/fixed-tasks/${taskId}`);
}

export async function getFixedNotes() {
  const res = await apiClient.get('/admin/fixed-notes');
  return res.data.fixedNotes;
}

export async function createFixedNote(data) {
  const res = await apiClient.post('/admin/fixed-notes', data);
  return res.data.fixedNote;
}

export async function deactivateFixedNote(id) {
  const res = await apiClient.patch(`/admin/fixed-notes/${id}/deactivate`);
  return res.data.fixedNote;
}
export async function deleteFixedNote(id) {
  await apiClient.delete(`/admin/fixed-notes/${id}`);
}

export async function getMyActiveShift() {
  const res = await apiClient.get('/shifts/my-active');
  return res.data.activeSession;
}
export async function updateNote(id, data) {
  const res = await apiClient.patch(`/notes/${id}`, data);
  return res.data.note;
}

export async function deleteNote(id) {
  await apiClient.delete(`/notes/${id}`);
}

export async function updateTempTask(id, data) {
  const res = await apiClient.patch(`/temp-tasks/${id}`, data);
  return res.data.tempTask;
}

export async function deleteTempTask(id) {
  await apiClient.delete(`/temp-tasks/${id}`);
}
export async function getAllNotes() {
  const res = await apiClient.get('/notes');
  return res.data.notes;
}

export async function getAllTempTasks() {
  const res = await apiClient.get('/temp-tasks');
  return res.data.tempTasks;
}
export async function carryNoteForward(id) {
  const res = await apiClient.post(`/notes/${id}/carry-forward`);
  return res.data.note;
}
export async function resetUserPassword(userId, newPassword) {
  const res = await apiClient.patch(`/admin/users/${userId}/password`, { newPassword });
  return res.data;
}
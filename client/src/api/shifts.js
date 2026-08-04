import apiClient from './client';

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

export async function startShift(shiftId, employeeIds) {
  const res = await apiClient.post('/shifts/start', { shiftId, employeeIds });
  return res.data;
}
export async function updateTaskStatus(taskId, status) {
  const res = await apiClient.patch(`/tasks/${taskId}`, { status });
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

export async function createTempTask(taskTitle, description, targetDate, targetShiftId) {
  const res = await apiClient.post('/temp-tasks', { taskTitle, description, targetDate, targetShiftId });
  return res.data.tempTask;
}
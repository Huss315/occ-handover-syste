const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const shiftRoutes = require('./routes/shift.routes');
const taskRoutes = require('./routes/task.routes');
const noteRoutes = require('./routes/note.routes');
const tempTaskRoutes = require('./routes/tempTask.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('OCC Handover System API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/temp-tasks', tempTaskRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const shiftRoutes = require('./routes/shift.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('OCC Handover System API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);

module.exports = app;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const claimsRoutes = require('./routes/claims');
const authRoutes = require('./routes/auth');

app.use('/api/claims', claimsRoutes);
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Insurance Claim Validation Backend API',
    version: '1.0.0',
    endpoints: {
      claims: '/api/claims',
      auth: '/api/auth',
      health: '/health'
    }
  });
});

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_claims';
mongoose.connect(mongoUri)
.then(() => {
  console.log('[OK] Connected to MongoDB at', mongoUri);
  
  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[OK] Backend API running on port ${PORT}`);
  });
})
.catch((error) => {
  console.warn('[WARN] MongoDB connection error:', error.message);
  console.log('Starting Express server anyway for API routing...');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[OK] Backend API running on port ${PORT} (MongoDB in offline/mock mode)`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

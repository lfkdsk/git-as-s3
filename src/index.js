if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const winston = require('winston');
const { Octokit } = require('@octokit/rest');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.TOKEN_GITHUB
});

const app = express();

// Middleware configuration
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: '*/*', limit: '10mb' }));

app.get('/', async (req, res) => {
  res.status(200).json({
    token: process.env.TOKEN_GITHUB !== undefined ? 'defined' : 'undefined',
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Verify GitHub connection
    await octokit.rest.users.getAuthenticated();
    res.status(200).json({
      status: 'healthy',
      github_connection: 'connected',
      token: process.env.TOKEN_GITHUB !== undefined ? 'defined' : 'undefined',
    });
  } catch (error) {
    res.status(200).json({
      status: 'healthy',
      github_connection: 'disconnected',
      github_error: error.message
    });
  }
});

// S3 compatible API routes
app.use('/s3', require('./routes/s3'));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

module.exports = app; // Export app for testing
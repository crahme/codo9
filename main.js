const logger = require('pino')({ level: 'info' });
const app = require('./app'); // Importing the Express app

// Start the server
const PORT = 5000;
const HOST = '0.0.0.0';

logger.info('Starting Express server...');
app.listen(PORT, HOST, () => {
  logger.info(`Server is running on http://${HOST}:${PORT}`);
});

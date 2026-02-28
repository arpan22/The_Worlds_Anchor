/**
 * Vercel Serverless Function — catch-all API handler
 *
 * Routes all /api/* requests to the Express app.
 * Vercel sets process.env.VERCEL=1 which prevents server/index.js
 * from calling app.listen(), allowing it to run as a serverless handler.
 */
import app from '../server/index.js';

export default app;

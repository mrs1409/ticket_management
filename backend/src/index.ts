import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import app from './app';
import { connectDB } from './db/connection';
import { connectRedis } from './config/redis';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

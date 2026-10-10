import mongoose from 'mongoose';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Create collections (incl. the time-series one, which cannot be created implicitly) and build
  // declared indexes up front so uniqueness guarantees hold before traffic arrives.
  await initModels();
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

export async function initModels(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectDatabase(): Promise<void> {
  // Intentional shutdown: don't log it as an unexpected disconnect.
  mongoose.connection.removeAllListeners('disconnected');
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

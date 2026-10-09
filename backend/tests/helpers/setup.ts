import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';
// Importing the app registers every Mongoose model before indexes are built.
import '../../src/app.js';

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `ft_test_${randomUUID().slice(0, 8)}` });
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

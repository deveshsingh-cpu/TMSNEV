import 'dotenv/config';
import express from 'express';
import { apiRouter } from '../src/server/routes/api.js';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mount on both /api and / so Vercel rewrites match regardless of prefix stripping
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;

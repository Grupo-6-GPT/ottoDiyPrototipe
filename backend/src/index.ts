import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { waitForDb } from './db';
import choreographyRouter from './routes';

const app  = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.use('/api/choreographies', choreographyRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Generic error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

(async () => {
  console.log('Waiting for MySQL…');
  await waitForDb();
  console.log('MySQL ready.');
  app.listen(port, () => console.log(`Backend listening on :${port}`));
})();

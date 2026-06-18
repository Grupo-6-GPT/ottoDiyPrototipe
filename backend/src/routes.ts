import { Router, Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from './db';

const router = Router();

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v');
  } catch { /* invalid URL */ }
  return null;
}

async function obtenerDuracionVideo(videoId: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    if (!response.ok) return null;
    const html = await response.text();

    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/);
    if (playerMatch) {
      try {
        const data = JSON.parse(playerMatch[1]);
        const seconds = parseInt(data?.videoDetails?.lengthSeconds, 10);
        if (!isNaN(seconds)) return seconds;
      } catch { /* fall through */ }
    }

    const msMatch = html.match(/"approxDurationMs":"(\d+)"/);
    if (msMatch) return Math.floor(parseInt(msMatch[1], 10) / 1000);

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveDuration(youtubeUrl?: string, youtubeDuration?: number): Promise<number | null> {
  if (youtubeDuration != null) return youtubeDuration;
  if (!youtubeUrl) return null;
  const videoId = extractVideoId(youtubeUrl);
  return videoId ? obtenerDuracionVideo(videoId) : null;
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

function toFront(row: RowDataPacket) {
  return {
    id:              row.id,
    name:            row.name,
    steps:           typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    createdAt:       row.created_at,
    bpm:             row.bpm,
    loop:            !!row.loop,
    youtubeUrl:      row.youtube_url  ?? undefined,
    audioUrl:        row.audio_url    ?? undefined,
    youtubeDuration: row.youtube_duration ?? undefined,
  };
}

// GET /api/choreographies
router.get('/', wrap(async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM choreographies ORDER BY created_at DESC',
  );
  res.json(rows.map(toFront));
}));

// POST /api/choreographies
router.post('/', wrap(async (req, res) => {
  const { id, name, steps, createdAt, bpm, loop, youtubeUrl, audioUrl, youtubeDuration } = req.body;
  const duration = await resolveDuration(youtubeUrl, youtubeDuration);
  await pool.query(
    `INSERT INTO choreographies
       (id, name, steps, created_at, bpm, \`loop\`, youtube_url, audio_url, youtube_duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, JSON.stringify(steps), createdAt, bpm ?? 120, loop ? 1 : 0,
     youtubeUrl ?? null, audioUrl ?? null, duration],
  );
  res.status(201).json({ id });
}));

// PUT /api/choreographies/:id
router.put('/:id', wrap(async (req, res) => {
  const { name, steps, bpm, loop, youtubeUrl, audioUrl, youtubeDuration } = req.body;
  const duration = await resolveDuration(youtubeUrl, youtubeDuration);
  await pool.query(
    `UPDATE choreographies
     SET name=?, steps=?, bpm=?, \`loop\`=?, youtube_url=?, audio_url=?, youtube_duration=?
     WHERE id=?`,
    [name, JSON.stringify(steps), bpm ?? 120, loop ? 1 : 0,
     youtubeUrl ?? null, audioUrl ?? null, duration, req.params.id],
  );
  res.json({ ok: true });
}));

// DELETE /api/choreographies/:id
router.delete('/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM choreographies WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;

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
  // Strategy 1: scrape YouTube page with browser-like headers
  const s1 = await scrapeYoutubePage(videoId);
  if (s1 != null) return s1;

  // Strategy 2: noembed.com public API (no auth needed, returns duration)
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
      { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    clearTimeout(t);
    if (res.ok) {
      const data: { duration_seconds?: number; error?: string } = await res.json();
      if (data.duration_seconds && !isNaN(data.duration_seconds)) {
        return Math.round(data.duration_seconds);
      }
    }
  } catch { /* fall through */ }

  return null;
}

async function scrapeYoutubePage(videoId: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();

    // Most reliable: direct grep for lengthSeconds field
    const lenMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
    if (lenMatch) return parseInt(lenMatch[1], 10);

    // Fallback: approxDurationMs
    const msMatch = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
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

// GET /api/choreographies/youtube-duration?url=...
router.get('/youtube-duration', wrap(async (req, res) => {
  const url = (req.query.url as string) ?? '';
  if (!url) { res.status(400).json({ error: 'url requerida' }); return; }
  const videoId = extractVideoId(url);
  if (!videoId) { res.status(400).json({ error: 'URL de YouTube inválida' }); return; }
  const seconds = await obtenerDuracionVideo(videoId);
  if (seconds == null) { res.status(404).json({ error: 'No se pudo obtener la duración' }); return; }
  res.json({ seconds, videoId });
}));

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

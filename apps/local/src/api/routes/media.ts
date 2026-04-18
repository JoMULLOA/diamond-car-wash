import { Hono } from 'hono';
import { getDatabase } from '../../db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from './auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../../public/uploads');

import { put } from '@vercel/blob';

const router = new Hono();

// POST /api/media/upload
router.post('/upload', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Validate type
    const mimeType = file.type;
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');

    if (!isImage && !isVideo) {
      return c.json({ error: 'Only images and videos are allowed' }, 400);
    }

    // Save file to Vercel Blob
    const ext = path.extname(file.name);
    const fileName = `${Date.now()}-${uuidv4()}${ext}`;
    
    // We upload the file directly to Vercel Blob
    const blob = await put(fileName, file, { access: 'public' });

    const mediaUrl = blob.url;
    const mediaType = isImage ? 'image' : 'video';

    return c.json({
      success: true,
      url: mediaUrl,
      type: mediaType
    });
  } catch (err) {
    console.error('[POST /api/media/upload]', err);
    return c.json({ error: 'Failed to upload media' }, 500);
  }
});

// PUT /api/services/:id/media - Link media to service
router.put('/services/:id', authMiddleware, async (c) => {
  try {
    const serviceId = c.req.param('id');
    const { media_url, media_type } = await c.req.json();

    const db = getDatabase();
    const now = Date.now();

    await db.run(
      `UPDATE services SET media_url = ?, media_type = ?, updated_at = ? WHERE id = ?`,
      [media_url, media_type, now, serviceId]
    );

    return c.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/media/services/:id]', err);
    return c.json({ error: 'Failed to update service media' }, 500);
  }
});

export { router as mediaRouter };

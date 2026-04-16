import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { v4 as uuid } from 'uuid';
import type { Service } from '../../shared';

const router = new Hono();

// GET /services - List all services (optionally filter by active)
router.get('/', async (c) => {
  try {
    const db = getDatabase();
    const activeOnly = c.req.query('active');

    let services: Service[];
    if (activeOnly === '1' || activeOnly === 'true') {
      services = await db.all<Service>('SELECT * FROM services WHERE active = 1 ORDER BY name ASC');
    } else {
      services = await db.all<Service>('SELECT * FROM services ORDER BY name ASC');
    }

    return c.json({ services });
  } catch (err) {
    console.error('[GET /services]', err);
    return c.json({ error: 'Failed to fetch services' }, 500);
  }
});

// GET /services/:id - Get a single service
router.get('/:id', async (c) => {
  try {
    const db = getDatabase();
    const service = await db.get<Service>('SELECT * FROM services WHERE id = ?', [c.req.param('id')]);

    if (!service) {
      return c.json({ error: 'Servicio no encontrado' }, 404);
    }

    return c.json({ service });
  } catch (err) {
    console.error('[GET /services/:id]', err);
    return c.json({ error: 'Failed to fetch service' }, 500);
  }
});

// POST /services - Create a new service
router.post('/', async (c) => {
  try {
    const { name, description, price, duration_minutes, max_quantity, media_url, media_type, process, tools_used } = await c.req.json();

    if (!name || !price || !duration_minutes) {
      return c.json({ error: 'Nombre, precio y duración son requeridos' }, 400);
    }

    const db = getDatabase();
    const now = Date.now();
    const id = uuid();

    await db.run(
      `INSERT INTO services (id, name, description, price, duration_minutes, max_quantity, active, media_url, media_type, process, tools_used, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [id, name, description || '', price, duration_minutes, max_quantity ?? 1, media_url || null, media_type || null, process || null, tools_used || null, now, now]
    );

    const service = await db.get<Service>('SELECT * FROM services WHERE id = ?', [id]);

    console.log(`[POST /services] Created service: ${name} ($${price}, ${duration_minutes}min)`);

    return c.json({ service }, 201);
  } catch (err) {
    console.error('[POST /services]', err);
    return c.json({ error: 'Failed to create service' }, 500);
  }
});

// PUT /services/:id - Update service
router.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const db = getDatabase();
    const now = Date.now();

    const existing = await db.get<Service>('SELECT * FROM services WHERE id = ?', [id]);
    if (!existing) {
      return c.json({ error: 'Servicio no encontrado' }, 404);
    }

    const name = updates.name ?? existing.name;
    const description = updates.description ?? existing.description;
    const price = updates.price ?? existing.price;
    const duration_minutes = updates.duration_minutes ?? existing.duration_minutes;
    const max_quantity = updates.max_quantity ?? existing.max_quantity;
    const active = updates.active !== undefined ? updates.active : existing.active;
    const media_url = updates.media_url !== undefined ? updates.media_url : existing.media_url;
    const media_type = updates.media_type !== undefined ? updates.media_type : existing.media_type;
    const process = updates.process !== undefined ? updates.process : existing.process;
    const tools_used = updates.tools_used !== undefined ? updates.tools_used : existing.tools_used;

    await db.run(
      `UPDATE services SET name = ?, description = ?, price = ?, duration_minutes = ?, max_quantity = ?, active = ?, media_url = ?, media_type = ?, process = ?, tools_used = ?, updated_at = ?
       WHERE id = ?`,
      [name, description, price, duration_minutes, max_quantity, active, media_url, media_type, process, tools_used, now, id]
    );

    const service = await db.get<Service>('SELECT * FROM services WHERE id = ?', [id]);

    console.log(`[PUT /services/${id}] Updated: ${name}`);

    return c.json({ service });
  } catch (err) {
    console.error('[PUT /services/:id]', err);
    return c.json({ error: 'Failed to update service' }, 500);
  }
});

// DELETE /services/:id - Soft delete (set inactive)
router.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();

    const existing = await db.get<Service>('SELECT * FROM services WHERE id = ?', [id]);
    if (!existing) {
      return c.json({ error: 'Servicio no encontrado' }, 404);
    }

    await db.run('UPDATE services SET active = 0, updated_at = ? WHERE id = ?', [Date.now(), id]);

    console.log(`[DELETE /services/${id}] Deactivated: ${existing.name}`);

    return c.json({ success: true });
  } catch (err) {
    console.error('[DELETE /services/:id]', err);
    return c.json({ error: 'Failed to delete service' }, 500);
  }
});

export { router as servicesRouter };

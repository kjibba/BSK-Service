import express from "express";
import materialRoutes from "./materials";
import equipmentTypeRoutes from "./equipmentTypes";
import { AppDataSource } from "../data-source";
import { ClientLog } from "../entities/ClientLog";
import { requireJwt, requireAdmin } from './auth';

const router = express.Router();

// GET /api/meta/bait-types -> /api/materials
router.use("/bait-types", materialRoutes);

// GET /api/meta/equipment-types -> /api/equipment-types
router.use("/equipment-types", equipmentTypeRoutes);

export default router;

// POST /api/meta/client-log — enkel klientfeillogging fra frontend
// Auth-optional: vi aksepterer logg også uten innlogging for å fange init-feil.
router.post('/client-log', async (req, res) => {
	try {
		// very light rate limit by IP (in-memory). Resets on container restart.
		const store = (global as any).__clientLogRl || ((global as any).__clientLogRl = new Map());
		const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
		const now = Date.now();
		const ent = store.get(ip) || { ts: 0, count: 0 };
		if (now - ent.ts > 60_000) { ent.ts = now; ent.count = 0; }
		ent.count += 1; store.set(ip, ent);
		if (ent.count > 120) { // max ~120/min per IP
			return res.status(202).json({ ok: true, limited: true });
		}

		const { level = 'error', message, stack, url, route, meta } = req.body || {};
		if (!message || typeof message !== 'string') {
			return res.status(400).json({ error: 'message påkrevd' });
		}
		const repo = AppDataSource.getRepository(ClientLog);
		const entity = repo.create({
			level: String(level).slice(0, 20),
			message: String(message).slice(0, 65535),
			stack: stack ? String(stack) : null,
			url: url ? String(url).slice(0, 1024) : null,
			route: route ? String(route).slice(0, 255) : null,
			userAgent: (req.headers['user-agent'] as string)?.slice(0, 512) || null,
			userId: (req as any)?.session?.userId || null,
			metaJson: meta ? JSON.stringify(meta).slice(0, 1_000_000) : null,
		});
		await repo.save(entity);
		res.json({ ok: true, id: entity.id });
	} catch (e) {
		// Ikke la logging feile brukerflyt
		console.error('client-log error:', e);
		res.json({ ok: true });
	}
});

	// GET /api/meta/client-log - admin: list recent logs with optional query filters
	router.get('/client-log', requireJwt, requireAdmin(), async (req, res) => {
		try {
			const repo = AppDataSource.getRepository(ClientLog);
			const { limit, level, user_id } = req.query as any;
			const take = Math.min(Math.max(parseInt(limit || '100', 10) || 100, 1), 500);
			const where: any = {};
			if (level) where.level = String(level);
			if (user_id) where.userId = parseInt(user_id);
			const items = await repo.find({ where, order: { createdAt: 'DESC' } as any, take });
			res.json(items);
		} catch (e) {
			console.error('list client-log error:', e);
			res.status(500).json({ error: 'Failed to list client logs' });
		}
	});

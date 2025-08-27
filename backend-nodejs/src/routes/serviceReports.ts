import express from 'express';
import { AppDataSource } from '../data-source';
import { ServiceReport } from '../entities/ServiceReport';
import { requireJwt, requireAdmin } from './auth';

const router = express.Router();

// GET /api/reports - admin list
router.get('/', requireJwt, requireAdmin(), async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(ServiceReport);
    const items = await repo.find({ order: { createdAt: 'DESC' } as any });
    res.json(items.map(r => r.toDict()));
  } catch (e) {
    console.error('Error listing reports', e);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// GET /api/reports/by_customer/:id - admin list per customer
router.get('/by_customer/:id', requireJwt, requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be an integer' });
    const repo = AppDataSource.getRepository(ServiceReport);
    const items = await repo.find({ where: { customerId: id } as any, order: { createdAt: 'DESC' } as any });
    res.json(items.map(r => r.toDict()));
  } catch (e) {
    console.error('Error listing reports by customer', e);
    res.status(500).json({ error: 'Failed to list reports by customer' });
  }
});

export default router;

import { z } from "zod";

// Common helpers
const nullableStr = z.string().trim().min(1).optional().or(z.literal("")).transform((v: any) => (v === "" ? undefined : v));
const optionalNumber = z.union([z.number(), z.string()]).optional().transform((v: any) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
});

export const CustomerCreateSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: nullableStr,
  postal_code: nullableStr,
  city: nullableStr,
  contact_person: nullableStr,
  email: nullableStr,
  phone: nullableStr,
  org_number: nullableStr,
});

export const CustomerUpdateSchema = z.object({
  name: nullableStr,
  address: nullableStr,
  postal_code: nullableStr,
  city: nullableStr,
  contact_person: nullableStr,
  email: nullableStr,
  phone: nullableStr,
  org_number: nullableStr,
  visits_per_year: optionalNumber,
  start_date: z.string().optional().nullable(),
  latitude: optionalNumber,
  longitude: optionalNumber,
  active: z.any().optional(),
});

export const VisitCreateSchema = z.object({
  customer_id: z.union([z.number(), z.string()]).transform((v: any) => Number(v)).refine(Number.isInteger, 'customer_id must be integer'),
  visit_date: z.string().min(1, 'visit_date required'),
  technician: nullableStr,
  notes: nullableStr,
  status: nullableStr,
  assigned_technician_id: optionalNumber,
  customer_signature_url: nullableStr,
  technician_signature_url: nullableStr,
});

export const VisitUpdateSchema = z.object({
  visit_date: z.string().optional(),
  technician: nullableStr,
  notes: nullableStr,
  status: nullableStr,
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  customer_signature_url: nullableStr,
  technician_signature_url: nullableStr,
});

export const ServiceLogUpdateSchema = z.object({
  log_date: z.string().optional(),
  description: nullableStr,
  hours_worked: optionalNumber,
  // Materials payloads
  materials_used: z.array(z.object({
  material_id: z.union([z.number(), z.string()]).transform((v: any)=>Number(v)).optional(),
    amount: optionalNumber,
    unit: nullableStr,
    batch_number: nullableStr,
    risk_assessment: nullableStr,
    approved_by: optionalNumber,
    waste_handling: nullableStr,
  })).optional(),
  poison_bait: z.object({
    used_material_id: optionalNumber,
    refilled_grams: optionalNumber,
  }).optional(),
  nonpoison_bait: z.object({
    used_material_id: optionalNumber,
    refilled_grams: optionalNumber,
  }).optional(),
});

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
export type VisitCreate = z.infer<typeof VisitCreateSchema>;
export type VisitUpdate = z.infer<typeof VisitUpdateSchema>;
export type ServiceLogUpdate = z.infer<typeof ServiceLogUpdateSchema>;

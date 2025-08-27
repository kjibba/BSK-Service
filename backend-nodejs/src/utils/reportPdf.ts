import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export type ServiceReportData = {
  customer: { id: number; name?: string; address?: string; postal_code?: string; city?: string; email?: string };
  visit: { id: number; visit_date?: string; started_at?: string | null; completed_at?: string | null; technician?: string | null; notes?: string | null; oppsummering_notat?: string | null };
  logs: Array<{ id: number; log_date?: string; description: string; hours_worked?: number; equipment_name?: string | null }>;
};

export async function generateServiceReportPdf(data: ServiceReportData, outDirAbs: string): Promise<{ filePath: string; absPath: string }>{
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const { width, height } = page.getSize();
  const margin = 40;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = height - margin;
  const drawText = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 12;
    const usedFont = opts?.bold ? fontBold : font;
    page.drawText(text, { x: margin, y: y - size, size, font: usedFont, color: rgb(0,0,0) });
    y -= size + 6;
  };

  drawText('Servicerapport', { bold: true, size: 18 });
  drawText(`Kunde: ${data.customer.name || ''}`);
  const addr = [data.customer.address, data.customer.postal_code, data.customer.city].filter(Boolean).join(', ');
  if (addr) drawText(`Adresse: ${addr}`);
  if (data.customer.email) drawText(`E-post: ${data.customer.email}`);
  drawText(`Besøk ID: ${data.visit.id}`);
  if (data.visit.visit_date) drawText(`Dato planlagt: ${data.visit.visit_date}`);
  if (data.visit.started_at) drawText(`Startet: ${data.visit.started_at}`);
  if (data.visit.completed_at) drawText(`Fullført: ${data.visit.completed_at}`);
  if (data.visit.technician) drawText(`Tekniker: ${data.visit.technician}`);
  if (data.visit.notes) drawText(`Notater: ${data.visit.notes}`);
  if (data.visit.oppsummering_notat) drawText(`Oppsummering: ${data.visit.oppsummering_notat}`);

  drawText('Arbeidslogg:', { bold: true });
  if (!data.logs || data.logs.length === 0) {
    drawText('Ingen loggføringer.');
  } else {
    for (const l of data.logs) {
      const line = `- ${l.log_date ? l.log_date + ' ' : ''}${l.equipment_name ? '[' + l.equipment_name + '] ' : ''}${l.description}${l.hours_worked ? ` (${l.hours_worked} t)` : ''}`;
      drawText(line);
      if (y < margin + 60) {
        y = height - margin;
        doc.addPage();
      }
    }
  }

  const pdfBytes = await doc.save();
  // ensure dir exists
  fs.mkdirSync(outDirAbs, { recursive: true });
  const fileName = `service_report_${data.visit.id}_${Date.now()}.pdf`;
  const absPath = path.join(outDirAbs, fileName);
  fs.writeFileSync(absPath, pdfBytes);
  // return path relative to /static
  const rel = path.relative(path.join(outDirAbs, '..'), absPath); // if outDirAbs is .../static/reports => relative to .../static
  return { filePath: `reports/${fileName}`, absPath };
}

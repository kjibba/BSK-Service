import fs from 'fs';
import path from 'path';

export function ensureUploadsDir(): string {
  // __dirname at runtime -> dist/utils; go two levels up to backend-nodejs root, then static/uploads
  const dir = path.join(__dirname, '../../static/uploads');
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

export function saveDataUrlImage(dataUrl: string): string | undefined {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return undefined;
    if (!dataUrl.startsWith('data:')) return undefined;
    const [header, b64] = dataUrl.split(',', 2);
    if (!header || !b64) return undefined;
    const m = /data:(.*?);base64/.exec(header);
    const mime = (m && m[1]) || 'application/octet-stream';
    const ext = (mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : mime.includes('jpg') ? 'jpg' : 'bin');
    const decoded = Buffer.from(b64, 'base64');
    const dir = ensureUploadsDir();
    const fname = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const fpath = path.join(dir, fname);
    fs.writeFileSync(fpath, decoded);
    return `/static/uploads/${fname}`;
  } catch {
    return undefined;
  }
}

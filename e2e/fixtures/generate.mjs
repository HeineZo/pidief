// Génère deux fixtures PDF déterministes pour les tests E2E :
//  - sample.pdf : 2 pages avec un titre rendu en Helvetica
//  - encrypted.pdf : même contenu, chiffré RC4 40-bit (V=1, R=2), mot de passe utilisateur "secret"
//
// Usage : node e2e/fixtures/generate.mjs
// On commit le script ET les .pdf produits pour que la suite tourne sans
// dépendance système (qpdf, pdftk, etc.).

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function rc4(key, data) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(data.length);
  let a = 0;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + 1) & 0xff;
    b = (b + S[a]) & 0xff;
    [S[a], S[b]] = [S[b], S[a]];
    out[i] = data[i] ^ S[(S[a] + S[b]) & 0xff];
  }
  return out;
}

function md5(...parts) {
  const h = createHash('md5');
  for (const p of parts) h.update(Buffer.from(p));
  return Uint8Array.from(h.digest());
}

const PASS_PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function padPassword(pw) {
  const pwBytes = new TextEncoder().encode(pw);
  const out = new Uint8Array(32);
  out.set(pwBytes.slice(0, 32));
  if (pwBytes.length < 32) {
    out.set(PASS_PAD.slice(0, 32 - pwBytes.length), pwBytes.length);
  }
  return out;
}

function concat(...arrs) {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function le4(n) {
  const out = new Uint8Array(4);
  out[0] = n & 0xff;
  out[1] = (n >>> 8) & 0xff;
  out[2] = (n >>> 16) & 0xff;
  out[3] = (n >>> 24) & 0xff;
  return out;
}

function compute_O(userPad, ownerPad) {
  const key = md5(ownerPad).slice(0, 5);
  return rc4(key, userPad);
}

function compute_fileKey(userPad, O, P, fileId) {
  const h = md5(userPad, O, le4(P), fileId);
  return h.slice(0, 5);
}

function compute_U(fileKey) {
  return rc4(fileKey, PASS_PAD);
}

function objStreamKey(fileKey, objNum, gen = 0) {
  const ext = new Uint8Array(fileKey.length + 5);
  ext.set(fileKey, 0);
  ext[fileKey.length] = objNum & 0xff;
  ext[fileKey.length + 1] = (objNum >>> 8) & 0xff;
  ext[fileKey.length + 2] = (objNum >>> 16) & 0xff;
  ext[fileKey.length + 3] = gen & 0xff;
  ext[fileKey.length + 4] = (gen >>> 8) & 0xff;
  const h = md5(ext);
  const len = Math.min(fileKey.length + 5, 16);
  return h.slice(0, len);
}

const enc = new TextEncoder();
const b = (s) => enc.encode(s);
const toHex = (bytes) => Buffer.from(bytes).toString('hex');

function buildPdf({ encrypt = false, password = '' } = {}) {
  const ID = Uint8Array.from([
    0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
    0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
  ]);
  const P = -4;

  let fileKey = null;
  let O = null;
  let U = null;
  if (encrypt) {
    const userPad = padPassword(password);
    const ownerPad = padPassword('owner');
    O = compute_O(userPad, ownerPad);
    fileKey = compute_fileKey(userPad, O, P, ID);
    U = compute_U(fileKey);
  }

  const encryptStream = (bytes, objNum) =>
    encrypt ? rc4(objStreamKey(fileKey, objNum), bytes) : bytes;

  const page1Content = b('BT /F1 24 Tf 180 720 Td (Pidief - Page 1) Tj ET\n');
  const page2Content = b('BT /F1 24 Tf 180 720 Td (Pidief - Page 2) Tj ET\n');

  const objects = [];

  objects.push({ num: 1, body: b('<< /Type /Catalog /Pages 2 0 R >>') });
  objects.push({ num: 2, body: b('<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>') });
  objects.push({
    num: 3,
    body: b(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    ),
  });
  {
    const stream = encryptStream(page1Content, 4);
    objects.push({
      num: 4,
      body: concat(b(`<< /Length ${stream.length} >>\nstream\n`), stream, b('\nendstream')),
    });
  }
  objects.push({
    num: 5,
    body: b(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    ),
  });
  {
    const stream = encryptStream(page2Content, 6);
    objects.push({
      num: 6,
      body: concat(b(`<< /Length ${stream.length} >>\nstream\n`), stream, b('\nendstream')),
    });
  }
  objects.push({
    num: 7,
    body: b('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
  });
  if (encrypt) {
    objects.push({
      num: 8,
      body: b(
        `<< /Filter /Standard /V 1 /R 2 /Length 40 /P ${P} /O <${toHex(O)}> /U <${toHex(U)}> >>`,
      ),
    });
  }

  const header = concat(b('%PDF-1.4\n'), Uint8Array.from([0x25, 0xc4, 0xc5, 0xc6, 0xc7, 0x0a]));
  const parts = [header];
  let offset = header.length;
  const offsets = new Map();

  for (const obj of objects) {
    offsets.set(obj.num, offset);
    const chunk = concat(b(`${obj.num} 0 obj\n`), obj.body, b('\nendobj\n'));
    parts.push(chunk);
    offset += chunk.length;
  }

  const size = objects.length + 1;
  const xrefOffset = offset;
  const xrefLines = [`xref\n0 ${size}\n0000000000 65535 f \n`];
  for (let n = 1; n < size; n++) {
    const off = offsets.get(n);
    xrefLines.push(`${String(off).padStart(10, '0')} 00000 n \n`);
  }
  parts.push(b(xrefLines.join('')));

  const idHex = toHex(ID);
  const trailerDict = encrypt
    ? `<< /Size ${size} /Root 1 0 R /Encrypt 8 0 R /ID [<${idHex}><${idHex}>] >>`
    : `<< /Size ${size} /Root 1 0 R /ID [<${idHex}><${idHex}>] >>`;
  parts.push(b(`trailer\n${trailerDict}\nstartxref\n${xrefOffset}\n%%EOF\n`));

  return concat(...parts);
}

const samplePdf = buildPdf({ encrypt: false });
const encryptedPdf = buildPdf({ encrypt: true, password: 'secret' });

writeFileSync(join(__dirname, 'sample.pdf'), samplePdf);
writeFileSync(join(__dirname, 'encrypted.pdf'), encryptedPdf);

console.log(`sample.pdf     ${samplePdf.length} bytes`);
console.log(`encrypted.pdf  ${encryptedPdf.length} bytes`);

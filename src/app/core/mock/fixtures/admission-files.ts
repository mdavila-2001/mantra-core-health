import { forbidden, type MockReply } from '../mock-router';
import type { MockUser } from '../mock-session';

/* ============================================================================
    Los documentos de las admisiones del simulador: PNG y PDF de verdad.

    No viven en el almacén de archivos (`files.handlers.ts`) a propósito: ese
    almacén se guarda en `sessionStorage` y un `Blob` no sobrevive a la
    serialización, así que tras una recarga el visor recibiría `{}`. Acá cada
    documento se **regenera** al pedirlo, determinista por su descriptor, y el
    registro es sólo una tabla de metadatos.

    El contenido es genérico —una tarjeta con franjas, un PDF con el título del
    requisito—: no hay ningún documento de identidad real ni se inventa uno.
    ========================================================================== */

export type AdmissionFileKind = 'png' | 'png-large' | 'pdf' | 'pdf-long';

export interface AdmissionFileDescriptor {
  readonly id: string;
  readonly name: string;
  readonly kind: AdmissionFileKind;
  /** Quién subió el documento: puede leerlo además de quien revisa. */
  readonly ownerUserId: string;
  /** Texto que se dibuja en el PDF. */
  readonly title: string;
}

const registry = new Map<string, AdmissionFileDescriptor>();

export function registerAdmissionFile(descriptor: AdmissionFileDescriptor): void {
  registry.set(descriptor.id, descriptor);
}

export function admissionFileDescriptor(id: string): AdmissionFileDescriptor | undefined {
  return registry.get(id);
}

export function admissionFileMime(kind: AdmissionFileKind): string {
  return kind.startsWith('png') ? 'image/png' : 'application/pdf';
}

/** Roles que leen cualquier documento de una admisión. */
const REVIEW_ROLES = ['SECURITY_ADMIN', 'SUPERADMIN', 'ADMISSIONS_REVIEWER', 'ADMISSIONS_APPROVER'];

export function canReadAdmissionFile(
  file: AdmissionFileDescriptor,
  user: Pick<MockUser, 'id' | 'roles'> | null,
): boolean {
  if (user === null) return false;
  return file.ownerUserId === user.id || user.roles.some((role) => REVIEW_ROLES.includes(role));
}

/**
 * La respuesta de `GET /common/files/:id/content` para un documento de admisión,
 * o `undefined` si el id no es de una admisión (lo atiende el almacén normal).
 */
export function admissionFileReply(
  id: string,
  user: Pick<MockUser, 'id' | 'roles'> | null,
): MockReply | undefined {
  const file = registry.get(id);
  if (file === undefined) return undefined;
  if (!canReadAdmissionFile(file, user)) return forbidden('No tiene acceso a este archivo');
  return {
    status: 200,
    body: admissionFileBlob(file),
    headers: {
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  };
}

export function admissionFileBlob(file: AdmissionFileDescriptor): Blob {
  switch (file.kind) {
    case 'png':
      return pngDeTarjeta(file.name, 640, 400);
    case 'png-large':
      return pngGrande(3000, 2000);
    case 'pdf':
      return new Blob([pdfDePaginas(file.title, 1)], { type: 'application/pdf' });
    case 'pdf-long':
      return new Blob([pdfDePaginas(file.title, 42)], { type: 'application/pdf' });
  }
}

/* ---- PDF ------------------------------------------------------------------ */

/** Un PDF de `paginas` páginas, cada una con el título y su número. */
export function pdfDePaginas(titulo: string, paginas: number): string {
  const limpio = titulo.replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, '');
  const objetos: string[] = [];
  // 1 catálogo, 2 páginas, 3 fuente, luego (página, contenido) por cada una.
  const kids = Array.from({ length: paginas }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
  objetos.push(`<< /Type /Pages /Kids [${kids}] /Count ${paginas} >>`);
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i = 0; i < paginas; i++) {
    const contenido = `BT /F1 20 Tf 60 760 Td (${limpio}) Tj ET BT /F1 12 Tf 60 730 Td (Pagina ${i + 1} de ${paginas}) Tj ET 0.85 g 60 120 475 2 re f`;
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    objetos.push(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
  }
  let salida = '%PDF-1.4\n';
  const offsets: number[] = [];
  objetos.forEach((objeto, i) => {
    offsets.push(salida.length);
    salida += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const xref = salida.length;
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) salida += `${String(o).padStart(10, '0')} 00000 n \n`;
  salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return salida;
}

/* ---- PNG ------------------------------------------------------------------ */

let tablaCrc: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (tablaCrc === null) {
    tablaCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tablaCrc[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = tablaCrc[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function trozo(tipo: string, datos: Uint8Array): Uint8Array<ArrayBuffer> {
  const salida = new Uint8Array(12 + datos.length);
  const vista = new DataView(salida.buffer);
  vista.setUint32(0, datos.length);
  for (let i = 0; i < 4; i++) salida[4 + i] = tipo.charCodeAt(i);
  salida.set(datos, 8);
  vista.setUint32(8 + datos.length, crc32(salida.subarray(4, 8 + datos.length)));
  return salida;
}

/** Codifica un PNG sin compresión (bloques `stored` de deflate). */
function codificarPng(
  ancho: number,
  alto: number,
  canales: 1 | 3,
  pixel: (x: number, y: number, fila: Uint8Array, offset: number) => void,
): Blob {
  const fila = ancho * canales + 1;
  const crudo = new Uint8Array(fila * alto);
  for (let y = 0; y < alto; y++) {
    const base = y * fila;
    crudo[base] = 0; // sin filtro
    for (let x = 0; x < ancho; x++) pixel(x, y, crudo, base + 1 + x * canales);
  }
  // zlib: cabecera 78 01, bloques stored de hasta 65535, adler32.
  const bloques = Math.ceil(crudo.length / 65535);
  const z = new Uint8Array(2 + crudo.length + bloques * 5 + 4);
  z[0] = 0x78;
  z[1] = 0x01;
  let o = 2;
  for (let i = 0; i < bloques; i++) {
    const inicio = i * 65535;
    const largo = Math.min(65535, crudo.length - inicio);
    z[o++] = i === bloques - 1 ? 1 : 0;
    z[o++] = largo & 0xff;
    z[o++] = largo >>> 8;
    z[o++] = ~largo & 0xff;
    z[o++] = (~largo >>> 8) & 0xff;
    z.set(crudo.subarray(inicio, inicio + largo), o);
    o += largo;
  }
  new DataView(z.buffer).setUint32(o, adler32(crudo));
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, ancho);
  v.setUint32(4, alto);
  ihdr[8] = 8;
  ihdr[9] = canales === 3 ? 2 : 0;
  const firma = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob([firma, trozo('IHDR', ihdr), trozo('IDAT', z), trozo('IEND', new Uint8Array(0))], {
    type: 'image/png',
  });
}

function matiz(nombre: string): number {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 360;
  return h;
}

/** Una tarjeta genérica: franja, recuadro de foto y renglones de texto en gris. */
function pngDeTarjeta(nombre: string, ancho: number, alto: number): Blob {
  const h = matiz(nombre);
  const franja: [number, number, number] = [
    60 + (h % 60),
    110 + ((h * 3) % 70),
    140 + ((h * 7) % 80),
  ];
  return codificarPng(ancho, alto, 3, (x, y, fila, o) => {
    let rgb: [number, number, number] = [247, 249, 250];
    if (y < alto * 0.18) rgb = franja;
    else if (x > ancho * 0.06 && x < ancho * 0.3 && y > alto * 0.28 && y < alto * 0.82)
      rgb = [205, 214, 220];
    else if (x > ancho * 0.36 && x < ancho * 0.92 && y > alto * 0.3 && y < alto * 0.8) {
      const renglon = Math.floor(((y - alto * 0.3) / (alto * 0.5)) * 6);
      const dentro = ((y - alto * 0.3) / (alto * 0.5)) * 6 - renglon;
      if (dentro > 0.25 && dentro < 0.6 && x < ancho * (0.92 - (renglon % 3) * 0.12))
        rgb = [150, 160, 168];
    } else if (y > alto * 0.9) rgb = [225, 231, 235];
    fila[o] = rgb[0];
    fila[o + 1] = rgb[1];
    fila[o + 2] = rgb[2];
  });
}

/** Una imagen enorme (escala de grises) para probar el visor con un archivo pesado. */
function pngGrande(ancho: number, alto: number): Blob {
  return codificarPng(ancho, alto, 1, (x, y, fila, o) => {
    const cuadro = (Math.floor(x / 150) + Math.floor(y / 150)) % 2 === 0;
    fila[o] = cuadro ? 236 : 214 - ((x + y) % 40);
  });
}

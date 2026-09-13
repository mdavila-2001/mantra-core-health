import { vitrinas } from '../fixtures/comunidad';
import { ESTADO } from '../fixtures/conceptos';
import { PACIENTES, PROFESIONALES } from '../fixtures/personas';
import { noContent, type MockRouter } from '../mock-router';
import { ahora, avatarSvg, Coleccion, imagenSvg, iso, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Archivos: subida, vínculos, descarga y el contenido de las imágenes.
    Las fotos de perfil y los logos se dibujan como SVG con iniciales.
    ========================================================================== */

interface ArchivoSimulado {
  readonly id: string;
  readonly currentVersionId: string;
  readonly originalName: string;
  readonly category: 'DOCUMENT' | 'IMAGE';
  readonly sensitivity: 'NORMAL' | 'PHI';
  readonly lifecycleStatusConceptId: string;
  readonly createdAt: string;
  readonly dataUrl: string;
  readonly ownerType?: string;
  readonly ownerId?: string;
}

const archivos = new Coleccion<ArchivoSimulado>([
  ...PROFESIONALES.map((p, i) => ({
    id: p.photoFileId,
    currentVersionId: uuid(`version-${p.photoFileId}`),
    originalName: `foto-${p.slug}.svg`,
    category: 'IMAGE' as const,
    sensitivity: 'NORMAL' as const,
    lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!,
    createdAt: iso(-300),
    dataUrl: avatarSvg(p.displayName, ['#1f6f8b', '#0f766e', '#7c3aed', '#b45309', '#be123c'][i % 5]),
    ownerType: 'USER',
    ownerId: p.userId,
  })),
  ...PACIENTES.filter((p) => p.photoFileId !== undefined).map((p) => ({
    id: p.photoFileId!,
    currentVersionId: uuid(`version-${p.photoFileId}`),
    originalName: 'foto-perfil.svg',
    category: 'IMAGE' as const,
    sensitivity: 'NORMAL' as const,
    lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!,
    createdAt: iso(-200),
    dataUrl: avatarSvg(p.displayName, '#db2777'),
    ownerType: 'USER',
    ownerId: p.userId,
  })),
  ...vitrinas.todos().flatMap((v) => [
    { id: v.avatarFileId, currentVersionId: uuid(`version-${v.avatarFileId}`), originalName: 'avatar.svg', category: 'IMAGE' as const, sensitivity: 'NORMAL' as const, lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-200), dataUrl: v.avatarUrl },
    { id: v.coverFileId, currentVersionId: uuid(`version-${v.coverFileId}`), originalName: 'portada.svg', category: 'IMAGE' as const, sensitivity: 'NORMAL' as const, lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-200), dataUrl: v.coverUrl },
  ]),
  ...PACIENTES.flatMap((p) => [
    { id: uuid(`file-lab-${p.id}`), currentVersionId: uuid(`v-file-lab-${p.id}`), originalName: 'laboratorio-completo.pdf', category: 'DOCUMENT' as const, sensitivity: 'PHI' as const, lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-47), dataUrl: imagenSvg('Laboratorio completo (PDF)'), ownerType: 'PATIENT', ownerId: p.id },
    { id: uuid(`file-ecg-${p.id}`), currentVersionId: uuid(`v-file-ecg-${p.id}`), originalName: 'electrocardiograma.png', category: 'IMAGE' as const, sensitivity: 'PHI' as const, lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-2), dataUrl: imagenSvg('ECG de reposo', '#fff7ed', '#c2410c'), ownerType: 'PATIENT', ownerId: p.id },
  ]),
  { id: uuid('file-lunar'), currentVersionId: uuid('v-file-lunar'), originalName: 'lunar.jpg', category: 'IMAGE', sensitivity: 'PHI', lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-12), dataUrl: imagenSvg('Foto del lunar', '#fdf2f8', '#9d174d') },
  { id: uuid('file-licencia'), currentVersionId: uuid('v-file-licencia'), originalName: 'licencia-funcionamiento.pdf', category: 'DOCUMENT', sensitivity: 'NORMAL', lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-400), dataUrl: imagenSvg('Licencia de funcionamiento (PDF)') },
  // Los adjuntos del chat de grupo de la médica.
  { id: uuid('file-guia-anticoagulacion'), currentVersionId: uuid('v-file-guia-anticoagulacion'), originalName: 'guia-anticoagulacion-2026.pdf', category: 'DOCUMENT', sensitivity: 'NORMAL', lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-2), dataUrl: imagenSvg('Guía de anticoagulación 2026 (PDF)') },
  { id: uuid('file-holter'), currentVersionId: uuid('v-file-holter'), originalName: 'holter-24h.png', category: 'IMAGE', sensitivity: 'PHI', lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(0), dataUrl: imagenSvg('Holter 24 h', '#f0fdf4', '#166534') },
]);

/** Un PDF de una página con una línea de texto. Lo justo para que un visor lo abra. */
function pdfMinimo(texto: string): string {
  const limpio = texto.replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, '');
  const contenido = `BT /F1 18 Tf 60 740 Td (${limpio}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
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

function metadatos(a: ArchivoSimulado) {
  return {
    id: a.id,
    currentVersionId: a.currentVersionId,
    originalName: a.originalName,
    category: a.category,
    sensitivity: a.sensitivity,
    lifecycleStatusConceptId: a.lifecycleStatusConceptId,
    createdAt: a.createdAt,
  };
}

/**
 * Liga un archivo ya subido a un recurso, y **deja el vínculo guardado**.
 *
 * Vive acá y se exporta porque las rutas de adjuntos de `clinical` hacen lo
 * mismo por su propio endpoint —el genérico de `common` no verifica que el
 * dueño exista ni quién puede adjuntarle nada— y devolvían `{ ok: true }` sin
 * guardar nada: `GET /common/files/links` no encontraba después lo adjuntado.
 */
export function enlazarArchivo(datos: {
  readonly ownerType: string;
  readonly ownerId: string;
  readonly fileId: string;
}): { id: string; fileId: string; ownerId: string; ownerType: string; createdAt: string } {
  const archivo = archivos.get(datos.fileId);
  if (archivo !== undefined) {
    archivos.actualizar(archivo.id, { ownerType: datos.ownerType, ownerId: datos.ownerId });
  }
  return {
    id: nuevoId('link'),
    fileId: datos.fileId,
    ownerId: datos.ownerId,
    ownerType: datos.ownerType,
    createdAt: ahora(),
  };
}

export function registrarArchivos(router: MockRouter): void {
  router.post('/common/files/upload', (request) => {
    const form = request.body;
    let nombre = 'archivo-subido.bin';
    let categoria: 'DOCUMENT' | 'IMAGE' = 'DOCUMENT';
    let sensibilidad: 'NORMAL' | 'PHI' = 'NORMAL';
    if (typeof FormData !== 'undefined' && form instanceof FormData) {
      const f = form.get('file');
      if (f instanceof File) {
        nombre = f.name;
        if (f.type.startsWith('image/')) categoria = 'IMAGE';
      }
      const cat = form.get('category');
      if (cat === 'IMAGE' || cat === 'DOCUMENT') categoria = cat;
      const sens = form.get('sensitivity');
      if (sens === 'PHI') sensibilidad = 'PHI';
    }
    const nuevo = archivos.agregar({
      id: nuevoId('file'),
      currentVersionId: nuevoId('file-version'),
      originalName: nombre,
      category: categoria,
      sensitivity: sensibilidad,
      lifecycleStatusConceptId: ESTADO['ST-ACTIVE']!,
      createdAt: ahora(),
      dataUrl: categoria === 'IMAGE' ? avatarSvg(nombre.slice(0, 2).toUpperCase(), '#0ea5e9') : imagenSvg(nombre),
    });
    return { status: 201, body: { ...metadatos(nuevo), fileId: nuevo.id, versionId: nuevo.currentVersionId, size: 24_576, mimeType: categoria === 'IMAGE' ? 'image/svg+xml' : 'application/pdf' } };
  });

  router.get('/common/files/links', ({ query }) => {
    const ownerType = texto(query, 'ownerType');
    const ownerId = texto(query, 'ownerId');
    const items = archivos
      .filtrar((a) => (ownerType === null || a.ownerType === ownerType) && (ownerId === null || a.ownerId === ownerId))
      .map((a) => ({ linkId: uuid(`link-${a.id}`), ownerId: a.ownerId ?? '', ownerType: a.ownerType ?? 'USER', linkedAt: a.createdAt, file: metadatos(a) }));
    return { items, count: items.length };
  });

  router.post('/common/files/:id/links', (request) => {
    const datos = request.body as { ownerType?: string; ownerId?: string } | null;
    return {
      status: 201,
      body: enlazarArchivo({
        ownerType: datos?.ownerType ?? 'USER',
        ownerId: datos?.ownerId ?? '',
        fileId: request.params['id']!,
      }),
    };
  });

  router.post('/common/files/:id/download-url', ({ params }) => {
    const a = archivos.get(params['id']!);
    return { url: a?.dataUrl ?? imagenSvg('Archivo'), expiresAt: iso(0, 23, 59) };
  });

  router.get('/common/files/:id/content', ({ params }) => {
    const a = archivos.get(params['id']!);
    if (a === undefined) return avatarSvg('?', '#94a3b8');
    // Un documento se entrega como un **PDF de verdad** (mínimo, con el nombre
    // del archivo como texto) y no como el dibujo SVG de las miniaturas: con el
    // SVG, un PDF adjunto en el chat se pintaba como foto —el tipo decía
    // `image/…`— y al abrirlo se veía un cartel, no un documento.
    const body =
      a.category === 'DOCUMENT' && typeof Blob !== 'undefined'
        ? new Blob([pdfMinimo(a.originalName)], { type: 'application/pdf' })
        : a.dataUrl;
    // 5.2 · el nombre viaja donde lo pone la API real. Sin esta cabecera todo
    // adjunto se guardaba con un nombre de reserva, y la paridad mock↔real se
    // rompía justo en lo que 5.2 tiene que demostrar. Se codifica igual que el
    // backend (`filename*=UTF-8''…`), acentos incluidos.
    return {
      body,
      headers: {
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.originalName)}`,
      },
    };
  });

  router.delete('/common/files/:id', ({ params }) => {
    archivos.borrar(params['id']!);
    return noContent();
  });
}

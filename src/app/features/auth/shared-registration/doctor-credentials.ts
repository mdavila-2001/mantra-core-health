/**
 * Reglas que comparten el alta y la edición de credenciales profesionales.
 *
 * El archivo elegido sólo vive en el navegador mientras la pantalla está
 * abierta: la rama `mockup` no publica documentos personales.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const SUPPORT_FILE_FORMATS = 'application/pdf,image/jpeg,image/png';

export type SupportFileKey = 'professional-title' | 'license' | 'sedes';

export interface DeclaredSupportFile {
  readonly archivo: string;
  readonly pesoBytes: number;
}

export const PROFESSIONAL_TITLE_TYPES = [
  { codigo: 'UNIVERSITARIO', etiqueta: 'Otra profesión', singular: 'otra profesión' },
  { codigo: 'DIPLOMADO', etiqueta: 'Diplomado', singular: 'diplomado' },
  { codigo: 'MAESTRIA', etiqueta: 'Maestría', singular: 'maestría' },
  { codigo: 'DOCTORADO', etiqueta: 'Doctorado', singular: 'doctorado' },
] as const;

export type ProfessionalTitleCode = (typeof PROFESSIONAL_TITLE_TYPES)[number]['codigo'];

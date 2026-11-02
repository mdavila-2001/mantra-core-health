import type { PractitionerSpecialty } from '../../core/data-access/profiles/profiles.types';

const CLAVE_STORAGE = 'alovida:formularios-cargados';

/**
 * Filtra las especialidades vigentes del profesional (sin caducar según fechas).
 */
export function resolverEspecialidadesValidas(
  especialidades: readonly PractitionerSpecialty[] | undefined,
  ahora: number = Date.now(),
): readonly string[] {
  if (!especialidades || especialidades.length === 0) return [];
  const vigentes = especialidades.filter((esp) => {
    if (esp.validFrom !== undefined && new Date(esp.validFrom).getTime() > ahora) {
      return false;
    }
    if (esp.validTo !== undefined && new Date(esp.validTo).getTime() <= ahora) {
      return false;
    }
    return true;
  });
  return [...new Set(vigentes.map((e) => e.specialtyConceptId))];
}

/**
 * Sugiere un código técnico único a partir del nombre del formulario.
 */
export function sugerirCodigoFormulario(nombre: string): string {
  const limpio = nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = limpio.slice(0, 32) || 'NUEVO';
  return `FORM_${base}`;
}

/**
 * Lee los identificadores de formularios que el usuario ha cargado en su sesión/almacenamiento.
 */
export function leerFormulariosCargados(): ReadonlySet<string> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(CLAVE_STORAGE);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Guarda los identificadores de formularios cargados por el usuario.
 */
export function guardarFormulariosCargados(ids: ReadonlySet<string>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify([...ids]));
  } catch {
    // Si la cuota está llena o el almacenamiento no está disponible, falla silenciosamente.
  }
}

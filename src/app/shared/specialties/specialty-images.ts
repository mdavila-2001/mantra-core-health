/*
 * La imagen de una especialidad: la propia del catálogo si el admin subió una,
 * y si no la ilustración empaquetada en `public/especialidades/`.
 */

/** Código de la propiedad de concepto donde el admin guarda la imagen. */
export const IMAGE_PROPERTY = 'image';

/** Código interno del catálogo de especialidades. */
export const SPECIALTY_VALUE_SET = 'VS_MEDICAL_SPECIALTY';

export const GENERIC_SPECIALTY_IMAGE = '/especialidades/generica.svg';

/** Palabra del nombre (sin tildes, en minúsculas) → ilustración. El orden decide. */
const KEYWORDS: readonly (readonly [string, string])[] = [
  ['bioquimic', 'bioquimica-clinica'],
  ['patologia', 'patologia-clinica'],
  ['ginecolog', 'ginecologia-obstetricia'],
  ['obstetr', 'obstetricia'],
  ['cirugia', 'cirugia-general'],
  ['anestes', 'anestesiologia'],
  ['cardio', 'cardiologia'],
  ['dermat', 'dermatologia'],
  ['endocrin', 'endocrinologia'],
  ['enfermer', 'enfermeria'],
  ['fisioter', 'fisioterapia'],
  ['rehabilit', 'fisioterapia'],
  ['gastro', 'gastroenterologia'],
  ['geriatr', 'geriatria'],
  ['hematolog', 'hematologia'],
  ['infectolog', 'infectologia'],
  ['deportiv', 'medicina-deportiva'],
  ['emergencia', 'medicina-emergencia'],
  ['familiar', 'medicina-familiar'],
  ['intensiv', 'medicina-intensiva'],
  ['medicina interna', 'medicina-interna'],
  ['medicina general', 'medicina-general'],
  ['nefrolog', 'nefrologia'],
  ['neumolog', 'neumologia'],
  ['neurolog', 'neurologia'],
  ['nutric', 'nutricion'],
  ['odontolog', 'odontologia'],
  ['oftalmolog', 'oftalmologia'],
  ['oncolog', 'oncologia'],
  ['otorrino', 'otorrinolaringologia'],
  ['pediatr', 'pediatria'],
  ['psicolog', 'psicologia-clinica'],
  ['psiquiatr', 'psiquiatria'],
  ['radiolog', 'radiologia'],
  ['reumatolog', 'reumatologia'],
  ['traumatolog', 'traumatologia'],
  ['urolog', 'urologia'],
];

export function normalizeSpecialtyName(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/** La ilustración empaquetada que le toca al nombre; la genérica si no hay. */
export function defaultSpecialtyImage(nombre: string): string {
  const texto = normalizeSpecialtyName(nombre);
  const hallada = KEYWORDS.find(([clave]) => texto.includes(clave));
  return hallada === undefined ? GENERIC_SPECIALTY_IMAGE : `/especialidades/${hallada[1]}.svg`;
}

/**
 * Sólo se aceptan rutas propias, https y `data:image` raster: lo guardado en el
 * catálogo llega a un `src`, y no debe poder ser otra cosa.
 */
export function safeImageValue(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  const valida =
    /^\/(?!\/)[\w./-]+$/u.test(texto) ||
    /^https:\/\/[^\s]+$/u.test(texto) ||
    /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/u.test(texto);
  return valida ? texto : null;
}

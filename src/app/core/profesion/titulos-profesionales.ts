import type { SelectOption } from '../../shared/components/atoms/select/select.types';

/**
 * El título profesional, como lista cerrada.
 *
 * ## Por qué vive acá y no en el alta
 *
 * Porque lo usan **dos** pantallas y tienen que decir lo mismo. El alta lo
 * ofrecía como lista cerrada de doce y el editor del perfil lo pedía como
 * **texto libre**: la misma profesión terminaba escrita «Médico», «medico»,
 * «Dr. en Medicina» y «Médico cirujano» según quién la tecleara, y eso rompe
 * dos cosas que dependen del título —el colegio que se ofrece en la
 * habilitación y qué especialidades se pueden elegir—.
 *
 * Duplicar la lista en el editor habría sido peor que el texto libre: dos
 * listas cerradas que se separan en el primer cambio.
 *
 * ## Por qué es texto y no un concepto
 *
 * No es una decisión de esta pantalla: `professionalTitle` es un texto de hasta
 * cien caracteres en el contrato, y aterriza en
 * `profiles.health_practitioner_profiles.professional_title`, **varchar
 * nullable**. No hay value set de títulos profesionales en la terminología, así
 * que lo que viaja es la etiqueta. El día que exista el concepto, esto pasa a
 * ser un mapeo y las dos pantallas lo heredan juntas.
 */
export const OPCIONES_TITULO_PROFESIONAL: readonly SelectOption<string>[] = [
  { value: 'Médico / Médica', label: 'Médico / Médica' },
  {
    value: 'Médico especialista / Médica especialista',
    label: 'Médico especialista / Médica especialista',
  },
  { value: 'Odontólogo / Odontóloga', label: 'Odontólogo / Odontóloga' },
  {
    value: 'Licenciado / Licenciada en Enfermería',
    label: 'Licenciado / Licenciada en Enfermería',
  },
  {
    value: 'Licenciado / Licenciada en Bioquímica y Farmacia',
    label: 'Licenciado / Licenciada en Bioquímica y Farmacia',
  },
  { value: 'Licenciado / Licenciada en Nutrición', label: 'Licenciado / Licenciada en Nutrición' },
  {
    value: 'Licenciado / Licenciada en Psicología',
    label: 'Licenciado / Licenciada en Psicología',
  },
  {
    value: 'Licenciado / Licenciada en Fisioterapia y Kinesiología',
    label: 'Licenciado / Licenciada en Fisioterapia y Kinesiología',
  },
  {
    value: 'Licenciado / Licenciada en Fonoaudiología',
    label: 'Licenciado / Licenciada en Fonoaudiología',
  },
  {
    value: 'Licenciado / Licenciada en Trabajo Social',
    label: 'Licenciado / Licenciada en Trabajo Social',
  },
  { value: 'Técnico / Técnica en Radiología', label: 'Técnico / Técnica en Radiología' },
  { value: 'Auxiliar de Enfermería', label: 'Auxiliar de Enfermería' },
];

/**
 * Si un título ya guardado está en la lista.
 *
 * Los perfiles anteriores a la lista cerrada tienen textos escritos a mano
 * («Médica cardióloga»). El editor **no los borra ni los corrige solo**: los
 * muestra tal cual y deja elegir uno de la lista cuando la persona quiera.
 * Pisarlos al abrir la pantalla sería cambiar un dato del perfil sin que nadie
 * lo pidiera.
 */
export function esTituloDeLaLista(titulo: string): boolean {
  return OPCIONES_TITULO_PROFESIONAL.some((opcion) => opcion.value === titulo);
}

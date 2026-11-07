import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';

/** Two pages, four fields at most: the organization and its first site. */
export const SETUP_PAGES = paginateFields([
  {
    titulo: 'Su organización',
    hint: 'Cómo la van a encontrar los pacientes y cómo se llama su primera sede.',
    campos: [
      {
        key: 'practiceName',
        label: 'Nombre de la organización',
        hint: 'El nombre con el que atiende, como lo va a ver el paciente.',
        control: 'text' as const,
        required: true,
        testId: 'medical-center-setup-practice-name',
        mensajeDeError: 'Escriba el nombre de la organización.',
      },
      {
        key: 'siteName',
        label: 'Nombre de la sede',
        hint: 'Como la va a ver el paciente: «Sede Norte», «Casa matriz».',
        control: 'text' as const,
        required: true,
        testId: 'medical-center-setup-site-name',
        mensajeDeError: 'Escriba el nombre de la sede.',
      },
    ],
  },
  {
    titulo: 'La sede',
    hint: 'Dónde queda: marque el punto exacto en el mapa; la dirección sale de ahí.',
    campos: [
      {
        key: 'point',
        label: 'Ubicación de la sede en el mapa',
        hint: 'Use su GPS o toque el plano. De ese punto sacamos la dirección, el municipio y la zona.',
        control: 'custom' as const,
        ancho: 'completo' as const,
        required: true,
        mensajeDeError: 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
      },
    ],
  },
]);

import type { HelpCard } from '../../../shared/components/organisms/registration-help/registration-help';

/** Side-panel help of the last registration step (`passwordStep`, key `password`). */
export const AYUDA_CONTRASENA: readonly HelpCard[] = [
  {
    icono: 'lock',
    titulo: 'Su contraseña, sólo suya',
    texto:
      'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca se la vamos a pedir por teléfono ni por correo.',
  },
];

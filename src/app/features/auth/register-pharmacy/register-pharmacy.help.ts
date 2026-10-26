import type { HelpCard } from '../../../shared/components/organisms/registration-help/registration-help';

/** Por qué se pide cada cosa, por sección — mismo mecanismo que el molde, texto propio de farmacia. */
export const AYUDA: Readonly<Record<string, readonly HelpCard[]>> = {
  empresa: [
    {
      icono: 'building',
      titulo: 'La empresa, no el local',
      texto:
        'Acá va la razón social con la que su farmacia está inscrita. Los locales donde atiende se cargan más adelante, cada uno con su punto en el mapa.',
    },
    {
      icono: 'labels',
      titulo: 'El tipo se elige de la lista',
      texto:
        'La plataforma necesita poder contar cuántas farmacias tiene de cada tipo societario, y eso sólo funciona si todas eligen de la misma lista.',
    },
  ],
  documentos: [
    {
      icono: 'folder',
      titulo: 'Ningún papel frena su alta',
      texto:
        'Puede adjuntarlos ahora o más adelante desde la Ficha de su farmacia. Sí van a hacer falta para que su farmacia quede habilitada a operar.',
    },
    {
      icono: 'shield',
      titulo: 'Quién los ve',
      texto:
        'Los mira el equipo que aprueba el alta. No se publican en su ficha ni los ve un paciente.',
    },
  ],
  ubicacion: [
    {
      icono: 'pin',
      titulo: 'El punto es lo que le hace aparecer',
      texto:
        'Cuando un paciente busca dónde comprar su receta, la app ordena por cercanía. Por eso el punto es obligatorio: de él sale también la dirección, el municipio y la zona.',
    },
  ],
  sucursales: [
    {
      icono: 'hospital',
      titulo: 'Una fila por local',
      texto:
        'Cada sucursal se ubica sola en el mapa: un paciente del sur no tiene por qué cruzar la ciudad porque la central esté en el norte.',
    },
  ],
  representante: [
    {
      icono: 'mail',
      titulo: 'Con este correo se entra',
      texto:
        'El correo del representante legal es el usuario de la cuenta. Después se suman los usuarios que hagan falta, cada uno con el suyo.',
    },
    {
      icono: 'folder',
      titulo: 'El poder va con quien lo firma',
      texto:
        'Adjúntelo acá, junto a los datos del representante. Es opcional: si el dueño se representa a sí mismo, no hace falta.',
    },
  ],
  'gerencia-general': [
    {
      icono: 'briefcase',
      titulo: 'Los cargos son opcionales',
      texto:
        'Ninguno de los tres frena el alta. Se piden para saber a quién escribirle según el asunto, y no todo al mismo correo.',
    },
  ],
  'gerencia-comercial': [
    {
      icono: 'chart',
      titulo: 'A quién le llega el resumen de ventas',
      texto:
        'Si lo deja vacío, el resumen de pedidos y ventas va al correo del representante legal.',
    },
  ],
  'gerencia-marketing': [
    {
      icono: 'megaphone',
      titulo: 'Promociones y campañas',
      texto:
        'Las promociones de su farmacia se coordinan con esta persona. Se puede cargar después.',
    },
  ],
  acceso: [
    {
      icono: 'lock',
      titulo: 'Una clave nueva, no la del correo',
      texto: 'Al menos ocho caracteres. Se puede cambiar después desde el perfil.',
    },
  ],
};

import type { HelpCard } from '../../../shared/components/organisms/registration-help/registration-help';

/**
 * Por qué se pide cada cosa, por página.
 *
 * Mismo mecanismo que las otras altas largas: la columna cambia con el paso,
 * porque «¿por qué me piden ESTO?» es una pregunta distinta en cada página.
 */
export const AYUDA_ALTA_MEDICA: Readonly<Record<string, readonly HelpCard[]>> = {
  organizacion: [
    {
      icono: 'building',
      titulo: 'La empresa, no el local',
      texto:
        'Acá va la razón social tal como figura en su matrícula de comercio. Los locales donde atiende se cargan más adelante, cada uno con su punto en el mapa.',
    },
    {
      icono: 'labels',
      titulo: 'El tipo se elige de la lista',
      texto:
        'La plataforma necesita contar cuántas instituciones hay de cada tipo, y eso sólo funciona si todas eligen de la misma lista.',
    },
  ],
  establecimiento: [
    {
      icono: 'billing',
      titulo: 'El NIT es el número, no el papel',
      texto:
        'Acá va el número de NIT con el que factura. El certificado se sube como PDF más adelante; el número permite cruzarlo con el padrón tributario.',
    },
    {
      icono: 'shield',
      titulo: 'Para que podamos verificarlo',
      texto:
        'El certificado del SEDES se sube como PDF más adelante; el número permite cruzarlo con el registro oficial. Sin el número la plataforma no puede verificarlo.',
    },
  ],
  director: [
    {
      icono: 'people',
      titulo: 'Quien responde clínicamente',
      texto:
        'La norma sanitaria exige un director médico o responsable técnico por establecimiento. Lo registramos como contacto: no se le crea una cuenta.',
    },
  ],
  'documentos-legales': [
    {
      icono: 'folder',
      titulo: 'Quién los ve',
      texto:
        'Los mira el equipo que aprueba el alta. No se publican en su ficha ni los ve un paciente.',
    },
    {
      icono: 'labels',
      titulo: 'Según su tipo societario',
      texto:
        'Una empresa unipersonal no tiene escritura de constitución, y un profesional independiente tampoco tiene matrícula de comercio: en esos casos el papel es opcional.',
    },
  ],
  ubicacion: [
    {
      icono: 'pin',
      titulo: 'El punto es lo que le hace aparecer',
      texto:
        'Cuando un paciente busca dónde atenderse, la app ordena por cercanía. Por eso el punto es obligatorio: de él sale también la dirección, el municipio y la zona.',
    },
  ],
  sucursales: [
    {
      icono: 'hospital',
      titulo: 'Una tarjeta por local',
      texto:
        'Cada sucursal se ubica sola en el mapa. Sirven para pre-llenar la configuración de su práctica cuando la cuenta esté verificada.',
    },
  ],
  representante: [
    {
      icono: 'mail',
      titulo: 'Con este correo se entra',
      texto:
        'El correo del representante legal es el usuario de la cuenta. Después se suman los usuarios que hagan falta, cada uno con el suyo.',
    },
  ],
  poder: [
    {
      icono: 'folder',
      titulo: 'El poder va con quien lo firma',
      texto:
        'Es el documento que acredita al representante. Una empresa unipersonal no lo necesita; el resto de las sociedades sí.',
    },
  ],
  'gerencia-general': [
    {
      icono: 'briefcase',
      titulo: 'Los cargos son opcionales',
      texto:
        'Ninguno de los tres frena el alta. Se piden para saber a quién escribirle, pero van como bloque: o se cargan las tres gerencias completas, o ninguna.',
    },
  ],
  'gerencia-comercial': [
    {
      icono: 'chart',
      titulo: 'A quién le llega la liquidación',
      texto:
        'El resumen semanal de ventas y comisiones se manda a este correo cuando está cargado.',
    },
  ],
  'gerencia-marketing': [
    {
      icono: 'megaphone',
      titulo: 'Campañas y promociones',
      texto:
        'Las campañas se coordinan con esta persona. Se puede cargar más adelante desde el perfil.',
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

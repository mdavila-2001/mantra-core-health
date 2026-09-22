/* ============================================================================
    El pack de stickers «AloVida Salud».

    **GENERADO por `scripts/gen-sticker-pack.mjs`. No editar a mano.**

    Las ilustraciones son de OpenMoji 15.0.0 (https://openmoji.org),
    bajo **CC BY-SA 4.0**; las frases se escribieron para este producto. La
    atribución completa está en `public/stickers/LICENSE.md` y se muestra al
    pie del panel de stickers.

    Los `id` son fijos y no se derivan de nada: son los mismos uuids con los
    que el backend siembra el pack en `common.files`, de modo que un sticker
    mandado desde un entorno se entiende en el otro.

    Regenerar con `yarn sticker:pack`.
    ========================================================================== */

/** Un sticker del pack. */
export interface Sticker {
  /** El `fileId` con el que viaja el mensaje. Fijo en todos los entornos. */
  readonly id: string;
  readonly clave: string;
  /** Cómo lo anuncia un lector de pantalla. */
  readonly nombre: string;
  /** Lo que dice el sticker. */
  readonly frase: string;
  /** De dónde se pinta. Es un archivo del producto, no del usuario. */
  readonly url: string;
}

export const PACK_DE_STICKERS: readonly Sticker[] = [
  {
    id: 'a7c1f0e2-0001-4a00-9000-5713ca110001',
    clave: 'saludo',
    nombre: "Hola",
    frase: "¡Hola!",
    url: '/stickers/saludo.svg',
  },
  {
    id: 'a7c1f0e2-0002-4a00-9000-5713ca110002',
    clave: 'gracias',
    nombre: "Gracias",
    frase: "¡Gracias!",
    url: '/stickers/gracias.svg',
  },
  {
    id: 'a7c1f0e2-0003-4a00-9000-5713ca110003',
    clave: 'en-camino',
    nombre: "Ya voy en camino",
    frase: "Ya voy en camino",
    url: '/stickers/en-camino.svg',
  },
  {
    id: 'a7c1f0e2-0004-4a00-9000-5713ca110004',
    clave: 'llegando-tarde',
    nombre: "Llego tarde",
    frase: "Llego unos minutos tarde",
    url: '/stickers/llegando-tarde.svg',
  },
  {
    id: 'a7c1f0e2-0005-4a00-9000-5713ca110005',
    clave: 'confirmado',
    nombre: "Turno confirmado",
    frase: "Turno confirmado",
    url: '/stickers/confirmado.svg',
  },
  {
    id: 'a7c1f0e2-0006-4a00-9000-5713ca110006',
    clave: 'te-espero',
    nombre: "Te espero en la consulta",
    frase: "Te espero en la consulta",
    url: '/stickers/te-espero.svg',
  },
  {
    id: 'a7c1f0e2-0007-4a00-9000-5713ca110007',
    clave: 'receta-lista',
    nombre: "Receta lista",
    frase: "Tu receta está lista",
    url: '/stickers/receta-lista.svg',
  },
  {
    id: 'a7c1f0e2-0008-4a00-9000-5713ca110008',
    clave: 'tomar-remedio',
    nombre: "Acordate del remedio",
    frase: "Acordate del remedio",
    url: '/stickers/tomar-remedio.svg',
  },
  {
    id: 'a7c1f0e2-0009-4a00-9000-5713ca110009',
    clave: 'resultados',
    nombre: "Resultados listos",
    frase: "Resultados listos",
    url: '/stickers/resultados.svg',
  },
  {
    id: 'a7c1f0e2-0010-4a00-9000-5713ca110010',
    clave: 'ayunas',
    nombre: "Vení en ayunas",
    frase: "Vení en ayunas",
    url: '/stickers/ayunas.svg',
  },
  {
    id: 'a7c1f0e2-0011-4a00-9000-5713ca110011',
    clave: 'mejorate',
    nombre: "Recuperate pronto",
    frase: "Recuperate pronto",
    url: '/stickers/mejorate.svg',
  },
  {
    id: 'a7c1f0e2-0012-4a00-9000-5713ca110012',
    clave: 'animo',
    nombre: "Ánimo",
    frase: "¡Ánimo!",
    url: '/stickers/animo.svg',
  },
  {
    id: 'a7c1f0e2-0013-4a00-9000-5713ca110013',
    clave: 'cuidate',
    nombre: "Cuidate mucho",
    frase: "Cuidate mucho",
    url: '/stickers/cuidate.svg',
  },
  {
    id: 'a7c1f0e2-0014-4a00-9000-5713ca110014',
    clave: 'descansa',
    nombre: "Descansá",
    frase: "Descansá",
    url: '/stickers/descansa.svg',
  },
  {
    id: 'a7c1f0e2-0015-4a00-9000-5713ca110015',
    clave: 'agua',
    nombre: "Tomá agua",
    frase: "Tomá agua",
    url: '/stickers/agua.svg',
  },
  {
    id: 'a7c1f0e2-0016-4a00-9000-5713ca110016',
    clave: 'control',
    nombre: "Control en dos semanas",
    frase: "Control en dos semanas",
    url: '/stickers/control.svg',
  },
  {
    id: 'a7c1f0e2-0017-4a00-9000-5713ca110017',
    clave: 'entendido',
    nombre: "Entendido",
    frase: "Entendido",
    url: '/stickers/entendido.svg',
  },
  {
    id: 'a7c1f0e2-0018-4a00-9000-5713ca110018',
    clave: 'consulta',
    nombre: "Tengo una consulta",
    frase: "Tengo una consulta",
    url: '/stickers/consulta.svg',
  },
  {
    id: 'a7c1f0e2-0019-4a00-9000-5713ca110019',
    clave: 'reprogramar',
    nombre: "Podemos reprogramar",
    frase: "¿Podemos reprogramar?",
    url: '/stickers/reprogramar.svg',
  },
  {
    id: 'a7c1f0e2-0020-4a00-9000-5713ca110020',
    clave: 'urgencia',
    nombre: "Es urgente",
    frase: "Es urgente",
    url: '/stickers/urgencia.svg',
  },
  {
    id: 'a7c1f0e2-0021-4a00-9000-5713ca110021',
    clave: 'estudios',
    nombre: "Traé tus estudios",
    frase: "Traé tus estudios",
    url: '/stickers/estudios.svg',
  },
  {
    id: 'a7c1f0e2-0022-4a00-9000-5713ca110022',
    clave: 'buen-dia',
    nombre: "Buen día",
    frase: "¡Buen día!",
    url: '/stickers/buen-dia.svg',
  },
  {
    id: 'a7c1f0e2-0023-4a00-9000-5713ca110023',
    clave: 'buenas-noches',
    nombre: "Buenas noches",
    frase: "Buenas noches",
    url: '/stickers/buenas-noches.svg',
  },
  {
    id: 'a7c1f0e2-0024-4a00-9000-5713ca110024',
    clave: 'felicitaciones',
    nombre: "Felicitaciones",
    frase: "¡Felicitaciones!",
    url: '/stickers/felicitaciones.svg',
  },
];

/**
 * El sticker de un `fileId`, o `undefined` si ese archivo no es uno.
 *
 * Es lo que le permite al hilo dibujar un sticker **sin fondo de burbuja** y
 * sin pedirle los bytes al servidor: el pack es del producto y el cliente ya lo
 * tiene. Un adjunto cualquiera sigue el camino de siempre.
 */
export function stickerDe(fileId: string | undefined): Sticker | undefined {
  return fileId === undefined ? undefined : porId().get(fileId);
}

let indice: ReadonlyMap<string, Sticker> | null = null;
function porId(): ReadonlyMap<string, Sticker> {
  indice ??= new Map(PACK_DE_STICKERS.map((sticker) => [sticker.id, sticker]));
  return indice;
}

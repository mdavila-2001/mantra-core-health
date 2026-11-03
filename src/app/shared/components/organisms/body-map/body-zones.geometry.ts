/* ============================================================================
    El maniquí del cuerpo y sus zonas, para señalar dónde duele con el dedo o
    con el teclado (P-01, doctor 22/09/2026; maniquí 3D, 2026-10-23).

    Los tipos viven acá; los datos, en `body-zones.generated.ts`, que sale de
    `scripts/render-body-map.py` (render) → `scripts/gen-body-zones.py` (zonas
    gruesas, `scripts/body-map-base/zonas-gruesas.json`) →
    `scripts/split-body-zones.py` (zonas finas, con lado y segmento).

    ## Qué es y qué no es este dato

    Un maniquí clínico renderizado (malla de MakeHuman, CC0) con las zonas
    calzadas sobre su silueta. No es una lámina anatómica ni representa a
    ninguna persona: es lo que la regla 97 llama dato sintético declarado.

    ## Las tres vistas

    - **Frente** y **espalda**: la figura entera en postura A. Cada vista
      reparte la misma figura en sus propias zonas: al frente el pecho, el
      estómago y la zona íntima; atrás la nuca, la espalda, los riñones y los
      glúteos.
    - **Cara**: un busto ampliado. Ojos, oídos, nariz y boca a escala de
      cuerpo entero miden menos que un objetivo táctil (WCAG 2.2 · 2.5.8), así
      que tienen su propia vista.

    `image` es el render de la vista, en el mismo `viewBox` que las zonas:
    la imagen va debajo y las zonas, transparentes, encima.

    ## Zonas finas (2026-11-03)

    Cada zona gruesa se parte en lo que una persona señala: lado (derecho o
    izquierdo **del paciente**: de frente, su derecha queda a la izquierda de
    la pantalla) y segmento (brazo, codo, antebrazo, muñeca, mano; muslo,
    rodilla, canilla o pantorrilla, tobillo, pie o talón; las nueve regiones
    del abdomen; columna y costados de la espalda). Unas 40 por vista.

    ## Por qué el `id` es el de la tabla de zonas

    El organismo no sabe de síntomas: dibuja sólo las zonas cuyo `id` le pasa
    quien lo monta (`features/symptom-check/zones.data.ts`). Una misma zona
    puede aparecer en más de una vista —los brazos se ven de frente y de
    espaldas— y es el mismo control lógico.

    ## Orden

    El orden de `zonas` es el del tabulador: de arriba abajo.

    ## Tres proporciones de cuerpo (P-04, 2026-09-25)

    `VISTAS_DEL_CUERPO` es el maniquí neutro (la malla base de MakeHuman, sin
    targets de género); `_MASCULINA` y `_FEMENINA` son los maniquíes de cada
    sexo. Quien monta el organismo (`BodyMap`) elige uno según el sexo del
    paciente, o el neutro si no lo sabe.
    ========================================================================== */

/** Una zona dibujable: su `id` (el de la tabla de zonas) y su contorno. */
export interface SiluetaDeZona {
  readonly id: string;
  /** Contorno(s) cerrado(s), `M…Z`; puede tener varios subtrazos. */
  readonly d: string;
  /**
   * Un punto adentro de cada parte de la zona (las dos manos son dos partes):
   * donde se pone el marcador cuando la zona queda elegida.
   */
  readonly centros: readonly (readonly [number, number])[];
  /**
   * The coarse zone it was cut from («rodilla-der» → «rodillas»). The AI
   * reading and the symptom table speak in coarse ids: marking one lights
   * every fine zone that shares it.
   */
  readonly madre: string;
  /** Si al elegirla la figura pasa a otra vista (la cabeza acerca la cara). */
  readonly acercaA?: IdDeVista;
}

export type IdDeVista = 'frente' | 'espalda' | 'cara';

/** Una manera de mirar el cuerpo: de frente, de espaldas o la cara de cerca. */
export interface VistaDelCuerpo {
  readonly id: IdDeVista;
  /** Rótulo del selector de vista. */
  readonly nombre: string;
  readonly viewBox: string;
  /** El render del maniquí en esta vista (WebP con fondo transparente). */
  readonly image: string;
  readonly zonas: readonly SiluetaDeZona[];
}

export {
  VISTAS_DEL_CUERPO,
  VISTAS_DEL_CUERPO_FEMENINA,
  VISTAS_DEL_CUERPO_MASCULINA,
} from './body-zones.generated';

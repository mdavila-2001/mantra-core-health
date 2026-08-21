import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  NewPrescriptionFavorite,
  PrescriptionFavorite,
} from './prescription-favorites.types';

/* ---- forma de transporte ---------------------------------------------------
   Dos diferencias con el tipo de la vista, las dos del mismo origen —el
   servidor proyecta la entidad tal cual— y las dos absorbidas acá:

   1. **Los opcionales vacíos llegan como `null`, no se omiten.** Es lo que
      documenta la cabecera de `wire.ts`; sin normalizar, `favorito.doseText !==
      undefined` daría `true` para un favorito sin posología y el formulario
      escribiría `null` en el campo.
   2. **`quantityDecimal` llega como texto.** La columna es `numeric` y el
      driver de Postgres la serializa como string para no perder precisión al
      pasar por un `double`. Al **crear**, en cambio, el DTO la valida con
      `@IsNumber()`: viaja numérica. Esa asimetría no puede salir de acá — un
      componente que reciba `'21'` de la lista y tenga que mandar `21` al
      guardar termina con un `Number()` suelto en cada pantalla, y el día que
      falte, `'21' * 2` da `42` pero `'21' + 1` da `'211'`.

   La conversión pierde los dígitos que un `numeric` sin escala podría guardar
   más allá de los ~15 significativos de un `double`. Es aceptable para una
   cantidad a dispensar —«30 comprimidos», «1,5»—: el campo del formulario que
   la carga ya es un `type=number`, así que ningún valor que este cliente pueda
   originar excede ese rango. */

interface WirePrescriptionFavorite {
  readonly id: string;
  readonly name: string;
  readonly medicationConceptId: string;
  readonly substanceAtcConceptId?: string | null;
  readonly doseText?: string | null;
  readonly routeConceptId?: string | null;
  readonly frequencyText?: string | null;
  readonly quantityDecimal?: string | null;
  readonly unitConceptId?: string | null;
  readonly patientInstructionsText?: string | null;
}

/**
 * Cliente de `clinical_ext` · favoritos de prescripción (Patch v4.1.7).
 *
 * Las tres rutas operan **siempre sobre la lista de quien pide**: no hay
 * `practitionerProfileId` en la ruta ni en el cuerpo porque el dueño se deduce
 * de la sesión. Por eso `listOwn` no recibe a quién listar y `remove` no recibe
 * de quién borrar: no hay forma de nombrar la lista de otro, que es la razón por
 * la que la comprobación de pertenencia no se puede saltear desde el frontend.
 *
 * Dos comportamientos del servidor que la pantalla tiene que mostrar como tales:
 *
 * - **409** al crear con un rótulo que ya está en la lista. No pisa el anterior:
 *   dos favoritos con el mismo nombre son indistinguibles en un desplegable.
 * - **422** cuando la lista llegó a su techo (200 favoritos).
 * - **404** al borrar uno que no existe *o* que es de otro profesional. No
 *   distingue los dos casos a propósito, así que el error no sirve para sondear
 *   qué ids existen.
 *
 * **Aplicar un favorito no pasa por acá.** Rellena el formulario de receta y se
 * prescribe por el camino normal (`POST /clinical/medication-requests`), con su
 * firma y su emisión; un atajo que creara recetas desde este módulo sería una
 * segunda puerta a la prescripción.
 */
@Injectable({ providedIn: 'root' })
export class PrescriptionFavoritesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /prescription-favorites` — la lista personal completa.
   *
   * **Sin paginar y ordenada por rótulo**, tal como la devuelve la API: es una
   * lista corta que se consume entera en un desplegable, y pedir páginas para
   * llenar un `select` obligaría a la pantalla a decidir cuándo dejar de pedir.
   *
   * @returns Los favoritos del profesional de la sesión, en orden alfabético.
   */
  listOwn(): Observable<readonly PrescriptionFavorite[]> {
    return this.http
      .get<readonly WirePrescriptionFavorite[]>(this.url('/prescription-favorites'))
      .pipe(map((body) => body.map(toFavorite)));
  }

  /**
   * `POST /prescription-favorites` — guarda una indicación repetida.
   *
   * @param favorito - Rótulo, medicamento y lo que se haya elegido prefijar.
   * @returns El favorito guardado, con su identificador.
   */
  create(favorito: NewPrescriptionFavorite): Observable<PrescriptionFavorite> {
    return this.http
      .post<WirePrescriptionFavorite>(this.url('/prescription-favorites'), sinAusentes(favorito))
      .pipe(map(toFavorite));
  }

  /**
   * `DELETE /prescription-favorites/:id` — borra un favorito propio.
   *
   * Se borra de verdad, no se archiva: una lista de conveniencia sin obligación
   * de conservación clínica no deja rastro que un estado tenga que representar.
   *
   * @param id - Favorito a borrar. De otro profesional responde 404.
   */
  remove(id: string): Observable<void> {
    return this.http
      .delete<unknown>(this.url(`/prescription-favorites/${encodeURIComponent(id)}`))
      .pipe(map(() => undefined));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** Un favorito del transporte, con la forma que el tipo de la vista promete. */
function toFavorite(body: WirePrescriptionFavorite): PrescriptionFavorite {
  return sinAusentes({
    id: body.id,
    name: body.name,
    medicationConceptId: body.medicationConceptId,
    substanceAtcConceptId: sinNulo(body.substanceAtcConceptId),
    doseText: sinNulo(body.doseText),
    routeConceptId: sinNulo(body.routeConceptId),
    frequencyText: sinNulo(body.frequencyText),
    quantityDecimal: aNumero(body.quantityDecimal),
    unitConceptId: sinNulo(body.unitConceptId),
    patientInstructionsText: sinNulo(body.patientInstructionsText),
  });
}

/**
 * El texto que vino, o nada si vino vacío.
 *
 * `== null` y no `=== undefined`: cubre los dos, y el segundo solo no alcanza
 * porque el servidor manda `null` en vez de omitir la clave.
 */
function sinNulo(valor?: string | null): string | undefined {
  return valor == null ? undefined : valor;
}

/**
 * La cantidad como número, o nada.
 *
 * Un texto que no es un número devuelve `undefined` y no `NaN`: `NaN` se colaría
 * en el formulario como un valor presente —`'quantityDecimal' in favorito` sería
 * `true`— y volvería a la API en el cuerpo de la próxima receta, donde el
 * `@IsNumber()` del DTO lo rechaza recién ahí. Es el mismo modo de fallo que
 * `maybeDateOnly` de `wire.ts` existe para evitar.
 */
function aNumero(valor?: string | null): number | undefined {
  if (valor == null) {
    return undefined;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

/**
 * El mismo objeto sin las claves cuyo valor es `undefined`.
 *
 * De ida importa porque el backend valida con `forbidNonWhitelisted` y una clave
 * declarada en `undefined` viaja como clave presente; `JSON.stringify` ya la
 * omitiría, pero depender de eso ata el cuerpo enviado a un detalle del
 * serializador en vez de declararlo.
 *
 * De vuelta importa porque el tipo de la vista declara esos campos con `?:`, y
 * eliminar la clave es la única forma de que `'x' in favorito` y `Object.keys()`
 * digan lo mismo que el tipo. Es {@link sinNulos} de `wire.ts` en el otro
 * sentido, y por eso no se puede reutilizar aquélla: filtra `null`, no
 * `undefined`.
 */
function sinAusentes<T extends object>(valor: T): T {
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== undefined)) as T;
}

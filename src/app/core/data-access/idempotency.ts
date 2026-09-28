import { HttpHeaders } from '@angular/common/http';
import { tap, type Observable } from 'rxjs';

/* ============================================================================
    Claves de idempotencia por intento de envío.

    Las escrituras sensibles de la API (walk-in, receta, orden de servicio,
    adjudicación) aceptan la cabecera `Idempotency-Key`: un reintento con la
    misma clave y el mismo cuerpo recibe la respuesta original sin volver a
    ejecutarse. Eso sólo sirve si el front manda **la misma clave** cuando
    reintenta el mismo envío, y **otra** cuando el envío es distinto.

    ## La regla

    - La clave nace con el primer envío de un formulario y se reutiliza
      mientras los datos no cambien: el doble clic, el reintento tras un
      timeout o un 5xx llegan con la misma clave, y el servidor no duplica.
    - Si el usuario cambia los datos, la clave es nueva: el servidor
      respondería 422 a una clave reciclada con otro cuerpo.
    - Cuando el envío sale bien, la clave se cierra: volver a enviar después
      —aunque sea con los mismos datos— es un envío nuevo, no un reintento.

    Una instancia por cliente (los clientes son singletons de raíz), con una
    entrada por operación: sólo interesa el último envío de cada formulario.
    ========================================================================== */

/** Nombre de la cabecera que lee la API. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** El envío en curso de una operación: su huella y la clave que lleva. */
interface PendingSubmission {
  readonly fingerprint: string;
  readonly key: string;
}

/** Registro de claves por operación; ver la nota de arriba. */
export class SubmissionKeys {
  private readonly pending = new Map<string, PendingSubmission>();

  /**
   * @param generate - Fábrica de claves nuevas; las pruebas la fijan.
   */
  constructor(private readonly generate: () => string = () => globalThis.crypto.randomUUID()) {}

  /**
   * La clave para enviar `payload` en `operation`: la misma que el envío
   * anterior si los datos no cambiaron, una nueva si cambiaron.
   */
  keyFor(operation: string, payload: unknown): string {
    const fingerprint = canonicalJson(payload);
    const current = this.pending.get(operation);
    if (current?.fingerprint === fingerprint) return current.key;

    const key = this.generate();
    this.pending.set(operation, { fingerprint, key });
    return key;
  }

  /**
   * Cierra el envío que llevaba `key`: el siguiente será nuevo. No toca la
   * entrada si mientras tanto ya empezó otro envío con otra clave.
   */
  settle(operation: string, key: string): void {
    if (this.pending.get(operation)?.key === key) this.pending.delete(operation);
  }
}

/**
 * Envía `payload` con su `Idempotency-Key` y cierra la clave al completarse
 * con éxito. Si falla (o se cancela), la clave queda para el reintento.
 *
 * @param keys - El registro del cliente.
 * @param operation - Nombre estable de la operación, con el recurso si aplica.
 * @param payload - El cuerpo tal como viaja: es lo que define "los mismos datos".
 * @param send - La petición, que recibe las cabeceras a adjuntar.
 */
export function sendIdempotent<T>(
  keys: SubmissionKeys,
  operation: string,
  payload: unknown,
  send: (headers: HttpHeaders) => Observable<T>,
): Observable<T> {
  const key = keys.keyFor(operation, payload);
  return send(new HttpHeaders({ [IDEMPOTENCY_KEY_HEADER]: key })).pipe(
    tap({ complete: () => keys.settle(operation, key) }),
  );
}

/** JSON con las claves ordenadas: `{a, b}` y `{b, a}` son el mismo envío. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : item,
  );
}

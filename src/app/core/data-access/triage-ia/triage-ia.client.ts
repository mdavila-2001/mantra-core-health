import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, map, of, timeout, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { apiUrl } from '../api';
import type { HallazgoIa, LecturaIa } from './triage-ia.types';

/**
 * Raíz del servicio de triage por IA. Ver `aiBaseUrl` en `environment.types.ts`.
 *
 * Token y no lectura directa por lo mismo que `API_BASE_URL`: las pruebas fijan
 * otra raíz sin tocar el entorno.
 */
export const AI_BASE_URL = new InjectionToken<string>('AI_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.aiBaseUrl,
});

/**
 * Cuánto se espera al servicio antes de seguir sin él.
 *
 * La pantalla ya reconoció lo que pudo con el motor local mientras la persona
 * escribía; el servicio suma lo que el motor no entiende (partes del cuerpo sin
 * fila en la tabla, frases enteras). Si tarda más que esto, se sigue sin su
 * aporte en vez de hacer esperar a nadie.
 */
const ESPERA_MS = 4_000;

/**
 * Habla con AlovidaAIService: le manda el texto del paciente y recibe síntomas,
 * partes del cuerpo y especialidades.
 *
 * ## Por qué un `HttpClient` propio, sin interceptores
 *
 * Se arma sobre `HttpBackend`, que es el `HttpClient` **sin** la cadena de
 * interceptores de la aplicación, por dos razones:
 *
 * - `authInterceptor` le pone el JWT del paciente a toda petición que no
 *   reconozca como pública. Este servicio no lo necesita —es público y no
 *   autoriza nada— y mandárselo sería entregarle una credencial de más.
 * - `mockBackendInterceptor` contesta en la rama `mockup` todo lo que parezca
 *   de la API. El triage tiene que llegar al servicio de verdad, también ahí.
 *
 * ## Nunca falla hacia arriba
 *
 * Un error, un tiempo agotado o una respuesta con otra forma devuelven `null`:
 * la pantalla sigue con lo que reconoció el motor local. El servicio mejora la
 * lectura; su ausencia no la rompe.
 */
@Injectable({ providedIn: 'root' })
export class TriageIaClient {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly base = inject(AI_BASE_URL);

  analizar(texto: string): Observable<LecturaIa | null> {
    return this.http.post<unknown>(apiUrl(this.base, '/v1/triage/analyze'), { text: texto }).pipe(
      timeout(ESPERA_MS),
      map(leerLectura),
      catchError(() => of(null)),
    );
  }
}

/** Valida la forma de lo que llegó; lo que no la tenga se trata como «sin lectura». */
export function leerLectura(cuerpo: unknown): LecturaIa | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return null;
  }
  const { symptoms, urgency } = cuerpo as { symptoms?: unknown; urgency?: unknown };
  if (!Array.isArray(symptoms) || (urgency !== 'urgente' && urgency !== 'prioritaria' && urgency !== 'programada')) {
    return null;
  }
  return { symptoms: symptoms.filter(esHallazgo), urgency };
}

function esHallazgo(valor: unknown): valor is HallazgoIa {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const h = valor as Partial<HallazgoIa>;
  return (
    typeof h.code === 'string' &&
    typeof h.label === 'string' &&
    (h.kind === 'curated' || h.kind === 'anatomy') &&
    Array.isArray(h.zones) &&
    Array.isArray(h.especialidades) &&
    typeof h.alarm === 'boolean'
  );
}

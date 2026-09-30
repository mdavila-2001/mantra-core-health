import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, timeout, type Observable } from 'rxjs';

import { apiUrl } from '../api';
import { AI_BASE_URL } from './triage-ia.client';
import type {
  CategoriaDeOrdenIa,
  DiagnosticoTentativoIa,
  OrdenSugeridaIa,
  PeticionDeSugerencia,
  PruebaSugeridaIa,
  SugerenciaIa,
} from './diagnosis-ia.types';

/**
 * Cuánto se espera al servicio antes de seguir sin él.
 *
 * Más que el triage (4 s) porque acá el servicio puede consultar un modelo con
 * un prompt más largo; menos que lo que alguien tolera mirando un spinner. Si
 * tarda más, el cierre del formulario sigue a mano.
 */
const ESPERA_MS = 6_000;

/**
 * Habla con AlovidaAIService: le manda las respuestas de un formulario clínico
 * y recibe diagnósticos tentativos con sus pruebas.
 *
 * ## Por qué un `HttpClient` propio, sin interceptores
 *
 * Mismo criterio que `TriageIaClient`: se arma sobre `HttpBackend` para que
 * `authInterceptor` no le entregue el JWT a un servicio que no lo necesita y
 * para que `mockBackendInterceptor` no lo conteste en la rama `mockup` — tiene
 * que llegar al servicio de verdad, también ahí.
 *
 * ## Nunca falla hacia arriba
 *
 * Un error, un tiempo agotado o una respuesta con otra forma devuelven `null`:
 * el cierre del formulario se completa a mano, como siempre. El servicio
 * sugiere; su ausencia no bloquea nada.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosisIaClient {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly base = inject(AI_BASE_URL);

  sugerir(peticion: PeticionDeSugerencia): Observable<SugerenciaIa | null> {
    return this.http
      .post<unknown>(apiUrl(this.base, '/v1/diagnosis/suggest'), cuerpoDe(peticion))
      .pipe(
        timeout(ESPERA_MS),
        map(leerSugerencia),
        catchError(() => of(null)),
      );
  }
}

/** Sólo las claves con valor: el servicio rechaza un cuerpo sin ninguna de las tres. */
function cuerpoDe(peticion: PeticionDeSugerencia): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {};
  if (peticion.answers !== undefined && peticion.answers.length > 0) {
    cuerpo['answers'] = peticion.answers;
  }
  if (peticion.symptomCodes !== undefined && peticion.symptomCodes.length > 0) {
    cuerpo['symptomCodes'] = peticion.symptomCodes;
  }
  if (peticion.freeText !== undefined && peticion.freeText.trim() !== '') {
    cuerpo['freeText'] = peticion.freeText;
  }
  if (peticion.patient !== undefined) {
    cuerpo['patient'] = peticion.patient;
  }
  return cuerpo;
}

/**
 * Valida la forma de lo que llegó; lo que no la tenga se trata como «sin
 * sugerencia».
 *
 * Una fila de diagnóstico o de prueba mal formada se **descarta** sin tirar
 * el resto: un servicio que devolvió cuatro tentativos válidos y uno roto
 * sigue siendo útil. Un `score` fuera de 0..1 se recorta al rango, no se
 * descarta: la fila sigue nombrando un diagnóstico real del glosario, y lo que
 * está mal es el número, que la pantalla sólo usa para ordenar.
 */
export function leerSugerencia(cuerpo: unknown): SugerenciaIa | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return null;
  }
  const c = cuerpo as Record<string, unknown>;
  if (
    (c['source'] !== 'model' && c['source'] !== 'catalog') ||
    !Array.isArray(c['tentativeDiagnoses']) ||
    !Array.isArray(c['suggestedOrders']) ||
    typeof c['disclaimer'] !== 'string'
  ) {
    return null;
  }
  return {
    source: c['source'],
    recognized: c['recognized'] === true,
    symptoms: Array.isArray(c['symptoms']) ? c['symptoms'].filter(esSintoma) : [],
    tentativeDiagnoses: c['tentativeDiagnoses'].flatMap((fila) => {
      const tentativo = leerTentativo(fila);
      return tentativo === null ? [] : [tentativo];
    }),
    suggestedOrders: c['suggestedOrders'].flatMap((fila) => {
      const orden = leerOrden(fila);
      return orden === null ? [] : [orden];
    }),
    disclaimer: c['disclaimer'],
    knowledgeVersion: typeof c['knowledgeVersion'] === 'string' ? c['knowledgeVersion'] : '',
  };
}

function esSintoma(valor: unknown): valor is { code: string; label: string } {
  if (typeof valor !== 'object' || valor === null) return false;
  const s = valor as Record<string, unknown>;
  return typeof s['code'] === 'string' && typeof s['label'] === 'string';
}

function codigoOpcional(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

function esCategoria(valor: unknown): valor is CategoriaDeOrdenIa {
  return valor === 'LAB' || valor === 'IMAGING' || valor === 'OTHER';
}

function leerPrueba(valor: unknown): PruebaSugeridaIa | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const p = valor as Record<string, unknown>;
  if (
    typeof p['slug'] !== 'string' ||
    typeof p['label'] !== 'string' ||
    !esCategoria(p['category'])
  ) {
    return null;
  }
  return {
    slug: p['slug'],
    code: codigoOpcional(p['code']),
    codeSystem: codigoOpcional(p['codeSystem']),
    label: p['label'],
    category: p['category'],
  };
}

function leerOrden(valor: unknown): OrdenSugeridaIa | null {
  const prueba = leerPrueba(valor);
  if (prueba === null) return null;
  const para = (valor as Record<string, unknown>)['forDiagnoses'];
  return {
    ...prueba,
    forDiagnoses: Array.isArray(para) ? para.filter((s): s is string => typeof s === 'string') : [],
  };
}

function leerTentativo(valor: unknown): DiagnosticoTentativoIa | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const d = valor as Record<string, unknown>;
  if (
    typeof d['slug'] !== 'string' ||
    typeof d['label'] !== 'string' ||
    typeof d['score'] !== 'number' ||
    !Number.isFinite(d['score'])
  ) {
    return null;
  }
  return {
    slug: d['slug'],
    code: codigoOpcional(d['code']),
    codeSystem: codigoOpcional(d['codeSystem']),
    label: d['label'],
    score: Math.min(1, Math.max(0, d['score'])),
    why: typeof d['why'] === 'string' ? d['why'] : '',
    matchedSymptoms: Array.isArray(d['matchedSymptoms'])
      ? d['matchedSymptoms'].filter((s): s is string => typeof s === 'string')
      : [],
    suggestedTests: Array.isArray(d['suggestedTests'])
      ? d['suggestedTests'].flatMap((fila) => {
          const prueba = leerPrueba(fila);
          return prueba === null ? [] : [prueba];
        })
      : [],
  };
}

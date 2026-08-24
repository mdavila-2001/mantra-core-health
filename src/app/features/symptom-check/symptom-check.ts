import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { ProfilesClient } from '@core/data-access/profiles/profiles.client';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '@core/data-access/terminology/terminology.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Chip } from '@shared/components/atoms/chip/chip';
import { Textarea } from '@shared/components/atoms/textarea/textarea';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';

import {
  explicar,
  normalizar,
  reconocer,
  reconocerAlarmas,
  recomendar,
  sugerir,
  type Recomendacion,
  type Sintoma,
} from './sintomas';

/** Tope por página del listado de profesionales. */
const POR_PAGINA = 50;

/**
 * **¿Qué te pasa?** — el punto de entrada del paciente (Frente C del plan de UX
 * del 22/08/2026).
 *
 * ## Qué problema resuelve
 *
 * Un paciente entraba y veía un lanzador de secciones: «Directorio»,
 * «Laboratorios», «Mensajes». Para usarlo hay que saber de antemano a qué
 * especialidad se va, que es justo lo que no sabe quien está con dolor de
 * cabeza hace tres días. El cliente lo pidió como «flujo como ClinicApp»: la
 * primera pantalla es de síntomas, y de ahí sale la recomendación.
 *
 * ## Cómo funciona, y por qué así
 *
 * 1. Se escribe en lenguaje corriente.
 * 2. Mientras se escribe, los síntomas reconocidos **se pintan como chips**.
 *    Ese es el corazón del flujo: es el acuse de recibo de «te entendí esto», y
 *    es lo que hace que la recomendación de después no se sienta adivinanza.
 * 3. Cada chip se puede quitar —un falso positivo no puede quedar atrapado— y
 *    se pueden agregar por autocompletado los que el texto no dijo.
 * 4. Con los chips puestos, se recomiendan especialidades **con su porqué**, y
 *    de ahí se salta al directorio de médicos ya filtrado.
 *
 * ## Lo que esta pantalla NO hace, y lo dice
 *
 * **No diagnostica.** Orienta hacia una especialidad, que es una decisión sobre
 * a quién consultar. El aviso es fijo y no depende de que nadie se acuerde de
 * ponerlo.
 *
 * Y frente a un **síntoma de alarma** deja de recomendar: manda a urgencias.
 * Ofrecerle a alguien que escribió «me duele el pecho y no puedo respirar» un
 * turno de cardiología para el jueves sería el peor resultado posible de esta
 * pantalla.
 *
 * ## Por qué las especialidades salen del directorio y no del catálogo
 *
 * Porque el catálogo de terminología tiene especialidades que en esta
 * plataforma no ejerce nadie, y recomendar una que lleva a un directorio vacío
 * es peor que no recomendar. Se cruzan las de la tabla con las que **de verdad
 * tienen profesionales publicados**.
 */
@Component({
  selector: 'app-symptom-check',
  imports: [Alert, AppButton, Card, Chip, RouterLink, Textarea],
  templateUrl: './symptom-check.html',
  styleUrl: './symptom-check.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SymptomCheck {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly router = inject(Router);

  /** Lo que la persona escribió, tal cual. */
  protected readonly texto = signal('');

  /** Los que se agregaron a mano por el autocompletado. */
  private readonly agregados = signal<readonly Sintoma[]>([]);

  /** Los que se quitaron a mano aunque el texto los nombre. */
  private readonly quitados = signal<ReadonlySet<string>>(new Set());

  /**
   * Si ya hace falta saber qué especialidades existen.
   *
   * **No se pide al abrir.** Esta pantalla encabeza el panel del paciente, que
   * es el destino del login: una lectura de cincuenta profesionales ahí la
   * pagaría todo el mundo, incluido quien entró a mirar cuándo era su turno y
   * no va a escribir una palabra. Se pide en cuanto alguien empieza a
   * escribir, que es bastante antes de que el dato haga falta.
   */
  private readonly haceFalta = signal(false);

  /**
   * Las especialidades que de verdad tienen profesionales, ya normalizadas.
   *
   * Un fallo **no rompe el flujo**: sin la lista no se filtra nada y se
   * recomiendan todas las de la tabla, que es peor que lo ideal y mucho mejor
   * que una pantalla que no funciona.
   */
  private readonly especialidadesDisponibles = toSignal(
    toObservable(this.haceFalta).pipe(
      switchMap((hace) => (hace ? this.leerEspecialidades() : of(new Set<string>()))),
      catchError(() => of(new Set<string>())),
    ),
    { initialValue: new Set<string>() as ReadonlySet<string> },
  );

  /** Los síntomas de alarma que aparecen en el texto. Vacío es lo normal. */
  protected readonly alarmas = computed(() => reconocerAlarmas(this.texto()));

  /**
   * Los chips: lo reconocido en el texto, menos lo quitado, más lo agregado.
   *
   * El orden es el de aparición en el texto y después los agregados: ver el
   * porqué en `reconocer`.
   */
  protected readonly sintomas = computed<readonly Sintoma[]>(() => {
    const quitados = this.quitados();
    const delTexto = reconocer(this.texto()).filter((s) => !quitados.has(s.id));
    const yaEstan = new Set(delTexto.map((s) => s.id));
    return [...delTexto, ...this.agregados().filter((s) => !yaEstan.has(s.id))];
  });

  /** Lo que el autocompletado ofrece para la última palabra que se escribe. */
  protected readonly sugerencias = computed(() =>
    sugerir(ultimaFrase(this.texto()), this.sintomas()),
  );

  protected readonly recomendaciones = computed<readonly Recomendacion[]>(() =>
    // Con una alarma en el texto no se recomienda nada: la pantalla entera pasa
    // a decir «andá a urgencias», y una lista de especialidades debajo
    // competiría con ese mensaje.
    this.alarmas().length > 0 ? [] : recomendar(this.sintomas(), this.especialidadesDisponibles()),
  );

  /** Lo que la región viva le anuncia a un lector de pantalla. */
  protected readonly anuncio = computed(() => {
    const nombres = this.sintomas().map((s) => s.nombre);
    if (nombres.length === 0) {
      return '';
    }
    return `Reconocimos: ${nombres.join(', ')}.`;
  });

  protected readonly explicacionDe = explicar;

  protected escribir(valor: string): void {
    this.texto.set(valor);
    if (valor.trim() !== '') {
      this.haceFalta.set(true);
    }
  }

  /** Quita un chip. Un falso positivo no puede quedar atrapado. */
  protected quitar(sintoma: Sintoma): void {
    this.quitados.update((previos) => new Set([...previos, sintoma.id]));
    this.agregados.update((previos) => previos.filter((s) => s.id !== sintoma.id));
  }

  /** Agrega uno del autocompletado. */
  protected agregar(sintoma: Sintoma): void {
    this.quitados.update((previos) => {
      const copia = new Set(previos);
      copia.delete(sintoma.id);
      return copia;
    });
    this.agregados.update((previos) =>
      previos.some((s) => s.id === sintoma.id) ? previos : [...previos, sintoma],
    );
  }

  protected empezarDeNuevo(): void {
    this.texto.set('');
    this.agregados.set([]);
    this.quitados.set(new Set());
  }

  /**
   * Salta al directorio de médicos con esa especialidad puesta.
   *
   * Va por el **nombre** y no por el `conceptId` porque la tabla de síntomas se
   * escribe con nombres —ver `sintomas.datos.ts`— y el directorio ya sabe
   * filtrar en memoria por su chip. El identificador lo resuelve el propio
   * directorio, que es quien tiene los grupos cargados.
   */
  protected verProfesionales(nombre: string): void {
    void this.router.navigate(['/directory'], { queryParams: { q: nombre } });
  }

  /**
   * Las especialidades con profesionales publicados, normalizadas.
   *
   * Una sola página: alcanza para saber **qué especialidades existen** en la
   * plataforma, que es lo único que hace falta acá. Recorrer el cursor entero
   * sería traerse el directorio para leer una lista de nombres.
   */
  private leerEspecialidades(): Observable<ReadonlySet<string>> {
    return this.profiles.listPractitioners({ limit: POR_PAGINA }).pipe(
      switchMap((pagina) => {
        const ids = [
          ...new Set(
            pagina.items.flatMap((fila) => fila.specialties.map((e) => e.specialtyConceptId)),
          ),
        ];
        if (ids.length === 0) {
          return of(new Set<string>());
        }
        // El catálogo traduce los conceptos a nombres; sin él no hay con qué
        // cruzar la tabla, y se devuelve vacío, que desactiva el filtro.
        return this.terminology.readConceptLabels(ids).pipe(
          map(
            (etiquetas: ConceptLabels) =>
              new Set([...etiquetas.values()].map((opcion) => normalizar(opcion.display))),
          ),
          catchError(() => of(new Set<string>())),
        );
      }),
    );
  }
}

/**
 * La última frase de lo que se está escribiendo.
 *
 * El autocompletado mira sólo lo último y no el texto entero: quien ya escribió
 * «tengo fiebre y do» está buscando algo que empieza con «do», y buscar sobre
 * la frase completa no encontraría nada.
 */
export function ultimaFrase(texto: string): string {
  const partes = normalizar(texto).split(/[,.;]| y /);
  return (partes[partes.length - 1] ?? '').trim();
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { finalize, map, of, switchMap, timer } from 'rxjs';

import { TriageIaClient } from '../../../../core/data-access/triage-ia/triage-ia.client';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  BodyMap,
  type SexoDeLaSilueta,
  type ZonaElegible,
} from '../../../../shared/components/organisms/body-map/body-map';
import {
  combine,
  currentReading,
  readingSymptoms,
  readingZones,
  type TextReading,
} from '../../../symptom-check/ai-reading';
import {
  recognize,
  recognizeAlarms,
  SYMPTOMS_ALL,
  type Sintoma,
} from '../../../symptom-check/symptoms';
import { BODY_ZONES } from '../../../symptom-check/zones.data';

/** La misma pausa que `symptom-check` antes de preguntarle al servicio de triage. */
const PAUSA_PARA_LEER_MS = 600;

/**
 * La figura del cuerpo junto al **motivo de la consulta** de la reserva
 * (pedido del cliente, 04/11/2026: la columna derecha de la reserva quedaba
 * vacía).
 *
 * Es la misma figura y la misma detección de «¿Qué te pasa?»
 * (`features/symptom-check`), en dos sentidos:
 *
 * - **Del texto a la figura.** Lo que se escribe en el motivo pasa por el motor
 *   local (`recognize`) y, tras una pausa, por el servicio de triage; las zonas
 *   de lo reconocido se iluminan en la silueta, igual que allá.
 * - **De la figura al texto.** Tocar una zona abre sus síntomas; tocar uno lo
 *   **agrega al motivo** (`agregado`). La figura no escribe el formulario: lo
 *   pide, y quien la monta decide (respeta el tope de 500 caracteres).
 *
 * Frente a un síntoma de alarma dice que no espere al turno, como en
 * «¿Qué te pasa?»: una reserva para el jueves no es la respuesta a un dolor de
 * pecho con falta de aire.
 *
 * No recomienda especialidades: acá el profesional ya está elegido.
 */
@Component({
  selector: 'app-motivo-figura',
  imports: [Alert, BodyMap],
  templateUrl: './motivo-figura.html',
  styleUrl: './motivo-figura.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotivoFigura {
  private readonly triageIa = inject(TriageIaClient);

  /** Lo escrito en el motivo, tal cual. */
  readonly texto = input('');

  /** Con `false` la figura sólo muestra (paso de confirmar: el motivo ya no se edita). */
  readonly editable = input(true);

  /** Con qué proporción dibujar la figura; sin dato, la neutra. */
  readonly sexo = input<SexoDeLaSilueta | undefined>(undefined);

  /** El nombre del síntoma que se tocó, para sumarlo al motivo. */
  readonly agregado = output<string>();

  /* ---- detección: la de `symptom-check` ---------------------------------- */

  private readonly textoLeido = signal('');

  private readonly lecturaGuardada = toSignal(
    toObservable(this.texto).pipe(
      map((texto) => texto.trim()),
      switchMap((texto) =>
        texto.length < 3
          ? of(null)
          : timer(PAUSA_PARA_LEER_MS).pipe(
              switchMap(() => this.triageIa.analizar(texto)),
              map((lectura): TextReading | null => (lectura === null ? null : { texto, lectura })),
              finalize(() => this.textoLeido.set(texto)),
            ),
      ),
    ),
    { initialValue: null },
  );

  private readonly lecturaVigente = computed(() =>
    currentReading(this.lecturaGuardada(), this.texto()),
  );

  /** Lo reconocido en el motivo: motor local más lo que sumó el servicio. */
  protected readonly sintomas = computed<readonly Sintoma[]>(() =>
    combine(recognize(this.texto()), readingSymptoms(this.lecturaVigente())).filter((s) =>
      this.visible(s),
    ),
  );

  /** El servicio todavía está leyendo lo escrito. */
  protected readonly leyendo = computed(() => {
    const texto = this.texto().trim();
    return texto.length >= 3 && this.textoLeido() !== texto;
  });

  /** Las alarmas del texto: frente a ellas no se espera el turno. */
  protected readonly alarmas = computed(() => recognizeAlarms(this.texto()));

  /** Las zonas que la silueta ilumina por lo escrito (misma regla que `symptom-check`). */
  protected readonly zonasMarcadas = computed<readonly string[]>(() => {
    const delServicio = readingZones(this.lecturaVigente());
    const marcadas = new Set<string>();
    for (const sintoma of [...this.sintomas(), ...this.alarmas()]) {
      const ubicadas = delServicio.get(sintoma.id);
      if (ubicadas !== undefined && ubicadas.length > 0) {
        ubicadas.forEach((zona) => marcadas.add(zona));
        continue;
      }
      const deLaTabla = BODY_ZONES.find((zona) => zona.sintomas.includes(sintoma.id));
      if (deLaTabla !== undefined) marcadas.add(deLaTabla.id);
    }
    return [...marcadas];
  });

  /* ---- elegir tocando ---------------------------------------------------- */

  protected readonly zonas: readonly ZonaElegible[] = BODY_ZONES.map(({ id, nombre }) => ({
    id,
    nombre,
  }));

  protected readonly zonaAbierta = signal<string | null>(null);

  protected readonly nombreDeLaZonaAbierta = computed(
    () => BODY_ZONES.find((zona) => zona.id === this.zonaAbierta())?.nombre ?? null,
  );

  protected readonly sintomasDeLaZona = computed<readonly Sintoma[]>(() => {
    const zona = BODY_ZONES.find((z) => z.id === this.zonaAbierta());
    if (zona === undefined) return [];
    return zona.sintomas
      .map((id) => SYMPTOMS_ALL.find((s) => s.id === id))
      .filter((s): s is Sintoma => s !== undefined)
      .filter((s) => this.visible(s));
  });

  protected elegirZona(id: string | null): void {
    this.zonaAbierta.set(id);
  }

  protected estaEnElMotivo(sintoma: Sintoma): boolean {
    return (
      this.sintomas().some((s) => s.id === sintoma.id) ||
      this.alarmas().some((s) => s.id === sintoma.id)
    );
  }

  protected agregar(sintoma: Sintoma): void {
    if (!this.editable() || this.estaEnElMotivo(sintoma)) return;
    this.agregado.emit(sintoma.nombre);
  }

  /** Igual que en `symptom-check`: sin sexo conocido no se esconde nada. */
  private visible(sintoma: Sintoma): boolean {
    const solo = sintoma.soloParaSexo;
    const sexo = this.sexo();
    return solo === undefined || sexo === undefined || solo === sexo;
  }
}

/* ============================================================================
    Las ventanas de fecha del resumen: hoy, esta semana, este mes — y con qué
    se compara cada una.

    ## Por qué la comparación no es «el mes pasado entero»

    Si el 3 de septiembre se compara lo que va del mes contra septiembre
    completo del año pasado, el resumen abre siempre en rojo. No porque el
    consultorio esté peor, sino porque se comparan tres días contra treinta.
    Un médico que ve «−90 %» el día 3 de cada mes deja de mirar la pantalla.

    Así que la ventana previa tiene **el mismo largo** que la actual, corrida
    un período hacia atrás: los primeros tres días del mes pasado contra los
    primeros tres de éste. Es la única comparación que significa algo sin
    explicar nada.

    Se recibe `hoy` por parámetro y no se lee el reloj adentro: así las
    pruebas fijan el día y no dependen de cuándo se corren.
    ========================================================================== */

/** Un rango cerrado de fechas, `YYYY-MM-DD` las dos puntas. */
export interface Ventana {
  readonly from: string;
  readonly to: string;
}

/** Una ventana y su comparable del período anterior, del mismo largo. */
export interface ParDeVentanas {
  readonly actual: Ventana;
  readonly previa: Ventana;
  /** Cómo se nombra la ventana previa cuando se la menciona en pantalla. */
  readonly rotuloPrevio: string;
}

/** `YYYY-MM-DD` en hora local. `toISOString()` no sirve: corre a UTC. */
export function aIsoLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** Hoy contra ayer. */
export function ventanasDelDia(hoy: Date): ParDeVentanas {
  const ayer = sumarDias(hoy, -1);
  return {
    actual: { from: aIsoLocal(hoy), to: aIsoLocal(hoy) },
    previa: { from: aIsoLocal(ayer), to: aIsoLocal(ayer) },
    rotuloPrevio: 'ayer',
  };
}

/**
 * Lo que va de esta semana contra los mismos días de la semana pasada.
 *
 * La semana arranca el **lunes**: es el primer día laboral del consultorio, y
 * una semana que empieza el domingo parte el fin de semana en dos.
 */
export function ventanasDeLaSemana(hoy: Date): ParDeVentanas {
  const desdeElLunes = (hoy.getDay() + 6) % 7;
  const lunes = sumarDias(hoy, -desdeElLunes);
  return {
    actual: { from: aIsoLocal(lunes), to: aIsoLocal(hoy) },
    previa: {
      from: aIsoLocal(sumarDias(lunes, -7)),
      to: aIsoLocal(sumarDias(hoy, -7)),
    },
    rotuloPrevio: 'la semana pasada',
  };
}

/**
 * Lo que va del mes contra los mismos días del mes pasado.
 *
 * El día de corte se recorta al último día del mes previo: el 31 de marzo se
 * compara contra el 28 de febrero, no contra un 31 de febrero que no existe
 * —y que `Date` resolvería, en silencio, como el 3 de marzo—.
 */
export function ventanasDelMes(hoy: Date): ParDeVentanas {
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const primeroPrevio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const ultimoDiaPrevio = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
  const corteDelPrevio = new Date(
    primeroPrevio.getFullYear(),
    primeroPrevio.getMonth(),
    Math.min(hoy.getDate(), ultimoDiaPrevio),
  );
  return {
    actual: { from: aIsoLocal(primero), to: aIsoLocal(hoy) },
    previa: { from: aIsoLocal(primeroPrevio), to: aIsoLocal(corteDelPrevio) },
    rotuloPrevio: 'el mes pasado',
  };
}

/** Cómo le fue a una ventana contra su comparable. */
export interface Comparacion {
  readonly direccion: 'sube' | 'baja' | 'igual';
  /** Cuánto cambió, en por ciento y sin signo: el signo lo dice `direccion`. */
  readonly porcentaje: number;
  readonly rotuloPrevio: string;
}

/**
 * Cuánto cambió un importe respecto del período anterior.
 *
 * ## Acá sí se convierte a número, y sólo acá
 *
 * La regla de la casa (cabecera de `accounting.types.ts`) es que un importe no
 * pasa por `number`: un `float` no representa 0,1 y un céntimo de descuadre no
 * se distingue de un error contable. Un **porcentaje de variación** no es un
 * importe: no se muestra como plata, no se suma a nada y no vuelve al
 * servidor. Se redondea a entero, que es la precisión con la que se lee.
 *
 * Sin comparable —el período anterior en cero, o un dato que no llegó— no se
 * inventa un «+100 %»: se devuelve `null` y la pantalla no dibuja el chip.
 */
export function comparar(
  actual: string,
  previo: string,
  rotuloPrevio: string,
): Comparacion | null {
  const a = Number(actual);
  const p = Number(previo);
  if (!Number.isFinite(a) || !Number.isFinite(p) || p <= 0) return null;
  const variacion = Math.round(((a - p) / p) * 100);
  if (variacion === 0) return { direccion: 'igual', porcentaje: 0, rotuloPrevio };
  return {
    direccion: variacion > 0 ? 'sube' : 'baja',
    porcentaje: Math.abs(variacion),
    rotuloPrevio,
  };
}

/**
 * Qué parte del total representa un importe, en por ciento.
 *
 * Es el ancho de una barra, no una cifra contable: misma licencia que
 * `comparar`, y por la misma razón.
 */
export function porcentajeDe(parte: string, total: string): number {
  const p = Number(parte);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
}

/** Importe en bolivianos, formateado para leer. El texto no se convierte. */
export function importeBs(valor: string): string {
  const negativo = valor.trim().startsWith('-');
  const limpio = negativo ? valor.trim().slice(1) : valor.trim();
  const partes = limpio.split('.');
  const entero = (partes[0] ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${negativo ? '−' : ''}Bs ${entero},${(partes[1] ?? '00').padEnd(2, '0').slice(0, 2)}`;
}

/** Si un decimal como texto vale cero. Se mira el número, no la cadena. */
export function esCero(valor: string): boolean {
  const n = Number(valor);
  return !Number.isFinite(n) || Math.abs(n) < 0.005;
}

/** Si un decimal como texto es negativo. */
export function esNegativo(valor: string): boolean {
  const n = Number(valor);
  return Number.isFinite(n) && n < -0.005;
}

/**
 * Cuántos días faltan para una fecha (`YYYY-MM-DD`). Negativo = ya pasó.
 *
 * La API recorta `overdueDays` a cero para lo que todavía no venció, así que
 * el «vence en 8 días» no puede salir de ahí: se calcula con la fecha, que sí
 * viaja entera.
 */
export function diasHasta(fechaIso: string, hoy: Date): number {
  const partes = fechaIso.split('-').map(Number);
  const [anio, mes, dia] = partes;
  if (anio === undefined || mes === undefined || dia === undefined) return 0;
  const objetivo = new Date(anio, mes - 1, dia);
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((objetivo.getTime() - base.getTime()) / 86_400_000);
}

export interface KeyValueRow {
  readonly label: string;
  /** `null` o vacío se dice «Sin dato»: una ficha no esconde lo que falta. */
  readonly value: string | null;
  /** Tipografía de código, para nombres técnicos y rutas. */
  readonly mono?: boolean;
  /** Muestra un botón para copiar el valor. */
  readonly copyable?: boolean;
}

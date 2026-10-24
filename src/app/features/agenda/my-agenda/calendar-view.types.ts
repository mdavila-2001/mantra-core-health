/** Un estado del catálogo, ya resuelto: su código y cómo se lee. */
export interface EstadoResuelto {
  readonly code: string;
  readonly display: string;
}

/** Un bloqueo declarado por el profesional, ya resuelto para el calendario. */
export interface BloqueoDelMes {
  /** El id de la excepción, para poder quitarla desde el día. */
  readonly id?: string;
  readonly desde: Date;
  readonly hasta: Date;
  /** Por qué, si se declaró. Es lo que distingue «bloqueado» de «sin agenda». */
  readonly motivo: string | null;
}

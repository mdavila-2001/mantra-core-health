/* ============================================================================
    Contratos del `app-date-picker` — sistema REDSAT v1.0.
    ========================================================================== */

export const DATE_PICKER_MODES = ['date-only', 'date-time'] as const;
export type DatePickerMode = (typeof DATE_PICKER_MODES)[number];

/** Una celda del calendario. La arma el componente; se expone para las pruebas. */
export interface CalendarDay {
  readonly date: Date;
  readonly dayNumber: number;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
}

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * Pestaña «Reporte contable»: hoy **no existe** en la API un catálogo de reporte
 * contable por tipo de usuario que se pueda editar (contrato H3 §4), y la
 * pantalla lo dice en vez de simularlo. Ningún control de esta pestaña habla con
 * la API ni guarda nada.
 *
 * Lo que sí existe es el plan de cuentas de cada práctica, que alimenta el
 * balance y el mayor; editarlo toca la integridad del libro y no es una edición
 * de catálogo. Definir qué es «el reporte contable por tipo de usuario» es una
 * decisión de negocio pendiente (`DECISION_REQUIRED`), no un faltante técnico.
 */
@Component({
  selector: 'app-catalog-accounting-tab',
  imports: [Alert],
  templateUrl: './accounting-tab.html',
  styleUrl: '../catalog-editor-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingTab {}

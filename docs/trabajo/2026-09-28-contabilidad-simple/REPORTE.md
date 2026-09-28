# Contabilidad simple del doctor — 28/09/2026

Rama `claude/formulario-libre-deslizable-bug-ko5n7y`, sobre `dev`, a continuación del mercado de
seguros.

## Pedido

- Que el doctor vea **cuántos pacientes atendió, cuánto dinero hizo y cuánto espera recibir de
  las aseguradoras**, estos dos últimos como dos números separados.
- El flujo, simple y con CRUD del doctor: **gasto → tipo, activo → tipo, deuda → tipo,
  transacción debe/haber**. Nada de centros de costo.
- **Cuentas con modal y tabla**, con cuentas generales sembradas y la posibilidad de crear
  cuentas ahí mismo.
- «Lo demás está bien»: no se tocó el resto de Contabilidad.

## Qué se hizo

- Arriba de «Contabilidad» (`/administration/accounting`), la sección `ContabilidadSimple`:
  - **Tres números**, con «Este mes / Este año»: pacientes atendidos (y en cuántas consultas),
    cobraste y esperás de las aseguradoras (a hoy, con cuántas solicitudes pendientes).
  - **Una tarjeta con cinco pestañas** (regla 6): Gastos · Activos · Deudas · Transacciones ·
    Cuentas. En cada una, la misma `app-data-table` con «Editar» y «Borrar» por fila y el mismo
    `app-content-dialog` para crear y editar. Borrar pide confirmación.
- **El tipo es una cuenta de la clase que corresponde.** En el modal de gasto, activo o deuda,
  «Nueva cuenta» abre el modal de cuenta con la clase fija, y la cuenta creada queda elegida.
- **26 cuentas generales sembradas**: caja, banco, por cobrar a aseguradoras, equipo médico…;
  préstamo, proveedores, tarjeta…; capital; honorarios, pagos de aseguradoras…; alquiler,
  sueldos, insumos, servicios básicos, mantenimiento, impuestos, seguros y colegiatura,
  publicidad, otros. Se renombran, no se borran. Las propias se borran si nada las usa.
- Montos escritos como en Bolivia (`1.250,50`), normalizados a cadena decimal.
- Contrato **P47** en `PENDIENTES-BACKEND.md`; simulador con persistencia en `sessionStorage`.
  Los tres números salen de los mismos datos que la agenda, las consultas pagadas de los
  libros y las solicitudes a aseguradoras.

## Verificación ejecutada

- `ng test`: contabilidad, simulador de contabilidad simple, finanzas y seguros: 133 pruebas,
  132 pasan. La que falla, «pide el estado de resultados SEIS veces» del resumen, **ya fallaba
  en `dev`** con el mismo 5 contra 6 (medido con los cambios apartados). Nuevas:
  `simple-accounting.handlers.spec.ts` (7) y `registros.formato.spec.ts` (4).
  El spec del resumen recibe un `SimpleAccountingClient` sin red, para que siga contando sólo
  los pedidos del resumen.
- En una corrida combinada falló una vez «con las primas de fábrica, el loss ratio ya viene
  calculado» (seguros); en las dos corridas siguientes, sola y combinada, pasó. Queda anotado
  como dependiente del orden, no resuelto.
- `tsc` de la app y de Playwright, ESLint de lo tocado y `check-*-prefixes`: limpios.
- Playwright con el simulador, `contabilidad-simple.spec.ts` 1/1: los tres números; gasto con
  un tipo creado ahí mismo, editado y borrado; activo; deuda; transacción debe/haber; cuenta
  propia creada y borrada; una general sin «Borrar»; **tras recargar, el gasto y la transacción
  siguen**. Fotos en `evidencia/`, inspeccionadas una por una.
- El simulador se encendió sólo en local (`mockBackend: true`), **no** va en el commit.

## No verificado

- Contra la API real: P47 no existe todavía.
- La suite completa (`yarn test`) y el lint global.
- Revisión independiente (`NO_SELF_APPROVAL`).

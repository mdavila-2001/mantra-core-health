# Decisiones, límites y ambigüedades — plan Médico

- **R-001 — alcance de esta ejecución:** la petición es ejecutar el plan Médico completo. Las instrucciones vigentes del workspace acotan cambios de producto a presentación visual en frontend, rama `mockup`, y excluyen API/modelo, `.env` y `proxy.conf.json`. Se ejecutaron auditoría, trazabilidad y verificaciones permitidas; no se infirió autorización para ampliar ese límite a cambios funcionales o de backend.
- **R-002 — dueño de Paciente:** el plan PAC pertenece a otro trabajo. Este plan cubre recepción y contratos compartidos desde Médico. No duplicar alta general, activación, perfil ni archivos del paciente.
- **R-003 — trabajo previo de perfil médico:** `justin/perfil-medico-correcciones` está contenido en `mockup`; su punta es ancestro de la base `b7785e362a7ccfbbd0665b1863eab92b65ea4137`. No se trasplantaron cambios duplicados; los comportamientos se vuelven a probar.
- **R-004 — anotaciones antiguas:** “COMPLETO/INCOMPLETO/FALTA” se conserva como texto histórico, no como evidencia. Las filas y escenarios sólo se cierran con aceptación y DoD actuales.
- **R-005 — integración local:** la API en `localhost:3005` no estaba saludable, Docker daemon/socket no existía y el route-health E2E se detuvo antes del login. No se creó una base ni se sembraron datos.
- **R-006 — denominador:** se conservan 100 criterios fuente descompuestos; 98 incluidos, 2 ramas de cobro integrado/QR fuera. Ningún criterio se cuenta por duplicado con su encabezado/padre. 0/98 alcanza el DoD; ese porcentaje no describe la funcionalidad existente.
- **R-007 — CORR-08 es evidencia visual parcial, no cierre médico:** se usa la ficha TAREA-38 existente, sin mapear un número de carril a un hito por inferencia. El perfil con pestañas ya estaba en la base; el PR #612 elimina el switch de certificación que persistía en el diálogo y verifica que el PATCH no sobrescriba ese dato. MT-38-01 y el DoD end-to-end siguen pendientes, y ningún criterio de MATRIX cambia de estado.

## Bloqueos y decisiones externas sin resolver

- Catálogo SEGIP auténtico y autorización/versión de sus ocupaciones; no inventar que el catálogo local equivale al oficial.
- Reglas por profesión para rótulo y autoridad de matrícula/colegio; confirmar catálogos y semántica antes de modificar presentación.
- Identificación y asignación de hospitales públicos, sede y horario; no inferir que cualquier sede es pública.
- Destinatarios y momento de avisos por demora/cupo liberado; “quienes buscaron ese día” requiere una definición y un contrato de datos.
- Interpretación aprobada del canal “TOUS”, sus destinatarios, persistencia, reintentos y entrega con la app cerrada.
- Proveedor real de sala virtual y comportamiento de enlaces, expiración y finalización.
- Recetas con indicaciones ambiguas/a demanda: no inferir frecuencia ni programar alarmas sin datos explícitos.
- Cobertura/coaseguro por prestación y póliza; no inventar importes, reglas o vigencias.
- Emisor, permisos del médico, destinatario fiscal y canal de entrega de factura/comprobante.
- Calendario, requisitos y propietario de lotes de aseguradora; no definir semana/quincena/mes unilateralmente.
- Sustituto verificable de “pagado” mientras no exista pasarela autorizada. No simular pagos, recibos ni puntos/comisiones por una acción de compra.

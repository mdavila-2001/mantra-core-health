# Regresión del front — C-01 (2026-10-23)

Suite completa por lotes (la corrida única muere por memoria, exit 129):
```text
core     → 3 failed | 3022 passed (3025): faker.spec (datos de pacientes del simulador), navigation.subgroups.spec (psychological-help sin bloque), pdf-logo.spec (sólo en lote; aislado pasa) — ninguno tocado por C-01
shared   → 1883 passed (1883)
features [a…] por carpeta (corrida cortada al cerrar el turno, auth y auth-providers sin correr):
  account → 1 failed | 1480 passed (doctor-profile-tabs.spec; account/ no tiene cambios de C-01, sin línea de base corrida)
  accounting → 80 passed (80)   ← incluye la pestaña nueva «Pagos por sesión»
  admin → 2 failed | 399 passed (patient-list.spec; admin/ no tiene cambios de C-01, sin línea de base corrida)
  agenda → 558 passed · alovida → 147 passed
features [b] → 1 failed | 58 passed (billing.spec «la puerta por omisión», rojo también en HEAD)
features [c] → 565 passed (565)   ← incluye consultation y payments-block
features [d-l] → Tests 105 failed | 906 passed (1011)
features [m-p] → Tests 29 failed | 855 passed (884)
features [q-z] → Tests 363 passed (363)
```

Línea de base: los 14 specs rojos de features se corrieron en HEAD (146cba8f0) SIN los cambios de C-01 (git stash -u):
```text
BASELINE → Tests 129 failed | 147 passed (276) · 12 de los 14 specs también rojos en la base
Rojos sólo con C-01: dashboard.spec, visitor-visits.spec → aislados: Test Files 2 passed (2) · Tests 25 passed (25) (contaminación de TestBed en lote, no regresión)
```

Specs dirigidos de C-01 (billing, payments-block, accounting/summary, data-access/billing, handlers): 140 passed; el único rojo es billing.spec «la puerta por omisión», rojo también en HEAD.

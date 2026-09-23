# Panel · «Lo que toca hoy» (19/09/2026)

El propietario mandó sacar del inicio de sesión del médico los cuatro bloques
de sistema —«Tu cuenta», «Directorio público», «Secciones disponibles» y
«Organizaciones»— y poner en su lugar qué toca hoy, con salida a la agenda
completa.

Esta carpeta es la prueba de navegador de que eso quedó hecho. La levanta
`playwright/panel-hoy.spec.ts` contra el backend simulado:

```bash
yarn start &
E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/panel-hoy.spec.ts
```

| Captura | Qué muestra |
|---|---|
| `panel-390.png` | Teléfono. La franja apilada: botón a lo ancho, cinta, leyenda, «Ahora» y la lista. |
| `panel-768.png` | Tablet vertical. La cita destacada ya reparte hora / paciente / sello en tres columnas. |
| `panel-1024.png` | Tablet horizontal. |
| `panel-1440.png` | Escritorio. El ancho de referencia del sistema. |
| `panel-1920.png` | Escritorio grande. La franja no se estira más allá del área de contenido. |
| `panel-1440-oscuro.png` | El mismo panel en tema oscuro: los tonos de la cinta y la banda ámbar de «en curso» salen de los tokens, no de valores fijos. |
| `panel-admin-1440.png` | Una cuenta **sin perfil profesional**: no se le dibuja jornada —no tiene— y su panel sigue entero, con accesos y últimos pacientes. |

Lo que las capturas acompañan, y que las aserciones del spec son las que
realmente fijan:

- ninguno de los cuatro bloques retirados aparece, ni por texto ni por
  `data-testid`;
- la cinta trae tramos y el resumen trae cifras — no una franja vacía con
  título;
- «Ver agenda completa» lleva a `/schedule`;
- no hay desborde horizontal en ninguno de los cinco anchos ni en oscuro;
- la pantalla no deja errores en consola ni peticiones en 4xx/5xx.

La franja se alimenta del simulador: la médica de prueba atiende los siete días
(mañanas en la clínica de lunes a sábado, guardia corta el domingo), así que la
maqueta tiene jornada cualquier día en que se la abra.

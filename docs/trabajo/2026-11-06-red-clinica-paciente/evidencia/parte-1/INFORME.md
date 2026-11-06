# Parte 1 — hallazgos HIGH de la segunda revisión

Capturas y aserciones: `captura-parte-1.cjs` (salida en `aserciones.txt`, 20 ok, 0 fallas).
Corrió contra una compilación `development,demo` servida estática (`ng serve` moría por
memoria con otros cinco agentes en la misma máquina). La compilación salió del árbol de
trabajo con los commits de esta parte y **con cambios sin commitear de otros agentes**:
no es exactamente un HEAD limpio.

## 1. Nombres de episodio cortados

- Causa: `flex: 0 1 auto` dejaba al nombre absorber una fracción del recorte; con
  `text-overflow: ellipsis`, medio píxel ya come letras. Ahora `flex: 0 0 auto` con tope
  `min(100%, 36ch)`; ceden los conteos.
- Medida (Range vs caja del span, sin tolerancia) a 768 y 1440, claro y oscuro, sin y con
  panel: «Hipotiroidismo» 95,89 / 95,89 px, ningún nombre cortado
  (`medica-*-1-sin-panel.png`, `medica-*-2-con-panel.png`).
- A 768 el panel es una hoja que tapa el lienzo: la medida con panel se toma debajo de ella;
  la captura muestra el panel, no los nombres.
- La aserción de la tanda 3 (`scrollWidth > clientWidth + 1`) se cambió a la misma medida.

## 2. Acordeones anidados

- La flecha gira con el `aria-expanded` del propio disparador.
- Paciente 1440, claro y oscuro: 12 disparadores, 4 hijos plegados dentro de un padre
  abierto, 0 discrepancias flecha/estado (`paciente-1440-*-1-hilo-anidado.png`).

## 3. Ciclos

`check-architecture`: 8 → 3 ciclos (los mismos tres que existían antes de esta red).

## 4. Portada del paciente

`paciente-1440-*-0-portada.png`: portada, síntomas y próxima cita visibles.

## No verificado

- No se corrió la puerta (`pre-push-gate`): la corre el integrador.
- El resto de anchos (390, 1024, 1920) no se recapturó en esta parte.
- Sin revisión independiente: quien implementó no aprueba.

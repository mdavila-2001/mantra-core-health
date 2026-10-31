"""Genera el atlas de pantallas (markdown) a partir de las salidas del recorrido."""
import json, os, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
DEST = sys.argv[1]

CUENTAS = [
    ('anon', 'Visitante sin sesión', '—'),
    ('paciente', 'Paciente — Ana Lucía Pérez Quiroga', 'paciente@alovida.mock'),
    ('medica', 'Médica — Dra. Valeria Rojas Mendoza (cardióloga, dos organizaciones)', 'medica@alovida.mock'),
    ('medico.nuevo', 'Médico recién registrado', 'medico.nuevo@alovida.mock'),
    ('farmacia', 'Farmacia — encargada de Farmacia Vida (PHARMACY_STAFF)', 'farmacia@alovida.mock'),
    ('laboratorio', 'Laboratorio clínico', 'laboratorio@alovida.mock'),
    ('aseguradora', 'Aseguradora (administración)', 'aseguradora@alovida.mock'),
    ('aseguradora.staff', 'Aseguradora (personal)', 'aseguradora.staff@alovida.mock'),
    ('visitador', 'Visitador médico — Laboratorios Inti', 'visitador@alovida.mock'),
    ('aprobador', 'Aprobador de admisiones', 'aprobador@alovida.mock'),
    ('admin', 'Administración (todos los roles administrativos)', 'admin@alovida.mock'),
    ('superadmin', 'Superadministración (entra a todo)', 'superadmin@alovida.mock'),
]

UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')


def resumen(r):
    h1 = (r['h1'] or [''])[0]
    lineas = [l.strip() for l in r['texto'].split('\n') if l.strip()]
    # se saltea la miga de pan y el propio título
    cuerpo = [l for l in lineas if l not in ('Panel', '/', h1) and len(l) > 25]
    txt = (cuerpo[0] if cuerpo else '')[:170]
    return txt.replace('|', '/')


def estado(r):
    if r['redirigida']:
        return f"redirige a `{UUID.sub(':id', r['final'].split('?')[0])}`"
    marcas = []
    if r['pantallaError']:
        marcas.append('⚠ muestra error')
    if r['excepciones']:
        marcas.append('⚠ excepción JS')
    if r['huecos']:
        marcas.append('⚠ simulador 501')
    if r['consola']:
        marcas.append('consola')
    if r['desborde']:
        marcas.append('desborde')
    return ', '.join(marcas) or 'ok'


out = ['# Atlas de pantallas de AloVida, por rol', '',
       '> Generado por `herramientas/atlas.py` desde el recorrido automático del 2026-10-31 contra el',
       '> **simulador** (`yarn start:demo`, datos sintéticos, ninguna petición sale a la red).',
       '> Una fila = una pantalla visitada por esa cuenta. «Resumen» es la primera frase útil que pinta.',
       '> Los identificadores se muestran como `:id`. Para el detalle de los problemas ver `hallazgos.md`.', '']

for clave, nombre, correo in CUENTAS:
    ruta = os.path.join(BASE, 'out', clave, 'filas.json')
    if not os.path.exists(ruta):
        continue
    filas = json.load(open(ruta))
    menu = json.load(open(os.path.join(BASE, 'out', clave, 'menu.json')))
    vistos, items = set(), []
    for m in menu:
        k = (m['txt'], m['href'])
        if k in vistos:
            continue
        vistos.add(k)
        items.append(f"{m['txt'] or '(icono)'} → `{m['href']}`")
    out += [f'## {nombre}', '', f'Cuenta: `{correo}` · pantallas visitadas: {len(filas)}', '',
            '**Menú que ve:** ' + ' · '.join(items), '',
            '| Ruta | Título (h1) | Resumen | Estado |', '|---|---|---|---|']
    for r in filas:
        if clave == 'anon' and r['redirigida'] and r['final'].startswith('/auth'):
            continue  # el anónimo rebota al login en todo lo privado: se resume abajo
        h1 = ((r['h1'] or [''])[0])[:60].replace('|', '/')
        out.append(f"| `{UUID.sub(':id', r['ruta'])}` | {h1} | {resumen(r)} | {estado(r)} |")
    if clave == 'anon':
        n = sum(1 for r in filas if r['redirigida'] and r['final'].startswith('/auth'))
        out += ['', f'Además, {n} rutas privadas rebotan correctamente al login (`/auth`).']
    out.append('')

open(DEST, 'w').write('\n'.join(out))
print('escrito', DEST, len(out), 'líneas')

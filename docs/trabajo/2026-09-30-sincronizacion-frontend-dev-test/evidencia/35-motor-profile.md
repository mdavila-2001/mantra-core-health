# H2.S2.M21 — Perfil ligero del motor de síntomas

Fecha: 2026-09-30. Estado: **WRITTEN; medición Node observada, pendiente runner Angular y cobertura completa**.

## Alcance y referencia

Se modificó únicamente `src/app/features/symptom-check/motor.ts`. La optimización reutiliza, dentro de una llamada de análisis, las coincidencias entre un lema de patrón y los tokens de entrada. Los patrones que comparten ese lema consultan el mismo resultado. El mapa se descarta al terminar el análisis y no agrega retención de entradas entre consultas.

La referencia comparada fue `HEAD`, comprobado como `4247bb0a211bf53e0c3d3291ccbee5ba1817d0dc`. El comando de comparación cargó el motor anterior con `git show HEAD:src/app/features/symptom-check/motor.ts` y el candidato desde el archivo de trabajo. Ambos usaron las mismas dependencias y fixtures locales. El diff del motor al medir tenía 21 inserciones y 6 eliminaciones; `texto.ts`, `sintomas.ts`, el corpus y sus pruebas no se editaron.

Comprobaciones de referencia posteriores a la medición, transcritas de la salida observada:

```powershell
git rev-parse HEAD
git rev-parse 4247bb0a:src/app/features/symptom-check/motor.ts HEAD:src/app/features/symptom-check/motor.ts
```

```text
4247bb0a211bf53e0c3d3291ccbee5ba1817d0dc
75ce8981847a1eb5b891a434b77290d3b12f2659
75ce8981847a1eb5b891a434b77290d3b12f2659
```

## Método y resultados observados

Entorno: Node `v26.4.0`, Windows, directorio de trabajo `.worktrees/frontend-hito-2`. Se cargaron módulos TypeScript puros mediante `typescript.transpileModule` y CommonJS en memoria, sin emitir archivos, iniciar Angular ni usar cobertura.

La instrumentación cuenta las invocaciones de `parecido` y `distancia` en copias independientes de los módulos. Después se cargan copias sin instrumentación para medir cinco tandas de veinte entradas distintas, alternando referencia y candidato en el mismo proceso. Las variaciones de entrada evitan reutilizar el caché del último texto completo. Este número de tandas y repeticiones coincide con el test existente y no se aumentó.

Los 296 casos proceden de `corpus.fixture.ts`, datos sintéticos declarados. Además se compararon los análisis completos de esos casos, la frase sintética larga y todos sus prefijos: 461 entradas. La igualdad incluye el objeto completo, con síntomas, alarmas, negaciones, confianza, posiciones y evidencia. Sólo se imprimieron contadores y tiempos, nunca entradas clínicas reales.

| Medida | Referencia 4247bb0a | Candidato |
| --- | ---: | ---: |
| Comparaciones por reconocimiento instrumentado | 7038 | 2669 |
| Pares distintos de lema/token | 2512 | 2512 |
| Llamadas a distancia | 7447 | 2882 |
| Mejor tanda, ms por reconocimiento | 3.299 | 1.355 |
| Discrepancias contra los 296 resultados esperados | — | 0 |
| Diferencias entre 461 análisis completos | — | 0 |

La mejor tanda observada fue aproximadamente 2,43 veces más rápida. Esta cifra corresponde exclusivamente al perfil Node descrito.

**Procedencia de evidencia:** la ejecución original mostró estas salidas en la herramienta y no las redirigió a un archivo. Los bloques siguientes son una transcripción literal de esa salida observada, conservada ahora en este documento; no constituyen un log capturado contemporáneamente. El comando fue guardado en memoria durante la sesión y se reproduce abajo sin reemplazar `HEAD` por otro valor.

```text
{"baseline":{"comparisons":7038,"uniquePairs":2512,"distances":7447},"optimized":{"comparisons":2669,"uniquePairs":2512,"distances":2882}}
{"baselineMs":[4.569,3.463,3.311,3.427,3.299],"optimizedMs":[1.952,1.355,1.357,1.614,1.692],"corpusCases":296,"corpusMismatches":0,"fullAnalysesCompared":461,"fullAnalysisDifferences":0}
```

La herramienta devolvió `exit_code: 0`; duración del proceso indicada: `3.2698269` segundos.

## Comando ejecutado

Ejecutado en PowerShell con directorio de trabajo `.worktrees/frontend-hito-2`. La referencia `HEAD` era el SHA indicado arriba; para una repetición futura hay que conservar esa referencia o reemplazarla explícitamente por dicho SHA.

```powershell
@'

const fs=require('node:fs'), path=require('node:path'), ts=require('typescript');
const root=path.resolve('src/app/features/symptom-check');
const baselineMotor=require('node:child_process').execFileSync('git',['show','HEAD:src/app/features/symptom-check/motor.ts'],{encoding:'utf8'});
function loadModules(instrument=false, baseline=false){
 const loaded=new Map();
 const profile={comparisons:0, pairs:new Set(), lemmas:new Set(), distances:0};
 function load(name){
  const file=path.resolve(root,name.endsWith('.ts')?name:name+'.ts');
  if(loaded.has(file)) return loaded.get(file).exports;
  let source=baseline && path.basename(file)==='motor.ts' ? baselineMotor : fs.readFileSync(file,'utf8');
  if(instrument && path.basename(file)==='motor.ts'){
   source=source.replace(
    'function parecido(patron: string, claveDelPatron: string, token: Token): number {',
    'function parecido(patron: string, claveDelPatron: string, token: Token): number { profile.comparisons++; profile.lemmas.add(patron); profile.pairs.add(JSON.stringify([patron,token.lema,token.clave,token.claveCruda]));'
   );
  }
  const module={exports:{}};loaded.set(file,module);
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('module','exports','require','profile',output)(module,module.exports,n=>load(n),profile);
  if(instrument && path.basename(file)==='texto.ts'){
   const original=module.exports.distancia;
   module.exports.distancia=(...args)=>{profile.distances++;return original(...args);};
  }
  return module.exports;
 }
 return {symptoms:load('./sintomas'),motor:load('./motor'),corpus:load('./corpus.fixture').BANCO,profile};
}
const longText='me duele mucho la cabeza hace tres dias, tengo fiebre de 38.5, nauseas y no puedo dormir. '+'ademas me arde al orinar y se me hinchan los tobillos desde el lunes pasado';

function countOne(suite){
 suite.symptoms.reconocer(longText);
 suite.profile.comparisons=0;suite.profile.pairs.clear();suite.profile.lemmas.clear();suite.profile.distances=0;
 suite.symptoms.reconocer(longText+' 0-0');
 return {comparisons:suite.profile.comparisons,uniquePairs:suite.profile.pairs.size,distances:suite.profile.distances};
}
console.log(JSON.stringify({baseline:countOne(loadModules(true,true)),optimized:countOne(loadModules(true,false))}));
const baseline=loadModules(false,true), optimized=loadModules(false,false);
baseline.symptoms.reconocer(longText);optimized.symptoms.reconocer(longText);
const before=[], after=[];
for(let batch=0;batch<5;batch++){
 for(const [suite,samples] of [[baseline,before],[optimized,after]]){
  const start=performance.now();
  for(let i=0;i<20;i++)suite.symptoms.reconocer(longText+' '+batch+'-'+i);
  samples.push((performance.now()-start)/20);
 }
}
let corpusMismatches=0, fullAnalysisDifferences=0, checked=0;
const inputTexts=optimized.corpus.map(sample=>sample.texto);
inputTexts.push(longText);
for(let end=1;end<longText.length;end++) inputTexts.push(longText.slice(0,end));
for(const text of inputTexts){
 const left=baseline.motor.analizar(text,baseline.symptoms.TODOS_LOS_SINTOMAS);
 const right=optimized.motor.analizar(text,optimized.symptoms.TODOS_LOS_SINTOMAS);
 if(JSON.stringify(left)!==JSON.stringify(right))fullAnalysisDifferences++;
 checked++;
}
for(const sample of optimized.corpus){
 const actual=optimized.symptoms.reconocer(sample.texto).map(s=>s.id).sort().join(',');
 const alarms=optimized.symptoms.reconocerAlarmas(sample.texto).map(s=>s.id).sort().join(',');
 if(actual!==[...sample.sintomas].sort().join(',')||alarms!==[...(sample.alarmas??[])].sort().join(','))corpusMismatches++;
}
console.log(JSON.stringify({baselineMs:before.map(n=>Number(n.toFixed(3))),optimizedMs:after.map(n=>Number(n.toFixed(3))),corpusCases:optimized.corpus.length,corpusMismatches,fullAnalysesCompared:checked,fullAnalysisDifferences}));

'@ | node
```

## Límites y comprobaciones pendientes

- No se ejecutó Vitest, Angular, build ni cobertura desde esta subtarea. La carga con `transpileModule` no equivale a un typecheck.
- Los tiempos Node sin cobertura no demuestran que el test bajo cobertura completa entre en 16 ms. La corrida completa previa registró 21.20360000000219 ms y su resultado sigue siendo un fallo de esa revisión.
- El test `corpus.spec.ts` conserva su límite de 16 ms, cinco tandas y veinte vueltas. No se cambió ninguna aserción, timeout, reintento ni fixture.
- La comparación de 461 entradas respalda la equivalencia de esos casos; no prueba todas las entradas posibles.
- Pendiente del coordinador: suites `corpus`, `motor`, `sintomas` y `texto`, seguidas de cobertura completa. No se afirma cierre ni ausencia general de regresiones.

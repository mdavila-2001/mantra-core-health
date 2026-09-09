import re, json, os, collections
raiz='src'
HEX=re.compile(r'#[0-9a-fA-F]{3,8}\b')
PX=re.compile(r'(?<![-\w])(?:padding|margin|gap|border-radius|font-size|line-height|top|left|right|bottom|width|height)\s*:\s*[^;{}]*?\b(\d{2,})px')
TOKENDEF=os.path.normpath('src/styles/alovida.css')
hits=collections.defaultdict(list)
tot={'hex':0,'px':0}
for dp,_,fns in os.walk(raiz):
    for fn in fns:
        if not fn.endswith(('.css','.ts','.html')): continue
        if fn.endswith('.spec.ts'): continue
        p=os.path.join(dp,fn)
        if os.path.normpath(p)==TOKENDEF: continue
        try: t=open(p,encoding='utf-8').read()
        except Exception: continue
        h=[m.group(0) for m in HEX.finditer(t)]
        x=[m.group(0) for m in PX.finditer(t)]
        if h or x:
            hits[p]={'hex':len(h),'px':len(x),'ejemplos':(h[:3]+x[:3])}
            tot['hex']+=len(h); tot['px']+=len(x)
orden=sorted(hits.items(), key=lambda kv:-(kv[1]['hex']+kv[1]['px']))
print(f"archivos con valores literales: {len(hits)}")
print(f"  colores hex: {tot['hex']}   medidas px: {tot['px']}   total: {tot['hex']+tot['px']}")
print("\n  los 15 peores:")
for p,v in orden[:15]:
    print(f"   {v['hex']+v['px']:5}  {p.replace(os.sep,'/')}")
json.dump({'total':tot,'archivos':{k.replace(os.sep,'/'):v for k,v in orden}}, open(os.environ['CLAUDE_JOB_DIR']+'/tmp/literales.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)

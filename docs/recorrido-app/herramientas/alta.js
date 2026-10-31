const { chromium } = require('playwright');
const B='http://localhost:4200';
async function elegir(p,tid,o){const c=p.getByTestId(tid);await c.locator('.select-trigger').click();const d=c.locator('dialog.select-dialog[open]');await d.waitFor();
 await ('label' in o? d.getByRole('option',{name:o.label,exact:true}) : d.getByTestId(`select-opcion-${o.index-1}`)).click();}
async function cont(p){const b=p.getByTestId('paginated-form-continuar');await b.click();await p.waitForTimeout(700);}
(async()=>{const b=await chromium.launch();
 for (const [vp,w,h] of [['desktop',1440,900],['movil',390,844]]){
 const p=await b.newPage({viewport:{width:w,height:h},locale:'es-BO',timezoneId:'America/La_Paz'});const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150))});
 const s=async n=>p.screenshot({path:`out/alta/${vp}-${n}.jpg`,type:'jpeg',quality:60,fullPage:true});
 await p.goto(B+'/auth/register');await p.waitForTimeout(2500);await s('00-tipo-cuenta');
 console.log(vp,'tipos:',(await p.locator('main').innerText()).replace(/\n+/g,' | ').slice(0,700));
 await p.goto(B+'/auth/register/patient');await p.getByTestId('registro-form-paciente').waitFor();await s('01-identidad');
 await p.getByTestId('registro-nombre').fill('Prueba');await p.getByTestId('registro-apellido-paterno').fill('Sintetica');
 await p.getByTestId('registro-documento').fill('8'+String(Date.now()).slice(-6));await elegir(p,'registro-departamento-ci',{index:1});
 const f=p.getByPlaceholder('DD/MM/AAAA');await f.click();await p.keyboard.press('Control+A');await p.keyboard.press('Backspace');await f.pressSequentially('17051990',{delay:20});
 await elegir(p,'registro-genero',{label:'Femenino'});await cont(p);await p.waitForTimeout(1500);await s('02-residencia');
 const m=p.getByTestId('registro-mapa-domicilio');await m.locator('.leaflet-container').click();await p.getByTestId('registro-mapa-domicilio-localidad-ficha-municipio').waitFor({timeout:15000});
 await p.getByTestId('registro-confirmar-direccion').click();await s('02b-residencia-marcada');await cont(p);await s('03-contacto');
 await p.getByTestId('registro-telefono').fill('70012345');await p.getByTestId('registro-tutor-nombre').fill('Contacto Sintetico');await elegir(p,'registro-tutor-relacion',{index:2});
 await cont(p);await s('04-trabajo');await cont(p);await s('05-acceso');
 const email=`prueba.${vp}.${Date.now()}@correo.umsa.bo`;
 await p.getByTestId('registro-correo').fill(email);await p.getByTestId('registro-password').fill('Secreto123!');
 await cont(p);await p.waitForTimeout(2500);await s('06-resultado');
 console.log(vp,'resultado:',(await p.locator('main').innerText()).replace(/\n+/g,' | ').slice(0,500),'| errores',errs.slice(0,3));
 // intentar entrar con la cuenta nueva
 await p.goto(B+'/auth');await p.getByTestId('login-identifier').fill(email);await p.getByTestId('login-password').fill('Secreto123!');await p.getByTestId('login-submit').click();
 await p.waitForTimeout(4000);await s('07-login-nueva');console.log(vp,'login nueva ->',p.url(),(await p.locator('main, body').first().innerText()).replace(/\n+/g,' | ').slice(0,300));
 await p.close();}
 await b.close();})().catch(e=>{console.error('FALLO',e.message);process.exit(1)});

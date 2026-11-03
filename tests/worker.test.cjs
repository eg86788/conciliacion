const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const messages=[];
const context={TextDecoder,Blob,setTimeout,self:{postMessage:m=>{if(!m.progress)messages.push(m);}}};
vm.createContext(context);
for(const file of ['vendor/xlsx.full.min.js','src/core.js','src/worker.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
let sequence=0;
async function request(action,args={}){const id=++sequence;await context.self.onmessage({data:{id,action,...args}});const message=messages.find(m=>m.id===id);assert.ok(message,'Respuesta del worker');if(message.error)throw Error(message.error);return message.result;}
function jsonFile(text,chunkSize=17){const buffer=Buffer.from(text);return {name:'prueba.json',size:buffer.length,stream(){let offset=0;return {getReader(){return {async read(){if(offset>=buffer.length)return {done:true};const value=buffer.subarray(offset,offset+=chunkSize);return {done:false,value};},releaseLock(){}};}};}};}
const filter={q:'',from:'',to:'',status:'',currency:''};
async function run(){
 const MAX=800*1024*1024;
 await assert.rejects(request('open',{file:{name:'demasiado.json',size:MAX+1}}),/800 MB/);
 const fixture={producto:'SEP "Con Autelis" \\ prueba',metadata:{lista:[1,2,3]},movimientos:[{fecha:'2026-10-28',referencia:'00001',cliente:'José "Empresa" \\ ☀',importe:1250,estado:'Conciliado',moneda:'MXN',extra:{x:[1,{y:'] }'}]}},{fecha:'28/10/2026',referencia:'00002',cliente:'Otro',importe:20,estado:'Pendiente',moneda:'USD'}],nota:'cola válida'};
 for(const chunks of [1,7,65536]){
  await request('open',{file:jsonFile(JSON.stringify(fixture),chunks)});const setup=await request('prepare',{});const map=context.ReconCore.suggest(setup.headers);const summary=await request('commit',{map,currency:'MXN'});assert.equal(summary.count,2);
  const result=await request('query',{filter,page:1});assert.equal(result.count,2);assert.equal(result.totals.length,2);assert.equal(result.counts.applied,1);
  const detail=await request('detail',{rowId:1});assert.equal(detail.reference,'00001');assert.equal(detail.raw.find(([key])=>key==='cliente')[1],fixture.movimientos[0].cliente);
  const found=await request('query',{filter:{...filter,q:'jose'},page:1});assert.equal(found.count,1);
  const exportBlob=await request('export',{filter,meta:{producto:'SEP',variante:'Con Autelis'}});const exported=JSON.parse(await exportBlob.text());assert.equal(exported.movimientos.length,2);assert.equal(exported.variante,'Con Autelis');
 }
 for(const invalid of ['[{"x":1},]','[{"x":1}] basura','{"movimientos":[{"x":1}]','[null]','[]','{"movimientos":[{"x":1}],"movimientos":null}'])await assert.rejects(request('open',{file:jsonFile(invalid)}));
 const large=Array.from({length:50003},(_,i)=>({fecha:'2026-10-28',referencia:String(i).padStart(8,'0'),importe:i,estado:'Aplicado'}));
 await request('open',{file:jsonFile(JSON.stringify(large),65536)});const setup=await request('prepare',{});const summary=await request('commit',{map:context.ReconCore.suggest(setup.headers),currency:'MXN'});assert.equal(summary.count,50003);
 const last=await request('query',{filter,page:5001});assert.equal(last.items.length,3);assert.equal(last.items[2].reference,'00050002');assert.equal(last.count,50003);const beyond=await request('query',{filter,page:99999});assert.equal(beyond.page,5001);assert.equal(beyond.items.length,3);
 // XLSX y XLS multihoja: solo se prepara la hoja elegida y se conserva el folio.
 const X=context.XLSX,wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Título'],['Fecha','Referencia','Importe'],['2026-10-28','000123',12.5]]),'SEP');X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Fecha','Monto'],['2026-10-29',20]]),'Otra');
 for(const bookType of ['xlsx','biff8']){const bytes=X.write(wb,{bookType,type:'array'});const file={name:'prueba.'+(bookType==='xlsx'?'xlsx':'xls'),size:bytes.byteLength,arrayBuffer:async()=>bytes};const opened=await request('open',{file});assert.equal(opened.sheets.length,2);const setup=await request('prepare',{sheet:'SEP',headerRow:2});await request('commit',{map:context.ReconCore.suggest(setup.headers),currency:'MXN'});assert.equal((await request('query',{filter,page:1})).items[0].reference,'000123');}
 // Flujo JSON válido de exactamente 800 MiB, sin reservar un buffer de 800 MiB.
 // Solo hay una operación; el resto es espacio JSON permitido entre elementos.
 const row=Buffer.from('{"fecha":"2026-10-28","importe":800}');const padding=Buffer.alloc(1024*1024,32);let delivered=0;
 const bigFile={name:'800mb.json',size:MAX,stream(){let stage=0,remaining=MAX-row.length-2;return {getReader(){return {async read(){let value;if(stage===0){stage=1;value=Buffer.from('[');}else if(remaining>0){const length=Math.min(remaining,padding.length);remaining-=length;value=padding.subarray(0,length);}else if(stage===1){stage=2;value=row;}else if(stage===2){stage=3;value=Buffer.from(']');}else return {done:true};delivered+=value.length;return {done:false,value};},releaseLock(){}};}};}};
 await request('open',{file:bigFile});assert.equal(delivered,MAX);const bigSetup=await request('prepare',{});assert.equal(bigSetup.count,1);await request('commit',{map:context.ReconCore.suggest(bigSetup.headers),currency:'MXN'});assert.equal((await request('query',{filter,page:1})).items[0].amount,800);
 console.log('OK: worker, JSON por bloques (incluido flujo de 800 MiB), límite exacto, +50,000 movimientos, filtros, detalle, exportación, XLS/XLSX multihoja y JSON inválido.');
}
globalThis.testRun=run();
if(require.main===module)globalThis.testRun.catch(error=>{console.error(error);process.exitCode=1;});

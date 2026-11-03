/* Se ejecuta dentro de un Web Worker local; nunca accede a la red. */
'use strict';
const MAX_FILE_BYTES=800*1024*1024;
let sourceFile=null,kind='',workbook=null,jsonRows=null,headers=[],matrix=null,records=[],mapping=null,defaultCurrency='MXN',csv=null,csvHeader=0,dataProfile='',columnMap=null;
const scalar=v=>v&&typeof v==='object'?JSON.stringify(v):v??'';
function validateFile(file){if(!file||file.size>MAX_FILE_BYTES)throw Error('El archivo supera el límite de 800 MB (838,860,800 bytes).');if(!/\.(xlsx|xls|json|csv|zip)$/i.test(file.name))throw Error('Selecciona un archivo Excel, JSON, CSV o ZIP.');}
function progress(message,percent){self.postMessage({progress:true,message,percent});}
// Lee una lista JSON por bloques sin crear una cadena del tamaño de todo el archivo.
// Admite [...] y {"movimientos":[...]}; JSON.parse valida cada objeto y el envoltorio.
async function readJSON(file){
 const reader=file.stream().getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let prefix='',tail='',item='',started=false,finished=false,wrapped=false,inString=false,escaped=false,depth=0,expect='first',read=0,scanString=false,scanEscape=false,rootDepth=0,key='',lastString='',colonKey='',rootSeen=false;
 const rows=[];
 function consume(text){for(let i=0;i<text.length;i++){
  const c=text[i];
  if(!started){
   if(!rootSeen&&!/\s/.test(c)){rootSeen=true;if(c==='['){started=true;prefix='';continue;}if(c!=='{')throw Error('JSON: se espera una lista o un objeto con movimientos.');wrapped=true;}
   prefix+=c;if(prefix.length>1024*1024)throw Error('Los metadatos anteriores a movimientos exceden 1 MB. Usa una lista JSON directa.');
   if(scanString){if(c==='"'&&!scanEscape){scanString=false;lastString=JSON.parse('"'+key+'"');}else{key+=c;if(scanEscape)scanEscape=false;else if(c==='\\')scanEscape=true;}}
   else if(c==='"'){scanString=true;key='';}
   else if(c==='{')rootDepth++;
   else if(c==='}')rootDepth--;
   else if(c===':'&&rootDepth===1)colonKey=lastString;
   else if(c==='['){if(rootDepth===1&&colonKey==='movimientos'){started=true;prefix=prefix.slice(0,-1);continue;}rootDepth++;}
   else if(c===']')rootDepth--;
   else if(c===',')colonKey='';
   continue;
  }
  if(finished){tail+=c;if(tail.length>1024*1024)throw Error('Los metadatos posteriores a movimientos exceden 1 MB.');continue;}
  if(depth===0){
   if(/\s/.test(c))continue;
   if(c===']'&&(expect==='first'||expect==='separator')){finished=true;continue;}
   if(c===','&&expect==='separator'){expect='value';continue;}
   if(c==='{'&&(expect==='first'||expect==='value')){item='{';depth=1;inString=false;escaped=false;continue;}
   throw Error('La lista movimientos debe contener objetos JSON separados por comas.');
  }
  item+=c;
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;}
  else if(c==='"')inString=true;
  else if(c==='{'||c==='[')depth++;
  else if(c==='}'||c===']'){depth--;if(depth===0){const row=JSON.parse(item);rows.push(row);item='';expect='separator';}}
 }}
 try{while(true){const {done,value}=await reader.read();if(done)break;read+=value.byteLength;consume(decoder.decode(value,{stream:true}));progress('Leyendo JSON · '+rows.length.toLocaleString('es-MX')+' movimientos',Math.round(read/file.size*100));}consume(decoder.decode());}finally{reader.releaseLock();}
 if(!started||!finished)throw Error('JSON incompleto o sin lista movimientos.');
 const shell=JSON.parse(wrapped?prefix+'[]'+tail:'[]'+tail);if(wrapped&&!Array.isArray(shell.movimientos))throw Error('JSON sin una lista movimientos válida.');
 if(!rows.length)throw Error('El archivo no contiene movimientos.');return rows;
}
function getRaw(index){return kind==='csv'?csv.row(index+csvHeader+1):kind==='json'?headers.map(h=>scalar(jsonRows[index][h])):matrix[index];}
function original(index){const row=getRaw(index);return headers.map((h,j)=>[h,String(row[j]??'')]);}
async function open(file){
 validateFile(file);records=[];matrix=null;workbook=null;jsonRows=null;csv=null;dataProfile='';columnMap=null;
 if(/\.zip$/i.test(file.name)){progress('Abriendo ZIP local…',null);file=await ReconFiles.unzip(file);validateFile(file);}
 sourceFile=file;kind=/\.json$/i.test(file.name)?'json':/\.csv$/i.test(file.name)?'csv':'excel';
 if(kind==='csv'){csv=await new ReconFiles.CSVIndex().read(file,progress);headers=csv.row(0);dataProfile=ReconCore.profile(headers);return {kind,sheets:['Movimientos CSV'],fileName:file.name,profile:dataProfile,encoding:csv.encoding,warning:csv.warning};}
 if(kind==='json'){jsonRows=await readJSON(file);const keys=new Set();for(const row of jsonRows)for(const key of Object.keys(row))keys.add(key);headers=[...keys];return {kind,sheets:['Movimientos JSON']};}
 progress('Leyendo estructura del libro Excel…',null);
 const buffer=await file.arrayBuffer();workbook=XLSX.read(buffer,{type:'array',bookSheets:true,bookProps:true});
 if(!workbook.SheetNames.length)throw Error('El libro no contiene hojas.');return {kind,sheets:workbook.SheetNames};
}
async function prepare(sheet,headerRow){
 if(kind==='csv'){csvHeader=Number(headerRow)-1;if(!Number.isInteger(csvHeader)||csvHeader<0||csvHeader>=csv.count-1)throw Error('Elige una fila de encabezados con movimientos después.');headers=csv.row(csvHeader).map((v,i)=>String(v||'Columna '+(i+1)));dataProfile=ReconCore.profile(headers);return {headers,preview:Array.from({length:Math.min(3,csv.count-csvHeader-1)},(_,i)=>csv.row(csvHeader+1+i)),count:csv.count-csvHeader-1,profile:dataProfile,encoding:csv.encoding,warning:csv.warning};}
 if(kind==='json')return {headers,preview:jsonRows.slice(0,3).map(r=>headers.map(h=>scalar(r[h]))),count:jsonRows.length};
 progress('Preparando hoja '+sheet+'…',null);
 // Solo se decodifica la hoja seleccionada. No se truncan filas silenciosamente.
 const buffer=await sourceFile.arrayBuffer();const wb=XLSX.read(buffer,{type:'array',sheets:[sheet],dense:true,cellDates:false});
 const ws=wb.Sheets[sheet];if(!ws)throw Error('No se encontró la hoja seleccionada.');
 const h=Number(headerRow)-1,range=XLSX.utils.decode_range(ws['!ref']||'A1');if(!Number.isInteger(h)||h<0||h>range.e.r)throw Error('Elige una fila de encabezados existente.');
 const grid=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false,range:{s:{r:h,c:0},e:range.e}});
 headers=(grid.shift()||[]).map((v,i)=>String(v||'Columna '+(i+1)));matrix=grid;
 if(wb.Workbook?.WBProps?.date1904)workbook={date1904:true};else workbook={date1904:false};
 if(!matrix.length)throw Error('No hay movimientos después de la fila de encabezados.');return {headers,preview:matrix.slice(0,3),count:matrix.length};
}
async function commit(map,currency){
 mapping=map;defaultCurrency=currency;records=[];dataProfile=ReconCore.profile(headers);columnMap=dataProfile?ReconCore.bankFields(headers):null;const currencies=new Set(),statuses=new Set();let badDate=0,badAmount=0,excluded=csv?.excluded||0;const length=kind==='csv'?csv.count-csvHeader-1:kind==='json'?jsonRows.length:matrix.length;
 for(let i=0;i<length;i++){
  let raw=getRaw(i);if(kind==='excel'&&workbook.date1904&&typeof raw[map.date]==='number'){raw=raw.slice();raw[map.date]+=1462;}
  if(!raw.some(v=>v!==''&&v!=null))continue;if(kind==='csv'&&raw.length!==headers.length){excluded++;continue;}
  const record=ReconCore.normalizeOne(raw,map,headers,currency,false,columnMap);record.id=i+1;records.push(record);currencies.add(record.currency);statuses.add(record.rawStatus);if(!record.date)badDate++;if(record.amount===null)badAmount++;
  if(i%10000===0){progress('Preparando consulta · '+i.toLocaleString('es-MX')+' movimientos',Math.round(i/length*100));await new Promise(resolve=>setTimeout(resolve,0));}
 }
 if(!records.length)throw Error('No se encontraron movimientos completos.');sourceFile=null;return {count:records.length,currencies:[...currencies].sort(),rawStatuses:[...statuses].sort(),profile:dataProfile,excluded,warning:excluded?(excluded===1?'Se excluyó 1 fila incompleta. ':'Se excluyeron '+excluded.toLocaleString('es-MX')+' filas incompletas. ')+(csv?.excluded?'El archivo de origen termina truncado.':'Las filas con una cantidad de columnas distinta al encabezado se omitieron de la consulta.'):'',badDate,badAmount};
}
function matches(row,filter){return (!filter.from||row.date&&row.date>=filter.from)&&(!filter.to||row.date&&row.date<=filter.to)&&(!filter.status||(filter.status.startsWith('code:')?row.rawStatus===filter.status.slice(5):row.status===filter.status))&&(!filter.currency||row.currency===filter.currency)&&(!filter.clientId||row.clientId===filter.clientId)&&(!filter.account||row.account===filter.account)&&(!filter.q||ReconCore.clean(original(row.id-1).flat().join(' ')).includes(filter.q));}
function query(filter,page=1,pageSize=10){
 const totals=new Map(),counts={applied:0,pending:0,rejected:0,unknown:0,missing:0};let count=0;const items=[];const start=(page-1)*pageSize;let last=[];
 for(const row of records){if(!matches(row,filter))continue;if(row.amount!==null)totals.set(row.currency,(totals.get(row.currency)||0)+Math.round(row.amount*100));else counts.missing++;
  if(row.status==='Aplicado')counts.applied++;else if(row.status==='Pendiente')counts.pending++;else if(row.status==='Rechazado')counts.rejected++;else counts.unknown++;
  if(count>=start&&items.length<pageSize)items.push(row);if(count%pageSize===0)last=[];last.push(row);count++;
 }
 const pages=Math.max(1,Math.ceil(count/pageSize));return {count,counts,totals:[...totals],page:Math.min(page,pages),pages,items:page>pages?last:items};
}
function detail(id){const record=records.find(r=>r.id===id);return record?{...record,raw:original(id-1)}:null;}
function exportJSON(filter,meta){const parts=[JSON.stringify(meta).slice(0,-1)+',"movimientos":['];let first=true,chunk=[];for(const row of records){if(!matches(row,filter))continue;chunk.push((first?'':',')+JSON.stringify({fecha:row.date,referencia:row.reference,cliente:row.name,importe:row.amount,moneda:row.currency,estado:row.rawStatus,datosOriginales:original(row.id-1)}));first=false;if(chunk.length===500){parts.push(chunk.join(''));chunk=[];}}parts.push(chunk.join(''),']}');return new Blob(parts,{type:'application/json;charset=utf-8'});}
self.onmessage=async({data})=>{try{let result;switch(data.action){case 'open':result=await open(data.file);break;case 'prepare':result=await prepare(data.sheet,data.headerRow);break;case 'commit':result=await commit(data.map,data.currency);break;case 'query':result=query(data.filter,data.page);break;case 'detail':result=detail(data.rowId);break;case 'export':result=exportJSON(data.filter,data.meta);break;default:throw Error('Acción desconocida.');}self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:error.message+' Si el navegador agota la memoria, divide el archivo o usa JSON.'});}};

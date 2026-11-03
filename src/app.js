'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,c)=>{try{return new Intl.NumberFormat('es-MX',{style:'currency',currency:c}).format(n)+' '+c;}catch{return new Intl.NumberFormat('es-MX',{minimumFractionDigits:2}).format(n)+' '+c;}};
const dateLabel=s=>s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'Sin fecha válida';
const labels={date:'Fecha *',reference:'Referencia',name:'Cliente / Ordenante',amount:'Importe *',status:'Estado',currency:'Moneda'};
let products=[],selected=0,page=1,filtered=[],book=null,pendingFile='',headers=[],importToken=0,importing=false,importWorker=null,renderToken=0;
const pageSize=10;
const MAX_FILE_BYTES=800*1024*1024;
const catalog=['SEP - Servicio Electrónico de Pagos','SEP - Servicios de Efectivo','Cobranza Universal','Concentración de Fondos','Domiciliación'];
const current=(p=products[selected])=>p.variants[p.activeVariant||0];
const displayName=()=>products[selected].name+(products[selected].variants.length>1?' · '+current().variant:'');
function createLocalWorker(){
 if(typeof Worker==='undefined')throw Error('Este navegador no admite procesamiento en segundo plano. Abre el HTML en una versión reciente de Chrome, Edge o Firefox.');
 const url=URL.createObjectURL(new Blob([$('workerSource').textContent],{type:'text/javascript'}));let worker;try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
 const pending=new Map();let sequence=0;
 worker.onmessage=({data})=>{if(data.progress){if(worker===importWorker){$('importProgress').textContent=data.message;$('progressBar').value=data.percent??0;$('progressBar').classList.toggle('indeterminate',data.percent==null);}return;}const request=pending.get(data.id);if(!request)return;pending.delete(data.id);data.error?request.reject(Error(data.error)):request.resolve(data.result);};
 worker.onerror=e=>{for(const request of pending.values())request.reject(Error('No se pudo procesar el archivo en este navegador. Puede faltar memoria. '+(e.message||'')));pending.clear();};
 worker.request=(action,args={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,action,...args});});
 worker.dispose=()=>{worker.terminate();for(const request of pending.values())request.reject(Error('Carga cancelada.'));pending.clear();};return worker;
}
function makeDemo(){
 products.forEach(p=>p.variants.forEach(v=>v.worker?.dispose()));
 const names=['Comercial del Centro','Distribuidora Horizonte','Servicios del Bajío','Grupo Altavista','Insumos del Norte','Soluciones del Pacífico'];
 products=catalog.map((name,p)=>({name,activeVariant:0,variants:(p===0?['Sin Autelis','Con Autelis']:['Archivo de conciliación']).map((variant,v)=>({variant,source:'Datos ficticios de demostración',demo:true,rows:Array.from({length:27-p*3-v*2},(_,i)=>{const statuses=['Aplicado','Aplicado','Pendiente','Aplicado','Rechazado'];const row={id:i+1,date:'2026-10-'+String(28-i%24).padStart(2,'0'),reference:(p+1)+'024'+String(85300+i+v*100),name:names[(i+p)%names.length],amount:Math.round((1750+i*827.45+p*953+v*400)*100)/100,currency:'MXN',status:statuses[(i+p)%5],rawStatus:statuses[(i+p)%5]};row.raw=[['Fecha',row.date],['Referencia',row.reference],['Cliente',row.name],['Importe',String(row.amount)],['Moneda',row.currency],['Estado',row.status],['Convenio','DEMO-'+(700+p)]];return row;})}))})); selected=0;renderProducts();resetFilters();
}
function renderProducts(){
 $('products').innerHTML=products.map((p,i)=>{const d=current(p);return '<button class="product '+(i===selected?'active':'')+'" aria-pressed="'+(i===selected)+'" data-product="'+i+'"><span class="icon" aria-hidden="true">'+['▤','⇄','▦'][i%3]+'</span>'+(i===selected?'<span class="dot" aria-hidden="true">●</span>':'')+'<strong>'+escapeHTML(p.name)+'</strong><small>'+(d.count??d.rows.length).toLocaleString('es-MX')+' movimientos · '+(d.demo?'Ejemplo ficticio':'Archivo local')+(p.variants.length>1?'<br>Con y sin Autelis':'')+'</small></button>';}).join('');
 $('targetProduct').innerHTML=products.map((p,i)=>'<option value="'+i+'">'+escapeHTML(p.name)+'</option>').join('');$('targetProduct').value=selected;
 $('productTitle').textContent=products[selected].name;$('source').textContent=current().source;
 $('sourceVariant').innerHTML=products[selected].variants.map((v,i)=>'<option value="'+i+'">'+escapeHTML(v.variant)+'</option>').join('');$('sourceVariant').value=products[selected].activeVariant;$('sourceVariantField').classList.toggle('hidden',products[selected].variants.length===1);
 const currencies=current().currencies||[...new Set(current().rows.map(r=>r.currency))].sort();$('currency').innerHTML='<option value="">Todas</option>'+currencies.map(c=>'<option>'+escapeHTML(c)+'</option>').join('');updateTargetVariant();
}
function updateTargetVariant(){const p=products[Number($('targetProduct').value)];$('targetVariant').innerHTML=p.variants.map((v,i)=>'<option value="'+i+'">'+escapeHTML(v.variant)+'</option>').join('');$('targetVariant').value=p.activeVariant||0;$('targetVariantField').classList.toggle('hidden',p.variants.length===1);}
function resetFilters(){['search','from','to','status','currency'].forEach(id=>$(id).value='');page=1;render();}
function render(){
 const token=++renderToken;
 const q=ReconCore.clean($('search').value),from=$('from').value,to=$('to').value,state=$('status').value,currency=$('currency').value;
 const invalid=from&&to&&from>to;$('filterError').classList.toggle('hidden',!invalid);$('filterError').textContent=invalid?'La fecha inicial debe ser anterior o igual a la fecha final.':'';
 if(current().worker){renderRemote(token,invalid);return;}
 filtered=invalid?[]:current().rows.filter(r=>(!q||ReconCore.clean(r.raw.flat().join(' ')).includes(q))&&(!from||r.date&&r.date>=from)&&(!to||r.date&&r.date<=to)&&(!state||r.status===state)&&(!currency||r.currency===currency));
 const totals=new Map();filtered.forEach(r=>{if(r.amount!==null)totals.set(r.currency,(totals.get(r.currency)||0)+Math.round(r.amount*100));});
 $('total').textContent=totals.size===1?money([...totals.values()][0]/100,[...totals.keys()][0]):totals.size>1?'Varias monedas':'—';
 const missing=filtered.filter(r=>r.amount===null).length;$('totalFoot').textContent=(totals.size>1?[...totals].map(([c,n])=>money(n/100,c)).join(' · '):'Según los filtros seleccionados')+(missing?' · '+missing+' importes sin valor válido':'');
 $('applied').textContent=filtered.filter(r=>r.status==='Aplicado').length.toLocaleString('es-MX');$('pending').textContent=filtered.filter(r=>r.status==='Pendiente').length.toLocaleString('es-MX');$('count').textContent=filtered.length.toLocaleString('es-MX');
 $('rejected').textContent=filtered.filter(r=>r.status==='Rechazado').length+' rechazados · '+filtered.filter(r=>r.status==='Sin clasificar').length+' sin clasificar';
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);const start=(page-1)*pageSize;
 $('rows').innerHTML=filtered.slice(start,start+pageSize).map(r=>'<tr><td>'+dateLabel(r.date)+'</td><td class="ref">'+escapeHTML(r.reference||'Sin referencia')+'</td><td>'+escapeHTML(r.name||'No informado')+'</td><td class="money">'+escapeHTML(r.amount===null?'Importe no válido':money(r.amount,r.currency))+'</td><td><span class="badge '+r.status.toLowerCase().replace(' ','-')+'">'+r.status+'</span></td><td><button class="detailbtn" data-detail="'+r.id+'" aria-label="Ver detalle de '+escapeHTML(r.reference||r.id)+'">Ver detalle ↗</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">No hay movimientos para esta consulta. Cambia los filtros o carga un archivo para este producto.</td></tr>';
 $('pageInfo').textContent=filtered.length?'Mostrando '+(start+1)+'–'+Math.min(start+pageSize,filtered.length)+' de '+filtered.length+' movimientos':'0 movimientos';$('pageNumber').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('exportBtn').disabled=!filtered.length;
 const p=current();$('notice').textContent=p.demo?'DEMO · Todos los movimientos de este producto son ficticios. Carga un archivo para consultar tus operaciones.':'ARCHIVO LOCAL · '+p.source+' · Los estados provienen del archivo; el demo no realiza conciliación automática.';
}
const getFilter=()=>({q:ReconCore.clean($('search').value),from:$('from').value,to:$('to').value,status:$('status').value,currency:$('currency').value});
async function renderRemote(token,invalid){
 $('rows').innerHTML='<tr><td colspan="6" class="empty">Consultando movimientos…</td></tr>';$('prev').disabled=true;$('next').disabled=true;$('exportBtn').disabled=true;['total','applied','pending','count'].forEach(id=>$(id).textContent='…');$('pageInfo').textContent='Consulta en proceso';
 const p=current();try{const result=invalid?{count:0,counts:{applied:0,pending:0,rejected:0,unknown:0,missing:0},totals:[],page:1,pages:1,items:[]}:await p.worker.request('query',{filter:getFilter(),page});if(token!==renderToken)return;
 page=result.page;const {count,counts,totals,items,pages}=result;filtered=items;$('total').textContent=totals.length===1?money(totals[0][1]/100,totals[0][0]):totals.length?'Varias monedas':'—';$('totalFoot').textContent=(totals.length>1?totals.map(([c,n])=>money(n/100,c)).join(' · '):'Según los filtros seleccionados')+(counts.missing?' · '+counts.missing+' importes sin valor válido':'');$('applied').textContent=counts.applied.toLocaleString('es-MX');$('pending').textContent=counts.pending.toLocaleString('es-MX');$('count').textContent=count.toLocaleString('es-MX');$('rejected').textContent=counts.rejected+' rechazados · '+counts.unknown+' sin clasificar';
 $('rows').innerHTML=items.map(r=>'<tr><td>'+dateLabel(r.date)+'</td><td class="ref">'+escapeHTML(r.reference||'Sin referencia')+'</td><td>'+escapeHTML(r.name||'No informado')+'</td><td class="money">'+escapeHTML(r.amount===null?'Importe no válido':money(r.amount,r.currency))+'</td><td><span class="badge '+r.status.toLowerCase().replace(' ','-')+'">'+r.status+'</span></td><td><button class="detailbtn" data-detail="'+r.id+'">Ver detalle ↗</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">No hay movimientos para esta consulta.</td></tr>';
 const start=(page-1)*pageSize;$('pageInfo').textContent=count?'Mostrando '+(start+1)+'–'+Math.min(start+pageSize,count)+' de '+count.toLocaleString('es-MX')+' movimientos':'0 movimientos';$('pageNumber').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('exportBtn').disabled=!count;$('notice').textContent='ARCHIVO LOCAL · '+p.source+' · Los estados provienen del archivo.';
 }catch(e){if(token!==renderToken)return;$('notice').textContent='No se pudo completar la consulta: '+e.message;$('rows').innerHTML='<tr><td colspan="6" class="empty">No se pudo completar la consulta. Vuelve a cargar el archivo si el navegador agotó su memoria.</td></tr>';}
}
function showError(text){$('importError').textContent=text;$('importError').classList.remove('hidden');}
function clearError(){$('importError').classList.add('hidden');}
async function prepareGrid(){
 clearError();$('confirmImport').disabled=true;if(!importWorker||!book)return;
 const worker=importWorker,token=importToken;importing=true;$('file').disabled=true;$('sheet').disabled=true;$('headerRow').disabled=true;$('importProgressArea').classList.remove('hidden');
 try{const result=await worker.request('prepare',{sheet:$('sheet').value,headerRow:Number($('headerRow').value)});if(token!==importToken)return;headers=result.headers;
 const map=ReconCore.suggest(headers);$('mapping').innerHTML=Object.entries(labels).map(([key,label])=>'<div class="field"><label for="map-'+key+'">'+label+'</label><select id="map-'+key+'"><option value="-1">No disponible</option>'+headers.map((h,i)=>'<option value="'+i+'" '+(map[key]===i?'selected':'')+'>'+escapeHTML(h)+' (col. '+(i+1)+')</option>').join('')+'</select></div>').join('');
 $('preview').innerHTML='<table><thead><tr>'+headers.map(h=>'<th>'+escapeHTML(h)+'</th>').join('')+'</tr></thead><tbody>'+result.preview.map(r=>'<tr>'+headers.map((_,i)=>'<td>'+escapeHTML(r[i])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';$('importProgress').textContent=result.count.toLocaleString('es-MX')+' movimientos disponibles · Confirma las columnas';$('progressBar').value=100;$('confirmImport').disabled=false;
 }catch(e){if(token===importToken)showError(e.message);}finally{if(token===importToken){importing=false;$('file').disabled=false;$('sheet').disabled=book?.kind==='json';$('headerRow').disabled=book?.kind==='json';}}
}
async function loadFile(){
 if(importWorker){importWorker.dispose();importWorker=null;}
 const token=++importToken;book=null;$('importSetup').classList.add('hidden');$('confirmImport').disabled=true;clearError();const file=$('file').files[0];if(!file)return;
 if(file.size>MAX_FILE_BYTES){showError('El archivo supera el límite de 800 MB (838,860,800 bytes).');return;}
 importing=true;$('file').disabled=true;$('importProgressArea').classList.remove('hidden');$('importProgress').textContent='Preparando lectura local…';$('progressBar').value=0;
 try{pendingFile=file.name;importWorker=createLocalWorker();book=await importWorker.request('open',{file});if(token!==importToken)return;
 $('sheet').innerHTML=book.sheets.map(n=>'<option>'+escapeHTML(n)+'</option>').join('');$('sheet').disabled=book.kind==='json';$('headerRow').disabled=book.kind==='json';$('headerRow').value=1;$('importSetup').classList.remove('hidden');await prepareGrid();
 }catch(e){if(token===importToken){book=null;showError('No se pudo leer el archivo. '+e.message);}}
 finally{if(token===importToken){importing=false;$('file').disabled=false;}}
}
async function commitImport(){
 clearError();if(!book||importing||!importWorker)return;
 const map=Object.fromEntries(Object.keys(labels).map(k=>[k,Number($('map-'+k).value)]));
 if(map.date<0||map.amount<0){showError('Selecciona las columnas de fecha e importe para continuar.');return;}
 const columns=Object.values(map).filter(v=>v>=0);if(new Set(columns).size!==columns.length){showError('Cada campo debe usar una columna diferente.');return;}
 const target=Number($('targetProduct').value),variant=Number($('targetVariant').value),token=importToken,worker=importWorker;
 importing=true;$('confirmImport').disabled=true;
 try{const result=await worker.request('commit',{map,currency:$('defaultCurrency').value});if(token!==importToken)return;
 const p=products[target],old=p.variants[variant];old.worker?.dispose();
 p.variants[variant]={variant:old.variant,worker,rows:[],count:result.count,currencies:result.currencies,demo:false,source:pendingFile+' · '+$('sheet').value+(result.badDate||result.badAmount?' · Revisar: '+result.badDate+' fechas y '+result.badAmount+' importes sin valor válido':'')};p.activeVariant=variant;selected=target;importWorker=null;$('importDialog').close();renderProducts();resetFilters();
 }catch(e){if(token===importToken){showError(e.message);$('confirmImport').disabled=false;}}
 finally{if(token===importToken)importing=false;}
}
async function detail(id){
 const p=current(),name=displayName(),token=renderToken;
 try{const row=p.worker?await p.worker.request('detail',{rowId:id}):p.rows.find(r=>r.id===id);if(!row||token!==renderToken)return;$('detailSubtitle').textContent=name+' · '+(row.reference||'Sin referencia');$('detailFields').innerHTML=row.raw.map(([k,v])=>'<div><small>'+escapeHTML(k)+'</small>'+escapeHTML(v||'—')+'</div>').join('');$('detailDialog').showModal();}catch(e){$('notice').textContent=e.message;}
}
async function download(){
 const p=current(),name=displayName();$('exportBtn').disabled=true;
 try{const meta={producto:products[selected].name,variante:p.variant,origen:p.source,datosFicticios:p.demo};
 const blob=p.worker?await p.worker.request('export',{filter:getFilter(),meta}):new Blob([JSON.stringify({...meta,movimientos:filtered.map(r=>({fecha:r.date,referencia:r.reference,cliente:r.name,importe:r.amount,moneda:r.currency,estado:r.rawStatus,datosOriginales:r.raw}))},null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cobranza-'+ReconCore.clean(name)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){$('notice').textContent='No se pudo exportar: '+e.message;}finally{$('exportBtn').disabled=false;}
}
$('products').addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b){selected=Number(b.dataset.product);renderProducts();resetFilters();}});
$('rows').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)detail(Number(b.dataset.detail));});
['search','from','to','status','currency'].forEach(id=>$(id).addEventListener('input',()=>{page=1;render();}));
$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};$('clearFilters').onclick=resetFilters;
$('sourceVariant').onchange=()=>{products[selected].activeVariant=Number($('sourceVariant').value);renderProducts();resetFilters();};$('targetProduct').onchange=updateTargetVariant;
$('openImport').onclick=()=>{if(importing)return;importToken++;book=null;$('file').value='';$('targetProduct').value=selected;updateTargetVariant();$('importSetup').classList.add('hidden');$('importProgressArea').classList.add('hidden');$('confirmImport').disabled=true;clearError();$('importDialog').showModal();};
$('cancelImport').onclick=()=>{$('importDialog').close();};$('importDialog').addEventListener('close',()=>{importToken++;book=null;importing=false;$('file').disabled=false;if(importWorker){importWorker.dispose();importWorker=null;}});$('file').onchange=loadFile;$('sheet').onchange=prepareGrid;$('headerRow').onchange=prepareGrid;$('confirmImport').onclick=commitImport;
$('exportBtn').onclick=download;$('closeDetail').onclick=()=>$('detailDialog').close();$('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('resetDemo').onclick=()=>{if(confirm('¿Restablecer los ejemplos ficticios y descartar todos los archivos cargados?')){makeDemo();$('helpDialog').close();}};
makeDemo();

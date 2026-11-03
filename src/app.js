'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,c)=>{try{return new Intl.NumberFormat('es-MX',{style:'currency',currency:c}).format(n)+' '+c;}catch{return new Intl.NumberFormat('es-MX',{minimumFractionDigits:2}).format(n)+' '+c;}};
const dateLabel=s=>s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'Sin fecha válida';
const labels={date:'Fecha *',reference:'Referencia',name:'Cliente / Ordenante',amount:'Importe *',status:'Estado',currency:'Moneda'};
let products=[],selected=0,page=1,filtered=[],book=null,pendingFile='',grid=[],headers=[],dataRows=[],importToken=0,importing=false;
const pageSize=10;
function makeDemo(){
 const names=['Comercial del Centro','Distribuidora Horizonte','Servicios del Bajío','Grupo Altavista','Insumos del Norte','Soluciones del Pacífico'];
 products=['Cobranza referenciada','Domiciliación','Cobranza por convenio'].map((name,p)=>({name,source:'Datos ficticios de demostración',demo:true,rows:Array.from({length:27-p*6},(_,i)=>{const statuses=['Aplicado','Aplicado','Pendiente','Aplicado','Rechazado'];const row={id:i+1,date:'2026-10-'+String(28-i%24).padStart(2,'0'),reference:(p+1)+'024'+String(85300+i),name:names[(i+p)%names.length],amount:Math.round((1750+i*827.45+p*953)*100)/100,currency:'MXN',status:statuses[(i+p)%5],rawStatus:statuses[(i+p)%5]};row.raw=[['Fecha',row.date],['Referencia',row.reference],['Cliente',row.name],['Importe',String(row.amount)],['Moneda',row.currency],['Estado',row.status],['Convenio','DEMO-'+(700+p)]];return row;})})); selected=0;renderProducts();resetFilters();
}
function renderProducts(){
 $('products').innerHTML=products.map((p,i)=>'<button class="product '+(i===selected?'active':'')+'" aria-pressed="'+(i===selected)+'" data-product="'+i+'"><span class="icon" aria-hidden="true">'+['▤','⇄','▦'][i%3]+'</span>'+(i===selected?'<span class="dot" aria-hidden="true">●</span>':'')+'<strong>'+escapeHTML(p.name)+'</strong><small>'+p.rows.length+' movimientos · '+(p.demo?'Ejemplo ficticio':'Archivo local')+'</small></button>').join('');
 $('targetProduct').innerHTML=products.map((p,i)=>'<option value="'+i+'">'+escapeHTML(p.name)+'</option>').join('');$('targetProduct').value=selected;
 $('productTitle').textContent=products[selected].name;$('source').textContent=products[selected].source;
 const currencies=[...new Set(products[selected].rows.map(r=>r.currency))].sort();$('currency').innerHTML='<option value="">Todas</option>'+currencies.map(c=>'<option>'+escapeHTML(c)+'</option>').join('');
}
function resetFilters(){['search','from','to','status','currency'].forEach(id=>$(id).value='');page=1;render();}
function render(){
 const q=ReconCore.clean($('search').value),from=$('from').value,to=$('to').value,state=$('status').value,currency=$('currency').value;
 const invalid=from&&to&&from>to;$('filterError').classList.toggle('hidden',!invalid);$('filterError').textContent=invalid?'La fecha inicial debe ser anterior o igual a la fecha final.':'';
 filtered=invalid?[]:products[selected].rows.filter(r=>(!q||ReconCore.clean(r.raw.flat().join(' ')).includes(q))&&(!from||r.date&&r.date>=from)&&(!to||r.date&&r.date<=to)&&(!state||r.status===state)&&(!currency||r.currency===currency));
 const totals=new Map();filtered.forEach(r=>{if(r.amount!==null)totals.set(r.currency,(totals.get(r.currency)||0)+Math.round(r.amount*100));});
 $('total').textContent=totals.size===1?money([...totals.values()][0]/100,[...totals.keys()][0]):totals.size>1?'Varias monedas':'—';
 const missing=filtered.filter(r=>r.amount===null).length;$('totalFoot').textContent=(totals.size>1?[...totals].map(([c,n])=>money(n/100,c)).join(' · '):'Según los filtros seleccionados')+(missing?' · '+missing+' importes sin valor válido':'');
 $('applied').textContent=filtered.filter(r=>r.status==='Aplicado').length.toLocaleString('es-MX');$('pending').textContent=filtered.filter(r=>r.status==='Pendiente').length.toLocaleString('es-MX');$('count').textContent=filtered.length.toLocaleString('es-MX');
 $('rejected').textContent=filtered.filter(r=>r.status==='Rechazado').length+' rechazados · '+filtered.filter(r=>r.status==='Sin clasificar').length+' sin clasificar';
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages);const start=(page-1)*pageSize;
 $('rows').innerHTML=filtered.slice(start,start+pageSize).map(r=>'<tr><td>'+dateLabel(r.date)+'</td><td class="ref">'+escapeHTML(r.reference||'Sin referencia')+'</td><td>'+escapeHTML(r.name||'No informado')+'</td><td class="money">'+escapeHTML(r.amount===null?'Importe no válido':money(r.amount,r.currency))+'</td><td><span class="badge '+r.status.toLowerCase().replace(' ','-')+'">'+r.status+'</span></td><td><button class="detailbtn" data-detail="'+r.id+'" aria-label="Ver detalle de '+escapeHTML(r.reference||r.id)+'">Ver detalle ↗</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">No hay movimientos para esta consulta. Cambia los filtros o carga un archivo para este producto.</td></tr>';
 $('pageInfo').textContent=filtered.length?'Mostrando '+(start+1)+'–'+Math.min(start+pageSize,filtered.length)+' de '+filtered.length+' movimientos':'0 movimientos';$('pageNumber').textContent=page+' / '+pages;$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('exportBtn').disabled=!filtered.length;
 const p=products[selected];$('notice').textContent=p.demo?'DEMO · Todos los movimientos de este producto son ficticios. Carga un archivo para consultar tus operaciones.':'ARCHIVO LOCAL · '+p.source+' · Los estados provienen del archivo; el demo no realiza conciliación automática.';
}
function showError(text){$('importError').textContent=text;$('importError').classList.remove('hidden');}
function clearError(){$('importError').classList.add('hidden');}
function prepareGrid(){
 clearError();$('confirmImport').disabled=true;
 try{grid=book.kind==='json'?book.rows:XLSX.utils.sheet_to_json(book.workbook.Sheets[$('sheet').value],{header:1,defval:'',raw:true,blankrows:true});
 if(grid.length>50001)throw Error('La hoja excede el límite de 50,000 filas. Divide el archivo.');
 const h=Number($('headerRow').value)-1;if(!Number.isInteger(h)||h<0||h>=grid.length)throw Error('Elige una fila de encabezados existente.');
 if(grid[h].length>200)throw Error('La hoja excede el límite de 200 columnas. Selecciona otra hoja.');
 headers=grid[h].map((v,i)=>String(v||'Columna '+(i+1)));dataRows=grid.slice(h+1);if(!headers.length||!dataRows.some(r=>r.some(v=>v!==''&&v!=null)))throw Error('No hay movimientos después de la fila seleccionada.');
 const map=ReconCore.suggest(headers);$('mapping').innerHTML=Object.entries(labels).map(([key,label])=>'<div class="field"><label for="map-'+key+'">'+label+'</label><select id="map-'+key+'"><option value="-1">No disponible</option>'+headers.map((h,i)=>'<option value="'+i+'" '+(map[key]===i?'selected':'')+'>'+escapeHTML(h)+' (col. '+(i+1)+')</option>').join('')+'</select></div>').join('');
 $('preview').innerHTML='<table><thead><tr>'+headers.map(h=>'<th>'+escapeHTML(h)+'</th>').join('')+'</tr></thead><tbody>'+dataRows.slice(0,3).map(r=>'<tr>'+headers.map((_,i)=>'<td>'+escapeHTML(r[i])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';$('confirmImport').disabled=false;
 }catch(e){showError(e.message);}
}
async function loadFile(){
 const token=++importToken;book=null;$('importSetup').classList.add('hidden');$('confirmImport').disabled=true;clearError();const file=$('file').files[0];if(!file)return;
 if(file.size>20*1024*1024){showError('El archivo supera el límite de 20 MB.');return;}
 importing=true;$('file').disabled=true;
 try{pendingFile=file.name;const ext=file.name.split('.').pop().toLowerCase();if(!['xlsx','xls','json'].includes(ext))throw Error('Selecciona un archivo .xlsx, .xls o .json.');const buffer=await file.arrayBuffer();if(token!==importToken)return;
 if(ext==='json'){const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));const rows=Array.isArray(parsed)?parsed:parsed?.movimientos;if(!Array.isArray(rows)||!rows.length)throw Error('JSON: se espera una lista de objetos o {"movimientos": [...]}.');if(rows.length>50000)throw Error('El archivo supera los 50,000 movimientos.');if(rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('Cada movimiento debe ser un objeto JSON.');const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];if(keys.length>200)throw Error('El archivo supera las 200 columnas.');const scalar=v=>v&&typeof v==='object'?JSON.stringify(v):v??'';book={kind:'json',rows:[keys,...rows.map(r=>keys.map(k=>scalar(r[k])))]};$('sheet').innerHTML='<option>Movimientos JSON</option>';$('sheet').disabled=true;$('headerRow').disabled=true;
 }else{const workbook=XLSX.read(buffer,{type:'array',cellDates:false,sheetRows:50002});if(!workbook.SheetNames.length)throw Error('El archivo no contiene hojas.');book={kind:'excel',workbook};$('sheet').innerHTML=workbook.SheetNames.map(n=>'<option>'+escapeHTML(n)+'</option>').join('');$('sheet').disabled=false;$('headerRow').disabled=false;}
 $('headerRow').value=1;$('importSetup').classList.remove('hidden');prepareGrid();
 }catch(e){book=null;showError('No se pudo leer el archivo. '+e.message);}finally{importing=false;$('file').disabled=false;}
}
function commitImport(){
 clearError();if(!book||importing)return;
 const map=Object.fromEntries(Object.keys(labels).map(k=>[k,Number($('map-'+k).value)]));
 if(map.date<0||map.amount<0){showError('Selecciona las columnas de fecha e importe para continuar.');return;}
 const columns=Object.values(map).filter(v=>v>=0);if(new Set(columns).size!==columns.length){showError('Cada campo debe usar una columna diferente.');return;}
 const rows=ReconCore.normalize(dataRows,map,headers,$('defaultCurrency').value);if(!rows.length){showError('No se encontraron movimientos.');return;}
 const badDate=rows.filter(r=>!r.date).length,badAmount=rows.filter(r=>r.amount===null).length;
 const custom=$('customProduct').value.trim();let target=Number($('targetProduct').value);
 if(custom){const exists=products.findIndex(p=>p.name.toLocaleLowerCase()===custom.toLocaleLowerCase());if(exists>=0){showError('Este nombre de producto ya existe. Selecciónalo en la lista para reemplazar sus datos.');return;}target=products.length;}
 const name=custom||products[target].name;products[target]={name,rows,demo:false,source:pendingFile+' · '+$('sheet').value+(badDate||badAmount?' · Revisar: '+badDate+' fechas y '+badAmount+' importes sin valor válido':'')};selected=target;$('importDialog').close();renderProducts();resetFilters();
}
function detail(id){const row=products[selected].rows.find(r=>r.id===id);if(!row)return;$('detailSubtitle').textContent=products[selected].name+' · '+(row.reference||'Sin referencia');$('detailFields').innerHTML=row.raw.map(([k,v])=>'<div><small>'+escapeHTML(k)+'</small>'+escapeHTML(v||'—')+'</div>').join('');$('detailDialog').showModal();}
function download(){const p=products[selected];const rows=filtered.map(r=>({fecha:r.date,referencia:r.reference,cliente:r.name,importe:r.amount,moneda:r.currency,estado:r.rawStatus,datosOriginales:r.raw}));const blob=new Blob([JSON.stringify({producto:p.name,origen:p.source,datosFicticios:p.demo,movimientos:rows},null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='cobranza-'+ReconCore.clean(p.name)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('products').addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b){selected=Number(b.dataset.product);renderProducts();resetFilters();}});
$('rows').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)detail(Number(b.dataset.detail));});
['search','from','to','status','currency'].forEach(id=>$(id).addEventListener('input',()=>{page=1;render();}));
$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};$('clearFilters').onclick=resetFilters;
$('openImport').onclick=()=>{if(importing)return;importToken++;book=null;$('file').value='';$('customProduct').value='';$('targetProduct').value=selected;$('importSetup').classList.add('hidden');$('confirmImport').disabled=true;clearError();$('importDialog').showModal();};
$('cancelImport').onclick=()=>{$('importDialog').close();};$('importDialog').addEventListener('close',()=>{importToken++;book=null;});$('file').onchange=loadFile;$('sheet').onchange=prepareGrid;$('headerRow').oninput=prepareGrid;$('confirmImport').onclick=commitImport;
$('exportBtn').onclick=download;$('closeDetail').onclick=()=>$('detailDialog').close();$('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('resetDemo').onclick=()=>{if(confirm('¿Restablecer los ejemplos ficticios y descartar todos los archivos cargados?')){makeDemo();$('helpDialog').close();}};
makeDemo();

'use strict';
let activeView='load',consultClientId='',clientDirectory=[],clientSummaries=[],includedProducts=new Set(),clientDetailProduct=null,clientPage=1,clientVersion=0,clientDetailVersion=0;
const clientGlobalFilter=()=>({q:'',from:$('clientFrom').value,to:$('clientTo').value,currency:$('clientCurrency').value,status:''});
const clientDetailFilter=()=>({...clientGlobalFilter(),q:ReconCore.clean($('clientSearch').value),status:$('clientStatus').value});
const validClientDates=()=>!$('clientFrom').value||!$('clientTo').value||$('clientFrom').value<=$('clientTo').value;
function clearClientResults(message='Selecciona un cliente para consultar sus productos.'){
 clientSummaries=[];includedProducts.clear();clientDetailProduct=null;clientDetailVersion++;$('clientProductCards').innerHTML='';$('clientTotals').innerHTML='';$('clientOperationCount').textContent='0';$('clientProductCount').textContent='0';$('clientSummaryMessage').textContent=message;$('clientDetailSection').classList.add('hidden');$('clientExportAll').disabled=true;$('clientSepField').classList.add('hidden');$('clientRows').innerHTML='';$('clientTitle').textContent='Consulta del cliente';$('clientIdentity').textContent='';
}
async function showView(view){
 activeView=view;clientVersion++;clientDetailVersion++;$('detailDialog').close();$('loadView').classList.toggle('hidden',view!=='load');$('clientView').classList.toggle('hidden',view!=='client');$('monthlyView').classList.toggle('hidden',view!=='monthly');$('viewMonthly').setAttribute('aria-pressed',String(view==='monthly'));globalThis.invalidateMonthlyView?.();$('viewLoad').setAttribute('aria-pressed',String(view==='load'));$('viewClient').setAttribute('aria-pressed',String(view==='client'));
 if(view==='monthly'){await initializeMonthlyView();}if(view==='load'){renderProducts();resetFilters();}if(view==='client'){clearClientResults('Buscando clientes en los archivos cargados…');await refreshClientDirectory();}
}
async function refreshClientDirectory(){
 const token=++clientVersion;clientDetailVersion++;const merged=new Map();clearClientResults('Buscando clientes en los archivos cargados…');$('clientPicker').disabled=true;
 try{await Promise.all(products.flatMap(p=>p.variants).filter(d=>d.worker).map(async d=>{if(!d.clients){const list=await d.worker.request('clients');d.clients=new Map(list.map(c=>[c.id,c]));}for(const customer of d.clients.values()){const prior=merged.get(customer.id);merged.set(customer.id,{id:customer.id,name:customer.name||prior?.name||''});}}));if(token!==clientVersion||activeView!=='client')return;
 clientDirectory=[...merged.values()].sort((a,b)=>a.id.localeCompare(b.id,'es-MX',{numeric:true}));$('clientPicker').disabled=false;renderClientOptions();
 if(consultClientId&&merged.has(consultClientId)){$('clientPicker').value=consultClientId;await loadClientSummary();}else{consultClientId='';clearClientResults(clientDirectory.length?'Selecciona un cliente para ver sus operaciones.':'No hay clientes disponibles. Carga archivos con una columna de número de cliente en la vista de carga.');}
 }catch(e){if(token===clientVersion){$('clientPicker').disabled=false;clearClientResults('No se pudieron consultar los clientes: '+e.message);}}
}
function renderClientOptions(){
 const q=ReconCore.clean($('clientLookup').value);const matches=clientDirectory.filter(c=>!q||ReconCore.clean(c.id+' '+c.name).includes(q));const list=matches.slice(0,100);if(consultClientId&&!list.some(c=>c.id===consultClientId)){const selected=clientDirectory.find(c=>c.id===consultClientId);if(selected)list.unshift(selected);}
 $('clientPicker').innerHTML='<option value="">Selecciona un cliente</option>'+list.map(c=>'<option value="'+escapeHTML(c.id)+'">'+escapeHTML(c.id+(c.name?' · '+c.name:''))+'</option>').join('');$('clientPicker').value=consultClientId;$('clientMatches').textContent=matches.length>100?'Mostrando 100 de '+matches.length.toLocaleString('es-MX')+' clientes. Escribe el número o nombre para encontrarlo.':matches.length.toLocaleString('es-MX')+' clientes encontrados';
}
function datasetForClient(product){const ordered=[product.activeVariant,...product.variants.map((_,i)=>i).filter(i=>i!==product.activeVariant)];for(const index of ordered){const dataset=product.variants[index];if(dataset.worker&&dataset.clients?.has(consultClientId))return {dataset,variant:index};}return null;}
async function loadClientSummary(){
 const id=consultClientId,token=++clientVersion;clientDetailVersion++;clearClientResults('Consultando productos del cliente…');
 if(!id){clearClientResults();return;}if(!validClientDates()){clearClientResults('La fecha inicial debe ser anterior o igual a la fecha final.');return;}
 const identity=clientDirectory.find(c=>c.id===id);if(!identity){clearClientResults('Selecciona un cliente presente en los archivos cargados.');return;}
 $('clientTitle').textContent=identity.name||'Cliente '+id;$('clientIdentity').textContent='Número de cliente: '+id;
 const sources=products.map((p,index)=>({index,product:p,...datasetForClient(p)})).filter(s=>s.dataset);
 try{const summaries=await Promise.all(sources.map(async s=>({...s,summary:await s.dataset.worker.request('clientQuery',{clientId:id,filter:clientGlobalFilter(),page:1})})));if(token!==clientVersion||id!==consultClientId||activeView!=='client')return;
 clientSummaries=summaries;includedProducts=new Set(summaries.map(s=>s.index));$('clientSummaryMessage').textContent=summaries.length?'Selecciona los productos que quieres incluir en el total global.':'Este cliente no tiene operaciones en los archivos cargados.';
 const sep=clientSummaries.find(s=>s.index===0);if(sep){const choices=products[0].variants.map((d,i)=>({d,i})).filter(({d})=>d.worker&&d.clients?.has(id));$('clientSepVariant').innerHTML=choices.map(({d,i})=>'<option value="'+i+'">'+escapeHTML(d.variant)+'</option>').join('');$('clientSepVariant').value=sep.variant;$('clientSepField').classList.toggle('hidden',choices.length<2);}
 renderClientProducts();renderClientTotals();
 }catch(e){if(token===clientVersion)clearClientResults('No se pudo completar la consulta: '+e.message);}
}
function renderClientProducts(){
 $('clientProductCards').innerHTML=clientSummaries.map(s=>'<article class="client-product"><label class="include-product"><input type="checkbox" data-include="'+s.index+'" '+(includedProducts.has(s.index)?'checked':'')+'> Incluir en total global</label><h3>'+escapeHTML(s.product.name)+'</h3><p class="muted">'+s.summary.count.toLocaleString('es-MX')+' movimientos'+(s.index===0?' · '+escapeHTML(s.dataset.variant):'')+'</p><div class="product-amounts">'+(s.summary.totals.map(([currency,cents])=>'<strong>'+escapeHTML(money(cents/100,currency))+'</strong>').join('')||'<span class="muted">Sin importes para este filtro</span>')+'</div>'+(s.summary.counts.missing?'<p class="help">'+s.summary.counts.missing+' importes sin valor válido</p>':'')+(s.dataset.warning?'<p class="help">'+escapeHTML(s.dataset.warning)+'</p>':'')+'<button data-client-product="'+s.index+'" '+(!s.summary.count?'disabled':'')+'>Consultar movimientos →</button></article>').join('');
}
function renderClientTotals(){
 const totals=new Map();let count=0,missing=0;for(const s of clientSummaries){if(!includedProducts.has(s.index))continue;count+=s.summary.count;missing+=s.summary.counts.missing;for(const [currency,cents] of s.summary.totals)totals.set(currency,(totals.get(currency)||0)+cents);}
 $('clientTotals').innerHTML=totals.size?[...totals].map(([c,n])=>'<div><small>TOTAL GLOBAL · '+escapeHTML(c)+'</small><strong>'+escapeHTML(money(n/100,c))+'</strong></div>').join(''):'<span class="muted">Sin importes para la selección</span>';$('clientOperationCount').textContent=count.toLocaleString('es-MX');$('clientProductCount').textContent=includedProducts.size.toLocaleString('es-MX');$('clientTotalsNote').textContent=(missing?missing+' importes no válidos excluidos del total. ':'')+'Las monedas se totalizan por separado. SEP utiliza un solo archivo por consulta.';$('clientExportAll').disabled=!count;
}
async function openClientProduct(index){
 const source=clientSummaries.find(s=>s.index===index);if(!source||!consultClientId)return;clientDetailProduct=source;clientPage=1;$('clientSearch').value='';$('clientStatus').innerHTML='<option value="">Todos los estados</option>'+(source.dataset.rawStatuses||[]).map(s=>'<option value="code:'+escapeHTML(s)+'">'+escapeHTML(s)+'</option>').join('');$('clientDetailTitle').textContent=source.product.name;$('clientDetailIdentity').textContent='Solo operaciones del cliente '+consultClientId;$('clientDetailSection').classList.remove('hidden');await renderClientDetail();
}
async function renderClientDetail(){
 const source=clientDetailProduct,id=consultClientId,token=++clientDetailVersion;if(!source||!id)return;$('clientRows').innerHTML='<tr><td colspan="6" class="empty">Consultando movimientos del cliente…</td></tr>';$('clientPrev').disabled=true;$('clientNext').disabled=true;$('clientExportDetail').disabled=true;
 try{const result=await source.dataset.worker.request('clientQuery',{clientId:id,filter:clientDetailFilter(),page:clientPage});if(token!==clientDetailVersion||id!==consultClientId||activeView!=='client')return;clientPage=result.page;
 $('clientRows').innerHTML=result.items.map(r=>'<tr><td>'+dateLabel(r.date)+(r.time?'<small class="cell-secondary">'+escapeHTML(r.time)+'</small>':'')+'</td><td>'+escapeHTML(r.reference||r.transaction||r.authorization||'No informada')+'</td><td>'+escapeHTML(r.paymentType||r.name||'No informado')+'</td><td class="money">'+escapeHTML(r.amount===null?'Importe no válido':money(r.amount,r.currency))+'</td><td>'+escapeHTML(stateLabel(r))+'</td><td><button data-client-row="'+r.id+'" class="detailbtn">Ver detalle ↗</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">Este cliente no tiene movimientos con los filtros seleccionados.</td></tr>';$('clientPageInfo').textContent=result.count.toLocaleString('es-MX')+' movimientos · Página '+result.page+' de '+result.pages;$('clientPrev').disabled=result.page<=1;$('clientNext').disabled=result.page>=result.pages;$('clientExportDetail').disabled=!result.count;
 }catch(e){if(token===clientDetailVersion)$('clientRows').innerHTML='<tr><td colspan="6" class="empty">'+escapeHTML(e.message)+'</td></tr>';}
}
async function openClientRow(rowId){
 const source=clientDetailProduct,id=consultClientId,token=clientDetailVersion;if(!source||!id)return;
 try{const row=await source.dataset.worker.request('clientDetail',{clientId:id,rowId});if(!row||row.clientId!==id||token!==clientDetailVersion||activeView!=='client')return;$('detailSubtitle').textContent=source.product.name+' · Cliente '+id;$('detailFields').innerHTML=row.raw.map(([key,value])=>'<div><small>'+escapeHTML(key)+'</small>'+escapeHTML(value||'—')+'</div>').join('');$('detailDialog').showModal();}catch(e){$('clientSummaryMessage').textContent=e.message;}
}
async function exportClient(all){
 const id=consultClientId,token=clientVersion;if(!id)return;const sources=all?clientSummaries.filter(s=>includedProducts.has(s.index)):clientDetailProduct?[clientDetailProduct]:[];if(!sources.length)return;const button=$(all?'clientExportAll':'clientExportDetail');button.disabled=true;
 try{const blobs=await Promise.all(sources.map(s=>s.dataset.worker.request('clientExport',{clientId:id,filter:all?clientGlobalFilter():clientDetailFilter(),meta:{producto:s.product.name,variante:s.dataset.variant,advertencia:s.dataset.warning||''}})));if(id!==consultClientId||token!==clientVersion||activeView!=='client')return;
 const parts=all?['{"numeroCliente":'+JSON.stringify(id)+',"productos":[',...blobs.flatMap((blob,i)=>i?[',',blob]:[blob]),']}']:blobs;const url=URL.createObjectURL(new Blob(parts,{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='consulta-cliente-'+id.replace(/[^a-z0-9_-]/gi,'')+(all?'-global':'-movimientos')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){$('clientSummaryMessage').textContent='No se pudo exportar: '+e.message;}finally{if(id===consultClientId&&token===clientVersion)button.disabled=false;}
}
globalThis.clientFilesChanged=()=>{clientVersion++;clientDetailVersion++;globalThis.invalidateMonthlyView?.();if(activeView==='client')refreshClientDirectory();if(activeView==='monthly')initializeMonthlyView();};
$('viewLoad').onclick=()=>showView('load');$('viewClient').onclick=()=>showView('client');$('clientRefresh').onclick=refreshClientDirectory;$('clientLookup').oninput=renderClientOptions;
$('clientPicker').onchange=()=>{consultClientId=$('clientPicker').value;$('detailDialog').close();return loadClientSummary();};
['clientFrom','clientTo','clientCurrency'].forEach(id=>$(id).onchange=loadClientSummary);
$('clientSepVariant').onchange=()=>{products[0].activeVariant=Number($('clientSepVariant').value);return loadClientSummary();};
$('clientProductCards').addEventListener('click',e=>{const button=e.target.closest('[data-client-product]');if(button)return openClientProduct(Number(button.dataset.clientProduct));});
$('clientProductCards').addEventListener('change',e=>{if(e.target.dataset.include===undefined)return;const index=Number(e.target.dataset.include);e.target.checked?includedProducts.add(index):includedProducts.delete(index);renderClientTotals();});
$('clientRows').addEventListener('click',e=>{const button=e.target.closest('[data-client-row]');if(button)return openClientRow(Number(button.dataset.clientRow));});
$('clientSearch').onchange=()=>{clientPage=1;return renderClientDetail();};$('clientStatus').onchange=()=>{clientPage=1;return renderClientDetail();};$('clientPrev').onclick=()=>{clientPage--;return renderClientDetail();};$('clientNext').onclick=()=>{clientPage++;return renderClientDetail();};$('clientBack').onclick=()=>{clientDetailVersion++;clientDetailProduct=null;$('clientDetailSection').classList.add('hidden');};$('clientExportAll').onclick=()=>exportClient(true);$('clientExportDetail').onclick=()=>exportClient(false);
clearClientResults();

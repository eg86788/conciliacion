/* Lectores locales ZIP/CSV. No ejecutan ni interpretan contenido como instrucciones. */
(function(root){
'use strict';
const MAX_BYTES=800*1024*1024;
const u16=(bytes,offset)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(offset,true);
const u32=(bytes,offset)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,true);
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes,crc=0xffffffff){for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return crc>>>0;}
async function unzip(file){
 const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());let eocd=-1;
 for(let i=tail.length-22;i>=0;i--)if(u32(tail,i)===0x06054b50&&i+22+u16(tail,i+20)===tail.length){eocd=i;break;}
 if(eocd<0)throw Error('ZIP incompleto: no se encontró su directorio.');
 if(u16(tail,eocd+4)||u16(tail,eocd+6))throw Error('No se admiten ZIP divididos en varios volúmenes.');
 const count=u16(tail,eocd+10),size=u32(tail,eocd+12),offset=u32(tail,eocd+16);
 if(count===65535||size===0xffffffff||offset===0xffffffff)throw Error('ZIP64 no admitido. Extrae el CSV antes de cargarlo.');
 if(size>8*1024*1024||offset+size>file.size)throw Error('Directorio ZIP demasiado grande o inválido.');
 const directory=new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()),entries=[];let pos=0;
 for(let i=0;i<count;i++){
  if(pos+46>directory.length||u32(directory,pos)!==0x02014b50)throw Error('Directorio ZIP inválido.');
  const flags=u16(directory,pos+8),method=u16(directory,pos+10),crc=u32(directory,pos+16),compressed=u32(directory,pos+20),length=u32(directory,pos+24),nameLength=u16(directory,pos+28),extraLength=u16(directory,pos+30),commentLength=u16(directory,pos+32),local=u32(directory,pos+42);
  const name=new TextDecoder(flags&2048?'utf-8':'windows-1252').decode(directory.subarray(pos+46,pos+46+nameLength));
  if(/\.(csv|json|xlsx|xls)$/i.test(name)&&!name.startsWith('__MACOSX/'))entries.push({name,flags,method,crc,compressed,length,local});pos+=46+nameLength+extraLength+commentLength;
 }
 if(entries.length!==1)throw Error(entries.length?'El ZIP contiene varios archivos de datos. Extrae y carga uno a la vez.':'El ZIP no contiene CSV, Excel o JSON.');
 const entry=entries[0];if(entry.flags&1)throw Error('ZIP protegido con contraseña no admitido.');if(entry.length>MAX_BYTES)throw Error('El archivo descomprimido supera los 800 MB.');
 if(![0,8].includes(entry.method))throw Error('Compresión ZIP no admitida. Extrae el archivo antes de cargarlo.');
 if(entry.method===8&&typeof DecompressionStream==='undefined')throw Error('Para abrir ZIP usa Chrome, Edge o Firefox recientes, o extrae el CSV.');
 const local=new Uint8Array(await file.slice(entry.local,entry.local+30).arrayBuffer());if(local.length<30||u32(local,0)!==0x04034b50)throw Error('Cabecera ZIP inválida.');
 const start=entry.local+30+u16(local,26)+u16(local,28);if(start+entry.compressed>offset)throw Error('El contenido ZIP excede sus límites.');
 function stream(){let bytes=0,crc=0xffffffff;let content=file.slice(start,start+entry.compressed).stream();if(entry.method===8)content=content.pipeThrough(new DecompressionStream('deflate-raw'));
  return content.pipeThrough(new TransformStream({transform(chunk,controller){bytes+=chunk.byteLength;if(bytes>MAX_BYTES||bytes>entry.length)throw Error('El archivo ZIP excede el tamaño permitido.');crc=crc32(chunk,crc);controller.enqueue(chunk);},flush(){if(bytes!==entry.length||(crc^0xffffffff)>>>0!==entry.crc)throw Error('La integridad CRC o el tamaño del archivo ZIP no coincide.');}}));
 }
 return {name:entry.name,size:entry.length,archive:file.name,stream,async arrayBuffer(){const reader=stream().getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);size+=value.length;}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;}};
}
function parseCSVRow(text,delimiter=','){
 const cells=[];let value='',state='start';text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(state==='quoted'){if(c==='"')state='after';else value+=c;}else if(state==='after'){if(c==='"'){value+='"';state='quoted';}else if(c===delimiter){cells.push(value);value='';state='start';}else if(c!==' '&&c!=='\t')throw Error('CSV inválido: texto después de comillas.');}else if(c===delimiter){cells.push(value);value='';state='start';}else if(c==='"'&&state==='start')state='quoted';else{value+=c;state='plain';}}
 if(state==='quoted')throw Error('CSV inválido: comillas sin cerrar.');cells.push(value);return cells;
}
// Guarda bytes e índices compactos, no millones de arrays con cien columnas.
class CSVIndex{
 constructor(){this.chunks=[];this.offsets=[];this.starts=[];this.ends=[];this.count=0;this.total=0;this.encoding='utf-8';this.delimiter=',';this.warning='';this.excluded=0;}
 add(start,end){if(end<=start)return;const block=this.count>>>16,index=this.count&65535;if(!this.starts[block]){this.starts[block]=new Uint32Array(65536);this.ends[block]=new Uint32Array(65536);}this.starts[block][index]=start;this.ends[block][index]=end;this.count++;}
 text(index){const block=index>>>16,row=index&65535,start=this.starts[block][row],end=this.ends[block][row];let lo=0,hi=this.offsets.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(this.offsets[mid]<=start)lo=mid;else hi=mid-1;}const first=lo;while(lo+1<this.chunks.length&&this.offsets[lo]+this.chunks[lo].length<end)lo++;let bytes;if(lo===first)bytes=this.chunks[first].subarray(start-this.offsets[first],end-this.offsets[first]);else{bytes=new Uint8Array(end-start);let cursor=0;for(let i=first;i<=lo;i++){const piece=this.chunks[i].subarray(Math.max(0,start-this.offsets[i]),Math.min(this.chunks[i].length,end-this.offsets[i]));bytes.set(piece,cursor);cursor+=piece.length;}}return new TextDecoder(this.encoding,{fatal:true}).decode(bytes);}
 row(index){return parseCSVRow(this.text(index),this.delimiter);}
 async read(file,onProgress=()=>{}){
  const reader=file.stream().getReader(),utf8=new TextDecoder('utf-8',{fatal:true});let validUtf8=true,quote=false,start=0,lastCR=false,padding=false;let previousProgress=-1;
  try{while(true){const {done,value}=await reader.read();if(done)break;if(this.total+value.length>MAX_BYTES)throw Error('CSV descomprimido mayor a 800 MB.');if(this.total===0&&value.length>=2&&((value[0]===255&&value[1]===254)||(value[0]===254&&value[1]===255)))throw Error('Guarda el CSV como UTF-8; UTF-16 no se admite.');
   if(validUtf8)try{utf8.decode(value,{stream:true});}catch{validUtf8=false;}
   this.offsets.push(this.total);this.chunks.push(value);
   for(let i=0;i<value.length;i++){const c=value[i],position=this.total+i;if(c===0){padding=true;continue;}if(padding)throw Error('El CSV contiene bytes nulos intermedios. Reexporta como UTF-8.');if(lastCR){lastCR=false;if(c===10){start=position+1;continue;}}if(c===34)quote=!quote;else if(!quote&&(c===10||c===13)){this.add(start,position);start=position+1;lastCR=c===13;}}
   this.total+=value.length;const percent=Math.floor(this.total/file.size*100);if(percent!==previousProgress){onProgress('Leyendo CSV · '+this.count.toLocaleString('es-MX')+' filas',percent);previousProgress=percent;}
  }}finally{reader.releaseLock();}
  if(validUtf8)try{utf8.decode();}catch{validUtf8=false;}this.encoding=validUtf8?'utf-8':'windows-1252';
  let tailAdded=false;if(quote){this.excluded=1;this.warning='El archivo termina con una fila incompleta (comillas sin cerrar). Se excluyó esa última fila; revisa la exportación de origen.';}
  else if(padding){let end=this.total;for(let i=this.chunks.length-1;i>=0;i--){const chunk=this.chunks[i];let j=chunk.length-1;while(j>=0&&chunk[j]===0)j--;if(j>=0){end=this.offsets[i]+j+1;break;}if(i===0)end=0;}if(end>start){this.add(start,end);tailAdded=true;}}
  else if(this.total>start){this.add(start,this.total);tailAdded=true;}
  if(this.count<2)throw Error('CSV sin filas de movimientos.');
  const header=this.text(0);this.delimiter=[',',';','\t'].map(d=>{try{return {delimiter:d,count:parseCSVRow(header,d).length};}catch{return {delimiter:d,count:0};}}).sort((a,b)=>b.count-a.count)[0].delimiter;
  if(tailAdded){let valid=false;try{valid=this.row(this.count-1).length===this.row(0).length;}catch{}if(!valid){this.count--;this.excluded=1;this.warning='El archivo termina con una fila incompleta. Se excluyó esa última fila; revisa la exportación de origen.';}}
  if(this.count<2)throw Error('CSV sin movimientos completos.');return this;
 }
}
root.ReconFiles={MAX_BYTES,unzip,CSVIndex,parseCSVRow,crc32};
})(globalThis);

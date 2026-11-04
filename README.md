# Demo de consulta de cobranza

Aplicación portable para emular la consulta de productos de cobranza desde banca electrónica. **Abre `index.html` directamente en Edge, Chrome o Firefox.** Puedes copiar únicamente ese archivo a otra computadora: contiene estilos, JavaScript y lector de Excel; no requiere instalación, internet, servidor ni base de datos.

## Uso

La aplicación tiene tres vistas: **Carga de archivos** para incorporar y revisar los archivos, **Consulta del cliente** para emular la consulta de un cliente específico y **Global por mes** para revisar todos los clientes agrupados por mes y año de transacción. Todas inician sin registros; no hay datos de ejemplo precargados ni función para restaurarlos.

1. Selecciona un producto: **SEP - Servicio Electrónico de Pagos**, **SEP - Servicios de Efectivo**, **Cobranza Universal**, **Concentración de Fondos** o **Domiciliación**. En SEP - Servicio Electrónico de Pagos, elige **Con Autelis** o **Sin Autelis**: cada variante conserva un archivo independiente. Todos los productos y variantes inician vacíos. Solo se muestran movimientos de archivos cargados por el usuario.
2. Pulsa **Cargar archivo**, selecciona el producto y la variante SEP cuando aplique, y abre un `.xlsx`, `.xls`, `.json`, **`.csv` o `.zip`** local. SEP/SEF se reconocen por sus columnas; los nombres con/sin Autelis sugieren la variante, que puedes cambiar antes de confirmar.
3. Elige la hoja y la fila de encabezados; confirma las columnas de fecha, referencia, cliente, importe, estado y moneda. Fecha e importe son obligatorios. Si falta moneda, elige la predeterminada.
4. Consulta los movimientos con búsqueda, fechas, estado, moneda, paginación y detalle de todas las columnas originales. Los resúmenes corresponden al resultado filtrado; las monedas no se suman entre sí.
5. **Exportar JSON** descarga solamente el resultado filtrado. Puede importarse de nuevo.

Cada carga reemplaza los movimientos de un solo producto y variante. Cancelar una carga conserva los datos anteriores. Los datos permanecen en memoria y se descartan al cerrar o recargar la página. No hay autenticación real ni conciliación automática. La interfaz reutiliza el logotipo PNG original y el estilo de perfilamiento-banamex: barra lateral blanca, navegación azul, fondo gris claro, tipografía Arial y tarjetas con bordes suaves. Es una demostración.

## Consulta del cliente

1. Carga los archivos de los productos en **Carga de archivos**. En la asignación de columnas, confirma **Número de cliente** (`NUM_CLIENTE`, `numeroCliente` o una columna elegida manualmente). Los archivos sin identificador de cliente pueden revisarse en la carga, pero no se mezclan en el portal del cliente.
2. Abre **Consulta del cliente**, busca por número o nombre y selecciona el cliente que quieres simular. Se muestran solo los productos con operaciones de ese identificador en los archivos cargados. Los contratos se emulan a partir de la presencia de operaciones; no hay un catálogo real de contratación.
3. Consulta el total por producto y el **total global**. Marca los productos que quieres incluir y filtra por fechas o moneda. Se suman los importes de las transacciones por moneda: MXN y USD aparecen separados, sin conversión de divisas. Los importes inválidos se excluyen y se informa su cantidad.
4. SEP con y sin Autelis son archivos alternativos de un mismo producto: **solo se incluye una variante en el total global** para evitar sumar ambos archivos como si fueran productos diferentes. Se prefiere la variante activa que tenga operaciones del cliente; puedes cambiarla en la consulta cuando ambas están disponibles.
5. Usa **Consultar movimientos** para abrir el detalle del producto. Búsqueda, paginación, detalle de la operación y exportación quedan restringidos al cliente seleccionado. La exportación global incluye los productos marcados; la exportación de movimientos incluye el producto abierto y sus filtros. El JSON global es una consulta con varios productos, mientras que el JSON de movimientos puede volver a importarse como una tabla.

Las acciones `clientQuery`, `clientDetail` y `clientExport` del worker exigen un número de cliente y fuerzan el filtro exacto correspondiente, aunque otro filtro intente sustituirlo. Al cambiar de cliente se limpian los resultados anteriores y se descartan respuestas pendientes de la consulta previa. Esto es una simulación local; no constituye autenticación ni una barrera de acceso entre usuarios de un equipo que dispone de los archivos completos.

## Global por mes

- **Global por mes** enlista todos los clientes con número identificable en los archivos seleccionados. Cada fila representa un cliente y un mes/año de la **fecha de la transacción**, consolidando los productos incluidos. Se muestran número y nombre del cliente, número de productos, total de transacciones e importes por moneda.
- Se incluyen subtotales de cada mes para todos los clientes del filtro, además de los totales de la consulta. El contador de clientes es de clientes únicos, aunque un cliente aparezca en varios meses. MXN, USD y cualquier otra moneda permanecen separados.
- Permite filtrar por mes inicial/final (ambos incluidos), cliente y moneda, y elegir los productos que se suman. Para SEP se incluye un solo archivo, con o sin Autelis, seleccionado explícitamente cuando ambos están cargados.
- Las operaciones sin fecha válida aparecen en **Sin fecha válida** cuando no se exige un rango mensual. Los registros sin número de cliente se omiten del listado y se informa su cantidad. Los importes inválidos se excluyen de las sumas, pero su transacción se cuenta y se señala. Las filas incompletas continúan excluidas durante la carga.
- La paginación muestra 25 grupos cliente/mes por página. Los subtotales de mes siempre corresponden a todos los clientes del filtro, no solo a la página visible. **Exportar resumen JSON** incluye todos los grupos filtrados, incluso los de otras páginas; es un resumen agregado, no un archivo de movimientos para reimportar.
- La agregación se calcula en el worker de cada archivo y se conserva mientras ese archivo esté cargado. La interfaz recibe grupos resumidos y solo dibuja la página visible, conservando el funcionamiento local y portable.

## Formatos y límites

- **Hasta 800 MB por archivo**, definidos como 800 × 1024 × 1024 = **838,860,800 bytes**, incluidos. Se rechazan archivos mayores antes de leerlos. Se eliminaron los límites artificiales de 50,000 filas y 200 columnas.
- Excel: `.xlsx` y `.xls`, una hoja por carga. Se consulta primero el catálogo de hojas y se decodifica la hoja seleccionada en un Web Worker local. Los libros protegidos con contraseña no se admiten. Las fórmulas se leen por su valor guardado; no se recalculan. Guardar referencias con ceros iniciales como texto en Excel.
- **CSV directo**: lectura por bloques con índices de filas sobre bytes originales. Separador coma, punto y coma o tabulador; comillas escapadas, saltos de línea dentro de celdas, CRLF y UTF-8 (con/sin BOM). Se detecta Windows-1252 si el archivo no es UTF-8 válido. UTF-16 requiere reexportar a UTF-8. Identificadores y referencias se conservan como texto, incluidos ceros iniciales y puntos finales de cuentas.
- **ZIP directo**: un archivo CSV, Excel o JSON compatible dentro del ZIP, sin necesidad de extraerlo manualmente. Se admiten métodos almacenado y deflate y se verifican tamaño y CRC32. Tanto el ZIP como el archivo descomprimido deben respetar 800 MB. ZIP64, contraseñas o varios archivos de datos requieren extracción manual. Se usa `DecompressionStream('deflate-raw')` de navegadores recientes; no hay descarga de bibliotecas ni conexión de red.
- **Filas incompletas de CSV**: se excluye la última fila truncada y las filas con una cantidad de campos distinta al encabezado; se muestra un aviso con el número excluido y se conserva en la exportación. No se rellenan columnas para presentar registros incompletos como válidos. Un CSV sin movimientos completos se rechaza.
- JSON UTF-8: una lista de objetos o un objeto con `movimientos: [...]`. Incluye un ejemplo en `examples/cobranza.json`. La propiedad `producto` es informativa: el usuario selecciona el destino de la carga.
- JSON se lee por bloques con decodificación UTF-8 incremental, sin concatenar todo el archivo en una sola cadena. El contenedor opcional admite hasta 1 MB de metadatos antes y después de `movimientos`; para metadatos mayores usar la lista directa. Cada movimiento debe ser un objeto JSON.
- Fechas: seriales de Excel (sistemas 1900 y 1904), `AAAA-MM-DD` o `DD/MM/AAAA`. Las fechas que no se pueden interpretar se señalan y no se incluyen en filtros de fecha.
- Importes: números o textos como `1,234.56`, `1.234,56`, `1234,56`; los importes inválidos se señalan y se excluyen del resumen. Los valores negativos se conservan.
- Estados: aplicado/conciliado/pagado/exitoso/liquidado → Aplicado; pendiente/en proceso/por conciliar → Pendiente; rechazado/devuelto/cancelado → Rechazado. Los demás se muestran como Sin clasificar; su valor original permanece en el detalle.
- **Moneda confirmada por el usuario**: `1`/`001` → MXN (pesos); `5`/`005` → USD. El código original se conserva en el detalle. Los códigos restantes permanecen sin equivalencia asignada y nunca se suman entre sí.
- `CVE_ESTATUSTXN` se muestra y filtra por su valor original. No se presupone que un código numérico signifique aplicado, pendiente o rechazado; esos indicadores aparecen como no disponibles cuando solo hay códigos sin catálogo confirmado.
- No se deduplican filas ni se descartan totales automáticamente. El archivo debe contener una tabla de movimientos; filas de resumen o encabezados intermedios deben quitarse o revisarse antes de presentar cifras.

## Capacidad y archivos grandes

La lectura, normalización, búsqueda, resúmenes y exportación de archivos importados se ejecutan en Web Workers, uno por archivo cargado. Solo la página de resultados llega al hilo de la interfaz. El progreso se muestra durante la carga y **Cancelar** termina el worker de importación. La exportación se construye por bloques en un Blob.

**El límite permitido de 800 MB no garantiza que cualquier Excel de ese tamaño quepa en memoria.** Excel requiere descomprimir y analizar la hoja, y el consumo puede superar varias veces el tamaño del archivo. La cantidad de filas, columnas y archivos simultáneos, la RAM disponible y los límites del navegador determinan la capacidad efectiva. JSON incremental reduce la memoria temporal, pero los movimientos consultables permanecen en memoria. Si se agota, dividir el archivo o reducir columnas. No hay base de datos ni almacenamiento persistente de apoyo.

La prueba automatizada procesa un flujo JSON válido de exactamente 800 MiB con una operación y relleno de espacios, sin reservar un buffer completo, y prueba más de 50,000 movimientos. Esto verifica el límite y la lectura incremental; **no equivale a validar un Excel real de 800 MB ni un JSON con 800 MB de movimientos**. Esa validación requiere los archivos reales y el equipo destino.

## Adaptación a los archivos reales

Se incluyen perfiles para los encabezados SEP y SEF recibidos: `FEC_TRANSACCION`, `IMP_TRANSACCION`, `CVE_ESTATUSTXN`, `CVE_MONEDASISTEMA`, `NUM_CLIENTE`, referencias, sucursales, autorizaciones y `NUM_AUTELIS151`, cuando existen. La tabla se adapta al producto; el detalle conserva todas las columnas originales. Los filtros exactos por número de cliente y cuenta permiten emular la consulta de un cliente dentro de un archivo con múltiples clientes. No sustituyen autenticación ni autorización de acceso.

Los ejemplos de `examples/sep-con-autelis.csv`, `examples/sep-sin-autelis.csv` y `examples/sef.csv` son **sintéticos** y se usan únicamente como archivos de prueba; nunca se cargan automáticamente en la vista. Los archivos del usuario no se incorporan al repositorio ni al HTML. Las pruebas usan únicamente ejemplos ficticios. Los productos precargados no representan un catálogo real de contratos.

La demostración trabaja con archivos locales. En una implementación posterior, un adaptador autorizado podrá entregar los movimientos de la vista de Teradata al mismo modelo de consulta; esta versión no incluye conexión a Teradata.

## Identidad visual

El logotipo de `assets/banamex-logo.png` es el mismo archivo usado por perfilamiento-banamex. `src/brand.css` adapta su estilo a las tres vistas de conciliación. `build.ps1` incorpora el PNG como una URL de datos en el HTML, por lo que copiar únicamente `index.html` conserva el logotipo y todos los estilos sin conexión.

## Desarrollo y verificación

- `src/shell.html`, `src/styles.css`, `src/core.js`, `src/app.js`, `src/client.js`, `src/monthly.js`, `src/files.js`, `src/worker.js`: fuentes editables; las tres vistas, el worker y todos los lectores se incluyen dentro del HTML portable.
- `vendor/xlsx.full.min.js`: SheetJS Community Edition 0.20.3, incluida localmente bajo Apache 2.0; licencia en `vendor/SHEETJS-LICENSE.txt`. Distribución oficial: https://docs.sheetjs.com/docs/getting-started/installation/standalone/.
- `build.ps1`: genera el HTML portable desde las fuentes, sin descargar dependencias. Ejecutar `powershell -ExecutionPolicy Bypass -File ./build.ps1`.
- `tests/core.test.cjs`: pruebas de importes, fechas, normalización, contenido no confiable y lectura de Excel con múltiples hojas. Ejecutar con Node.js: `node tests/core.test.cjs`.
- `tests/worker.test.cjs`: JSON incremental, límite de 800 MiB, más de 50,000 movimientos, filtros, detalle, exportación y XLS/XLSX. Ejecutar `node tests/worker.test.cjs`.
- `tests/app.test.cjs`: inicio sin datos ficticios, integración de las tres vistas y worker empaquetado, variantes SEP independientes, totales por producto y moneda, aislamiento por cliente, agrupación mensual entre distintos años, subtotales, filtros, paginación y exportación de todas las páginas. Ejecutar `node tests/app.test.cjs`. Usa un DOM mínimo para probar comportamiento; no sustituye una revisión visual en navegador.
- `tests/files.test.cjs`: CSV incremental, ZIP/CRC32, perfiles SEP/SEF, monedas confirmadas, filtros por cliente/cuenta y exclusión de filas incompletas. Ejecutar `node tests/files.test.cjs` con Node.js 22 o posterior (requiere `DecompressionStream` con deflate-raw).

La política de contenido del HTML bloquea conexiones de red. Las celdas y nombres de archivo se insertan como texto escapado. No hay telemetría ni almacenamiento persistente.

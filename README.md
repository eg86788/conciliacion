# Demo de consulta de cobranza

Aplicación portable para emular la consulta de productos de cobranza desde banca electrónica. **Abre `index.html` directamente en Edge, Chrome o Firefox.** Puedes copiar únicamente ese archivo a otra computadora: contiene estilos, JavaScript y lector de Excel; no requiere instalación, internet, servidor ni base de datos.

## Uso

1. Selecciona un producto: **SEP - Servicio Electrónico de Pagos**, **SEP - Servicios de Efectivo**, **Cobranza Universal**, **Concentración de Fondos** o **Domiciliación**. En SEP - Servicio Electrónico de Pagos, elige **Con Autelis** o **Sin Autelis**: cada variante conserva un archivo independiente. Los movimientos iniciales son ficticios.
2. Pulsa **Cargar archivo**, selecciona el producto y la variante SEP cuando aplique, y abre un `.xlsx`, `.xls` o `.json` local.
3. Elige la hoja y la fila de encabezados; confirma las columnas de fecha, referencia, cliente, importe, estado y moneda. Fecha e importe son obligatorios. Si falta moneda, elige la predeterminada.
4. Consulta los movimientos con búsqueda, fechas, estado, moneda, paginación y detalle de todas las columnas originales. Los resúmenes corresponden al resultado filtrado; las monedas no se suman entre sí.
5. **Exportar JSON** descarga solamente el resultado filtrado. Puede importarse de nuevo.

Cada carga reemplaza los movimientos de un solo producto y variante. Cancelar una carga conserva los datos anteriores. Los datos permanecen en memoria y se descartan al cerrar o recargar la página. Restablecer los ejemplos requiere confirmación. No hay autenticación real ni conciliación automática. La interfaz utiliza una paleta azul, rojo y blanco de Banamex; es una demostración.

## Formatos y límites

- **Hasta 800 MB por archivo**, definidos como 800 × 1024 × 1024 = **838,860,800 bytes**, incluidos. Se rechazan archivos mayores antes de leerlos. Se eliminaron los límites artificiales de 50,000 filas y 200 columnas.
- Excel: `.xlsx` y `.xls`, una hoja por carga. Se consulta primero el catálogo de hojas y se decodifica la hoja seleccionada en un Web Worker local. Los libros protegidos con contraseña no se admiten. Las fórmulas se leen por su valor guardado; no se recalculan. Guardar referencias con ceros iniciales como texto en Excel.
- JSON UTF-8: una lista de objetos o un objeto con `movimientos: [...]`. Incluye un ejemplo en `examples/cobranza.json`. La propiedad `producto` es informativa: el usuario selecciona el destino de la carga.
- JSON se lee por bloques con decodificación UTF-8 incremental, sin concatenar todo el archivo en una sola cadena. El contenedor opcional admite hasta 1 MB de metadatos antes y después de `movimientos`; para metadatos mayores usar la lista directa. Cada movimiento debe ser un objeto JSON.
- Fechas: seriales de Excel (sistemas 1900 y 1904), `AAAA-MM-DD` o `DD/MM/AAAA`. Las fechas que no se pueden interpretar se señalan y no se incluyen en filtros de fecha.
- Importes: números o textos como `1,234.56`, `1.234,56`, `1234,56`; los importes inválidos se señalan y se excluyen del resumen. Los valores negativos se conservan.
- Estados: aplicado/conciliado/pagado/exitoso/liquidado → Aplicado; pendiente/en proceso/por conciliar → Pendiente; rechazado/devuelto/cancelado → Rechazado. Los demás se muestran como Sin clasificar; su valor original permanece en el detalle.
- No se deduplican filas ni se descartan totales automáticamente. El archivo debe contener una tabla de movimientos; filas de resumen o encabezados intermedios deben quitarse o revisarse antes de presentar cifras.

## Capacidad y archivos grandes

La lectura, normalización, búsqueda, resúmenes y exportación de archivos importados se ejecutan en Web Workers, uno por archivo cargado. Solo la página de resultados llega al hilo de la interfaz. El progreso se muestra durante la carga y **Cancelar** termina el worker de importación. La exportación se construye por bloques en un Blob.

**El límite permitido de 800 MB no garantiza que cualquier Excel de ese tamaño quepa en memoria.** Excel requiere descomprimir y analizar la hoja, y el consumo puede superar varias veces el tamaño del archivo. La cantidad de filas, columnas y archivos simultáneos, la RAM disponible y los límites del navegador determinan la capacidad efectiva. JSON incremental reduce la memoria temporal, pero los movimientos consultables permanecen en memoria. Si se agota, dividir el archivo o reducir columnas. No hay base de datos ni almacenamiento persistente de apoyo.

La prueba automatizada procesa un flujo JSON válido de exactamente 800 MiB con una operación y relleno de espacios, sin reservar un buffer completo, y prueba más de 50,000 movimientos. Esto verifica el límite y la lectura incremental; **no equivale a validar un Excel real de 800 MB ni un JSON con 800 MB de movimientos**. Esa validación requiere los archivos reales y el equipo destino.

## Adaptación a los archivos reales

La selección de columnas permite explorar archivos sin conocer todavía su estructura. Cuando estén disponibles los Excel de cada producto, se pueden ajustar nombres, estados, encabezados, reglas, convenios y vistas específicas. Los productos precargados no representan un catálogo real de contratos.

La demostración trabaja con archivos locales. En una implementación posterior, un adaptador autorizado podrá entregar los movimientos de la vista de Teradata al mismo modelo de consulta; esta versión no incluye conexión a Teradata.

## Desarrollo y verificación

- `src/shell.html`, `src/styles.css`, `src/core.js`, `src/app.js`, `src/worker.js`: fuentes editables; el worker y su lector Excel se incluyen dentro del HTML portable.
- `vendor/xlsx.full.min.js`: SheetJS Community Edition 0.20.3, incluida localmente bajo Apache 2.0; licencia en `vendor/SHEETJS-LICENSE.txt`. Distribución oficial: https://docs.sheetjs.com/docs/getting-started/installation/standalone/.
- `build.ps1`: genera el HTML portable desde las fuentes, sin descargar dependencias. Ejecutar `powershell -ExecutionPolicy Bypass -File ./build.ps1`.
- `tests/core.test.cjs`: pruebas de importes, fechas, normalización, contenido no confiable y lectura de Excel con múltiples hojas. Ejecutar con Node.js: `node tests/core.test.cjs`.
- `tests/worker.test.cjs`: JSON incremental, límite de 800 MiB, más de 50,000 movimientos, filtros, detalle, exportación y XLS/XLSX. Ejecutar `node tests/worker.test.cjs`.
- `tests/app.test.cjs`: integración de interfaz y worker empaquetado, cinco productos y persistencia independiente de ambas variantes SEP. Ejecutar `node tests/app.test.cjs`. Usa un DOM mínimo para probar comportamiento; no sustituye una revisión visual en navegador.

La política de contenido del HTML bloquea conexiones de red. Las celdas y nombres de archivo se insertan como texto escapado. No hay telemetría ni almacenamiento persistente.

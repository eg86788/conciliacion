# Demo de consulta de cobranza

Aplicación portable para emular la consulta de productos de cobranza desde banca electrónica. **Abre `index.html` directamente en Edge, Chrome o Firefox.** Puedes copiar únicamente ese archivo a otra computadora: contiene estilos, JavaScript y lector de Excel; no requiere instalación, internet, servidor ni base de datos.

## Uso

1. Selecciona un producto de la lista. Los tres productos iniciales y todos sus movimientos son ficticios.
2. Pulsa **Cargar archivo**, selecciona el producto o escribe el nombre de uno nuevo y abre un `.xlsx`, `.xls` o `.json` local.
3. Elige la hoja y la fila de encabezados; confirma las columnas de fecha, referencia, cliente, importe, estado y moneda. Fecha e importe son obligatorios. Si falta moneda, elige la predeterminada.
4. Consulta los movimientos con búsqueda, fechas, estado, moneda, paginación y detalle de todas las columnas originales. Los resúmenes corresponden al resultado filtrado; las monedas no se suman entre sí.
5. **Exportar JSON** descarga solamente el resultado filtrado. Puede importarse de nuevo.

Cada carga reemplaza los movimientos de un solo producto. Los datos permanecen en memoria y se descartan al cerrar o recargar la página. Restablecer los ejemplos requiere confirmación. No hay autenticación real ni conciliación automática.

## Formatos y límites

- Excel: `.xlsx` y `.xls`, una hoja por carga; 20 MB, 50,000 filas de datos y 200 columnas como máximo. Los libros protegidos con contraseña no se admiten. Las fórmulas se leen por su valor guardado; no se recalculan. Guardar referencias con ceros iniciales como texto en Excel.
- JSON UTF-8: una lista de objetos o un objeto con `movimientos: [...]`. Incluye un ejemplo en `examples/cobranza.json`. La propiedad `producto` es informativa: el usuario selecciona el destino de la carga.
- Fechas: seriales de Excel, `AAAA-MM-DD` o `DD/MM/AAAA`. Las fechas que no se pueden interpretar se señalan y no se incluyen en filtros de fecha.
- Importes: números o textos como `1,234.56`, `1.234,56`, `1234,56`; los importes inválidos se señalan y se excluyen del resumen. Los valores negativos se conservan. El lector asume fechas seriales Excel del sistema 1900.
- Estados: aplicado/conciliado/pagado/exitoso/liquidado → Aplicado; pendiente/en proceso/por conciliar → Pendiente; rechazado/devuelto/cancelado → Rechazado. Los demás se muestran como Sin clasificar; su valor original permanece en el detalle.
- No se deduplican filas ni se descartan totales automáticamente. El archivo debe contener una tabla de movimientos; filas de resumen o encabezados intermedios deben quitarse o revisarse antes de presentar cifras.

## Adaptación a los archivos reales

La selección de columnas permite explorar archivos sin conocer todavía su estructura. Cuando estén disponibles los Excel de cada producto, se pueden ajustar nombres, estados, encabezados, reglas, convenios y vistas específicas. Los productos precargados no representan un catálogo real de contratos.

La demostración trabaja con archivos locales. En una implementación posterior, un adaptador autorizado podrá entregar los movimientos de la vista de Teradata al mismo modelo de consulta; esta versión no incluye conexión a Teradata.

## Desarrollo y verificación

- `src/shell.html`, `src/styles.css`, `src/core.js`, `src/app.js`: fuentes editables.
- `vendor/xlsx.full.min.js`: SheetJS Community Edition 0.20.3, incluida localmente bajo Apache 2.0; licencia en `vendor/SHEETJS-LICENSE.txt`. Distribución oficial: https://docs.sheetjs.com/docs/getting-started/installation/standalone/.
- `build.ps1`: genera el HTML portable desde las fuentes, sin descargar dependencias. Ejecutar `powershell -ExecutionPolicy Bypass -File ./build.ps1`.
- `tests/core.test.cjs`: pruebas de importes, fechas, normalización, contenido no confiable y lectura de Excel con múltiples hojas. Ejecutar con Node.js: `node tests/core.test.cjs`.

La política de contenido del HTML bloquea conexiones de red. Las celdas y nombres de archivo se insertan como texto escapado. No hay telemetría ni almacenamiento persistente.

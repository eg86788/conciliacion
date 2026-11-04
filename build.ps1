$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$html = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/shell.html'))
$styles = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/styles.css'))
$styles += "`n" + [IO.File]::ReadAllText((Join-Path $projectRoot 'src/brand.css'))
$logo = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $projectRoot 'assets/banamex-logo.png')))
$vendor = [IO.File]::ReadAllText((Join-Path $projectRoot 'vendor/xlsx.full.min.js'))
$core = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/core.js'))
$app = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/app.js'))
$client = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/client.js'))
$monthly = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/monthly.js'))
$worker = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/worker.js'))
$files = [IO.File]::ReadAllText((Join-Path $projectRoot 'src/files.js'))
# Evitar que una cadena de la biblioteca cierre su etiqueta de script.
$vendor = $vendor.Replace('</script', '<\/script')
$workerBundle = ($vendor + "`n" + $core + "`n" + $files + "`n" + $worker).Replace('</script', '<\/script')
$html = $html.Replace('/* STYLES */', $styles).Replace('/* WORKER */', $workerBundle).Replace('/* CORE */', $core).Replace('/* APP */', $app).Replace('/* CLIENT */', $client).Replace('/* MONTHLY */', $monthly)
$html = $html.Replace('/* BRAND_LOGO */', 'data:image/png;base64,' + $logo)
[IO.File]::WriteAllText((Join-Path $projectRoot 'index.html'), $html, [Text.UTF8Encoding]::new($false))
Write-Output 'index.html generado. Abre este archivo en Edge, Chrome o Firefox; no requiere servidor.'

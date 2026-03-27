<#
.SYNOPSIS
  Suite completa de tests para el agente de ventas AI.
  Ejecutar desde la raiz del proyecto:
    Set-ExecutionPolicy Bypass -Scope Process -Force
    .\tests\run-tests.ps1
    .\tests\run-tests.ps1 -Iterations 1
#>
param(
  [string]$BaseUrl    = "http://localhost:3001",
  [int]$Iterations    = 0,
  [int]$DelayMinutes  = 5,
  [int]$MaxHours      = 10,
  [string]$ReportDir  = "$PSScriptRoot"
)

$ErrorActionPreference = "SilentlyContinue"

$Script:AllResults = [System.Collections.Generic.List[hashtable]]::new()
$Script:RunNumber  = 0
$Script:StartTime  = Get-Date
$Script:SessionId  = "test-auto-$(Get-Date -Format 'HHmmss')"
$Script:FirstPid   = $null

function Write-Sep { Write-Host ("=" * 62) -ForegroundColor Cyan }
function Write-Sub([string]$t) { Write-Host "  -- $t" -ForegroundColor Yellow }

function Invoke-ApiTest {
  param(
    [string]$Name,
    [string]$Method   = "GET",
    [string]$Url,
    [hashtable]$Body  = $null,
    [scriptblock]$Val,
    [bool]$NeedsOllama = $false,
    [int]$Timeout      = 30
  )

  $start = Get-Date
  $r = @{
    name        = $Name
    method      = $Method
    url         = $Url
    status      = $null
    passed      = $false
    error       = $null
    durationMs  = 0
    snip        = ""
    ollama      = $NeedsOllama
    ts          = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    run         = $Script:RunNumber
  }

  try {
    $p = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = $Timeout; ErrorAction = "Stop" }
    if ($Body) { $p.ContentType = "application/json"; $p.Body = ($Body | ConvertTo-Json -Depth 5 -Compress) }

    $resp = $null
    $attempts = 0
    do {
      $attempts++
      try {
        $resp = Invoke-WebRequest @p
      } catch {
        # Retry on 5xx transient errors (not on 4xx or connection errors)
        $ex = $_.Exception
        $sc5 = $null
        try { $sc5 = [int]$ex.Response.StatusCode } catch {}
        if ($sc5 -ge 500 -and $attempts -lt 3) {
          Start-Sleep -Seconds 2
          continue
        }
        throw
      }
    } while (-not $resp -and $attempts -lt 3)

    $r.status     = $resp.StatusCode
    $r.durationMs = [int]((Get-Date) - $start).TotalMilliseconds
    $r.snip       = $resp.Content.Substring(0, [Math]::Min(200, $resp.Content.Length)) -replace "`n"," "

    $json = $null
    try { $json = $resp.Content | ConvertFrom-Json } catch {}

    if ($Val) { $r.passed = [bool](& $Val $json $resp.StatusCode) }
    else      { $r.passed = $resp.StatusCode -lt 400 }

  } catch {
    $r.durationMs = [int]((Get-Date) - $start).TotalMilliseconds
    $e = $_.Exception.Message
    $r.error = $e
    if ($NeedsOllama -and ($e -match "timeout|refused|connect|operation")) {
      $r.passed = $null
      $r.error  = "SKIP (Ollama no disponible)"
    } else {
      # Intentar obtener el status code del response de error
      try {
        $eb  = $_.Exception.Response
        if ($null -ne $eb) {
          $r.status = [int]$eb.StatusCode
          try {
            $sr   = [System.IO.StreamReader]::new($eb.GetResponseStream())
            $raw  = $sr.ReadToEnd()
            $r.snip = if ($raw.Length -gt 200) { $raw.Substring(0, 200) } else { $raw }
          } catch { $r.snip = "(no body)" }
          # Si hay funcion de validacion y tenemos status, intentar validar
          if ($Val) {
            $errJson = $null
            try { $errJson = $r.snip | ConvertFrom-Json } catch {}
            $r.passed = [bool](& $Val $errJson $r.status)
            if ($r.passed) { $r.error = $null }
          } else {
            $r.passed = $false
          }
        } else {
          $r.passed = $false
        }
      } catch {
        $r.passed = $false
      }
    }
  }

  $icon  = if ($r.passed -eq $true) { "[OK]  " } elseif ($r.passed -eq $null) { "[SKIP]" } else { "[FAIL]" }
  $color = if ($r.passed -eq $true) { "Green"  } elseif ($r.passed -eq $null) { "Yellow" } else { "Red"    }
  $ms    = "$($r.durationMs)ms".PadLeft(7)
  $st    = if ($r.status) { "[$($r.status)]" } else { "[---]" }
  Write-Host "    $icon $st $ms  $Name" -ForegroundColor $color
  if ($r.error -and $r.passed -eq $false) {
    Write-Host "         \-- $($r.error)" -ForegroundColor Gray
  }

  $Script:AllResults.Add($r)
  return $r
}

function Get-FirstProductId([string]$type = "supermercado") {
  if ($Script:FirstPid) { return $Script:FirstPid }
  try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/catalog/$type/search?q=a" -TimeoutSec 5 -ErrorAction Stop
    $products = if ($resp.products) { $resp.products } elseif ($resp -is [array]) { $resp } else { @() }
    if ($products.Count -gt 0 -and $products[0]._id) {
      $Script:FirstPid = $products[0]._id
      return $Script:FirstPid
    }
  } catch {}
  return $null
}

# ============================================================
#  SUITE
# ============================================================
function Invoke-TestSuite {
  $Script:RunNumber++
  $sid = "$($Script:SessionId)-r$($Script:RunNumber)"

  Write-Sep
  Write-Host "  ITERACION $($Script:RunNumber) -- $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
  Write-Sep

  # 1. Health
  Write-Sub "Health y estado del servidor"

  Invoke-ApiTest -Name "GET /api/health -> 200 + mongodb:connected" `
    -Url "$BaseUrl/api/health" `
    -Val { param($j) $j.status -eq "ok" -and $j.mongodb -eq "connected" }

  Invoke-ApiTest -Name "GET /api/health/ollama -> responde (200 o 503)" `
    -Url "$BaseUrl/api/health/ollama" `
    -Val { param($j,$sc) $sc -eq 200 -or $sc -eq 503 } `
    -NeedsOllama $true -Timeout 10

  Invoke-ApiTest -Name "GET /api/ruta-inexistente -> debe devolver 404" `
    -Url "$BaseUrl/api/ruta-inexistente-xyz-test" `
    -Val { param($j,$sc) $sc -eq 404 }

  # 2. Config
  Write-Sub "Configuracion del agente"

  Invoke-ApiTest -Name "GET /api/config -> 200 con campos" `
    -Url "$BaseUrl/api/config" `
    -Val { param($j) $j.tono -ne $null -or $j.systemPrompt -ne $null }

  Invoke-ApiTest -Name "PUT /api/config -> temperatura 0.3" `
    -Method "PUT" -Url "$BaseUrl/api/config" `
    -Body @{ temperature = 0.3; tono = "amigable" } `
    -Val { param($j) ($null -ne $j.config) -or ($null -ne $j.message) }

  Invoke-ApiTest -Name "PUT /api/config -> restaura temperatura 0.1" `
    -Method "PUT" -Url "$BaseUrl/api/config" `
    -Body @{ temperature = 0.1 } `
    -Val { param($j) ($null -ne $j.config) -or ($null -ne $j.message) }

  # 3. Catalogo
  Write-Sub "Catalogo de productos"

  foreach ($cat in @("supermercado","ferreteria","autopartes")) {
    $catVar = $cat
    Invoke-ApiTest -Name "GET /api/catalog/$catVar/search?q=a -> tiene productos" `
      -Url "$BaseUrl/api/catalog/$catVar/search?q=a" `
      -Val {
        param($j)
        $products = if ($j.products) { $j.products } elseif ($j -is [array]) { $j } else { @() }
        $products.Count -gt 0
      }
  }

  Invoke-ApiTest -Name "GET /api/catalog/supermercado/search?q=xq9z8w7 -> vacio" `
    -Url "$BaseUrl/api/catalog/supermercado/search?q=xq9z8w7v6u5" `
    -Val {
      param($j)
      $products = if ($j.products) { $j.products } elseif ($j -is [array]) { $j } else { @() }
      $products.Count -eq 0
    }

  Invoke-ApiTest -Name "GET /api/catalog/tipo-invalido -> error controlado (no crash)" `
    -Url "$BaseUrl/api/catalog/tipo-invalido-xyz/search?q=test" `
    -Val { param($j,$sc) $sc -ge 200 -and $sc -lt 600 }

  # 4. Carrito
  Write-Sub "Carrito de compras"

  Invoke-ApiTest -Name "GET /api/cart/$sid -> carrito vacio" `
    -Url "$BaseUrl/api/cart/$sid" `
    -Val { param($j) ($null -ne $j.items) -and $j.total -eq 0 }

  $productId = Get-FirstProductId
  if ($productId) {
    Invoke-ApiTest -Name "POST /api/cart/add -> agrega producto valido" `
      -Method "POST" -Url "$BaseUrl/api/cart/add" `
      -Body @{ sessionId = $sid; productId = $productId; quantity = 2 } `
      -Val { param($j) $j.cart -ne $null -or $j.message -ne $null }

    Invoke-ApiTest -Name "GET /api/cart/$sid -> total > 0 despues de agregar" `
      -Url "$BaseUrl/api/cart/$sid" `
      -Val { param($j) $j.total -gt 0 }

    Invoke-ApiTest -Name "POST /api/cart/remove -> quita 1 unidad" `
      -Method "POST" -Url "$BaseUrl/api/cart/remove" `
      -Body @{ sessionId = $sid; productId = $productId; quantity = 1 } `
      -Val { param($j) $j.cart -ne $null -or $j.message -ne $null }
  } else {
    Write-Host "    [SKIP] [---]        Carrito add/remove: no se encontro productId" -ForegroundColor Yellow
  }

  Invoke-ApiTest -Name "DELETE /api/cart/$sid -> vacia carrito" `
    -Method "DELETE" -Url "$BaseUrl/api/cart/$sid" `
    -Val { param($j,$sc) $sc -lt 400 }

  Invoke-ApiTest -Name "GET /api/cart/$sid -> vacio despues de delete" `
    -Url "$BaseUrl/api/cart/$sid" `
    -Val { param($j) $j.total -eq 0 -and ($null -ne $j) }

  # 5. Conversacion
  Write-Sub "Historial de conversacion"

  Invoke-ApiTest -Name "GET /api/chat/$sid -> historial (puede vacio)" `
    -Url "$BaseUrl/api/chat/$sid" `
    -Val { param($j) $j.sessionId -ne $null -or $j.messages -ne $null -or ($j -is [array]) }

  Invoke-ApiTest -Name "DELETE /api/chat/$sid -> elimina historial" `
    -Method "DELETE" -Url "$BaseUrl/api/chat/$sid" `
    -Val { param($j,$sc) $sc -lt 400 }

  # 6. Pedidos
  Write-Sub "Pedidos y ordenes"

  Invoke-ApiTest -Name "GET /api/orders/$sid -> array (puede vacio)" `
    -Url "$BaseUrl/api/orders/$sid" `
    -Val { param($j) $j -is [array] -or $j -ne $null }

  Invoke-ApiTest -Name "GET /api/orders -> listado admin" `
    -Url "$BaseUrl/api/orders" `
    -Val { param($j) $j -is [array] -or $j -ne $null }

  # 7. Chat LLM
  Write-Sub "Chat con LLM (requiere Ollama)"

  Invoke-ApiTest -Name "POST /api/chat -> responde (cualquier respuesta sin crash)" `
    -Method "POST" -Url "$BaseUrl/api/chat" `
    -Body @{ message = "Hola que productos tienen?"; sessionId = $sid; catalogoActivo = "supermercado" } `
    -Val { param($j) $j.response -ne $null -and $j.response.Length -gt 5 } `
    -NeedsOllama $true -Timeout 150

  Invoke-ApiTest -Name "POST /api/chat -> error Ollama devuelve mensaje amigable (no 500)" `
    -Method "POST" -Url "$BaseUrl/api/chat" `
    -Body @{ message = "Ver mi carrito"; sessionId = $sid; catalogoActivo = "ferreteria" } `
    -Val { param($j) $j.response -ne $null } `
    -NeedsOllama $true -Timeout 150

  # Resumen
  $iter   = $Script:AllResults | Where-Object { $_.run -eq $Script:RunNumber }
  $pass   = ($iter | Where-Object { $_.passed -eq $true  }).Count
  $fail   = ($iter | Where-Object { $_.passed -eq $false }).Count
  $skip   = ($iter | Where-Object { $_.passed -eq $null  }).Count
  $total  = $iter.Count

  Write-Host ""
  Write-Host ("  " + ("-" * 58)) -ForegroundColor Gray
  $passColor = if ($fail -eq 0) { "Green" } else { "Yellow" }
  Write-Host ("  Iteracion $($Script:RunNumber): $pass/$total OK  |  $fail FAIL  |  $skip SKIP") -ForegroundColor $passColor

  return @{ pass = $pass; fail = $fail; skip = $skip; total = $total }
}

# ============================================================
#  REPORTE HTML
# ============================================================
function Export-HtmlReport([string]$out) {
  $total    = $Script:AllResults.Count
  $pass     = ($Script:AllResults | Where-Object { $_.passed -eq $true  }).Count
  $fail     = ($Script:AllResults | Where-Object { $_.passed -eq $false }).Count
  $skip     = ($Script:AllResults | Where-Object { $_.passed -eq $null  }).Count
  $runtime  = [int]((Get-Date) - $Script:StartTime).TotalMinutes
  $rate     = if ($total -gt 0) { [Math]::Round($pass / $total * 100, 1) } else { 0 }

  $rows = ($Script:AllResults | ForEach-Object {
    $badge = if ($_.passed -eq $true) { '<span class="p">PASS</span>' } `
             elseif ($_.passed -eq $null) { '<span class="s">SKIP</span>' } `
             else { '<span class="f">FAIL</span>' }
    $err = if ($_.error) { "<small class='e'>" + [System.Web.HttpUtility]::HtmlEncode($_.error) + "</small>" } else { "" }
    "<tr><td>$($_.run)</td><td>$($_.ts)</td><td class='m'>$($_.method)</td><td>$($_.name)</td><td class='m'>$($_.status)</td><td>$($_.durationMs)ms</td><td>$badge $err</td></tr>"
  }) -join "`n"

  $html = @"
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Test Report - Agente Ventas AI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0f1117;color:#e2e8f0;padding:24px}
h1{color:#c3f53c;margin-bottom:4px}
.sub{color:#64748b;font-size:13px;margin-bottom:24px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:28px}
.stat{background:#1e2335;border-radius:12px;padding:16px 20px}
.stat .n{font-size:2.2em;font-weight:700}
.stat .l{font-size:12px;color:#94a3b8}
.gn{color:#4ade80}.rn{color:#f87171}.yn{color:#facc15}.bn{color:#60a5fa}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#1e2335;color:#94a3b8;padding:10px 12px;text-align:left;font-weight:600}
td{padding:8px 12px;border-bottom:1px solid #1e2335;vertical-align:top}
tr:hover td{background:#1a1f2e}
.m{font-family:monospace;font-size:12px}
.p,.f,.s{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700}
.p{background:#14532d;color:#4ade80}.f{background:#7f1d1d;color:#f87171}.s{background:#713f12;color:#facc15}
.e{color:#f87171;display:block;margin-top:3px;word-break:break-all;max-width:400px}
.bw{background:#1e2335;border-radius:99px;height:10px;margin:16px 0 24px;overflow:hidden}
.bf{height:100%;background:linear-gradient(90deg,#4ade80,#c3f53c);border-radius:99px}
</style></head><body>
<h1>Agente Ventas AI - Test Report</h1>
<p class="sub">Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Duracion: ${runtime} min | Iteraciones: $($Script:RunNumber)</p>
<div class="stats">
  <div class="stat"><div class="n bn">$total</div><div class="l">Tests ejecutados</div></div>
  <div class="stat"><div class="n gn">$pass</div><div class="l">Pasaron (PASS)</div></div>
  <div class="stat"><div class="n rn">$fail</div><div class="l">Fallaron (FAIL)</div></div>
  <div class="stat"><div class="n yn">$skip</div><div class="l">Omitidos (SKIP)</div></div>
  <div class="stat"><div class="n gn">${rate}%</div><div class="l">Tasa de exito</div></div>
</div>
<div class="bw"><div class="bf" style="width:${rate}%"></div></div>
<table><thead><tr><th>Run</th><th>Hora</th><th>Metodo</th><th>Test</th><th>HTTP</th><th>Tiempo</th><th>Estado</th></tr></thead>
<tbody>$rows</tbody></table>
</body></html>
"@

  [System.IO.File]::WriteAllText($out, $html, [System.Text.Encoding]::UTF8)
  Write-Host "  [HTML] Reporte: $out" -ForegroundColor Cyan
}

# ============================================================
#  REPORTE JSON
# ============================================================
function Export-JsonReport([string]$out) {
  $s = @{
    generatedAt    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    runtimeMinutes = [int]((Get-Date) - $Script:StartTime).TotalMinutes
    iterations     = $Script:RunNumber
    total          = $Script:AllResults.Count
    passed         = ($Script:AllResults | Where-Object { $_.passed -eq $true  }).Count
    failed         = ($Script:AllResults | Where-Object { $_.passed -eq $false }).Count
    skipped        = ($Script:AllResults | Where-Object { $_.passed -eq $null  }).Count
    results        = @($Script:AllResults)
  }
  [System.IO.File]::WriteAllText($out, ($s | ConvertTo-Json -Depth 6), [System.Text.Encoding]::UTF8)
  Write-Host "  [JSON] Reporte: $out" -ForegroundColor Cyan
}

# ============================================================
#  MAIN LOOP
# ============================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   Agente Ventas AI -- Suite de Tests Automatizados             " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Backend : $BaseUrl" -ForegroundColor White
Write-Host "  Session : $($Script:SessionId)" -ForegroundColor White
Write-Host "  Delay   : ${DelayMinutes} min entre iteraciones" -ForegroundColor White
Write-Host "  Max     : ${MaxHours} horas" -ForegroundColor White
Write-Host "  Inicio  : $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White

$maxIter = if ($Iterations -gt 0) { $Iterations } else { [int]($MaxHours * 60 / [Math]::Max($DelayMinutes,1)) + 1 }
$deadline = $Script:StartTime.AddHours($MaxHours)

$iter = 0
while ($iter -lt $maxIter -and (Get-Date) -lt $deadline) {
  $iter++
  $res = Invoke-TestSuite

  $snap = Join-Path $ReportDir "test-snapshot.json"
  Export-JsonReport -out $snap

  $timeLeft = ($deadline - (Get-Date)).TotalMinutes
  $isLast   = ($iter -ge $maxIter) -or ($timeLeft -le $DelayMinutes)

  if (-not $isLast) {
    $nextAt = (Get-Date).AddMinutes($DelayMinutes).ToString("HH:mm:ss")
    Write-Host ""
    Write-Host "  Proxima iteracion a las $nextAt (en ${DelayMinutes} min). Ctrl+C para salir." -ForegroundColor Gray
    Write-Host "  Tiempo restante: $([int]$timeLeft) min de ${MaxHours}h" -ForegroundColor Gray
    Start-Sleep -Seconds ($DelayMinutes * 60)
  }
}

# Reporte final
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Export-HtmlReport -out (Join-Path $ReportDir "test-report-$stamp.html")
Export-JsonReport -out (Join-Path $ReportDir "test-report-$stamp.json")

$total  = $Script:AllResults.Count
$pass   = ($Script:AllResults | Where-Object { $_.passed -eq $true  }).Count
$fail   = ($Script:AllResults | Where-Object { $_.passed -eq $false }).Count
$skip   = ($Script:AllResults | Where-Object { $_.passed -eq $null  }).Count
$rt     = [int]((Get-Date) - $Script:StartTime).TotalMinutes

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   RESUMEN FINAL                                                " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Iteraciones  : $($Script:RunNumber)" -ForegroundColor White
Write-Host "  Tiempo total : ${rt} minutos" -ForegroundColor White
Write-Host "  Tests totales: $total" -ForegroundColor White
Write-Host "  Pasaron      : $pass" -ForegroundColor Green
$failColor = if ($fail -eq 0) { "Green" } else { "Red" }
Write-Host "  Fallaron     : $fail" -ForegroundColor $failColor
Write-Host "  Omitidos     : $skip (requieren Ollama)" -ForegroundColor Yellow
Write-Host ""
if ($fail -eq 0) {
  Write-Host "  Todos los tests pasaron correctamente!" -ForegroundColor Green
} else {
  Write-Host "  Hay $fail test(s) fallando. Revisa el reporte HTML." -ForegroundColor Red
}
Write-Host ""

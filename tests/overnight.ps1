<#
.SYNOPSIS
  Launcher de tests. Ejecutar antes de dormir.

.EXAMPLE
  # Una sola vez (verificacion rapida):
  .\tests\overnight.ps1 -Iterations 1

  # Toda la noche (default 10h, cada 5min):
  .\tests\overnight.ps1

  # Personalizado:
  .\tests\overnight.ps1 -MaxHours 8 -DelayMinutes 10
#>
param(
  [string]$BaseUrl     = "http://localhost:3001",
  [int]$MaxHours       = 10,
  [int]$DelayMinutes   = 5,
  [int]$Iterations     = 0
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   AGENTE VENTAS -- TESTS NOCTURNOS                            " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que el backend este up
Write-Host "  Verificando backend en $BaseUrl ..." -ForegroundColor Yellow
$backendUp = $false
$attempts  = 0

do {
  $h = $null
  try {
    $h = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 4 -ErrorAction Stop
    if ($h.status -eq "ok") { $backendUp = $true }
  } catch { $h = $null }

  if (-not $backendUp) {
    $attempts++
    if ($attempts -ge 15) {
      Write-Host ""
      Write-Host "  ERROR: Backend no responde despues de 15 intentos." -ForegroundColor Red
      Write-Host "  Asegurate de que este corriendo:" -ForegroundColor Red
      Write-Host "    cd backend" -ForegroundColor Red
      Write-Host "    npm run dev" -ForegroundColor Red
      Write-Host ""
      exit 1
    }
    Write-Host "    Intento $attempts/15 -- esperando 4s..." -ForegroundColor Gray
    Start-Sleep -Seconds 4
  }

} while (-not $backendUp)

$mongoStatus = if ($h -and $h.mongodb) { $h.mongodb } else { "unknown" }
Write-Host "  [OK] Backend operativo (MongoDB: $mongoStatus)" -ForegroundColor Green

# Verificar Ollama (solo informativo)
Write-Host "  Verificando Ollama..." -ForegroundColor Yellow
$olStatus = "no disponible"
try {
  $ol = Invoke-RestMethod -Uri "$BaseUrl/api/health/ollama" -TimeoutSec 8 -ErrorAction Stop
  $modelList = if ($ol.models) { $ol.models -join ", " } else { "ninguno" }
  Write-Host "  [OK] Ollama corriendo. Modelos: $modelList" -ForegroundColor Green
  $olStatus = "disponible"
} catch {
  Write-Host "  [WARN] Ollama no disponible -- tests LLM seran marcados SKIP" -ForegroundColor Yellow
  Write-Host "         Para activarlos: ollama serve  +  ollama pull llama3.1" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Lanzando suite de tests..." -ForegroundColor Cyan
Write-Host "  Reportes en: $PSScriptRoot" -ForegroundColor Cyan
Write-Host ""
Write-Host "  MaxHours     = $MaxHours h" -ForegroundColor White
Write-Host "  DelayMinutes = $DelayMinutes min" -ForegroundColor White
if ($Iterations -gt 0) {
  Write-Host "  Iterations   = $Iterations (modo manual)" -ForegroundColor White
}
Write-Host ""
Write-Host "  [Ctrl+C para interrumpir en cualquier momento]" -ForegroundColor Gray
Write-Host ""
Start-Sleep -Seconds 2

# Ejecutar la suite
$suite = Join-Path $PSScriptRoot "run-tests.ps1"
& $suite `
  -BaseUrl $BaseUrl `
  -MaxHours $MaxHours `
  -DelayMinutes $DelayMinutes `
  -Iterations $Iterations `
  -ReportDir $PSScriptRoot

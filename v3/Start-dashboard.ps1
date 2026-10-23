$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$projectPython = Join-Path $projectDirectory '.venv-v3\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $projectPython)) {
    throw 'The v3 Python environment is missing. Follow v3/README.md to install it.'
}
$dashboardUrl = 'http://127.0.0.1:8763'
try {
    $response = Invoke-WebRequest -Uri "$dashboardUrl/api/report" -TimeoutSec 2
} catch {
    Start-Process -FilePath $projectPython -ArgumentList @('-m', 'v3', 'serve') -WorkingDirectory $projectDirectory -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { $response = Invoke-WebRequest -Uri "$dashboardUrl/api/report" -TimeoutSec 1; break } catch { }
    }
}
if ($null -eq $response -or $response.StatusCode -ne 200) { throw 'The development dashboard could not start.' }
Start-Process $dashboardUrl

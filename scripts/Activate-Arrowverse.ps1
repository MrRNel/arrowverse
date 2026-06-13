# Loads Arrowverse dev environment variables and optional Python venv.
# Used automatically by the workspace PowerShell terminal (.vscode/settings.json).

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

function Import-DotEnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Host "No env file at $Path" -ForegroundColor DarkYellow
        return
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            return
        }

        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) {
            return
        }

        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        Set-Item -Path "Env:$name" -Value $value
    }
}

Import-DotEnvFile (Join-Path $RepoRoot 'backend\.env')

if (-not $env:ENVIRONMENT) {
    $env:ENVIRONMENT = 'development'
}

$env:PYTHONPATH = Join-Path $RepoRoot 'backend'

$venvActivate = Join-Path $RepoRoot 'backend\.venv\Scripts\Activate.ps1'
if (Test-Path $venvActivate) {
    . $venvActivate
    $pyVersion = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    Write-Host "Python venv activated (backend\.venv, Python $pyVersion)" -ForegroundColor Green
    if ($pyVersion -eq '3.14') {
        Write-Host 'Tip: if pip install failed earlier, run: npm run setup:backend' -ForegroundColor DarkYellow
    }
} else {
    Write-Host 'Python venv not found. Run: npm run setup:backend' -ForegroundColor DarkYellow
}

Write-Host ''
Write-Host 'Arrowverse dev shell ready' -ForegroundColor Cyan
Write-Host "  repo:        $RepoRoot"
Write-Host "  environment: $env:ENVIRONMENT"
Write-Host "  database:    $env:DB_HOST`:$env:DB_PORT/$env:DB_NAME"
Write-Host ''
Write-Host 'Commands:' -ForegroundColor Cyan
Write-Host '  npm start'
Write-Host '  npm run db:schema'
Write-Host '  npm run start:api'

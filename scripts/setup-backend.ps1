# Creates backend/.venv and installs dependencies.
# Prefers Python 3.12 via the Windows py launcher, then 3.13, then default python.

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$BackendRoot = Join-Path $RepoRoot 'backend'
$VenvPath = Join-Path $BackendRoot '.venv'

function Get-PythonLauncher {
    foreach ($version in @('3.12', '3.13', '3.14')) {
        try {
            $candidate = & py "-$version" -c "import sys; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $candidate) {
                return @{ Command = "py -$version"; Executable = $candidate.Trim() }
            }
        } catch {
            continue
        }
    }

    $fallback = Get-Command python -ErrorAction SilentlyContinue
    if ($fallback) {
        return @{ Command = 'python'; Executable = $fallback.Source }
    }

    throw 'No Python interpreter found. Install Python 3.12+ from https://www.python.org/downloads/'
}

$launcher = Get-PythonLauncher
$versionText = & $launcher.Executable -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
Write-Host "Using Python $versionText ($($launcher.Executable))" -ForegroundColor Cyan

if ($versionText -eq '3.14') {
    Write-Host 'Python 3.14 detected — requires pydantic 2.12+ (prebuilt wheels).' -ForegroundColor Yellow
}

if (Test-Path $VenvPath) {
    Write-Host "Removing existing venv at $VenvPath" -ForegroundColor DarkYellow
    Remove-Item -Recurse -Force $VenvPath
}

Write-Host 'Creating virtual environment...' -ForegroundColor Cyan
& $launcher.Executable -m venv $VenvPath

$pip = Join-Path $VenvPath 'Scripts\python.exe'
& $pip -m pip install --upgrade pip
& $pip -m pip install -r (Join-Path $BackendRoot 'requirements.txt')

Write-Host ''
Write-Host 'Backend venv ready.' -ForegroundColor Green
Write-Host "  Activate: . .\scripts\Activate-Arrowverse.ps1"
Write-Host '  Run API:  npm run start:api'

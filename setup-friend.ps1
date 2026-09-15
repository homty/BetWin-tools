[CmdletBinding()]
param(
    [string]$WorkflowRepository = 'git@github.com:homty/AniSlot-Invoke-Workflow.git',
    [string]$InvokeRoot,
    [switch]$DownloadInvoke,
    [switch]$StartServer
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = $PSScriptRoot
$backendManage = Join-Path $repoRoot 'backend\manage.py'
$frontendDirectory = Join-Path $repoRoot 'frontend'
$requirementsFile = Join-Path $repoRoot 'backend\requirements.txt'
$venvDirectory = Join-Path $repoRoot '.betwin-dependencies'
$venvPython = Join-Path $venvDirectory 'Scripts\python.exe'
$sshDirectory = Join-Path $env:USERPROFILE '.ssh'
$deployKey = Join-Path $sshDirectory 'anislot_deploy'
$deployPublicKey = "$deployKey.pub"
$workflowDirectory = Join-Path $repoRoot 'workspaces\anislot'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Command {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' was not found. $InstallHint"
    }
}

function Invoke-Checked {
    param(
        [string]$Description,
        [scriptblock]$Command
    )

    Write-Step $Description
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Test-WorkflowAccess {
    $keyForSsh = $deployKey.Replace('\', '/')
    $sshCommand = "ssh -i `"$keyForSsh`" -o IdentitiesOnly=yes"
    & git -c "core.sshCommand=$sshCommand" ls-remote $WorkflowRepository HEAD 2>$null
    return $LASTEXITCODE -eq 0
}

Write-Host 'BetWin Tools - friend workstation setup' -ForegroundColor Green
Write-Host "Project: $repoRoot"

if (-not (Test-Path -LiteralPath $backendManage) -or -not (Test-Path -LiteralPath $frontendDirectory)) {
    throw 'Run this script from the root of the cloned BetWin-tools repository.'
}

Require-Command -Name 'git' -InstallHint 'Install Git for Windows and restart PowerShell.'
Require-Command -Name 'ssh-keygen' -InstallHint 'Install the Windows OpenSSH client or Git for Windows.'
Require-Command -Name 'py' -InstallHint 'Install Python 3.12 with the Python launcher.'
Require-Command -Name 'node' -InstallHint 'Install Node.js.'
Require-Command -Name 'npm' -InstallHint 'Install Node.js with npm.'

Invoke-Checked -Description 'Checking Python 3.12' -Command {
    & py -3.12 -c 'import sys; print(sys.version)'
}

Write-Step 'Preparing the AniSlot deploy key'
New-Item -ItemType Directory -Path $sshDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $deployKey)) {
    Write-Host 'Create the key now. For unattended local cloning, press Enter twice to leave the passphrase empty.' -ForegroundColor Yellow
    & ssh-keygen -t ed25519 -C "AniSlot read-only $env:USERNAME" -f $deployKey
    if ($LASTEXITCODE -ne 0) {
        throw 'SSH key generation failed.'
    }
}

if (-not (Test-Path -LiteralPath $deployPublicKey)) {
    throw "Public key was not found at $deployPublicKey."
}

if (-not (Test-WorkflowAccess)) {
    Write-Host "`nAdd this public key to:" -ForegroundColor Yellow
    Write-Host 'GitHub -> AniSlot-Invoke-Workflow -> Settings -> Deploy keys -> Add deploy key'
    Write-Host 'Leave Allow write access disabled.'
    Write-Host "`n----- PUBLIC KEY -----" -ForegroundColor Yellow
    Get-Content -LiteralPath $deployPublicKey
    Write-Host '----- END PUBLIC KEY -----' -ForegroundColor Yellow
    Read-Host "After the repository owner adds the key, press Enter to retry"

    if (-not (Test-WorkflowAccess)) {
        throw 'The deploy key still cannot read the private workflow repository.'
    }
}
Write-Host 'Private workflow repository access is working.' -ForegroundColor Green

$keyForSsh = $deployKey.Replace('\', '/')
$sshCommand = "ssh -i `"$keyForSsh`" -o IdentitiesOnly=yes"
if (-not (Test-Path -LiteralPath (Join-Path $workflowDirectory '.git'))) {
    Invoke-Checked -Description 'Cloning the private AniSlot workflow repository' -Command {
        & git -c "core.sshCommand=$sshCommand" clone $WorkflowRepository $workflowDirectory
    }
}
else {
    Invoke-Checked -Description 'Updating the private AniSlot workflow repository' -Command {
        & git -C $workflowDirectory -c "core.sshCommand=$sshCommand" pull --ff-only
    }
}

if (-not (Test-Path -LiteralPath $venvPython)) {
    Invoke-Checked -Description 'Creating the Python virtual environment' -Command {
        & py -3.12 -m venv $venvDirectory
    }
}

Invoke-Checked -Description 'Upgrading pip' -Command {
    & $venvPython -m pip install --upgrade pip
}

Invoke-Checked -Description 'Installing backend dependencies' -Command {
    & $venvPython -m pip install -r $requirementsFile
}

Push-Location $frontendDirectory
try {
    Invoke-Checked -Description 'Installing frontend dependencies' -Command {
        & npm ci
    }
    Invoke-Checked -Description 'Building the frontend' -Command {
        & npm run build
    }
}
finally {
    Pop-Location
}

Invoke-Checked -Description 'Applying database migrations' -Command {
    & $venvPython $backendManage migrate
}

Write-Host "`nSetup completed successfully." -ForegroundColor Green
Write-Host 'AniSlot will use this SSH repository URL:'
Write-Host "  $WorkflowRepository" -ForegroundColor White
Write-Host 'The first clone will be stored in:'
Write-Host "  $workflowDirectory" -ForegroundColor White

if ($DownloadInvoke -or $InvokeRoot) {
    $invokeSetup = Join-Path $repoRoot 'setup-invoke.ps1'
    $invokeArguments = @()
    if ($InvokeRoot) { $invokeArguments += @('-InvokeRoot', $InvokeRoot) }
    if ($DownloadInvoke) { $invokeArguments += '-DownloadLauncher' }

    Write-Step 'Preparing InvokeAI and AniSlot workflow files'
    & $invokeSetup @invokeArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'InvokeAI setup failed.'
    }
}

if ($DownloadInvoke -and -not $InvokeRoot) {
    Write-Host "`nWhen the InvokeAI Launcher has completed its first setup, run:" -ForegroundColor Yellow
    Write-Host '  .\setup-invoke.ps1' -ForegroundColor White
    Write-Host 'The script will ask for the InvokeAI folder selected by your friend.' -ForegroundColor Yellow
}

if ($StartServer) {
    Write-Step 'Starting Django at http://127.0.0.1:8000/'
    & $venvPython $backendManage runserver 127.0.0.1:8000
    exit $LASTEXITCODE
}

Write-Host "`nStart the application with:" -ForegroundColor Cyan
Write-Host "  .\.betwin-dependencies\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000"
Write-Host 'Or run this setup script with -StartServer.'

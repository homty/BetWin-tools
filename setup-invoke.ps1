[CmdletBinding()]
param(
    [string]$InvokeRoot,
    [switch]$DownloadLauncher
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = $PSScriptRoot
$workflowRepository = Join-Path $repoRoot 'workspaces\anislot'
$nodeSource = Join-Path $workflowRepository 'custom_nodes'
$workflowSource = Join-Path $workflowRepository 'workflow\Workflow.json'
$launcherUrl = 'https://github.com/invoke-ai/launcher/releases/latest/download/Invoke.Community.Edition.Setup.latest.exe'
$launcherInstaller = Join-Path $env:TEMP 'Invoke.Community.Edition.Setup.latest.exe'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path -LiteralPath $nodeSource) -or -not (Test-Path -LiteralPath $workflowSource)) {
    throw 'AniSlot workflow files are missing. Run setup-friend.ps1 first so workspaces\\anislot is cloned.'
}

if ($DownloadLauncher) {
    Write-Step 'Downloading the official InvokeAI Launcher'
    Invoke-WebRequest -Uri $launcherUrl -OutFile $launcherInstaller
    Write-Host 'Starting the installer. Choose your InvokeAI install folder, then finish the initial setup in the Launcher.' -ForegroundColor Yellow
    Start-Process -FilePath $launcherInstaller
    Write-Host "`nAfter InvokeAI itself has finished installing, run this command again:" -ForegroundColor Yellow
    Write-Host ".\\setup-invoke.ps1 -InvokeRoot '<your InvokeAI folder>'"
    return
}

if ([string]::IsNullOrWhiteSpace($InvokeRoot)) {
    $InvokeRoot = Read-Host 'Enter the full path to the InvokeAI folder you chose in the Launcher (for example D:\Invoke-AI)'
}

if ([string]::IsNullOrWhiteSpace($InvokeRoot)) {
    throw 'An InvokeAI folder path is required.'
}

$InvokeRoot = [System.IO.Path]::GetFullPath($InvokeRoot)

if (-not (Test-Path -LiteralPath $InvokeRoot)) {
    throw "InvokeAI was not found at '$InvokeRoot'. Install it with: .\\setup-invoke.ps1 -DownloadLauncher, then run this command again with -InvokeRoot <your InvokeAI folder>."
}

$nodeDestination = Join-Path $InvokeRoot 'nodes'
$workflowDestination = Join-Path $InvokeRoot 'workflow_imports'
New-Item -ItemType Directory -Force -Path $nodeDestination, $workflowDestination | Out-Null

Write-Step 'Installing AniSlot custom nodes'
Copy-Item -LiteralPath (Join-Path $nodeSource 'designer_logic') -Destination $nodeDestination -Recurse -Force

Write-Step 'Staging the AniSlot workflow for import'
Copy-Item -LiteralPath $workflowSource -Destination (Join-Path $workflowDestination 'AniSlot-Workflow.json') -Force

Write-Host "`nAniSlot files are ready." -ForegroundColor Green
Write-Host "Custom nodes: $(Join-Path $nodeDestination 'designer_logic')"
Write-Host "Workflow to import: $(Join-Path $workflowDestination 'AniSlot-Workflow.json')"
Write-Host "`nRestart InvokeAI, then use Workflow Editor -> Import to import the staged workflow." -ForegroundColor Yellow
Write-Host 'Before running it, install the models declared in workflow-contract.json through the InvokeAI model manager.' -ForegroundColor Yellow

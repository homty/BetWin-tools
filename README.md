# BetWin Tools

Project layout is split by responsibility:

- `frontend/`: React + TypeScript starting screen and frontend API services.
- `backend/`: Django app, API gateway, templates, static output, tests.

The frontend talks to the model pipeline through the Django API gateway, not
directly from React.

## Run locally

Install/build the frontend once:

```powershell
cd D:\GitHub\BetWin-tools\frontend
npm ci
npm run build
```

Start Django from the backend folder:

```powershell
cd D:\GitHub\BetWin-tools\backend
..\.betwin-dependencies\Scripts\python.exe manage.py migrate
..\.betwin-dependencies\Scripts\python.exe manage.py runserver
```

Open http://127.0.0.1:8000/.

## Friend workstation setup (Windows)

After cloning this repository, run PowerShell from the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-friend.ps1
```

The script checks the required tools, creates or reuses
`%USERPROFILE%\.ssh\anislot_deploy`, verifies access to the private AniSlot
workflow repository, installs backend and frontend dependencies, builds the
frontend, and applies database migrations. If the public key has not been added
to the workflow repository yet, the script displays it and pauses while the
repository owner adds it as a read-only GitHub Deploy Key.

To also download the official InvokeAI Launcher and prepare AniSlot's custom
nodes and workflow after the Launcher installation, use:

```powershell
.\setup-friend.ps1 -DownloadInvoke
```

The InvokeAI Launcher completes its first installation interactively. It lets
the friend choose where InvokeAI is stored. Afterwards, install or refresh the
AniSlot files with:

```powershell
.\setup-invoke.ps1
```

The script asks for the selected InvokeAI folder. You may instead provide it
without an interactive prompt, for example:

```powershell
.\setup-invoke.ps1 -InvokeRoot 'D:\Invoke-AI'
```

This copies the custom node pack into `nodes\designer_logic` and stages the
workflow in `workflow_imports\AniSlot-Workflow.json`. Restart InvokeAI, import
the workflow in its Workflow Editor, and download its required models through
the InvokeAI model manager before sending a job from BetWin.

To start Django immediately after setup:

```powershell
.\setup-friend.ps1 -StartServer
```

## Development

Frontend-only dev server:

```powershell
cd D:\GitHub\BetWin-tools\frontend
npm run dev -- --host 127.0.0.1
```

Production frontend build writes into `backend/static/frontend/`, where Django
serves it:

```powershell
cd D:\GitHub\BetWin-tools\frontend
npm run build
```

Django tests:

```powershell
cd D:\GitHub\BetWin-tools\backend
..\.betwin-dependencies\Scripts\python.exe manage.py test tests
```

## Structure

- `frontend/src/app/main.tsx`: React mount point.
- `frontend/src/pages/welcome/`: welcome screen component and CSS.
- `frontend/src/services/loading.ts`: loading state and promise tracking.
- `frontend/src/services/modelPipeline.ts`: frontend gateway client.
- `backend/api_gateway/`: Django API gateway for model-pipeline communication.
- `backend/dashboard/`, `backend/anislot/`, `backend/prediction_market/`: Django pages.
- `backend/templates/`: Django templates.
- `backend/static/`: Django static files and frontend build output.

## Model Pipeline Gateway

Set the pipeline target with:

```powershell
$env:MODEL_PIPELINE_URL = "http://127.0.0.1:9000/predict"
```

React should call:

```typescript
await sendPipelineRequest({ task: 'predict', payload: {} });
```

The request goes to Django at `/api/pipeline/`; Django forwards the JSON payload
to `MODEL_PIPELINE_URL`. This keeps the browser isolated from pipeline internals.

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

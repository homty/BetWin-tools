# BetWin Tools

Django serves the backend and tool panels. The starting screen is React + TypeScript,
animated with GSAP, @gsap/react and TextPlugin.

## Run locally

Install/build the frontend once (Node.js required):

```powershell
cd D:\GitHub\BetWin-tools\frontend
npm ci
npm run build
cd ..
```

Start Django using your existing Python environment:

```powershell
.\.betwin-dependencies\Scripts\python.exe manage.py migrate
.\.betwin-dependencies\Scripts\python.exe manage.py runserver
```

For a fresh Python environment, create a virtual environment and install
`requirements.txt` first. Open http://127.0.0.1:8000/.

After editing React/TypeScript/CSS, run `npm run build` in `frontend/` and refresh.
During development, `npm run watch` rebuilds on changes; Django serves the output.
Generated assets in `static/frontend/` and `frontend/node_modules/` are ignored by Git.
Build the frontend before deploying or running a fresh checkout.

## Structure

- `frontend/src/Welcome.tsx`: React starting screen and scoped GSAP timelines.
- `frontend/src/welcome.css`: logo, true italic subtitle, responsive sizing.
- `frontend/src/loading.ts`: loading state and promise tracking.
- `frontend/src/main.tsx`: React entry point.
- `templates/dashboard/landing.html`: Django mount and static fallback.
- `dashboard/`, `anislot/`, `prediction_market/`: Django views and routes.
- `static/fonts/`: bundled Montserrat normal/italic fonts and SIL license.

## Animation

BetWin enters left-to-right. Then `tools v1` types character-by-character using
`gsap.to(element, { text: 'tools v1', duration: 1, ease: 'none' })`, matching the
Hello world example. No random symbols or reels.

BetWin: 368 x 115px box, Montserrat Bold 80px, 4px tracking, 21px line height.
Subtitle: 175 x 55px box, Montserrat Medium Italic 45px, zero tracking,
21px line height. The boxes have no gap. Background: #121212.
Bet: #F8FAFC. Win: #CDFF51 0%, #B6FF00 55%, #6D9900 100%.

On normal visits the intro runs once and reveals Enter, linking to /dashboard/.
While application work is pending, the typing repeats and stops on the complete
text at the end of a cycle. Visit /?waiting=1 for a continuous loading preview.
The initials/combined mode assignments remain commented in Welcome.tsx; uncomment
one to enable it. Reduced-motion preferences show static text immediately.

```typescript
await window.betwinIntro.track(
    fetch('/your-endpoint/').then(response => {
        if (!response.ok) throw new Error('Download failed');
        return response.blob();
    }),
);
```

`track()` supports overlapping promises and releases loading on rejection too.
Callers handle download errors. Alternatively call `setLoading(true)`, then
`setLoading(false)` in a finally block. No profile or login step is required.

## Checks

```powershell
cd frontend
npm run build
cd ..
.\.betwin-dependencies\Scripts\python.exe manage.py test tests
```

# Neighbourhood Pulse (JCS Module 1B Challenge B)

Rich web application built with React + Vite that consumes the UK Police open Government API to generate dynamic neighbourhood intelligence.

## Live API used
- Police API docs: https://data.police.uk/docs/
- Base endpoint: `https://data.police.uk/api`

## Core features
- Loads all UK police forces from the API.
- Lets users pick a force and then loads:
  - force profile
  - neighbourhood list for that force
- Lets users filter and pick a neighbourhood, then loads:
  - neighbourhood detail
  - neighbourhood events
  - neighbourhood boundary points
- Uses a boundary coordinate + selected month to run another API call and generate a summarized crime-category view.
- Fully client-side only (no dedicated database required).
- Responsive interface for desktop and mobile.

## Build and run
```bash
npm install
npm run dev
```

Production build:
```bash
npm run build
npm run preview
```




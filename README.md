# CareerAI

Full-stack FYP implementation of CareerAI: a context-aware internship and job recommender with career path simulation.

## Stack

- Frontend: React + Vite + Tailwind
- Backend: FastAPI
- Storage: MongoDB via PyMongo
- Resume parsing: `pypdf` and `python-docx`
- External integrations: GitHub REST API, Jobicy, Arbeitnow, Remote OK, and Jobz.pk Pakistan technology listings

## Run locally

Create a `.env` file from `.env.example`.

Important:

- Set `MONGODB_URI` to your MongoDB Atlas or local MongoDB connection string for real persistence.
- If you want to run without a live MongoDB server during development, set `MONGODB_USE_MOCK=true`.

Start both frontend and backend:

```bash
npm run dev:fullstack
```

Before a presentation, start the backend and run:

```bash
npm run demo:check
```

Or run them separately:

```bash
npm run backend
npm run dev
```

Frontend:

- [http://127.0.0.1:8080](http://127.0.0.1:8080)

Backend:

- [http://127.0.0.1:8012/api/health](http://127.0.0.1:8012/api/health)
- [http://127.0.0.1:8012/docs](http://127.0.0.1:8012/docs)

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Features

- Register/login with persistent backend sessions
- Resume text analysis
- Validated resume upload for PDF and DOCX
- GitHub repository analysis with persisted profile data
- Backend-driven live job recommendations
- Skill-gap analysis
- Career roadmap simulation
- Bookmark persistence

## Gemini chatbot

Create a free-tier API key in Google AI Studio and add it to `.env`:

```env
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.5-flash
```

The backend prefers Gemini when `GEMINI_API_KEY` is configured. Never expose this key through a `VITE_` environment variable.

## GitHub integration

Public GitHub requests have a small anonymous rate limit. Create a free fine-grained personal access token and add:

```env
GITHUB_TOKEN=your_github_personal_access_token
```

No repository permissions are required for analyzing public profiles. The token stays in the backend and must not use a `VITE_` prefix.

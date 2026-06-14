# CareerAI Deployment

## 1. Push to GitHub

Create an empty GitHub repository, then run:

```powershell
cd "D:\Carrer-AI\Carrer-AI"
git init
git add .
git commit -m "Prepare CareerAI for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `.env`. Add secrets only in Render and Vercel.

## 2. Deploy the API on Render

1. In Render, choose **New > Blueprint**.
2. Connect the GitHub repository.
3. Render will read `render.yaml`.
4. Add these secret environment variables:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_gemini_key
GITHUB_TOKEN=your_github_token
CORS_ORIGINS=https://YOUR_VERCEL_DOMAIN.vercel.app
```

5. Keep `MONGODB_USE_MOCK=false`.
6. Deploy and verify:

```text
https://YOUR_RENDER_SERVICE.onrender.com/api/health
```

## 3. Deploy the frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Keep the detected framework as **Vite**.
3. Add:

```env
VITE_API_BASE_URL=https://YOUR_RENDER_SERVICE.onrender.com/api
VITE_DISABLE_LOCAL_API_FALLBACK=true
```

4. Deploy.
5. Copy the final Vercel domain into Render's `CORS_ORIGINS`, then redeploy Render.

## 4. Final checks

- Register a new user.
- Upload a PDF or DOCX resume.
- Connect a GitHub username.
- Select a target role.
- Open an exact job posting.
- Save and remove a bookmark.
- Ask Aira a question.
- Refresh the page and sign in again.

Render free services can sleep when idle, so open the API health URL shortly before a live demonstration.

## 5. Automatic job refresh on free hosting

The backend refreshes jobs every 30 minutes while it is running. The repository also includes a GitHub Actions schedule that wakes a sleeping free service.

After the backend is deployed:

1. Open the GitHub repository.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add a repository secret:

```text
Name: CAREERAI_API_URL
Value: https://YOUR_BACKEND_SERVICE.onrender.com
```

The workflow runs every 30 minutes. GitHub scheduled workflows can start a few minutes late during busy periods.

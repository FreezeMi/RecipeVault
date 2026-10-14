# Recipe Vault

A beautifully designed, personal full-stack recipe management application built with a modern, high-performance tech stack. 

The application allows you to create, edit, manage, and discover your personal culinary vault. Built completely from scratch with a clean, mellow-white aesthetic, featuring satisfying animations, comprehensive filtering, and local SQLite data persistence.

## ✨ Features

- **Full CRUD functionality:** Add, view, edit, and delete recipes.
- **Data Backup & Restore:** Export your entire vault as a JSON file and restore it later. Restoring only ever *adds* recipes: titles already in the vault (case-insensitive) are skipped, and the whole import is written atomically.
- **Authentication:** Protected recipe management. Public visitors can view and search recipes, while only the authenticated admin can add, edit, or delete them.
- **Multi-Tag System & Favorites:** Assign multiple tags to any recipe (e.g., Breakfast, Dessert, Seafood, Vegan) and filter your vault effortlessly. Mark your best recipes as favorites.
- **Smart Search:** Case-insensitive search across titles, descriptions, ingredients and tags. Filters live in the URL, so they survive refreshes and the Back button.
- **Shareable URLs:** Every recipe has its own address (`/recipes/12`), so links, refreshes and browser navigation all work.
- **Cooking Mode Touches:** Tick off ingredients as you go; reorder steps while editing.
- **Modern UI/UX:** Built with Tailwind CSS v4 and Framer Motion for a premium, agency-quality bright-mode aesthetic with satisfying micro-interactions.
- **Responsive Design:** Works flawlessly on desktop and mobile browsers. Heavily optimized to disable expensive visual effects (like frosted glass) on smartphones to ensure buttery-smooth scrolling.
- **Easy Images:** No complex file uploading required—simply paste direct image URLs or use placeholders (e.g. `https://picsum.photos/800/600`).

## 🛠️ Technology Stack

**Frontend:**
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (Build tool)
- [Tailwind CSS v4](https://tailwindcss.com/) (Styling system)
- [Framer Motion](https://motion.dev/) (Animations & View transitions)
- [Phosphor Icons](https://phosphoricons.com/) (Iconography)

**Backend:**
- [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (RESTful API)
- [TypeScript](https://www.typescriptlang.org/)
- [Prisma ORM](https://www.prisma.io/) (Database access & modeling)
- [Supabase (PostgreSQL)](https://supabase.com/) (Production database)

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm (Node Package Manager)
- A free [Supabase](https://supabase.com/) account and project.

## 🛠️ Local Installation & Setup

1. **Install all dependencies:**
   From the root directory, install all workspace packages with a single command:
   ```bash
   npm run install:all
   ```

2. **Configure Environment Variables:**
   Create `.env` files in both `backend` and `frontend` folders using the provided `.env.example` templates.
   - In `backend/.env`, set your `SESSION_SECRET` to a long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. It is **required in production**: the server refuses to start without it.
   - In `backend/.env`, set your `DATABASE_URL` to your Supabase PostgreSQL connection string (direct or session pooler string).
   - In `frontend/.env`, you can leave `VITE_API_URL` as default for local development.

3. **Initialize the Database:**
   Navigate into the backend and apply the migrations to your database:
   ```bash
   cd backend
   npm run db:migrate
   ```
   *(Optional)* Add a few starter recipes. The seed never deletes anything; it only adds recipes whose title isn't already in the vault:
   ```bash
   npm run db:seed
   ```

4. **Create the Admin Account:**
   While still in the `backend` folder, run the bootstrap script to securely create your personal login account in your Supabase database:
   ```bash
   npm run create-admin
   ```
   Follow the prompts to set your email and password (minimum 12 characters; input is hidden).
   Forgot your password? Run `npm run create-admin` again. When an account already exists it offers to reset the password (and signs out all sessions).

5. **Start the Application Locally:**
   From the root directory, start both the frontend and backend concurrently:
   ```bash
   cd ..
   npm run dev
   ```
   The application will now be running on `http://localhost:5173`. 
   The backend API runs on `http://localhost:3001`.

## 🚀 Deployment

This application is designed to be easily hosted on free-tier services.

**1. Supabase (Database)**
- Create a project on Supabase and grab the **Session Pooler** IPv4 Connection String (port 5432). 
- Ensure your Prisma schema `provider` is set to `"postgresql"`.

**2. Render (Backend)**
- Create a new Web Service on Render pointing to your GitHub repository.
- **Root Directory**: `backend`
- **Build Command**: `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/api/health`
- **Environment Variables**:
  - `DATABASE_URL`: the Supabase session pooler string.
  - `SESSION_SECRET`: required; use a long random value (32+ characters).
  - `NODE_ENV=production`: enables secure cross-site cookies, HSTS and proxy trust.
  - `FRONTEND_URL`: your Vercel URL. Several origins can be comma-separated (e.g. production + preview).
  - *(Optional)* `TRUST_PROXY`: defaults to `1` in production, which is correct for Render.

**3. Vercel (Frontend)**
- Create a new project on Vercel pointing to your GitHub repository.
- **Root Directory**: `frontend`
- **Framework Preset**: Vite
- **Environment Variables**: Add `VITE_API_URL` pointing to your Render backend URL (e.g., `https://your-backend.onrender.com/api`).
- `frontend/vercel.json` rewrites all routes to `index.html` so deep links like `/recipes/12` work on refresh, and adds caching and security headers.

## 📸 Using Images

To keep the application simple and self-contained without needing cloud storage or complicated file upload handling, **Recipe Vault** uses image URLs.
- **Web Images:** Find an image on Google, Imgur, or Unsplash, right-click, and select "Copy Image Address", then paste it into the recipe form.
- **Placeholders:** Don't have a picture? Paste `https://picsum.photos/800/600` into the image box, and it will automatically generate a beautiful, random, high-quality stock photo for your recipe.

## 🎨 Customization

**Recipe Tags**
The tags used for classifying recipes are fully customizable. You can add, remove, or re-order the tags by editing a single array located at:
`frontend/src/constants.ts`
Any changes made to this file will immediately reflect in both the recipe search filters and the recipe creation form.

## 🧪 Testing

The project includes comprehensive testing for both the frontend and backend, automated via a **GitHub Actions CI Pipeline**. Every push to the repository automatically spins up a PostgreSQL service and runs the full test suite.

### Frontend Tests
The frontend uses [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/react) to verify component rendering and user interactions in a simulated DOM environment (`jsdom`).

To run the frontend tests:
```bash
cd frontend
npm run test
```

### Backend Tests
The backend uses the native Node.js test runner and [Supertest](https://github.com/ladjs/supertest) to verify validation, the REST API endpoints and authentication logic.

The API tests write to the database, so they **refuse to run against anything except a local database** (set `ALLOW_REMOTE_TEST_DB=1` to override). Start a throwaway PostgreSQL with Docker and point the tests at it:
```bash
docker run -d --name recipevault-testdb -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=recipevault_test -p 55432:5432 postgres:15
cd backend
export DATABASE_URL="postgresql://test:test@localhost:55432/recipevault_test"
npm run db:migrate
npm run typecheck
npm run test
```

### Continuous Integration
The GitHub Actions pipeline type-checks, tests and builds both apps, applies the real migration history to a fresh PostgreSQL service, and fails if `schema.prisma` has drifted from the migrations.

## 📁 Project Structure

```text
RecipeVault/
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI pipeline
├── package.json             # Root workspace manager (concurrently scripts)
├── .gitignore               # Root gitignore rules
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # PostgreSQL database schema
│   │   └── seed.ts          # Seed data script
│   ├── src/
│   │   ├── server.ts        # Entry point (listen, graceful shutdown)
│   │   ├── app.ts           # Express app: middleware, routes, error handling
│   │   ├── config.ts        # Environment configuration
│   │   ├── recipes.ts       # Recipe routes (CRUD, favorites, backup restore)
│   │   ├── validation.ts    # Input validation & normalization
│   │   ├── auth.ts          # Authentication routes & session middleware
│   │   ├── http.ts          # Security headers, CSRF origin check, errors
│   │   ├── dbCheck.ts       # Periodic database keep-alive ping
│   │   └── scripts/         # Admin creation / password reset CLI
│   ├── tests/
│   │   ├── unit/            # Validation unit tests
│   │   └── api/             # Backend API & Authentication tests
│   └── package.json
└── frontend/
    ├── src/
    │   ├── __tests__/       # Frontend component tests
    │   ├── components/      # React components (screens + shared UI)
    │   ├── lib/             # Router, hooks, recipe helpers
    │   ├── services/        # API client
    │   ├── types/           # TypeScript interfaces
    │   ├── App.tsx          # Main application router/shell
    │   ├── constants.ts     # Editable global constants (e.g. Tags)
    │   ├── index.css        # Tailwind CSS definitions
    │   ├── setupTests.ts    # Vitest testing environment setup
    │   └── main.tsx         # React mount point
    ├── index.html           # HTML entry point
    ├── vite.config.ts       # Vite configuration
    └── package.json
```

## 🤝 Contributing
As this is a personal recipe vault, direct contributions are not expected, but feel free to fork the repository to build your own localized recipe manager.

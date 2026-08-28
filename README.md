# Recipe Vault

A beautifully designed, personal full-stack recipe management application built with a modern, high-performance tech stack. 

The application allows you to create, edit, manage, and discover your personal culinary vault. Built completely from scratch with a clean, mellow-white aesthetic, featuring satisfying animations, comprehensive filtering, and local SQLite data persistence.

## ✨ Features

- **Full CRUD functionality:** Add, view, edit, and delete recipes.
- **Authentication:** Protected recipe management. Public visitors can view and search recipes, while only the authenticated admin can add, edit, or delete them.
- **Multi-Tag System & Favorites:** Assign multiple tags to any recipe (e.g., Breakfast, Dessert, Seafood, Vegan) and filter your vault effortlessly. Mark your best recipes as favorites.
- **Smart Search:** Quickly find recipes by title or ingredients.
- **Modern UI/UX:** Built with Tailwind CSS v4 and Framer Motion for a premium, agency-quality bright-mode aesthetic with satisfying micro-interactions.
- **Responsive Design:** Works flawlessly on desktop and mobile browsers.
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
   - In `backend/.env`, set your `SESSION_SECRET` (e.g., `SESSION_SECRET="your_secure_random_string"`).
   - In `backend/.env`, set your `DATABASE_URL` to your Supabase PostgreSQL connection string (direct or session pooler string).
   - In `frontend/.env`, you can leave `VITE_API_URL` as default for local development.

3. **Initialize the Database:**
   Navigate into the backend and initialize your Supabase database. This will push your schema to Supabase:
   ```bash
   cd backend
   npx prisma migrate dev --name init
   ```
   *(Optional)* Populate the database with starter recipes:
   ```bash
   npm run db:seed
   ```

4. **Create the Admin Account:**
   While still in the `backend` folder, run the bootstrap script to securely create your personal login account in your Supabase database:
   ```bash
   npm run create-admin
   ```
   Follow the prompts to set your email and password (minimum 12 characters).

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
- **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**: Add your `DATABASE_URL` (the Supabase session pooler string), `SESSION_SECRET`, and `FRONTEND_URL` (your Vercel URL, without the trailing slash).

**3. Vercel (Frontend)**
- Create a new project on Vercel pointing to your GitHub repository.
- **Root Directory**: `frontend`
- **Framework Preset**: Vite
- **Environment Variables**: Add `VITE_API_URL` pointing to your Render backend URL (e.g., `https://your-backend.onrender.com/api`).

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

The backend includes a native Node.js test suite to verify the REST API functionality. It tests the full lifecycle of recipe CRUD operations, searching, and filtering.

To run the backend tests:
1. Ensure the development server is running (`npm run dev`) or start the backend manually.
2. Open a new terminal and run:
```bash
cd backend
npm run test
```

## 📁 Project Structure

```text
RecipeApp/
├── package.json             # Root workspace manager (concurrently scripts)
├── .gitignore               # Root gitignore rules
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # SQLite database schema
│   │   ├── seed.ts          # Seed data script
│   │   └── dev.db           # Local SQLite database file
│   ├── src/
│   │   ├── server.ts        # Express REST API endpoints
│   │   ├── auth.ts          # Authentication routes & logic
│   │   └── scripts/         # Admin creation CLI scripts
│   ├── test.ts              # Native Node.js API test suite
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/      # React functional components
    │   ├── services/        # API wrapper functions
    │   ├── types/           # TypeScript interfaces
    │   ├── App.tsx          # Main application router/shell
    │   ├── constants.ts     # Editable global constants (e.g. Tags)
    │   ├── index.css        # Tailwind CSS definitions
    │   └── main.tsx         # React mount point
    ├── index.html           # HTML entry point
    ├── vite.config.ts       # Vite configuration
    └── package.json
```

## 🤝 Contributing
As this is a personal recipe vault, direct contributions are not expected, but feel free to fork the repository to build your own localized recipe manager.

# TheraScope - Visibility, Control, Intelligence

A modern therapy management dashboard for real-time facility monitoring and documentation.

## Deploy to Vercel (5 Minutes!)

### Option 1: Deploy via Vercel Website (Easiest)

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up** using GitHub, GitLab, or Bitbucket (or email)
3. **Click "Add New Project"**
4. **Import this project:**
   - Click "Import Git Repository" or upload the folder directly
   - If using Git: Connect your GitHub account and select this repository
   - If uploading: Drag and drop the entire `therascope-deploy` folder
5. **Configure Project:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build` (should auto-detect)
   - Output Directory: `dist` (should auto-detect)
6. **Click "Deploy"**
7. **Done!** Your site will be live at `https://your-project-name.vercel.app`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to project directory
cd therascope-deploy

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Customization

- **Update Google Docs Form Link:** Edit `src/App.jsx` line 49 and replace `YOUR_FORM_ID`
- **Add More Facilities:** Edit the `facilities` state in `src/App.jsx`
- **Add More Documents:** Edit the `documents` state in `src/App.jsx`

## Features

- 📊 Real-time facility monitoring
- 📁 Document management system
- 📝 Weekly report submission
- 🔄 Ready for Nethealth integration
- 📱 Responsive design
- ⚡ Fast performance

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Lucide Icons

---

**Need help?** Contact your development team or check [Vercel's documentation](https://vercel.com/docs)

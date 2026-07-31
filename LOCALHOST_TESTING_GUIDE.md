# Localhost Testing Guide for Advantage Portal

This guide provides exact steps to set up and test the Advantage Portal project on your local machine.

## Prerequisites

Before starting, ensure you have the following installed:

```bash
# Check Node.js version (requires v18+)
node --version

# Check npm version (requires v9+)
npm --version
```

If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/) (LTS version recommended).

---

## Step 1: Clone the Repository

If you haven't already cloned the repository:

```bash
git clone http://local_proxy@127.0.0.1:42561/git/braydenokley13-ux/Advantage-Portal
cd Advantage-Portal
```

If you already have the repository, navigate to it:

```bash
cd /path/to/Advantage-Portal
```

---

## Step 2: Ensure You're on the Correct Branch

```bash
# Check current branch
git branch

# If not on the correct branch, switch to it
git checkout claude/localhost-testing-guide-brJT0

# Pull latest changes
git pull origin claude/localhost-testing-guide-brJT0
```

---

## Step 3: Install Dependencies

```bash
# Install all project dependencies
npm install
```

**What this does:** Installs all required packages listed in `package.json`, including:
- Next.js (React framework)
- React and React DOM
- UI components (Radix UI)
- Styling libraries (Tailwind CSS)
- TypeScript
- Other utilities

**Expected time:** 2-5 minutes depending on internet speed

---

## Step 4: Start the Development Server

```bash
# Start the Next.js development server
npm run dev
```

**Output should look like:**
```
  ▲ Next.js 15.1.0
  - Local:        http://localhost:3000
  - Environments: .env.local

  ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

**What this does:**
- Starts the development server on `http://localhost:3000`
- Enables hot-reload (code changes refresh automatically)
- Provides detailed error messages in the browser and terminal

---

## Step 5: Access the Application in Your Browser

```bash
# Open your browser and navigate to:
http://localhost:3000
```

Or copy-paste the URL from the terminal output.

**Expected behavior:**
- Page loads successfully
- No console errors in browser DevTools
- All UI components render correctly

---

## Step 6: Test the Application

### 6.1 Manual Testing in Browser

1. **Open Browser DevTools** (F12 or Right-click → Inspect)
2. **Check Console Tab** for any JavaScript errors (should be empty)
3. **Check Network Tab** to verify all resources load successfully
4. **Test Interactive Features:**
   - Click buttons and verify they respond
   - Test navigation between pages
   - Check form inputs work correctly
   - Verify styles load properly (no unstyled elements)

### 6.2 Run Linting (Code Quality Check)

In a new terminal window (keep dev server running):

```bash
# Check for code style and quality issues
npm run lint
```

**Expected output:** No errors or warnings

### 6.3 Run Type Checking

```bash
# Check TypeScript types for errors
npm run typecheck
```

**Expected output:** No type errors

### 6.4 Test Hot Reload (Optional)

1. Open a component file in your editor (e.g., `components/ui/button.tsx`)
2. Make a small change (e.g., change button text)
3. Save the file
4. Browser should refresh automatically
5. Verify the change appears in the browser

---

## Step 7: Build for Production (Optional)

To test the production build:

```bash
# Create production build
npm run build
```

**Expected output:**
```
✓ Compiled successfully
✓ Lint checks passed
```

### Run Production Server

```bash
# Start the production server
npm start
```

Access at: `http://localhost:3000`

To stop: Press `Ctrl+C`

---

## Troubleshooting

### Port 3000 Already in Use

```bash
# If port 3000 is in use, use a different port
npm run dev -- -p 3001
```

Then access at `http://localhost:3001`

### Dependencies Installation Issues

```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Module Not Found Errors

```bash
# Ensure all dependencies are installed
npm install

# Check for missing dependencies
npm audit
```

### Hot Reload Not Working

1. Restart the dev server: `Ctrl+C` then `npm run dev`
2. Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. Clear browser cache if needed

### TypeScript Errors

```bash
# Verify TypeScript configuration
npm run typecheck

# Fix common issues
npm install --save-dev typescript@latest
```

### Build Fails

```bash
# Clean build cache and rebuild
rm -rf .next
npm run build
```

---

## Complete Quick Start (All Commands)

Copy and run these commands in sequence:

```bash
# 1. Navigate to project directory
cd /path/to/Advantage-Portal

# 2. Checkout correct branch
git checkout claude/localhost-testing-guide-brJT0
git pull origin claude/localhost-testing-guide-brJT0

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev

# 5. Open browser to http://localhost:3000
# (Keep terminal open - press Ctrl+C to stop server)
```

---

## Key Endpoints & Routes

After starting the dev server, test these routes:

```
http://localhost:3000/          # Home page
http://localhost:3000/api/*     # API routes (if any exist)
```

Check the `app/` directory for available pages and routes.

---

## Environment Variables

Currently, the project doesn't require environment variables. If `.env.local` is needed in the future:

```bash
# Create .env.local file in project root
cp .env.example .env.local  # if .env.example exists

# Edit .env.local with your values
nano .env.local
```

---

## Performance Testing (Optional)

```bash
# Build and measure performance
npm run build

# Check bundle size
npm run build
# Look for size output in build logs
```

---

## Stopping the Development Server

In the terminal running the dev server:

```bash
# Press Ctrl+C to stop
^C
```

The server will shut down and you'll return to the command prompt.

---

## Next Steps

1. ✅ Dependencies installed
2. ✅ Development server running
3. ✅ Application accessible at localhost:3000
4. ✅ Code changes auto-reload
5. ✅ Tests and linting pass

Your local testing environment is ready!

---

## Additional Resources

- **Next.js Documentation:** https://nextjs.org/docs
- **React Documentation:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com/docs
- **TypeScript:** https://www.typescriptlang.org/docs

---

## Questions or Issues?

If you encounter any problems:

1. Check the error message in the terminal or browser console
2. Review the troubleshooting section above
3. Try the suggested fix
4. If issue persists, document the error and seek help

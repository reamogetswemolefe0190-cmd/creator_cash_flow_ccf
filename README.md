# ⚡ Creator Cash Flow | Financial OS for Content Creators

> **Creator Cash Flow** is a unified financial dashboard designed for content creators (YouTube, TikTok, Twitch, Patreon, Substack, Stripe) to track gross social revenue, monitor business expenses, discover tax write-offs, and calculate real-time net cash flow.

![Creator Cash Flow MVP](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80)

---

## ✨ Features

- **📊 Financial Overview KPI Dashboard:**
  - Net Cash Flow calculation (`Gross Social Revenue - Business Expenses`)
  - Real-time 30% Estimated Tax Reserve calculation
  - Revenue vs. Expense monthly trend charts (Chart.js)
  - Revenue source distribution breakdown

- **📂 Universal CSV & Statement Smart Importer:**
  - Drag-and-drop file upload engine for YouTube Studio CSVs, TikTok Creator Fund summaries, Patreon payout reports, and Bank CSVs.
  - Live pre-import data preview table with instant ledger ingestion.
  - Includes a downloadable sample CSV template for instant demo testing.

- **🔗 Connected Accounts Hub (Sandbox & API Ready):**
  - Integrated OAuth developer sandbox flows for YouTube, TikTok, Twitch, Patreon, and Stripe.
  - Plaid Sandbox integration for bank account feeds and expense debit tracking.

- **📑 Consolidated Ledger & Tax Write-off Engine:**
  - Unified transaction history with category tagging.
  - Automated detection of tax-deductible creator expenses (Adobe CC, camera gear, hosting, video editors).
  - Built-in Beta Feedback modal for collecting user insights during market testing.

---

## 🛠️ Technology Stack

- **Frontend Core:** HTML5, Modern ES6+ JavaScript, Vanilla CSS3 (Dark Glassmorphism UI)
- **Design System:** Custom HSL/Hex CSS design tokens, responsive CSS Grid & Flexbox
- **Libraries:**
  - [Chart.js](https://www.chartjs.org/) for interactive financial visualizations
  - [Lucide Icons](https://lucide.dev/) for crisp UI icon typography
  - [Google Fonts (Plus Jakarta Sans)](https://fonts.google.com/specimen/Plus+Jakarta+Sans)

---

## 🚀 Quick Start (Local Development)

No heavy installation or npm dependencies required!

### Option 1: Python HTTP Server
```bash
# Navigate to the project root directory
cd "path/to/Creator-Cash-Flow"

# Start local server
python -m http.server 3000
```
Open `http://localhost:3000` in your web browser.

### Option 2: VS Code Live Server
Simply open `index.html` with the **Live Server** extension in VS Code.

---

## 🌐 Hosting on GitHub Pages (Public Beta Setup)

1. Create a new repository on [GitHub](https://github.com/new) named `creator-cash-flow`.
2. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial release of Creator Cash Flow MVP"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/creator-cash-flow.git
   git push -u origin main
   ```
3. Enable GitHub Pages:
   - Go to your repository **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Branch**, select `main` and `/ (root)`.
   - Click **Save**.
   - Your live public MVP URL will be: `https://YOUR_USERNAME.github.io/creator-cash-flow/`

---

## 🔒 License & Copyright

**All Rights Reserved © 2026 Creator Cash Flow**

*Strictly private and proprietary software. Unauthorized copying, reverse engineering, distribution, or commercial use of this codebase, design system, or intellectual property is strictly prohibited.*

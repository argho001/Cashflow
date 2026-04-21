# Cashflow - Premium Personal Finance Management System

Cashflow is a modern, secure, and beautiful financial dashboard built with vanilla JavaScript and backed by Supabase.

## 🚀 Deployment to Vercel

### 1. Push to GitHub
Create a new repository on GitHub and push your local code:
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### 2. Connect to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New"** -> **"Project"**.
3. Import your GitHub repository.
4. Keep the default settings (Vercel will detect the project automatically).
5. Click **"Deploy"**.

### 3. Environment Variables (Optional but Recommended)
Standard Supabase values are currently in `supabase-config.js`. For enhanced security:
1. Create a `.env` file locally (ignored by git).
2. In Vercel, go to **Settings** -> **Environment Variables**.
3. Add `SUPABASE_URL` and `SUPABASE_KEY`.

---

## 🛠️ Features
- **Secure Authentication**: Built with Supabase Auth.
- **Cloud Database**: Real-time sync for transactions, budgets, goals, and more.
- **Dynamic Charts**: Interactive spending breakdown and 7-day trend bars.
- **Personalized Profile**: Automated avatars and user details.
- **Mobile Responsive**: Works perfectly on any device.

## 👥 Meet the Team (Group - 1)
- Debangshu Saha Arghya (2023-2-60-040)
- Maharun Nesa Tanni (2023-1-60-190)
- Kh Tania Akter Tamanna (2023-2-60-070)
- Rumaia Hossain Katha (2021-1-60-107)

---
*Developed for CSE347 project.*

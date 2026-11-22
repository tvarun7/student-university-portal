# 🚀 Deployment Guide — Student University Portal

## What You Need (Before Starting)
- [ ] GitHub account (you have: tvarun7)
- [ ] Render account (you already have one)
- [ ] Gemini API key — get free at https://aistudio.google.com/apikey
- [ ] Git installed on your computer ✅ (already installed)

---

## STEP 1 — Create New GitHub Repository

1. Go to https://github.com/new
2. Repository name: **`student-university-portal`**
3. Description: `Student University Academic Portal — Angular, Express, PostgreSQL, AI Study Assistant`
4. Set to **Public**
5. ❌ Do NOT check "Add README" (we already have one)
6. Click **Create repository**

---

## STEP 2 — Push Code to GitHub

Open **Command Prompt** or **PowerShell** and run these commands:

```powershell
cd "d:\website handling\student-university-portal-new"

git init
git add .
git commit -m "Initial commit: Student University Portal v2"
git branch -M main
git remote add origin https://github.com/tvarun7/student-university-portal.git
git push -u origin main
```

> If git asks for login, use your GitHub username and a Personal Access Token
> (not your password). Create one at: https://github.com/settings/tokens

---

## STEP 3 — Create Render PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click **New +** → **PostgreSQL**
3. Settings:
   - Name: `student-university-db`
   - Database: `university`
   - User: `university_user`
   - Region: Singapore (closest to India)
   - Plan: **Free**
4. Click **Create Database**
5. Wait ~2 minutes for it to be ready
6. **Copy the "Internal Database URL"** — you'll need it in Step 4

---

## STEP 4 — Create Render Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repo: `tvarun7/student-university-portal`
3. Settings:
   | Field | Value |
   |---|---|
   | Name | `student-university-portal` |
   | Region | Singapore |
   | Branch | `main` |
   | Runtime | Node |
   | Build Command | `npm ci --include=dev && npm --prefix client ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Plan | **Free** |

4. Click **Advanced** → Add these **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `DATABASE_URL` | (paste Internal Database URL from Step 3) |
   | `TRUST_PROXY` | `1` |
   | `AI_ENABLED` | `true` |
   | `GEMINI_API_KEY` | (your Gemini API key from aistudio.google.com) |
   | `GEMINI_MODEL` | `gemini-2.0-flash` |

5. Click **Create Web Service**
6. Wait ~5 minutes for first build to complete

---

## STEP 5 — Create Admin Account (One-Time Setup)

After the site is deployed:

1. In Render dashboard → your Web Service → **Environment** tab
2. Add temporarily:
   - `BOOTSTRAP_ADMIN_USERNAME` = `administrator` (or whatever you want)
   - `BOOTSTRAP_ADMIN_PASSWORD` = your chosen password (min 12 chars)
3. In Render → **Shell** tab, run:
   ```
   npm run bootstrap:admin
   ```
4. ✅ Admin created! Now **remove** `BOOTSTRAP_ADMIN_PASSWORD` from env vars (keep the username)

---

## STEP 6 — Run the Seed Script (Add All Student Data)

> ⚠️ This seeds ~1,080 students across 3 departments × 4 years × 3 batches × 30 students
> It may take 10–20 minutes to complete on Render free tier due to attendance records

**Option A — Render Shell (recommended):**
1. Render dashboard → Web Service → **Shell** tab
2. Run:
   ```
   npm run seed
   ```
3. Wait for completion — you'll see department progress printed

**Option B — Run locally with production DB:**
```powershell
cd "d:\website handling\student-university-portal-new"
# Create a .env file with DATABASE_URL set to your Render EXTERNAL database URL
npm run seed
```

After seeding, your credentials file `ALL-CREDENTIALS.txt` is generated with every username and password.

---

## STEP 7 — Verify the Site

1. Open your site: `https://student-university-portal.onrender.com`
2. Log in as Admin → verify departments, batches, students exist
3. Log in as a student (from ALL-CREDENTIALS.txt) → verify courses, attendance, marks
4. Test the AI assistant: ask "Show my attendance" or "Give me notes on [topic]"

---

## 🔑 Admin Credentials

| Field | Value |
|---|---|
| **Username** | whatever you set in BOOTSTRAP_ADMIN_USERNAME |
| **Password** | whatever you set in BOOTSTRAP_ADMIN_PASSWORD |
| **Role** | Admin |
| **Login URL** | https://student-university-portal.onrender.com |

---

## 📊 Data Summary After Seeding

| Item | Count |
|---|---|
| Departments | 3 (CSE, Civil Engineering, Mechanical Engineering) |
| Years per dept | 4 (1st, 2nd, 3rd, 4th) |
| Batches per year | 3 |
| Students per batch | 30 |
| **Total students** | **~1,080** |
| Staff (1 per course per batch) | ~400+ |
| Special students | Thumma Vishal (CSE-7-1-B1), Thumma Varun (CSE-2-1-B1) |
| Attendance records | ~Sep–Nov 2026 (Mon–Fri, ~65 days) |
| Exam timetable | CSE 4th yr: Nov 30–Dec 3 (Room 2003), CSE 2nd yr: Nov 30–Dec 5 (Room 2002) |

---

## 🤖 AI Study Assistant Capabilities

When a student logs in and uses the Study Assistant, Gemini can:

| Student asks | AI responds with |
|---|---|
| "Show my attendance" | Per-course attendance % with risk flags |
| "Show my marks" | Internal scores per component |
| "Give me notes on neural networks" | Structured notes (enrolled courses only) |
| "YouTube links for Blockchain" | Search queries and links |
| "Free resources for Compiler Design" | NPTEL, MIT OCW, GeeksForGeeks links |
| "When is my exam?" | Exam timetable from portal |
| Non-academic question | "I'm not supposed to answer these kinds of questions" |
| Course not enrolled in | "I can only help with your enrolled courses" |

---

## 🔄 Auto-Deploy

Every time you push code to GitHub (`git push`), Render will:
1. Run GitHub Actions CI (tests + build check)
2. Auto-deploy to production if CI passes

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| Site shows 503 on first open | Wait 30 sec — Render free tier hibernates |
| Seed fails "users already exist" | Log in as admin → delete existing non-admin users first |
| AI says "not configured" | Check GEMINI_API_KEY and AI_ENABLED=true in Render env vars |
| Login fails | Check username/password in ALL-CREDENTIALS.txt |
| Build fails | Check Render build logs — usually a missing env var |

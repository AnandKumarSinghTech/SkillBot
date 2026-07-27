# 🎯 SkillBot — AI-Powered Skill Gap Analyzer Chatbot

A full-stack conversational chatbot that analyzes your current skills against your target job role, identifies gaps, and generates a personalized step-by-step learning roadmap — powered by **Groq (Llama 3.3)**.

## 📸 Features

- 🤖 **Multi-turn AI conversation** — remembers full chat history across messages
- 🔍 **Skill gap analysis** — identifies skills you have ✅ and skills you're missing ❌
- 🗺️ **Personalized learning roadmap** — step-by-step plan with direct course links
- 📄 **Resume upload** — supports PDF, Word (.docx), and TXT files
- 💡 **AI-generated follow-up suggestions** — context-aware chips after every reply
- 💬 **Recent chats sidebar** — switch between past conversations anytime
- ✅ **Progress tracker** — check off skills as you complete them
- 🗑️ **Delete chats** — remove conversations you no longer need
- 🌙 **Dark mode UI** — clean, responsive interface built with vanilla HTML/CSS/JS
- 🔗 **Direct course links** — routes to Coursera, Udemy, GeeksforGeeks, freeCodeCamp, YouTube, W3Schools, and more

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Backend | Node.js, Express.js |
| AI Model | Groq API — Llama 3.3 70B Versatile |
| Database | SQLite (via better-sqlite3) |
| Resume Parsing | pdfjs-dist (PDF), Mammoth (Word) |
| File Upload | Multer |

---

## 💬 How It Works

```
User opens app
      ↓
Bot greets → asks for target job role
      ↓
Bot asks 1-2 questions about current skills
      ↓
Bot delivers skill gap analysis
   ✅ Skills you have
   ❌ Skills you're missing
   🔥 Priority gaps
      ↓
Bot generates step-by-step learning roadmap
with direct links to courses on real platforms
      ↓
AI generates 4 follow-up suggestion chips
      ↓
User tracks progress in sidebar
      ↓
All chats saved — resume anytime
```

---

## 📄 Resume Upload

Upload your resume and the bot will automatically use it to personalize the skill gap analysis. Supported formats:

- `.pdf` — text-based PDFs (not scanned images)
- `.docx` / `.doc` — Microsoft Word documents
- `.txt` — plain text files
- Max file size: **5MB**

After uploading, a prompt modal appears letting you choose what to ask the AI — analyze gaps, build a roadmap, find matching roles, or just give the AI access and ask freely.

---

## 🔗 Supported Learning Platforms

Course links are generated directly to the most relevant platform for each skill:

| Platform | Best For |
|---|---|
| Coursera | Python, ML, AI, professional certificates |
| Udemy | Project-based practical courses |
| YouTube | Free video tutorials |
| GeeksforGeeks | DSA, algorithms, CS concepts |
| W3Schools | HTML, CSS, JavaScript, SQL basics |
| freeCodeCamp | Web dev, Python, free certifications |
| edX | University-level courses |
| Codecademy | Interactive coding practice |
| MDN | JavaScript, web APIs, browser docs |
| MIT OpenCourseWare | Advanced CS, math, algorithms |

---

## 📦 Dependencies

```json
{
  "express": "^4.18.2",
  "groq-sdk": "^0.3.3",
  "multer": "^1.4.5-lts.1",
  "dotenv": "^16.3.1",
  "better-sqlite3": "^9.4.3",
  "mammoth": "^1.6.0",
  "pdfjs-dist": "^3.11.174"
}
```

---

## 🔒 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `GROQ_API_KEY` | Your Groq API key from console.groq.com | ✅ Yes |
| `PORT` | Server port (default: 3000) | ❌ Optional |

---

## 📝 Scripts

```bash
npm start       # Start the server
npm run dev     # Start with auto-reload (nodemon)
```

---

## 🚧 Future Improvements

- [ ] User authentication and accounts
- [ ] Email progress reports
- [ ] Live job market skill data integration
- [ ] Mobile app version
- [ ] Export roadmap as PDF

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---


## 👨‍💻 Author

Built by **Anand Kumar Singh**

> ⭐ If you found this useful, consider starring the repo!

// src/server.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const Groq     = require('groq-sdk');
const mammoth  = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = require('./database');

const app    = express();
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Unified AI caller — Groq + Gemini ──────────────────────────
async function callAI(messages, systemPrompt, model = 'groq') {
  if (model === 'gemini') {
    const genModel = gemini.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat    = genModel.startChat({ history });
    const lastMsg = messages[messages.length - 1].content;
    const result  = await chat.sendMessage(lastMsg);
    return result.response.text();
  }

  // Groq Llama
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  });
  return completion.choices[0].message.content;
}

// ── Multer ─────────────────────────────────────────────────────
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ['.pdf','.doc','.docx','.txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word (.doc/.docx), and TXT files are allowed.'));
    }
  }
});

// ── Resume parser ──────────────────────────────────────────────
async function parseResume(filePath, mimetype, originalname) {
  const buffer = fs.readFileSync(filePath);
  const ext    = path.extname(originalname || '').toLowerCase();

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = false;
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
      }
      if (!fullText || fullText.trim().length < 10) {
        throw new Error('PDF has no readable text. Please try a .docx or .txt file.');
      }
      return fullText;
    } catch (e) {
      throw new Error(e.message || 'Could not read PDF file.');
    }
  }

  if (mimetype === 'application/msword' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.doc' || ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value || result.value.trim().length < 10) {
      throw new Error('Could not extract text from Word file. Try saving as .txt.');
    }
    return result.value;
  }

  return buffer.toString('utf8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── System Prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are SkillBot, a friendly and expert career skills coach.
Your goal is to help users identify skill gaps for their target job role and build a personalized learning roadmap.

Follow this conversation flow naturally:
1. GREET: Welcome user warmly, ask for their target job role
2. COLLECT: Ask about current skills and experience (ask only 1-2 questions at a time, keep it conversational)
3. ANALYZE: Once you have enough info, provide a clear skill gap analysis with:
   - ✅ Skills they already have
   - ❌ Skills they are missing
   - 🔥 Priority gaps (most critical first)
4. ROADMAP: Generate a numbered step-by-step learning roadmap. For each step use EXACTLY this format:
   "1. Skill Name — why it matters — RESOURCE[skill name, platform] — Time: X weeks"

   Choose the best platform for each skill from this list:
   - coursera   → for professional certificates, university courses
   - udemy      → for practical project-based courses
   - youtube    → for free video tutorials
   - gfg        → for programming, DSA, CS concepts
   - w3schools  → for HTML, CSS, JavaScript, SQL basics
   - freecodecamp → for web dev, Python, free certifications
   - edx        → for university-level courses
   - codecademy → for interactive coding practice
   - mdn        → for JavaScript, web APIs, browser docs
   - mit        → for advanced CS, math, algorithms

   Examples:
   "1. Python Basics — foundation for data science — RESOURCE[Python basics, coursera] — Time: 3 weeks"
   "2. HTML & CSS — build web pages — RESOURCE[HTML CSS, w3schools] — Time: 2 weeks"
   "3. React JS — build modern UIs — RESOURCE[React JS tutorial, youtube] — Time: 4 weeks"
   "4. Data Structures — crack coding interviews — RESOURCE[Data Structures Arrays, gfg] — Time: 5 weeks"

5. FOLLOW-UP: After every analysis or roadmap always end with a follow-up question

Rules:
- Be warm, encouraging, and conversational
- Ask only 1-2 questions at a time — never overwhelm
- ALWAYS end every response with at least one follow-up question
- NEVER write raw URLs — always use RESOURCE[skill, platform] format only
- If resume is provided, reference it naturally
- Remember everything from earlier in the conversation
- Use emojis and clear formatting for readability`;

// ── Helpers ────────────────────────────────────────────────────
function generateId() {
  return 'sess_' + Math.random().toString(36).slice(2, 11);
}

// ── Build direct platform links — no API, no 404s ─────────────
function buildDirectLink(skill, platform) {
  const q   = encodeURIComponent(skill.trim());
  const key = (platform || '').toLowerCase().trim();

  const platformMap = {
    coursera:     `https://www.coursera.org/search?query=${q}`,
    udemy:        `https://www.udemy.com/courses/search/?q=${q}`,
    youtube:      `https://www.youtube.com/results?search_query=${q}+tutorial`,
    gfg:          `https://www.geeksforgeeks.org/search/?q=${q}`,
    geeksforgeeks:`https://www.geeksforgeeks.org/search/?q=${q}`,
    w3schools:    `https://www.w3schools.com/search/search_result.php?search=${q}`,
    freecodecamp: `https://www.freecodecamp.org/news/search/?query=${q}`,
    edx:          `https://www.edx.org/search?q=${q}`,
    codecademy:   `https://www.codecademy.com/search?query=${q}`,
    linkedin:     `https://www.linkedin.com/learning/search?keywords=${q}`,
    github:       `https://github.com/search?q=${q}&type=repositories`,
    mdn:          `https://developer.mozilla.org/en-US/search?q=${q}`,
    mit:          `https://ocw.mit.edu/search/?q=${q}`,
    pluralsight:  `https://www.pluralsight.com/search?q=${q}`,
    khan:         `https://www.khanacademy.org/search?page_search_query=${q}`,
  };

  return platformMap[key] || `https://www.coursera.org/search?query=${q}`;
}

// ── Replace RESOURCE[skill, platform] with real direct links ───
async function injectRealLinks(text) {
  // Format 1: RESOURCE[skill name, platform]
  const pattern1 = /RESOURCE\[([^\],]+),\s*([^\]]+)\]/g;
  const matches1 = [...text.matchAll(pattern1)];

  if (matches1.length > 0) {
    let result = text;
    matches1.forEach(m => {
      const skill    = m[1].trim();
      const platform = m[2].trim().toLowerCase();
      const url      = buildDirectLink(skill, platform);
      const label    = platform.charAt(0).toUpperCase() + platform.slice(1);
      result = result.replace(m[0], `[${skill} on ${label}](${url})`);
    });
    return result;
  }

  // Format 2 fallback: RESOURCE[single query] — pick best platform by keyword
  const pattern2 = /RESOURCE\[([^\]]+)\]/g;
  const matches2 = [...text.matchAll(pattern2)];
  if (matches2.length === 0) return text;

  let result = text;
  matches2.forEach(m => {
    const query = m[1].trim();
    const lower = query.toLowerCase();

    let platform = 'coursera'; // default
    if (lower.includes('youtube'))        platform = 'youtube';
    else if (lower.includes('udemy'))     platform = 'udemy';
    else if (lower.includes('gfg') || lower.includes('geeks')) platform = 'gfg';
    else if (lower.includes('w3'))        platform = 'w3schools';
    else if (lower.includes('freecodecamp')) platform = 'freecodecamp';
    else if (lower.includes('edx'))       platform = 'edx';
    else if (lower.includes('codecademy')) platform = 'codecademy';
    else if (lower.includes('mdn'))       platform = 'mdn';
    else if (lower.includes('html') || lower.includes('css')) platform = 'w3schools';
    else if (lower.includes('dsa') || lower.includes('algorithm') || lower.includes('data structure')) platform = 'gfg';
    else if (lower.includes('javascript') || lower.includes('react') || lower.includes('node')) platform = 'freecodecamp';
    else if (lower.includes('python') || lower.includes('machine learning') || lower.includes('ai')) platform = 'coursera';

    const skill = query.replace(/youtube|udemy|coursera|gfg|w3schools|freecodecamp|edx|codecademy|free|course|tutorial/gi, '').trim();
    const url   = buildDirectLink(skill || query, platform);
    const label = platform.charAt(0).toUpperCase() + platform.slice(1);
    result = result.replace(m[0], `[${skill || query} on ${label}](${url})`);
  });

  return result;
}

// ── AI-generated follow-up suggestions ────────────────────────
async function generateSuggestions(lastReply, model = 'groq') {
  try {
    const messages = [{
      role: 'user',
      content: `Based on this AI reply, generate exactly 4 short follow-up questions a user might ask next.
Rules:
- Must be specific to the actual skills, role, or topics mentioned — never generic
- Keep each under 10 words
- Sound natural like a curious user
- Return ONLY a raw JSON array of 4 strings. Example: ["Q1?","Q2?","Q3?","Q4?"]

AI reply: "${lastReply.slice(0, 800)}"`
    }];

    const raw   = await callAI(messages, 'Return only a valid JSON array of 4 follow-up question strings.', model);
    const match = raw.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 4);
    }
    return [];
  } catch (e) {
    console.error('Suggestion error:', e.message);
    return [];
  }
}

// ── POST /api/chat ─────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, model = 'groq' } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'message and sessionId are required' });
  }

  const selectedModel = ['groq', 'gemini'].includes(model) ? model : 'groq';

  db.createSession(sessionId);
  db.addMessage(sessionId, 'user', message);

  const history = db.getMessages(sessionId);
  const session = db.getSession(sessionId);
  const systemWithResume = SYSTEM_PROMPT + (session?.resume_text
    ? `\n\nUSER RESUME:\n${session.resume_text}` : '');

  try {
    const rawReply = await callAI(history, systemWithResume, selectedModel);
    const reply    = await injectRealLinks(rawReply);

    db.addMessage(sessionId, 'assistant', reply);

    if (history.length === 1) {
      db.updateSessionTitle(sessionId, message.slice(0, 50));
    }

    const suggestions = await generateSuggestions(reply, selectedModel);
    res.json({ reply, sessionId, suggestions, model: selectedModel });

  } catch (err) {
    console.error(`${selectedModel} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/upload-resume ────────────────────────────────────
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !req.file) {
    return res.status(400).json({ error: 'sessionId and resume file are required' });
  }
  try {
    const content = await parseResume(req.file.path, req.file.mimetype, req.file.originalname);
    fs.unlinkSync(req.file.path);
    if (!content || content.trim().length < 20) {
      return res.status(400).json({ error: 'Could not extract text from file.' });
    }
    db.createSession(sessionId);
    db.updateResumeText(sessionId, content.trim());
    res.json({ success: true, fileName: req.file.originalname, charCount: content.length });
  } catch (e) {
    console.error('Resume parse error:', e.message);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: e.message || 'Could not parse resume file.' });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 5MB.' });
  if (err.message) return res.status(400).json({ error: err.message });
  next(err);
});

app.get('/api/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session  = db.getSession(sessionId);
  const messages = db.getMessages(sessionId);
  const progress = db.getProgress(sessionId);
  res.json({ messages, progress, hasResume: !!(session?.resume_text), title: session?.title || 'New Chat' });
});

app.post('/api/progress', (req, res) => {
  const { sessionId, skill } = req.body;
  if (!sessionId || !skill) return res.status(400).json({ error: 'sessionId and skill required' });
  db.createSession(sessionId);
  db.addProgressItem(sessionId, skill);
  res.json({ success: true, progress: db.getProgress(sessionId) });
});

app.patch('/api/progress/:id', (req, res) => {
  db.toggleProgress(req.params.id, req.body.completed);
  res.json({ success: true });
});

app.post('/api/session', (req, res) => {
  const sessionId = generateId();
  db.createSession(sessionId);
  res.json({ sessionId });
});

app.get('/api/sessions', (req, res) => {
  res.json({ sessions: db.getAllSessions() });
});

app.delete('/api/session/:sessionId', (req, res) => {
  db.deleteSession(req.params.sessionId);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ SkillBot running at http://localhost:${PORT}`);
  console.log(`   Models: Groq (Llama 3.3) + Gemini (Flash)`);
  console.log(`   Database: data/skillbot.db\n`);
});
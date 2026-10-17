const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'medresearch_default_jwt_secret_2026';

const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());

// ==========================================
// 1. MONGODB ATLAS CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log(' Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error(' MongoDB Atlas Connection Error:', err.message));
} else {
  console.warn('⚠️ MONGODB_URI not found in .env file.');
}

// ==========================================
// 2. MONGOOSE SCHEMAS & MODELS
// ==========================================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  topic: { type: String, default: '' },
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'], required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  contextPapers: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

// Auth Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Sign in required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expired or invalid token.' });
    req.user = user;
    next();
  });
};

// ==========================================
// 3. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// Current User profile check
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// ==========================================
// 4. CONVERSATION HISTORY ROUTES
// ==========================================

// Get all chat sessions for logged-in user
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const chats = await ChatHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('title topic createdAt messages');
    res.json({ chats });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history.' });
  }
});

// Save or append to a conversation
app.post('/api/history/save', authenticateToken, async (req, res) => {
  try {
    const { chatId, title, topic, messages, contextPapers } = req.body;

    if (chatId) {
      // Update existing chat
      const updatedChat = await ChatHistory.findOneAndUpdate(
        { _id: chatId, userId: req.user.id },
        { title, topic, messages, contextPapers },
        { new: true }
      );
      return res.json({ chat: updatedChat });
    }

    // Create new chat
    const newChat = await ChatHistory.create({
      userId: req.user.id,
      title: title || topic || 'Medical Research Query',
      topic: topic || '',
      messages: messages || [],
      contextPapers: contextPapers || []
    });

    res.status(201).json({ chat: newChat });
  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({ error: 'Failed to save conversation.' });
  }
});

// Delete a conversation
app.delete('/api/history/:id', authenticateToken, async (req, res) => {
  try {
    await ChatHistory.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Conversation deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

// ==========================================
// 5. EXISTING AI & SEARCH LOGIC
// ==========================================
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateWithFallback(contents, preferredModel = 'gemini-3.5-flash-lite') {
  const modelsToTry = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-latest'
  ];
  let lastError;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
      });
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} failed (${err.status || err.message}). Trying fallback...`);
    }
  }
  throw lastError;
}

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MedResearch AI backend is running!' });
});

// PubMed Search Route
app.get('/api/pubmed/search', async (req, res) => {  try {
    const query = req.query.q || 'lung cancer';
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5`;
    const searchResponse = await axios.get(searchUrl);
    const idList = searchResponse.data.esearchresult?.idlist || [];

    if (idList.length === 0) {
      return res.json({ query, count: 0, results: [] });
    }

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const summaryResponse = await axios.get(summaryUrl);
    const resultObj = summaryResponse.data.result || {};

    const papers = idList.map(id => {
      const item = resultObj[id];
      return {
        id: id,
        title: item?.title || 'No title available',
        source: item?.source || 'PubMed',
        pubDate: item?.pubdate || 'N/A',
        authors: item?.authors ? item.authors.map(a => a.name).join(', ') : 'Unknown',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        db: 'PubMed'
      };
    });

    res.json({ query, count: papers.length, results: papers });
  } catch (error) {
    console.error('Error fetching PubMed data:', error.message);
    res.status(500).json({ error: 'Failed to fetch PubMed data' });
  }
});

// OpenAlex Search Route
app.get('/api/openalex/search', async (req, res) => {
  try {
    const query = req.query.q || 'lung cancer';
    const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5`;
    const response = await axios.get(openAlexUrl, {
      headers: { 'User-Agent': 'MedResearchAI-StudentProject/1.0' }
    });

    const works = response.data.results || [];
    const formattedWorks = works.map(w => ({
      id: w.id ? w.id.replace('https://openalex.org/', '') : 'N/A',
      title: w.title || 'Untitled Work',
      source: w.primary_location?.source?.display_name || 'OpenAlex Journal',
      pubDate: w.publication_year ? String(w.publication_year) : 'N/A',
      authors: w.authorships ? w.authorships.map(a => a.author?.display_name).filter(Boolean).slice(0, 3).join(', ') : 'Unknown',
      citations: w.cited_by_count || 0,
      url: w.doi || (w.primary_location && w.primary_location.landing_page_url) || `https://openalex.org/${w.id}`,
      db: 'OpenAlex'
    }));

    res.json({ query, count: formattedWorks.length, results: formattedWorks });
  } catch (error) {
    console.error('Error fetching OpenAlex data:', error.message);
    res.status(500).json({ error: 'Failed to fetch OpenAlex data' });
  }
});

// ClinicalTrials.gov Search Route
app.get('/api/trials/search', async (req, res) => {
  try {
    const query = req.query.q || 'lung cancer';
    const statusFilter = req.query.status || '';
    
    let trialsUrl = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(query)}&pageSize=10`;
    if (statusFilter && statusFilter !== 'ALL') {
      trialsUrl += `&filter.overallStatus=${encodeURIComponent(statusFilter)}`;
    }
    
    const response = await axios.get(trialsUrl);
    const studies = response.data.studies || [];

    const formattedTrials = studies.map(study => {
      const protocol = study.protocolSection || {};
      const idModule = protocol.identificationModule || {};
      const statusModule = protocol.statusModule || {};
      const designModule = protocol.designModule || {};
      const eligibilityModule = protocol.eligibilityModule || {};
      
      return {
        nctId: idModule.nctId || 'N/A',
        title: idModule.briefTitle || 'No title available',
        status: statusModule.overallStatus || 'UNKNOWN',
        conditions: protocol.conditionsModule?.conditions?.join(', ') || query,
        studyType: designModule.studyType || 'Interventional',
        eligibilityCriteria: eligibilityModule.eligibilityCriteria || 'Criteria details not listed in record.',
        minAge: eligibilityModule.minimumAge || 'Not specified',
        maxAge: eligibilityModule.maximumAge || 'Not specified',
        sex: eligibilityModule.sex || 'ALL',
        url: `https://clinicaltrials.gov/study/${idModule.nctId}`
      };
    });

    res.json({ query, count: formattedTrials.length, results: formattedTrials });
  } catch (error) {
    console.error('Error fetching Clinical Trials:', error.message);
    res.status(500).json({ error: 'Failed to fetch clinical trials data' });
  }
});

// Multi-Source AI Synthesis Route
app.post(['/api/ai/synthesize', '/api/ai/summarize'], async (req, res) => {
  try {
    const topic = req.body.topic || req.body.query || 'Medical Research';
    const contextPapers = req.body.contextPapers || req.body.papers || [];

    const titlesList = contextPapers
      .map((p, idx) => `${idx + 1}. [${p.db || 'Paper'}] ${p.title} (${p.source || ''})`)
      .join('\n');

    const prompt = `You are a medical research assistant for MedResearch AI.
Topic: "${topic}"

Synthesize evidence from these PubMed and OpenAlex publications:
${titlesList}

Instructions:
1. Provide a 3-bullet synthesis highlighting key medical themes.
2. Maintain objective academic language.
3. Add a brief closing sentence on overall scientific direction.`;

    const response = await generateWithFallback(prompt, 'gemini-2.5-flash');
    res.json({ summary: response.text });
  } catch (error) {
    console.error('Error running AI summarization:', error);
    res.status(500).json({ error: 'AI summarization rate limit or failure.' });
  }
});
// Interactive Q&A Chat Route (Voice & Text)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { question, contextPapers, topic } = req.body;

    const paperContext = (contextPapers || [])
      .slice(0, 5)
      .map((p, i) => `[${i + 1}] ${p.title} (${p.source || ''})`)
      .join('\n');

    const prompt = `You are MedResearch AI, an authentic biomedical voice assistant.
Current Topic: "${topic || 'General Medical Research'}"
Referenced Literature:
${paperContext}

User Question: "${question}"

Instructions:
- Provide a clear, natural answer in 2 to 3 spoken sentences.
- Speak directly as an expert collaborator.
- Do NOT use markdown symbols like asterisks (**), numbers, bullet points, or citations, as this text will be read aloud by browser text-to-speech.`;

    const response = await generateWithFallback(prompt, 'gemini-2.5-flash');
    res.json({ answer: response.text });
  } catch (error) {
    console.error('Chat route error:', error);
    res.status(500).json({ answer: "I could not analyze that question right now. Please try again." });
  }
});
// Medical Report Vision Route
app.post('/api/ai/analyze-report', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const base64Data = req.file.buffer.toString('base64');
    let mimeType = req.file.mimetype;

    if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
      mimeType = 'application/pdf';
    }

    const promptText = `You are an expert clinical pathologist and medical document analyzer.
Carefully inspect this uploaded medical report.

Analyze the visible content and extract:
1. "detectedCondition": The specific disease, diagnosed condition, or abnormal clinical parameter.
2. "searchTerm": A precise 1 to 3 word search query to look up medical research publications on PubMed.
3. "clinicalNotes": A 1-2 sentence clinical summary of observations.

Return ONLY raw JSON without markdown backticks:
{"detectedCondition": "Specific Condition", "searchTerm": "keyword query", "clinicalNotes": "Observation summary"}`;

    const contents = [
      {
        role: 'user',
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ];

    const response = await generateWithFallback(contents, 'gemini-3.5-flash-lite');
    const rawText = response.text || '';
    const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.json({
        detectedCondition: "Clinical Lab Document",
        searchTerm: "diabetes",
        clinicalNotes: "Extracted diagnostic profile from scanned document."
      });
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    res.json(parsedResult);
  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze uploaded medical document: ' + error.message });
  }
});

// Clinical Trial Eligibility Matcher Route
app.post('/api/ai/match-eligibility', async (req, res) => {
  try {
    const { patientProfile, trial } = req.body;

    if (!patientProfile || !trial) {
      return res.status(400).json({ error: 'Patient profile and trial details are required.' });
    }

    const prompt = `You are a clinical trials eligibility specialist.
Evaluate whether the following patient is eligible for this clinical trial based on the stated criteria:

Patient Profile:
- Age: ${patientProfile.age || 'Unspecified'}
- Biological Sex: ${patientProfile.sex || 'Unspecified'}
- Diagnosed Condition: ${patientProfile.condition || 'Unspecified'}
- Additional Health Notes: ${patientProfile.notes || 'None provided'}

Trial Details:
- Title: ${trial.title}
- Age Limits: ${trial.minAge} to ${trial.maxAge}
- Eligible Sex: ${trial.sex}
- Full Criteria Text:
${(trial.eligibilityCriteria || '').slice(0, 2500)}

Determine:
1. "status": One of ["ELIGIBLE", "POTENTIAL MATCH", "INELIGIBLE"]
2. "rationale": Exactly 2 concise sentences explaining why the patient matches or fails inclusion/exclusion criteria.

Respond strictly in raw JSON without code fences:
{"status": "ELIGIBLE", "rationale": "Explanation here."}`;

    const response = await generateWithFallback(prompt, 'gemini-3.5-flash-lite');
    const rawText = response.text || '';
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.json({ status: 'POTENTIAL MATCH', rationale: 'Review inclusion criteria with clinical investigator.' });
    }

    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error('Eligibility match error:', error.message);
    res.status(500).json({ error: 'Eligibility check failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running successfully on http://localhost:${PORT}`);
});
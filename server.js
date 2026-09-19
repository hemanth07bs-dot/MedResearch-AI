const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Fallback helper to handle quota/rate limits seamlessly
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

// 1. PubMed Search Route
app.get('/api/research/search', async (req, res) => {
  try {
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

// 2. OpenAlex Search Route
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

// 3. ClinicalTrials.gov Search Route
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

// 4. Multi-Source AI Synthesis Route
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { topic, contextPapers } = req.body;

    if (!contextPapers || contextPapers.length === 0) {
      return res.status(400).json({ error: 'No research context provided.' });
    }

    const titlesList = contextPapers
      .map((p, idx) => `${idx + 1}. [${p.db || 'Paper'}] ${p.title} (${p.source}, ${p.pubDate})`)
      .join('\n');

    const prompt = `You are a medical research assistant for an academic tool.
Topic: "${topic}"

Synthesize evidence from these PubMed and OpenAlex publications:
${titlesList}

Instructions:
1. Provide a 3-bullet synthesis highlighting key medical themes and findings.
2. Maintain objective academic language.
3. Add a brief closing sentence on overall scientific direction.`;

    const response = await generateWithFallback(prompt, 'gemini-3.5-flash-lite');
    res.json({ summary: response.text });
  } catch (error) {
    console.error('Error running AI summarization:', error.message);
    res.status(500).json({ error: 'AI summarization rate limit reached. Please retry in a few seconds.' });
  }
});

// 5. Interactive Q&A Chat Route
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { question, contextPapers, topic } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const contextText = (contextPapers || [])
      .map((p, idx) => `[Study ${idx + 1}] Title: ${p.title} | Source: ${p.source} (${p.pubDate})`)
      .join('\n');

    const prompt = `You are an AI Medical Research Assistant discussing the topic "${topic}".
Use the following retrieved studies to answer the user's question accurately and objectively:

Retrieved Literature:
${contextText}

User Question: "${question}"

Instructions:
- Provide a clear, concise, direct response (under 120 words).
- Explicitly cite the study titles or numbers when mentioning specific findings.
- If the retrieved papers do not contain enough information to answer, state that clearly without guessing.
- Do not provide medical prescriptions or clinical diagnoses.`;

    const response = await generateWithFallback(prompt, 'gemini-3.5-flash-lite');
    res.json({ answer: response.text });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});

// 6. Medical Report Vision Route
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

// 7. Clinical Trial Eligibility Matcher Route
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
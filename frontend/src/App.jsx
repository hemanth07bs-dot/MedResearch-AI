import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ParticleBackground from './ParticleBackground';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://medresearch-ai-backend.onrender.com';

function App() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pubmed');
  const [pubmedPapers, setPubmedPapers] = useState([]);
  const [openAlexPapers, setOpenAlexPapers] = useState([]);
  const [trials, setTrials] = useState([]);
  const [trialStatusFilter, setTrialStatusFilter] = useState('ALL');
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Dynamic time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Informational "How It Works" Modal State
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Patient Profile State for Eligibility Matching
  const [patientProfile, setPatientProfile] = useState({
    age: '45',
    sex: 'ALL',
    condition: '',
    notes: 'No prior chemotherapy'
  });
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [eligibilityResults, setEligibilityResults] = useState({});
  const [evaluatingTrialId, setEvaluatingTrialId] = useState(null);

  // Recent Searches State
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('medresearch_recent_searches');
      return saved ? JSON.parse(saved) : ['Type 2 Diabetes', 'Asthma Biomarkers', 'Lung Cancer Immunotherapy'];
    } catch (e) {
      return ['Type 2 Diabetes', 'Asthma Biomarkers'];
    }
  });

  // Theme & Voice Sphere Modal State
  const [darkMode, setDarkMode] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sphereStatus, setSphereStatus] = useState('READY');
  const [spokenTranscript, setSpokenTranscript] = useState('');

  const recognitionRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // File Upload State
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadedDocInfo, setUploadedDocInfo] = useState(null);
  const fileInputRef = useRef(null);

  const featuredTopics = [
    { icon: '🫁', title: 'Lung Cancer', subtitle: 'Latest treatment for lung cancer', query: 'lung cancer treatment' },
    { icon: '💉', title: 'Diabetes', subtitle: 'Clinical trials for diabetes', query: 'diabetes clinical trials' },
    { icon: '🧠', title: "Alzheimer's", subtitle: "Top research in Alzheimer's disease", query: "Alzheimer's disease" },
    { icon: '❤️', title: 'Heart Disease', subtitle: 'Recent studies on cardiovascular disease', query: 'heart disease' },
    { icon: '🧬', title: 'Gene Therapy', subtitle: 'Latest gene therapy breakthroughs', query: 'gene therapy breakthroughs' },
    { icon: '🦠', title: 'Immunotherapy', subtitle: 'Cancer immunotherapy clinical trials', query: 'cancer immunotherapy' },
  ];

  const saveRecentSearch = (term) => {
    if (!term.trim()) return;
    const cleanTerm = term.trim();
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== cleanTerm.toLowerCase());
      const updated = [cleanTerm, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('medresearch_recent_searches', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('medresearch_recent_searches');
  };

  // Check Eligibility with Gemini
  const handleCheckEligibility = async (trial) => {
    setEvaluatingTrialId(trial.nctId);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ai/match-eligibility`, {
        patientProfile: {
          ...patientProfile,
          condition: patientProfile.condition || query
        },
        trial: trial
      });

      setEligibilityResults((prev) => ({
        ...prev,
        [trial.nctId]: res.data
      }));
    } catch (err) {
      console.error('Eligibility check error:', err);
      alert('Could not evaluate trial eligibility.');
    } finally {
      setEvaluatingTrialId(null);
    }
  };

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSphereStatus('LISTENING');
      };

   recognition.onresult = async (event) => {
        const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
        setSpokenTranscript(transcript);

        if (event.results[0].isFinal) {
          setQuery(transcript);
          setSphereStatus('THINKING');
          if (recognitionRef.current) recognitionRef.current.stop();
          setIsListening(false);

          try {
         // 1. Call backend AI endpoint directly
            const response = await axios.post(`${API_BASE_URL}/api/ai/chat`, {
              question: transcript,
              contextPapers: combinedPapers || [],
              topic: transcript
            });

            const reply = response.data?.answer || response.data?.reply || response.data?.response || `Here is what I found about ${transcript}.`;
            setSpokenTranscript(reply);

            // 2. Speak the reply aloud
            speakText(reply);
          } catch (err) {
            console.error("Voice chat error:", err);
            const fallbackMsg = `Searching latest clinical research for ${transcript}.`;
            setSpokenTranscript(fallbackMsg);
            speakText(fallbackMsg);
          }
        }
      };
         if (event.results[0].isFinal) {
           setQuery(transcript);
           setSphereStatus('THINKING');
           if (recognitionRef.current) recognitionRef.current.stop();
           setIsListening(false);

           try {
             // 1. Get real-time conversational answer from Gemini backend
             const response = await axios.post(`${API_BASE_URL}/chat`, {
               message: transcript,
               history: chatMessages
             });

             const reply = response.data?.reply || response.data?.response || "I found research on this topic.";
             setSpokenTranscript(reply);

             // 2. Also run the background search for medical papers
             executeSearch(transcript);

             // 3. Speak the answer back aloud like ChatGPT / Gemini
             speakText(reply);
           } catch (err) {
             console.error("Voice chat error:", err);
             // Fallback: search and announce completion
             executeSearch(transcript);
             speakText(`Searching research for ${transcript}`);
           }
         }
       };
      recognition.onerror = () => {
        setIsListening(false);
        setSphereStatus('READY');
      };

      recognition.onend = () => {
        setIsListening(false);
        if (sphereStatus === 'LISTENING') setSphereStatus('READY');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [sphereStatus]);

  // Particle Canvas Rendering
  useEffect(() => {
    if (!voiceModalOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = (canvas.width = 320);
    const height = (canvas.height = 320);
    const numParticles = 180;
    const radius = 100;

    const points = [];
    for (let i = 0; i < numParticles; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      points.push({
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(theta),
        baseSize: Math.random() * 2.5 + 1.5,
      });
    }

    let angleX = 0.005;
    let angleY = 0.008;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let pulse = 1;
      if (sphereStatus === 'LISTENING') pulse = 1 + Math.sin(Date.now() * 0.008) * 0.12;
      if (sphereStatus === 'SPEAKING') pulse = 1 + Math.sin(Date.now() * 0.012) * 0.18;
      if (sphereStatus === 'THINKING') pulse = 1 + Math.sin(Date.now() * 0.02) * 0.06;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      points.forEach(p => {
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.z * cosY + p.x * sinY;

        let y1 = p.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.y * sinX;

        p.x = x1;
        p.y = y1;
        p.z = z2;

        const fov = 350;
        const scale = fov / (fov + z2);
        const x2d = x1 * scale * pulse + width / 2;
        const y2d = y1 * scale * pulse + height / 2;
        const alpha = Math.max(0.15, (z2 + radius) / (2 * radius));

        ctx.beginPath();
        ctx.arc(x2d, y2d, p.baseSize * scale, 0, Math.PI * 2);

        if (sphereStatus === 'LISTENING') {
          ctx.fillStyle = `rgba(231, 111, 81, ${alpha})`;
        } else if (sphereStatus === 'THINKING') {
          ctx.fillStyle = `rgba(244, 162, 97, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(203, 153, 126, ${alpha})`;
        }
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [voiceModalOpen, sphereStatus]);

 const handleSphereClick = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is supported in Google Chrome or Microsoft Edge.');
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const unlockUtterance = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(unlockUtterance);
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setSphereStatus('READY');
    } else {
      setIsSpeaking(false);
      setSpokenTranscript('');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Speech recognition start error:', e);
      }
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSphereStatus('READY');
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_•]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang === 'en-US');
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSphereStatus('SPEAKING');
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSphereStatus('READY');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSphereStatus('READY');
    };

    window.speechSynthesis.speak(utterance);
  };

  const executeSearch = async (searchTerm, status = trialStatusFilter) => {
    if (!searchTerm.trim()) return;

    saveRecentSearch(searchTerm);

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);

    setLoading(true);
    setSearched(true);
    setAiSummary('');
    setChatMessages([]);
    setEligibilityResults({});

    try {
      const [pubmedResult, openalexResult, trialsResult] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/research/search?q=${encodeURIComponent(searchTerm)}`),
          axios.get(`${API_BASE_URL}/api/openalex/search?q=${encodeURIComponent(searchTerm)}`),
          axios.get(`${API_BASE_URL}/api/trials/search?q=${encodeURIComponent(searchTerm)}&status=${status}`)
        ]);

        const fetchedPubmed = pubmedResult.status === 'fulfilled' ? (pubmedResult.value.data.results || []) : [];
        const fetchedOpenalex = openalexResult.status === 'fulfilled' ? (openalexResult.value.data.results || []) : [];
        const fetchedTrials = trialsResult.status === 'fulfilled' ? (trialsResult.value.data.results || []) : [];

      const fetchedPubmed = pubmedRes.data.results || [];
      const fetchedOpenAlex = openAlexRes.data.results || [];
      setPubmedPapers(fetchedPubmed);
      setOpenAlexPapers(fetchedOpenAlex);
      setTrials(trialsRes.data.results || []);
      setLoading(false);

      const combinedPapers = [...fetchedPubmed, ...fetchedOpenAlex];
      if (combinedPapers.length > 0) {
        setAiLoading(true);
        try {
          const aiRes = await axios.post(`${API_BASE_URL}/api/ai/summarize`, {
            topic: searchTerm,
            contextPapers: combinedPapers.slice(0, 8)
          });
          setAiSummary(aiRes.data.summary);
        } catch (err) {
          console.error('AI summary error:', err);
          setAiSummary('AI summarization unavailable.');
        } finally {
          setAiLoading(false);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      alert('Backend connection error. Make sure the backend server is running.');
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    executeSearch(query);
  };

  const handleTopicClick = (item) => {
    setQuery(item.query);
    executeSearch(item.query);
  };

  const handleRecentClick = (term) => {
    setQuery(term);
    executeSearch(term);
  };

  const handleStatusFilterChange = async (status) => {
    setTrialStatusFilter(status);
    if (!query.trim()) return;
    try {
      const trialsRes = await axios.get(`${API_BASE_URL}/api/trials/search?q=${encodeURIComponent(query)}&status=${status}`);
      setTrials(trialsRes.data.results || []);
    } catch (err) {
      console.error('Error filtering trials:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/ai/analyze-report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const extracted = res.data;
      setUploadedDocInfo({
        ...extracted,
        fileName: file.name
      });
      setQuery(extracted.searchTerm);
      executeSearch(extracted.searchTerm);
    } catch (err) {
      console.error('Upload analysis failed:', err);
      alert('Failed to analyze uploaded file.');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    const newMessages = [...chatMessages, { sender: 'user', text: userText }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const combinedPapers = [...pubmedPapers, ...openAlexPapers];
      const res = await axios.post(`${API_BASE_URL}/api/ai/chat`, {
        question: userText,
        contextPapers: combinedPapers,
        topic: query
      });

      const aiReply = res.data.answer;
      setChatMessages([...newMessages, { sender: 'ai', text: aiReply }]);
      speakText(aiReply);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages([...newMessages, { sender: 'ai', text: 'Sorry, I encountered an error answering that.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePrintSummaryOnlyPDF = () => {
    if (!aiSummary) return;
    const date = new Date().toLocaleDateString();
    const formattedSummaryLines = aiSummary
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `<p style="margin: 10px 0; line-height: 1.6; font-size: 14px;">${line.replace(/\*\*/g, '').replace(/^\*\s*/, '• ')}</p>`)
      .join('');

    const allPapers = [...pubmedPapers, ...openAlexPapers];
    const formattedPapers = allPapers
      .slice(0, 8)
      .map((p) => `
        <li style="margin-bottom: 10px;">
          <strong>[${p.db}]${p.title}</strong><br/>
          <span style="color: #64748b; font-size: 13px;">Source: ${p.source} (${p.pubDate})</span>
        </li>
      `)
      .join('');

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MedResearch AI Summary - ${query}</title>
          <style>
            body { font-family: Georgia, serif; color: #1e1b18; margin: 40px; }
            .header { border-bottom: 2px solid #e76f51; padding-bottom: 12px; margin-bottom: 24px; }
            .badge { background: #fbeee0; color: #d9480f; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
            .summary-box { background: #fdfaf6; border-left: 4px solid #e76f51; padding: 18px 22px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .footer { margin-top: 36px; font-size: 12px; color: #8c827a; border-top: 1px solid #eee7df; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; color: #2c2523; font-size: 24px; font-weight: 700;">MedResearch AI Summary</h1>
            <p style="margin: 6px 0 0 0; color: #8c827a; font-size: 14px;">Condition: <strong>${query.toUpperCase()}</strong> \vert{} Date:${date}</p>
          </div>
          <div>
            <span class="badge">Gemini Multi-Source Synthesis</span>
            <div class="summary-box">${formattedSummaryLines}</div>
          </div>
          <h3 style="margin-top: 28px; font-size: 16px; color: #2c2523;">Referenced Academic Literature:</h3>
          <ol style="padding-left: 20px; font-size: 13.5px; line-height: 1.6;">${formattedPapers}</ol>
          <div class="footer">MedResearch AI — BCA Final Year Project. Multi-database synthesis across PubMed & OpenAlex.</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  };

 const theme = {
    bg: darkMode ? '#070b14' : '#ffffff',
    cardBg: darkMode ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.88)',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    subText: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? 'rgba(56, 189, 248, 0.18)' : 'rgba(226, 232, 240, 0.8)',
    primary: darkMode ? '#38bdf8' : '#0ea5e9',
    pillBg: darkMode ? 'rgba(30, 41, 59, 0.75)' : 'rgba(241, 245, 249, 0.85)',
    topicCardBg: darkMode ? 'rgba(15, 23, 42, 0.78)' : '#ffffff',
    topicIconBg: darkMode ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.08)',
    summaryBg: darkMode ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
    summaryBorder: darkMode ? 'rgba(56, 189, 248, 0.28)' : '#e2e8f0',
    chatBubbleUser: '#0ea5e9',
    chatBubbleAi: darkMode ? 'rgba(30, 41, 59, 0.85)' : '#f8fafc',
    dockBg: darkMode ? 'rgba(11, 15, 25, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    dockBorder: darkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(226, 232, 240, 0.9)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      paddingBottom: '120px',
position: 'relative',
    overflowX: 'hidden',
      transition: 'background-color 0.25s ease, color 0.25s ease'
    }}>
<ParticleBackground darkMode={darkMode} />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header style={{ padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: theme.pillBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
            🔬
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: '700', letterSpacing: '-0.01em', color: theme.text }}>MedResearch AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* How It Works Button */}
          <button
            onClick={() => setShowHowItWorks(true)}
            style={{
              backgroundColor: theme.pillBg,
              color: theme.primary,
              border: `1px solid ${theme.border}`,
              padding: '0.3rem 0.65rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '700'
            }}
          >
            ℹ️ How It Works
          </button>
         
          {/* Theme Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              backgroundColor: theme.pillBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              padding: '0.3rem 0.65rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '700'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span style={{ fontSize: '0.7rem', backgroundColor: theme.pillBg, color: theme.subText, padding: '0.3rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>
            BCA Project
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '580px', margin: '1rem auto 0 auto', padding: '0 1.25rem', textAlign: 'center' }}>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '18px', backgroundColor: darkMode ? '#1e293b' : '#fbece5', color: darkMode ? '#38bdf8' : '#e07a5f', fontSize: '1.6rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          ★
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
          fontSize: '2.5rem',
          fontWeight: '400',
          margin: '0 0 0.6rem 0',
          color: theme.text,
          letterSpacing: '-0.02em'
        }}>
          {getGreeting()}
        </h1>
        <p style={{ fontSize: '1rem', color: theme.subText, margin: '0 0 2rem 0', fontWeight: '400', lineHeight: '1.5' }}>
          What medical research would you like to explore today?
        </p>

        {uploadLoading && (
          <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: theme.primary, fontSize: '0.9rem', fontWeight: '600' }}>
            <span>⏳</span> Parsing medical document with Gemini Vision...
          </div>
        )}

        {uploadedDocInfo && (
          <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${darkMode ? '#064e3b' : '#dbece2'}`, borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.5rem', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#10b981', marginBottom: '0.2rem' }}>
              ✓ Document Analyzed: {uploadedDocInfo.detectedCondition}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: theme.subText }}>
              {uploadedDocInfo.clinicalNotes} (Queried: <i>"{uploadedDocInfo.searchTerm}"</i>)
            </p>
          </div>
        )}

        {/* Featured Category Cards */}
        {!searched && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {featuredTopics.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTopicClick(topic)}
                  style={{
                    backgroundColor: theme.topicCardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '18px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: theme.topicIconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', border: `1px solid ${theme.border}` }}>
                      {topic.icon}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: theme.text }}>{topic.title}</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: theme.subText }}>{topic.subtitle}</p>
                    </div>
                  </div>
                  <span style={{ color: theme.subText, fontSize: '1.2rem', fontWeight: '600' }}>›</span>
                </button>
              ))}
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div style={{ margin: '1.5rem 0', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: theme.subText, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    Recent Searches
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    style={{ background: 'none', border: 'none', color: theme.subText, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                  >
                    Clear history
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleRecentClick(term)}
                      style={{
                        backgroundColor: theme.pillBg,
                        border: `1px solid ${theme.border}`,
                        color: theme.primary,
                        borderRadius: '20px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>🔍</span> {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!searched && (
          <div style={{ marginTop: '2rem', marginBottom: '1.5rem', color: theme.subText, fontSize: '0.8rem' }}>
            <span style={{ marginRight: '0.5rem' }}>Powered by</span>
            <span style={{ backgroundColor: theme.pillBg, padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: '600', color: theme.text, marginRight: '0.4rem' }}>PubMed</span>
            <span style={{ backgroundColor: theme.pillBg, padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: '600', color: theme.text, marginRight: '0.4rem' }}>OpenAlex</span>
            <span style={{ backgroundColor: theme.pillBg, padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: '600', color: theme.text }}>ClinicalTrials.gov</span>
          </div>
        )}

        {loading && (
          <div style={{ padding: '3rem 0', color: theme.subText, fontSize: '0.95rem' }}>
            Retrieving clinical literature & trials...
          </div>
        )}

        {/* Results View */}
        {searched && (
          <div style={{ textAlign: 'left', marginTop: '1rem' }}>
            <button
              onClick={() => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                setIsSpeaking(false);
                setSearched(false);
              }}
              style={{ backgroundColor: 'transparent', border: 'none', color: theme.primary, fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: '1rem' }}
            >
              ← Back to categories
            </button>

            {/* AI Summary Card */}
            <div style={{ backgroundColor: theme.summaryBg, border: `1px solid ${theme.summaryBorder}`, borderRadius: '20px', padding: '1.6rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: theme.primary }}>✨ AI Evidence Synthesis</span>
                  <span style={{ fontSize: '0.72rem', backgroundColor: darkMode ? '#1e293b' : '#fbece5', color: theme.primary, padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: '700' }}>Gemini 3.6 Flash</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {aiSummary && !aiLoading && !aiSummary.includes('unavailable') && (
                    <>
                      <button
                        onClick={() => speakText(aiSummary)}
                        style={{
                          backgroundColor: isSpeaking ? '#fbece5' : theme.pillBg,
                          border: isSpeaking ? `1px solid ${theme.primary}` : 'none',
                          color: theme.primary,
                          padding: '0.45rem 0.85rem',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        {isSpeaking ? '⏹ Stop' : '🔊 Listen'}
                      </button>
                      <button
                        onClick={handlePrintSummaryOnlyPDF}
                        style={{ backgroundColor: theme.primary, color: '#ffffff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        🖨 Save PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {aiLoading ? (
                <p style={{ margin: 0, fontSize: '0.9rem', color: theme.primary }}>Synthesizing cross-database literature...</p>
              ) : (
                <div style={{ fontSize: '0.92rem', lineHeight: '1.7', color: theme.text }}>
                  {aiSummary ? (
                    aiSummary.split('\n').filter(l => l.trim().length > 0).map((para, i) => (
                      <p key={i} style={{ margin: '0.55rem 0' }}>
                        {para.replace(/\*\*/g, '').replace(/^\*\s*/, '• ')}
                      </p>
                    ))
                  ) : (
                    'Summary will generate shortly.'
                  )}
                </div>
              )}

              {/* Consultation Chat */}
              {aiSummary && !aiLoading && (
                <div style={{ marginTop: '1.5rem', borderTop: `1px solid ${theme.border}`, paddingTop: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '700', color: theme.primary }}>
                    💬 Ask About These Findings (Voice interactive)
                  </h4>

                  {chatMessages.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem', maxHeight: '220px', overflowY: 'auto' }}>
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          style={{
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.sender === 'user' ? theme.chatBubbleUser : theme.chatBubbleAi,
                            color: msg.sender === 'user' ? '#ffffff' : theme.text,
                            padding: '0.65rem 0.95rem',
                            borderRadius: '12px',
                            maxWidth: '82%',
                            fontSize: '0.85rem',
                            lineHeight: '1.5',
                            border: msg.sender === 'ai' ? `1px solid ${theme.border}` : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{msg.text}</span>
                            {msg.sender === 'ai' && (
                              <button
                                onClick={() => speakText(msg.text)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                                title="Read response aloud"
                              >
                                🔊
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Ask a question about these studies..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.65rem 0.9rem',
                        fontSize: '0.85rem',
                        borderRadius: '10px',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: theme.cardBg,
                        color: theme.text,
                        outline: 'none'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading}
                      style={{ backgroundColor: theme.primary, color: '#ffffff', border: 'none', padding: '0.65rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      {chatLoading ? '...' : 'Ask'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Database Tab Navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: `1px solid ${theme.border}`, marginBottom: '1.25rem' }}>
              <button
                onClick={() => setActiveTab('pubmed')}
                style={{
                  padding: '0.65rem 0.5rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'pubmed' ? `2.5px solid ${theme.primary}` : 'none',
                  color: activeTab === 'pubmed' ? theme.primary : theme.subText,
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                PubMed ({pubmedPapers.length})
              </button>
              <button
                onClick={() => setActiveTab('openalex')}
                style={{
                  padding: '0.65rem 0.5rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'openalex' ? `2.5px solid ${theme.primary}` : 'none',
                  color: activeTab === 'openalex' ? theme.primary : theme.subText,
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                OpenAlex ({openAlexPapers.length})
              </button>
              <button
                onClick={() => setActiveTab('trials')}
                style={{
                  padding: '0.65rem 0.5rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'trials' ? `2.5px solid ${theme.primary}` : 'none',
                  color: activeTab === 'trials' ? theme.primary : theme.subText,
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Trials ({trials.length})
              </button>
            </div>

            {/* PubMed Tab */}
            {!loading && activeTab === 'pubmed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {pubmedPapers.map((p) => (
                  <div key={p.id} style={{ backgroundColor: theme.cardBg, padding: '1.25rem', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: '0.7rem', backgroundColor: theme.pillBg, color: theme.subText, padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700' }}>
                      PMID: {p.id}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: '0.4rem 0', color: theme.text }}>{p.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: theme.subText, margin: '0.2rem 0' }}>{p.authors}</p>
                    <p style={{ fontSize: '0.8rem', color: theme.subText, margin: '0.2rem 0 0.6rem 0' }}>{p.source} ({p.pubDate})</p>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: theme.primary, textDecoration: 'none', fontSize: '0.82rem', fontWeight: '700' }}>
                      View on PubMed →
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* OpenAlex Tab */}
            {!loading && activeTab === 'openalex' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {openAlexPapers.map((w) => (
                  <div key={w.id} style={{ backgroundColor: theme.cardBg, padding: '1.25rem', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: '0.7rem', backgroundColor: theme.pillBg, color: theme.subText, padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700' }}>
                      Citations: {w.citations}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: '0.4rem 0', color: theme.text }}>{w.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: theme.subText, margin: '0.2rem 0' }}>{w.authors}</p>
                    <p style={{ fontSize: '0.8rem', color: theme.subText, margin: '0.2rem 0 0.6rem 0' }}>{w.source} ({w.pubDate})</p>
                    <a href={w.url} target="_blank" rel="noreferrer" style={{ color: theme.primary, textDecoration: 'none', fontSize: '0.82rem', fontWeight: '700' }}>
                      View OpenAlex Record →
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Clinical Trials Tab with Eligibility Matcher */}
            {!loading && activeTab === 'trials' && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: theme.subText }}>Status:</span>
                    {['ALL', 'RECRUITING', 'COMPLETED'].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusFilterChange(status)}
                        style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '9999px',
                          border: `1px solid ${theme.border}`,
                          backgroundColor: trialStatusFilter === status ? theme.primary : theme.cardBg,
                          color: trialStatusFilter === status ? '#ffffff' : theme.subText,
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: theme.subText }}>
                    Matched against: Age {patientProfile.age || '45'}, {patientProfile.sex || 'ALL'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {trials.map((t) => {
                    const matchResult = eligibilityResults[t.nctId];
                    const isEvaluating = evaluatingTrialId === t.nctId;

                    return (
                      <div key={t.nctId} style={{ backgroundColor: theme.cardBg, padding: '1.35rem', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.7rem', backgroundColor: theme.pillBg, color: theme.subText, padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700' }}>
                              NCT: {t.nctId}
                            </span>
                            <span style={{ fontSize: '0.7rem', backgroundColor: darkMode ? '#064e3b' : '#e9f5ed', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700' }}>
                              {t.status}
                            </span>
                          </div>

                          <button
                            onClick={() => handleCheckEligibility(t)}
                            disabled={isEvaluating}
                            style={{
                              backgroundColor: theme.pillBg,
                              border: `1px solid ${theme.primary}`,
                              color: theme.primary,
                              padding: '0.3rem 0.75rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            {isEvaluating ? 'Checking...' : '⚡ Match Eligibility'}
                          </button>
                        </div>

                        <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: '0.4rem 0', color: theme.text }}>{t.title}</h3>
                        <p style={{ fontSize: '0.8rem', color: theme.subText, margin: '0.2rem 0' }}>Condition: {t.conditions}</p>
                        <p style={{ fontSize: '0.78rem', color: theme.subText, margin: '0.2rem 0 0.6rem 0' }}>
                          Age Criteria: {t.minAge} - {t.maxAge} | Sex: {t.sex}
                        </p>

                        {matchResult && (
                          <div style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            backgroundColor: matchResult.status === 'ELIGIBLE' ? (darkMode ? '#064e3b30' : '#ecfdf5') : (darkMode ? '#451a0330' : '#fffbeb'),
                            border: `1px solid ${matchResult.status === 'ELIGIBLE' ? '#10b981' : '#f59e0b'}`,
                            marginBottom: '0.6rem'
                          }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: matchResult.status === 'ELIGIBLE' ? '#10b981' : '#f59e0b', marginBottom: '0.2rem' }}>
                              {matchResult.status === 'ELIGIBLE' ? '✓ Likely Eligible' : '⚠️ Potential Match / Exclusions Apply'}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: theme.text, lineHeight: '1.4' }}>
                              {matchResult.rationale}
                            </p>
                          </div>
                        )}

                        <a href={t.url} target="_blank" rel="noreferrer" style={{ color: theme.primary, textDecoration: 'none', fontSize: '0.82rem', fontWeight: '700' }}>
                          View Full Protocol on ClinicalTrials.gov →
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HOW IT WORKS / ABOUT MODAL */}
      {showHowItWorks && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.25rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: theme.cardBg,
            borderRadius: '22px',
            padding: '2rem',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 15px 50px rgba(0,0,0,0.3)',
            border: `1px solid ${theme.border}`,
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔬</span>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: theme.text }}>About MedResearch AI</h3>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: theme.subText }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: theme.subText, lineHeight: '1.6', margin: '0 0 1.25rem 0' }}>
              <b>MedResearch AI</b> is a multimodal biomedical decision-support platform designed as a BCA Final Year Project. It bridges academic literature, open clinical registries, and patient lab records into a unified discovery interface.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: theme.text }}>
              <div style={{ backgroundColor: theme.pillBg, padding: '0.85rem 1rem', borderRadius: '12px' }}>
                <strong style={{ color: theme.primary }}>1. Multi-Database Evidence Retrieval</strong>
                <p style={{ margin: '0.35rem 0 0 0', color: theme.subText, lineHeight: '1.5' }}>
                  Concurrently queries live databases including <b>NCBI PubMed</b> (peer-reviewed articles), <b>OpenAlex</b> (global citation metrics), and <b>ClinicalTrials.gov</b> (ongoing protocols).
                </p>
              </div>

              <div style={{ backgroundColor: theme.pillBg, padding: '0.85rem 1rem', borderRadius: '12px' }}>
                <strong style={{ color: theme.primary }}>2. Multimodal Medical Vision</strong>
                <p style={{ margin: '0.35rem 0 0 0', color: theme.subText, lineHeight: '1.5' }}>
                  Users can upload clinical lab reports or scans (PDF, JPG, PNG). <b>Gemini Vision</b> inspects the document, extracts key diagnostic parameters, and automatically initiates targeted literature searches.
                </p>
              </div>

              <div style={{ backgroundColor: theme.pillBg, padding: '0.85rem 1rem', borderRadius: '12px' }}>
                <strong style={{ color: theme.primary }}>3. Grounded Evidence Synthesis & Voice Interaction</strong>
                <p style={{ margin: '0.35rem 0 0 0', color: theme.subText, lineHeight: '1.5' }}>
                  Synthesizes scientific findings into 3 key takeaways with source citations. Features an interactive 3D particle voice orb for hands-free speech queries and AI audio playback.
                </p>
              </div>

              <div style={{ backgroundColor: theme.pillBg, padding: '0.85rem 1rem', borderRadius: '12px' }}>
                <strong style={{ color: theme.primary }}>4. Patient Protocol Eligibility Matching</strong>
                <p style={{ margin: '0.35rem 0 0 0', color: theme.subText, lineHeight: '1.5' }}>
                  Evaluates a patient's clinical baseline (Age, Sex, Medical Notes) against intricate inclusion and exclusion trial criteria to determine suitability.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHowItWorks(false)}
              style={{
                backgroundColor: theme.primary,
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: '700',
                cursor: 'pointer',
                width: '100%',
                marginTop: '1.5rem'
              }}
            >
              Got it, Explore Project
            </button>
          </div>
        </div>
      )}

  
      {/* Floating Bottom Bar */}
      <div style={{
        position: 'fixed',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '560px',
        backgroundColor: theme.dockBg,
        borderRadius: '26px',
        padding: '0.5rem 0.75rem 0.5rem 1.1rem',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        border: `1px solid ${theme.dockBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        zIndex: 100,
        transition: 'border 0.2s ease, background-color 0.25s ease'
      }}>
        <span style={{ fontSize: '1rem', color: theme.subText }}>🔍</span>
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex' }}>
          <input
            type="text"
            placeholder="Ask about any disease, treatment, or clinical trial..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '0.9rem',
              color: theme.text,
              fontFamily: 'inherit'
            }}
          />
        </form>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload medical report (PDF or Image)"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: theme.pillBg,
            border: 'none',
            color: theme.text,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          📎
        </button>

        <button
          type="button"
          onClick={() => {
            setVoiceModalOpen(true);
            setSphereStatus('READY');
            setSpokenTranscript('');
          }}
          title="Open 3D Voice Assistant"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: theme.pillBg,
            border: 'none',
            color: theme.primary,
            fontSize: '1.1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          🎙️
        </button>

        <button
          type="button"
          onClick={handleSearchSubmit}
          disabled={loading || !query.trim()}
          title="Search"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: query.trim() ? theme.primary : theme.pillBg,
            border: 'none',
            color: '#ffffff',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: query.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ↑
        </button>
      </div>

      {/* 3D Particle Voice Sphere Modal */}
      {voiceModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0a0a0c',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff'
        }}>
          <button
            onClick={() => {
              if (recognitionRef.current && isListening) recognitionRef.current.stop();
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              setIsListening(false);
              setIsSpeaking(false);
              setVoiceModalOpen(false);
            }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#1f1f23',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>

          <div
            onClick={handleSphereClick}
            style={{ cursor: 'pointer', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            <canvas ref={canvasRef} style={{ width: '320px', height: '320px' }} />
          </div>

          <div style={{
            marginTop: '2rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            backgroundColor: '#16161a',
            border: '1px solid #282830',
            padding: '0.4rem 1.1rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.08em',
            color: sphereStatus === 'LISTENING' ? '#e76f51' : '#a1a1aa'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: sphereStatus === 'LISTENING' ? '#e76f51' : '#71717a'
            }} />
            {sphereStatus}
          </div>

          <p style={{
            marginTop: '1.2rem',
            fontSize: '0.98rem',
            color: '#d4d4d8',
            maxWidth: '360px',
            textAlign: 'center',
            lineHeight: '1.5'
          }}>
            {spokenTranscript ? `"${spokenTranscript}"` : (
              isListening ? 'Listening... speak medical query' : 'Tap the sphere to begin'
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
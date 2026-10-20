import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { ArrowRight, Brain, Dna, Droplets, HeartPulse, Mic, Paperclip, Search, ShieldPlus, Stethoscope } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import LandingHero from './LandingHero';
import './App.css';

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://medresearch-ai-backend.onrender.com';

function AiSummarySkeleton() {
  return (
    <div className="ai-summary-skeleton" role="status" aria-label="AI is synthesizing research results">
      <p className="ai-summary-skeleton__status">Synthesizing cross-database literature...</p>
      <div className="ai-summary-skeleton__lines" aria-hidden="true">
        <span className="ai-summary-skeleton__line ai-summary-skeleton__line--wide" />
        <span className="ai-summary-skeleton__line" />
        <span className="ai-summary-skeleton__line ai-summary-skeleton__line--medium" />
      </div>
    </div>
  );
}

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

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('medresearch_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('medresearch_jwt') || '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Saved History & Sidebar Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedHistory, setSavedHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

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
    { icon: Stethoscope, title: 'Lung Cancer', subtitle: 'Latest treatment for lung cancer', query: 'lung cancer treatment' },
    { icon: Droplets, title: 'Diabetes', subtitle: 'Clinical trials for diabetes', query: 'diabetes clinical trials' },
    { icon: Brain, title: "Alzheimer's", subtitle: "Top research in Alzheimer's disease", query: "Alzheimer's disease" },
    { icon: HeartPulse, title: 'Heart Disease', subtitle: 'Recent studies on cardiovascular disease', query: 'heart disease' },
    { icon: Dna, title: 'Gene Therapy', subtitle: 'Latest gene therapy breakthroughs', query: 'gene therapy breakthroughs' },
    { icon: ShieldPlus, title: 'Immunotherapy', subtitle: 'Cancer immunotherapy clinical trials', query: 'cancer immunotherapy' },
  ];

  // Fetch Saved History from MongoDB
  const fetchHistory = async () => {
    if (!authToken) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/history`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSavedHistory(res.data.chats || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchHistory();
    } else {
      setSavedHistory([]);
    }
  }, [authToken]);

  // Auth Handler: Register & Login
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, authForm);
      const { token, user } = res.data;

      localStorage.setItem('medresearch_jwt', token);
      localStorage.setItem('medresearch_user', JSON.stringify(user));
      setAuthToken(token);
      setCurrentUser(user);
      setAuthModalOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('medresearch_jwt');
    localStorage.removeItem('medresearch_user');
    setAuthToken('');
    setCurrentUser(null);
    setSavedHistory([]);
    setDrawerOpen(false);
  };

  // Start New Chat Reset
  const handleNewChat = () => {
    setQuery('');
    setPubmedPapers([]);
    setOpenAlexPapers([]);
    setTrials([]);
    setAiSummary('');
    setChatMessages([]);
    setEligibilityResults({});
    setSearched(false);
    setCurrentChatId(null);
    setDrawerOpen(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  // Delete Chat from History
  const handleDeleteChat = async (e, id) => {
    e.stopPropagation();
    if (!authToken) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/history/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSavedHistory((prev) => prev.filter((item) => item._id !== id));
      if (currentChatId === id) handleNewChat();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };
  // 1. Send voice input to Gemini Q&A
  const handleVoiceConversation = async (userVoiceText) => {
    if (!userVoiceText || !userVoiceText.trim()) {
      setSphereStatus('READY');
      return;
    }

    setSphereStatus('THINKING');

    const combinedPapers = [...pubmedPapers, ...openAlexPapers];
    const newChatHistory = [...chatMessages, { role: 'user', text: userVoiceText }];
    setChatMessages(newChatHistory);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/ai/chat`, {
        question: userVoiceText,
        contextPapers: combinedPapers,
        topic: query || userVoiceText
      });

      const aiReply = res.data.answer || "I reviewed the medical data, but could not produce a response.";
      setChatMessages([...newChatHistory, { role: 'assistant', text: aiReply }]);
      
      speakSphereResponse(aiReply);
    } catch (err) {
      console.error('Voice conversation error:', err);
      speakSphereResponse("I ran into an issue finding that clinical information. Please ask again.");
    }
  };

  // 2. TTS engine for the Voice Sphere
  const speakSphereResponse = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const clean = text.replace(/[*#_`~>\[\]\(\)]/g, '').trim();
    const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)\vert{}[^.!?]+$/g) || [clean];
    const validSentences = sentences.map(s => s.trim()).filter(Boolean);

    if (validSentences.length === 0) {
      setSphereStatus('READY');
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith('en')) || (voices.length > 0 ? voices[0] : null);

    setIsSpeaking(true);
    setSphereStatus('SPEAKING');

    let idx = 0;
    const speakNext = () => {
      if (idx >= validSentences.length) {
        setIsSpeaking(false);
        setSphereStatus('READY');
        return;
      }

      const utter = new SpeechSynthesisUtterance(validSentences[idx]);
      utter.rate = 1.0;
      if (voice) utter.voice = voice;

      utter.onend = () => {
        idx++;
        speakNext();
      };

      utter.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        setIsSpeaking(false);
        setSphereStatus('READY');
      };

      window.speechSynthesis.speak(utter);
    };

    setTimeout(speakNext, 60);
  };

  // Auto-Save Chat to MongoDB
  const saveChatToDatabase = async (topicTerm, messages, contextList, chatId = currentChatId) => {
    if (!authToken || !topicTerm) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/history/save`,
        {
          chatId,
          title: topicTerm,
          topic: topicTerm,
          messages,
          contextPapers: contextList || []
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (res.data?.chat?._id) {
        setCurrentChatId(res.data.chat._id);
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to auto-save chat history:', err);
    }
  };

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
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

  // Unified Search Execution Function
  const executeSearch = async (searchTerm, statusFilter = trialStatusFilter, preserveChatId = null) => {
    if (!searchTerm || !searchTerm.trim()) return;
    const cleanQuery = searchTerm.trim();
    setQuery(cleanQuery);
    setSearched(true);
    setLoading(true);
    setAiLoading(true);
    setAiSummary('');
    saveRecentSearch(cleanQuery);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      // 1. Concurrent Fetch: PubMed, OpenAlex, ClinicalTrials
      const [pubmedRes, openAlexRes, trialsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/pubmed/search?q=${encodeURIComponent(cleanQuery)}`),
        axios.get(`${API_BASE_URL}/api/openalex/search?q=${encodeURIComponent(cleanQuery)}`),
        axios.get(`${API_BASE_URL}/api/trials/search?q=${encodeURIComponent(cleanQuery)}&status=${statusFilter}`)
      ]);

      const fetchedPubmed = pubmedRes.status === 'fulfilled' ? (pubmedRes.value.data.results || []) : [];
      const fetchedOpenAlex = openAlexRes.status === 'fulfilled' ? (openAlexRes.value.data.results || []) : [];
      const fetchedTrials = trialsRes.status === 'fulfilled' ? (trialsRes.value.data.results || []) : [];

      setPubmedPapers(fetchedPubmed);
      setOpenAlexPapers(fetchedOpenAlex);
      setTrials(fetchedTrials);
      setLoading(false);

      // 2. Synthesize Evidence with Gemini AI
      const combinedPapers = [...fetchedPubmed, ...fetchedOpenAlex];
      if (combinedPapers.length > 0) {
        try {
          const aiRes = await axios.post(`${API_BASE_URL}/api/ai/synthesize`, {
            query: cleanQuery,
            papers: combinedPapers.slice(0, 8)
          });
          const summary = aiRes.data.summary || 'Summary generated.';
          setAiSummary(summary);

          // Auto-save search thread to MongoDB if authenticated
          if (authToken) {
            saveChatToDatabase(
              cleanQuery,
              [{ role: 'assistant', text: summary }],
              combinedPapers.slice(0, 8),
              preserveChatId
            );
          }
        } catch (aiErr) {
          console.error('Synthesis error:', aiErr);
          setAiSummary('AI Evidence Synthesis is currently unavailable. Please inspect the source papers directly.');
        }
      } else {
        setAiSummary('No academic papers found matching this search term.');
      }
    } catch (err) {
      console.error('Search execution failed:', err);
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  // Alias handleSearch to executeSearch for backward compatibility
  const handleSearch = (term) => executeSearch(term);

  // Restore Chat from History
  const handleSelectHistoryChat = (chat) => {
    setCurrentChatId(chat._id);
    const topic = chat.topic || chat.title || '';
    setQuery(topic);
    setChatMessages(chat.messages || []);
    setSearched(true);
    setDrawerOpen(false);
    executeSearch(topic, trialStatusFilter, chat._id);
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

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
        setSpokenTranscript(transcript);

    if (event.results[0].isFinal) {
          if (recognitionRef.current) recognitionRef.current.stop();
          setIsListening(false);
          handleVoiceConversation(transcript);
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
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      if (typeof setSphereStatus === 'function') setSphereStatus('READY');
      return;
    }

    if (!text || typeof text !== 'string' || !text.trim()) return;

    window.speechSynthesis.cancel();

    // Clean markdown characters and extra whitespace
    const cleanText = text
      .replace(/[*#_`~>\[\]\(\)]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Split into sentences for Chrome compatibility
    const sentences = cleanText.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleanText];
    const validSentences = sentences.map(s => s.trim()).filter(Boolean);

    if (validSentences.length === 0) return;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith('en')) || (voices.length > 0 ? voices[0] : null);

    setIsSpeaking(true);
    if (typeof setSphereStatus === 'function') setSphereStatus('SPEAKING');

    let currentIndex = 0;

    const speakNextSentence = () => {
      if (currentIndex >= validSentences.length) {
        setIsSpeaking(false);
        if (typeof setSphereStatus === 'function') setSphereStatus('READY');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(validSentences[currentIndex]);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        currentIndex++;
        speakNextSentence();
      };

      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        console.error('TTS error:', e);
        setIsSpeaking(false);
        if (typeof setSphereStatus === 'function') setSphereStatus('READY');
      };

      window.speechSynthesis.speak(utterance);
    };

    setTimeout(speakNextSentence, 50);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    executeSearch(query);
  };

  const handleTopicClick = (item) => {
    const q = item.query || item.title || item;
    executeSearch(q);
  };

  const handleRecentClick = (term) => {
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
    const newMessages = [...chatMessages, { role: 'user', text: userText }];
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
      const updatedMessages = [...newMessages, { role: 'assistant', text: aiReply }];
      setChatMessages(updatedMessages);
      speakText(aiReply);

      if (authToken) {
        saveChatToDatabase(query, updatedMessages, combinedPapers.slice(0, 8), currentChatId);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages([...newMessages, { role: 'assistant', text: 'Sorry, I encountered an error answering that.' }]);
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
          <strong>[${p.db || 'Paper'}] ${p.title}</strong><br/>
          <span style="color: #64748b; font-size: 13px;">Source: ${p.source} (${p.pubDate})</span>
        </li>
      `)
      .join('');

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Please allow popups to save the PDF summary.');
      return;
    }
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
            <p style="margin: 6px 0 0 0; color: #8c827a; font-size: 14px;">Condition: <strong>${query.toUpperCase()}</strong> | Date: ${date}</p>
          </div>
          <div>
            <span class="badge">Gemini Multi-Source Synthesis</span>
            <div class="summary-box">${formattedSummaryLines}</div>
          </div>
          <h3 style="margin-top: 28px; font-size: 16px; color: #2c2523;">Referenced Academic Literature:</h3>
          <ol style="padding-left: 20px; font-size: 13.5px; line-height: 1.6;">${formattedPapers}</ol>
          <div class="footer">MedResearch AI — Multi-database synthesis across PubMed & OpenAlex.</div>
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
    drawerBg: darkMode ? '#0c1322' : '#ffffff',
  };

  return (
    <div className={`app-shell${darkMode ? ' app-shell--dark' : ''}`} style={{
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

      {/* HEADER */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '780px', margin: '0 auto' }}>
        <div className="app-header__brand">
          <button
            onClick={() => setDrawerOpen(true)}
            title="Open Chat History"
            className="app-header__menu"
            style={{
              background: theme.pillBg,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}
          >
            ☰
          </button>

          <div className="app-header__mark" style={{ backgroundColor: theme.pillBg }}>
            🔬
          </div>
          <div className="brand-lockup">
            <span className="brand-title" style={{ color: theme.text }}>MedResearch AI</span>
            <span className="live-status" role="status" aria-label="MedResearch AI is live">
              <span className="live-status__dot" aria-hidden="true" />
              Live
            </span>
          </div>
        </div>

        <div className="app-header__actions">
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="app-header__user-name" style={{ color: theme.primary, backgroundColor: theme.pillBg, border: `1px solid ${theme.border}` }}>
                👤 {currentUser.name.split(' ')[0]}
              </span>
            </div>
          ) : (
            <button
              onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
              style={{
                backgroundColor: theme.primary,
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.8rem',
                borderRadius: '9999px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '700'
              }}
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => setShowHowItWorks(true)}
            className="app-header__secondary"
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
            How it works
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="app-header__secondary"
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

          <span className="app-header__project" style={{
            fontSize: '0.72rem',
            backgroundColor: theme.pillBg,
            color: theme.subText,
            border: `1px solid ${theme.border}`,
            padding: '0.3rem 0.65rem',
            borderRadius: '9999px',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            BCA Project
          </span>
        </div>
      </header>

      {/* SLIDE-OUT HISTORY DRAWER */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 99999,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '320px',
              maxWidth: '85vw',
              height: '100%',
              backgroundColor: theme.drawerBg,
              borderRight: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem 1.25rem',
              boxShadow: '10px 0 30px rgba(0,0,0,0.25)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🔬</span>
                <span style={{ fontWeight: '800', fontSize: '1rem', color: theme.text }}>Research History</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: theme.subText }}
              >
                ✕
              </button>
            </div>

            <button
              onClick={handleNewChat}
              style={{
                backgroundColor: theme.primary,
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)'
              }}
            >
              <span>+</span> New Chat
            </button>

            {currentUser ? (
              <div style={{
                backgroundColor: theme.pillBg,
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: theme.text }}>{currentUser.name}</div>
                  <div style={{ fontSize: '0.72rem', color: theme.subText }}>{currentUser.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div style={{
                backgroundColor: theme.pillBg,
                padding: '0.85rem',
                borderRadius: '12px',
                marginBottom: '1.25rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: theme.subText }}>
                  Sign in to save searches and chat history to MongoDB Atlas.
                </p>
                <button
                  onClick={() => { setDrawerOpen(false); setAuthMode('login'); setAuthModalOpen(true); }}
                  style={{
                    backgroundColor: theme.primary,
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Sign In / Register
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: theme.subText, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Past Conversations
              </div>

              {savedHistory.length === 0 ? (
                <div style={{ color: theme.subText, fontSize: '0.8rem', padding: '1rem 0', textAlign: 'center' }}>
                  {currentUser ? 'No saved chats yet. Start searching!' : 'Sign in to access saved chats.'}
                </div>
              ) : (
                savedHistory.map((chat) => (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectHistoryChat(chat)}
                    style={{
                      backgroundColor: currentChatId === chat._id ? theme.pillBg : 'transparent',
                      border: `1px solid ${currentChatId === chat._id ? theme.primary : theme.border}`,
                      borderRadius: '10px',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: '600', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        💬 {chat.title || chat.topic}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: theme.subText, marginTop: '2px' }}>
                        {new Date(chat.createdAt).toLocaleDateString()} • {chat.messages?.length || 0} msgs
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteChat(e, chat._id)}
                      title="Delete chat"
                      style={{ background: 'none', border: 'none', color: theme.subText, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATION MODAL */}
      {authModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 100000,
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
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 15px 50px rgba(0,0,0,0.35)',
            border: `1px solid ${theme.border}`,
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: theme.text }}>
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </h3>
              <button
                onClick={() => setAuthModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: theme.subText }}
              >
                ✕
              </button>
            </div>

            {authError && (
              <div style={{ backgroundColor: '#ef444420', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', marginBottom: '1rem' }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: theme.subText, marginBottom: '0.3rem' }}>FULL NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Hemanth Kumar"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.pillBg, color: theme.text, outline: 'none', fontSize: '0.85rem' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: theme.subText, marginBottom: '0.3rem' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.pillBg, color: theme.text, outline: 'none', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: theme.subText, marginBottom: '0.3rem' }}>PASSWORD</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.pillBg, color: theme.text, outline: 'none', fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  backgroundColor: theme.primary,
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                {authLoading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: theme.subText }}>
              {authMode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <span
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    style={{ color: theme.primary, cursor: 'pointer', fontWeight: '700' }}
                  >
                    Register
                  </span>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <span
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    style={{ color: theme.primary, cursor: 'pointer', fontWeight: '700' }}
                  >
                    Sign In
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="app-main" style={{ maxWidth: '580px', textAlign: 'center' }}>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', backgroundColor: darkMode ? '#1e293b' : '#fbece5', color: darkMode ? '#38bdf8' : '#e07a5f', fontSize: '1.6rem', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          ★
        </div>

        <h1 className="app-greeting" style={{ color: theme.text }}>
          {getGreeting()}
        </h1>
        <p className="app-intro" style={{ color: theme.subText }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {featuredTopics.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTopicClick(topic)}
                  style={{
                    backgroundColor: theme.topicCardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '18px',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="topic-icon" style={{ backgroundColor: theme.topicIconBg, border: `1px solid ${theme.border}`, color: theme.primary }}>
                      {React.createElement(topic.icon, { size: 20, strokeWidth: 1.8, 'aria-hidden': true })}
                    </div>
                    <div>
                    <h3 className="topic-title" style={{ color: theme.text }}>{topic.title}</h3>
                    <p className="topic-subtitle" style={{ color: theme.subText }}>{topic.subtitle}</p>
                    </div>
                  </div>
                  <span style={{ color: theme.subText, fontSize: '1.2rem', fontWeight: '600' }}>›</span>
                </button>
              ))}
            </div>

            {/* Reference Design: Metrics & Precision Grid */}
            <LandingHero onSelectTopic={(t) => executeSearch(t)} theme={theme} />

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
          <div className="search-results" style={{ textAlign: 'left' }}>
            <button
              onClick={() => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                setIsSpeaking(false);
                setSearched(false);
              }}
              style={{ backgroundColor: 'transparent', border: 'none', color: theme.primary, fontWeight: '700', fontSize: '0.875rem', cursor: 'pointer', padding: 0, marginBottom: '16px' }}
            >
              ← Back to categories
            </button>

            {/* AI Summary Card */}
            <div className="ai-summary-card" aria-busy={aiLoading} style={{ backgroundColor: theme.summaryBg, border: `1px solid ${theme.summaryBorder}`, boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
              <div className="ai-summary-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="ai-summary-card__title" style={{ color: theme.primary }}>✨ AI Evidence Synthesis</span>
                  <span style={{ fontSize: '0.72rem', backgroundColor: darkMode ? '#1e293b' : '#fbece5', color: theme.primary, padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: '700' }}>Gemini</span>
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
                <AiSummarySkeleton />
              ) : (
                <div className="ai-summary-copy" style={{ color: theme.text }}>
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
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.role === 'user' ? theme.chatBubbleUser : theme.chatBubbleAi,
                            color: msg.role === 'user' ? '#ffffff' : theme.text,
                            padding: '0.65rem 0.95rem',
                            borderRadius: '12px',
                            maxWidth: '82%',
                            fontSize: '0.85rem',
                            lineHeight: '1.5',
                            border: msg.role === 'assistant' ? `1px solid ${theme.border}` : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{msg.text}</span>
                            {msg.role === 'assistant' && (
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
      </main>

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
                <strong style={{ color: theme.primary }}>3. Grounded Evidence Synthesis & Persistent MongoDB Storage</strong>
                <p style={{ margin: '0.35rem 0 0 0', color: theme.subText, lineHeight: '1.5' }}>
                  Synthesizes scientific findings into key takeaways with source citations. Integrated with <b>MongoDB Atlas</b> and <b>JWT</b> to securely save query threads across sessions.
                </p>
              </div>

              <div style={{ backgroundColor: theme.pillBg, padding: '0.85rem 1rem', borderRadius: '12px' }}>
                <strong style={{ color: theme.primary }}>4. Patient Protocol Eligibility Matching</strong>
                <p style={{ margin: '0.35rem 0 0 0', color: theme.subText, lineHeight: '1.5' }}>
                  Evaluates a patient's clinical baseline against trial criteria to calculate match status.
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
      <div className="search-composer" style={{
        position: 'fixed',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '560px',
        backgroundColor: theme.dockBg,
        borderRadius: '20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        border: `1px solid ${theme.dockBorder}`,
        display: 'flex',
        alignItems: 'center',
        zIndex: 100,
        transition: 'border 0.2s ease, background-color 0.25s ease'
      }}>
        <Search className="search-composer__search-icon" size={20} aria-hidden="true" />
        <form onSubmit={handleSearchSubmit} className="search-composer__form">
          <input
            type="text"
            placeholder="Ask about any disease, treatment, or clinical trial..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-composer__input"
            style={{ color: theme.text }}
          />
        </form>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload medical report (PDF or Image)"
          className="search-composer__icon-button"
          style={{ backgroundColor: theme.pillBg, color: theme.text }}
        >
          <Paperclip size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            setVoiceModalOpen(true);
            setSphereStatus('READY');
            setSpokenTranscript('');
          }}
          title="Open voice assistant"
          aria-label="Open voice assistant"
          className="search-composer__icon-button"
          style={{ backgroundColor: theme.pillBg, color: theme.primary }}
        >
          <Mic size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleSearchSubmit}
          disabled={loading || !query.trim()}
          title="Search"
          className="search-composer__submit"
          style={{ backgroundColor: query.trim() ? theme.primary : theme.pillBg }}
        >
          <span>Search</span>
          <ArrowRight size={18} aria-hidden="true" />
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
          fontSize: '0.95rem',
          color: '#d4d4d8',
          maxWidth: '380px',
          textAlign: 'center',
          lineHeight: '1.5',
          minHeight: '48px'
        }}>
          {sphereStatus === 'SPEAKING' && chatMessages.length > 0
            ? chatMessages[chatMessages.length - 1].text
            : spokenTranscript
            ? `"${spokenTranscript}"`
            : isListening
            ? 'Listening... speak your question'
            : 'Tap the sphere to talk'}
        </p>
        </div>
      )}
    </div>
  );
}

export default App;
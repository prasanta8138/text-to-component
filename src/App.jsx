import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

const GROQ_MODEL = 'llama-3.3-70b-versatile'

const OUTPUT_FORMATS = [
  { id: 'react', label: 'React JSX', lang: 'jsx' },
  { id: 'html', label: 'HTML + CSS', lang: 'html' },
  { id: 'tailwind', label: 'React + Tailwind', lang: 'jsx' },
  { id: 'vue', label: 'Vue SFC', lang: 'html' },
]

const STYLE_PRESETS = [
  { id: 'modern',        label: '✨ Modern',        desc: 'Clean & professional',     color: '#5b8af0' },
  { id: 'minimal',       label: '◻ Minimal',        desc: 'Simple & distraction-free',color: '#a0a0c0' },
  { id: 'bold',          label: '⚡ Bold',           desc: 'Strong & high contrast',   color: '#f0a050' },
  { id: 'dark',          label: '🌑 Dark',           desc: 'Deep dark with glows',     color: '#8060f0' },
  { id: 'glassmorphism', label: '🪟 Glass',          desc: 'Frosted glass effect',     color: '#60d0f0' },
  { id: 'neon',          label: '🌈 Neon',           desc: 'Vibrant neon cyberpunk',   color: '#f060c0' },
  { id: 'retro',         label: '📺 Retro',          desc: '80s vintage aesthetic',    color: '#f0e060' },
  { id: 'cyberpunk',     label: '🤖 Cyberpunk',      desc: 'Futuristic & edgy',        color: '#00f0a0' },
]

const EXAMPLES = [
  'A pricing card with 3 tiers: Free, Pro $9/mo, Enterprise. Highlight the Pro tier.',
  'A navbar with logo on left, nav links in center, and login/signup buttons on right.',
  'A hero section with a big headline, subtitle, CTA button, and abstract background.',
  'A testimonial card with avatar, name, role, star rating and quote.',
  'A dashboard stats row showing 4 cards: Users, Revenue, Orders, Conversion Rate.',
  'A login form with email, password fields, forgot password link and submit button.',
  'A social media profile card with avatar, name, bio, follower counts and follow button.',
  'A notification dropdown with unread badge, list of notifications and mark all read button.',
]

const stylePrompts = {
  modern:        'Clean modern UI: subtle shadows, rounded corners, smooth hover transitions, professional blue/gray palette.',
  minimal:       'Ultra minimal: maximum whitespace, no decorations, only essential elements, muted monochrome colors.',
  bold:          'Bold and striking: strong typography, high contrast, dramatic spacing, confident warm colors.',
  dark:          'Dark theme: deep #0a0a0f backgrounds, glowing purple/blue accents, subtle gradients.',
  glassmorphism: 'Glassmorphism: frosted glass panels (backdrop-filter: blur), semi-transparent backgrounds, soft borders, light overlay on gradient background.',
  neon:          'Neon style: dark background, bright neon pink/cyan/green glowing text and borders, box-shadow glows.',
  retro:         'Retro 80s: pixel-style borders, warm yellow/orange palette, retro fonts (monospace), scanline feel.',
  cyberpunk:     'Cyberpunk: black background, bright yellow+cyan accents, diagonal cuts, glitch effects, techy monospace fonts.',
}

function buildPrompt(description, format, stylePreset) {
  const formatInstructions = {
    react:    'Generate a complete React JSX component. Use inline styles only. Export as default.',
    html:     'Generate complete HTML with all CSS in a <style> tag. Single self-contained file.',
    tailwind: 'Generate a React JSX component using only Tailwind CSS classes. Export as default.',
    vue:      'Generate a complete Vue 3 SFC with <template>, <script setup>, and <style scoped>.',
  }
  return `You are an expert UI developer. Create a beautiful production-ready UI component:

"${description}"

FORMAT: ${formatInstructions[format]}
STYLE: ${stylePrompts[stylePreset]}

RULES:
- Complete, fully working code
- Responsive and mobile-friendly
- Realistic placeholder content
- Smooth hover transitions
- No external dependencies

Return ONLY raw code. No explanation, no markdown fences.`
}

async function callGroqAPI(apiKey, description, format, stylePreset) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: buildPrompt(description, format, stylePreset) }],
    }),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || `Groq API error: ${response.status}`)
  }
  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No response from Groq. Please check your API key.')
  return text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
}

export default function App() {
  const [apiKey, setApiKey]           = useState(() => localStorage.getItem('groq_api_key') || '')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [description, setDescription] = useState('')
  const [format, setFormat]           = useState('html')
  const [stylePreset, setStylePreset] = useState('modern')
  const [output, setOutput]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)
  const [activeTab, setActiveTab]     = useState('code')
  const [history, setHistory]         = useState(() => JSON.parse(localStorage.getItem('gen_history') || '[]'))
  const [showHistory, setShowHistory] = useState(false)
  const [codeTheme, setCodeTheme]     = useState('dark')
  const [animate, setAnimate]         = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const saveApiKey = (key) => { setApiKey(key); localStorage.setItem('groq_api_key', key) }

  const addToHistory = (desc, fmt, style, code) => {
    const entry = { id: Date.now(), desc, fmt, style, code, time: new Date().toLocaleTimeString() }
    const updated = [entry, ...history].slice(0, 5)
    setHistory(updated)
    localStorage.setItem('gen_history', JSON.stringify(updated))
  }

  const handleGenerate = async () => {
    if (!apiKey.trim()) { setError('Please enter your Groq API key.'); return }
    if (!description.trim() || description.trim().length < 10) { setError('Please provide a more detailed description.'); return }
    setLoading(true); setError(''); setOutput(''); setAnimate(false); setActiveTab('code')
    try {
      const code = await callGroqAPI(apiKey.trim(), description.trim(), format, stylePreset)
      setOutput(code)
      setAnimate(true)
      addToHistory(description.trim(), format, stylePreset, code)
      if (format === 'html') setActiveTab('preview')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleCopy = () => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const handleDownload = () => {
    const ext = format === 'react' || format === 'tailwind' ? 'jsx' : format === 'vue' ? 'vue' : 'html'
    const blob = new Blob([output], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `component.${ext}`; a.click()
  }

  const loadHistory = (entry) => { setOutput(entry.code); setDescription(entry.desc); setFormat(entry.fmt); setStylePreset(entry.style); setActiveTab(entry.fmt === 'html' ? 'preview' : 'code'); setShowHistory(false) }

  const currentFormat = OUTPUT_FORMATS.find(f => f.id === format)
  const currentStyle  = STYLE_PRESETS.find(s => s.id === stylePreset)

  const S = {
    app:    { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', fontFamily: 'var(--font-display)' },
    grid:   { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'linear-gradient(rgba(91,138,240,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(91,138,240,0.03) 1px,transparent 1px)', backgroundSize: '44px 44px' },
    header: { position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '58px', background: 'rgba(7,8,15,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' },
    main:   { position: 'relative', zIndex: 1, display: 'flex', flex: 1, minHeight: 'calc(100vh - 58px)', overflow: 'hidden' },
  }

  return (
    <div style={S.app}>
      <div style={S.grid} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { border-color: var(--accent) !important; }
        button:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: var(--bg-2); }
        ::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 3px; }
        @media (max-width: 768px) {
          .main-grid { flex-direction: column !important; }
          .left-panel { width: 100% !important; max-height: 50vh; border-right: none !important; border-bottom: 1px solid var(--border) !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--accent)', fontSize: '1.2rem' }}>◈</span>
            <span>text<span style={{ color: 'var(--accent)', fontWeight: 400 }}> → </span>component</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setShowHistory(v => !v)} style={{ background: showHistory ? 'var(--accent-glow)' : 'var(--bg-3)', border: `1px solid ${showHistory ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, color: showHistory ? 'var(--accent-bright)' : 'var(--text-muted)' }}>
            🕐 History ({history.length})
          </button>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--green)', border: '1px solid rgba(62,240,160,0.25)', borderRadius: '100px', padding: '0.2rem 0.75rem', background: 'var(--green-dim)' }}>✦ FREE · Groq</div>
        </div>
      </header>

      {/* HISTORY DRAWER */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 58, right: 0, width: 340, height: 'calc(100vh - 58px)', background: 'var(--bg-2)', borderLeft: '1px solid var(--border)', zIndex: 200, overflowY: 'auto', padding: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Generations</h3>
          {history.length === 0 && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>No history yet. Generate something!</p>}
          {history.map(entry => (
            <div key={entry.id} onClick={() => loadHistory(entry)}
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer', transition: 'all 0.15s' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text)', marginBottom: '0.35rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.desc}</p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--accent-bright)', background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '0.1rem 0.4rem' }}>{entry.fmt}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--text-dim)' }}>{entry.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <main className="main-grid" style={{ ...S.main, display: 'flex' }}>

        {/* LEFT PANEL */}
        {sidebarOpen && (
          <div className="left-panel" style={{ width: 380, borderRight: '1px solid var(--border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', background: 'var(--bg-2)', flexShrink: 0 }}>

            {/* API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>🔑 Groq API Key</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input type={apiKeyVisible ? 'text' : 'password'} placeholder="gsk_..." value={apiKey} onChange={e => saveApiKey(e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.75rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', outline: 'none' }} />
                <button onClick={() => setApiKeyVisible(v => !v)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', width: 34, cursor: 'pointer', fontSize: '0.85rem' }}>{apiKeyVisible ? '🙈' : '👁'}</button>
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>Free at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)', textDecoration: 'none' }}>console.groq.com/keys</a> — no card needed!</p>
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>✏️ Describe Your Component</label>
              <textarea placeholder="e.g. A pricing card with 3 tiers..." value={description} onChange={e => setDescription(e.target.value)} rows={4}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.75rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            {/* Examples */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>💡 Examples</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 160, overflowY: 'auto' }}>
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => setDescription(ex)}
                    style={{ background: description === ex ? 'var(--accent-glow)' : 'var(--bg-3)', border: `1px solid ${description === ex ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', padding: '0.45rem 0.65rem', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: description === ex ? 'var(--accent-bright)' : 'var(--text-muted)', textAlign: 'left', lineHeight: 1.4 }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>⚙ Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                {OUTPUT_FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    style={{ background: format === f.id ? 'var(--accent-glow)' : 'var(--bg-3)', border: `1px solid ${format === f.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', padding: '0.45rem', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 600, color: format === f.id ? 'var(--accent-bright)' : 'var(--text-muted)' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>🎨 Style Preset</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                {STYLE_PRESETS.map(p => (
                  <button key={p.id} onClick={() => setStylePreset(p.id)}
                    style={{ background: stylePreset === p.id ? `${p.color}15` : 'var(--bg-3)', border: `1px solid ${stylePreset === p.id ? p.color : 'var(--border)'}`, borderRadius: '8px', padding: '0.5rem 0.65rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.1rem', textAlign: 'left' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: stylePreset === p.id ? p.color : 'var(--text)' }}>{p.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)' }}>{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate} disabled={loading}
              style={{ background: loading ? 'var(--bg-3)' : currentStyle?.color || 'var(--accent)', border: loading ? '1px solid var(--border)' : 'none', borderRadius: '10px', padding: '0.85rem', color: loading ? 'var(--text-muted)' : 'white', fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: loading ? 'none' : `0 4px 20px ${currentStyle?.color}40`, transition: 'all 0.2s' }}>
              {loading ? <><span style={{ width: 15, height: 15, border: '2px solid var(--border-bright)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Generating...</> : <><span>◈</span> Generate Component</>}
            </button>

            {error && <div style={{ background: 'rgba(240,80,100,0.08)', border: '1px solid rgba(240,80,100,0.3)', borderRadius: '8px', padding: '0.7rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#f05064', lineHeight: 1.5 }}>⚠ {error}</div>}
          </div>
        )}

        {/* RIGHT PANEL */}
        <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!output && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '3rem', textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, border: '1px solid var(--border)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--accent)', background: 'var(--accent-glow)' }}>◈</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Describe anything</h2>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)', maxWidth: 340, lineHeight: 1.7 }}>Type what you want to build — a navbar, card, form, dashboard — and get clean code instantly. <span style={{ color: 'var(--green)' }}>Completely free.</span></p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                {['Pricing cards', 'Login form', 'Hero section', 'Dashboard', 'Profile card', 'Neon button'].map(tag => (
                  <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '100px', padding: '0.25rem 0.7rem', background: 'var(--bg-3)' }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid var(--border)`, borderTopColor: currentStyle?.color || 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem' }}>Generating with {currentStyle?.label}...</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Usually 3–8 seconds ⚡</p>
            </div>
          )}

          {output && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: animate ? 'fadeSlideIn 0.4s ease' : 'none' }}>
              {/* Output toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {['code', ...(format === 'html' ? ['preview'] : [])].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      style={{ background: activeTab === tab ? 'var(--accent-glow)' : 'none', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.78rem', fontWeight: 600, color: activeTab === tab ? 'var(--accent-bright)' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--green)', border: '1px solid rgba(62,240,160,0.2)', background: 'var(--green-dim)', padding: '0.12rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{currentFormat?.lang}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: currentStyle?.color, border: `1px solid ${currentStyle?.color}40`, background: `${currentStyle?.color}10`, padding: '0.12rem 0.45rem', borderRadius: '4px' }}>{currentStyle?.label}</span>
                  <button onClick={() => setCodeTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{codeTheme === 'dark' ? '☀ Light' : '🌑 Dark'}</button>
                  <button onClick={handleCopy} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)' }}>{copied ? '✓ Copied' : '⧉ Copy'}</button>
                  <button onClick={handleDownload} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)' }}>↓ Download</button>
                </div>
              </div>

              {activeTab === 'code' && (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <SyntaxHighlighter language={currentFormat?.lang} style={codeTheme === 'dark' ? vscDarkPlus : tomorrow}
                    customStyle={{ margin: 0, padding: '1.5rem', background: codeTheme === 'dark' ? 'transparent' : '#fafafa', fontSize: '13px', lineHeight: '1.65', fontFamily: 'DM Mono, monospace', minHeight: '100%' }}
                    showLineNumbers lineNumberStyle={{ color: codeTheme === 'dark' ? '#333350' : '#bbb', fontSize: '12px', minWidth: '2.5rem' }}>
                    {output}
                  </SyntaxHighlighter>
                </div>
              )}
              {activeTab === 'preview' && format === 'html' && (
                <iframe title="Preview" srcDoc={output} sandbox="allow-scripts" style={{ flex: 1, border: 'none', background: 'white', width: '100%', height: '100%' }} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

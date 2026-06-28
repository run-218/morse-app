import { useState, useRef, useEffect } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MORSE TABLES  (無線局運用規則 別表第一号 準拠)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── EN: 英字 A-Z ────────────────────────────────────
const MORSE_EN_BASE = {
  ".-":   "A", "-...": "B", "-.-.": "C", "-..":  "D", ".":    "E",
  "..-.": "F", "--.":  "G", "....": "H", "..":   "I", ".---": "J",
  "-.-":  "K", ".-..": "L", "--":   "M", "-.":   "N", "---":  "O",
  ".--.": "P", "--.-": "Q", ".-.":  "R", "...":  "S", "-":    "T",
  "..-":  "U", "...-": "V", ".--":  "W", "-..-": "X", "-.--": "Y",
  "--..": "Z",
};

// ── EN+: 英字 + 数字 + 記号 ─────────────────────────
const MORSE_EN_PLUS = {
  ...MORSE_EN_BASE,
  // 数字（正式5シンボル）
  ".----": "1", "..---": "2", "...--": "3", "....-": "4", ".....": "5",
  "-....": "6", "--...": "7", "---..": "8", "----.": "9", "-----": "0",
  // 欧文記号
  ".-.-.-": ".", "--..--": ",", "---...": ":", "..--..": "?",
  ".----.": "'", "-....-": "-", "-.--.":  "(", "-.--.-": ")",
  "-..-.":  "/", "-...-":  "=", ".-.-.":  "+", ".-..-.": '"',
  ".--.-.": "@",
};

// ── JA: カタカナ基本 ─────────────────────────────────
// 無線局運用規則別表第一号 和文符号（正確版）
const MORSE_JA_BASE = {
  "--.--":  "ア", ".-":    "イ", "..-":   "ウ", "-.---": "エ", ".-...": "オ",
  ".-..":   "カ", "-.-.."  :"キ", "...-":  "ク", "-.--":  "ケ", "----":  "コ",
  "-.-.-":  "サ", "--.-."  :"シ", "---.-": "ス", ".---.": "セ", "---.":  "ソ",
  "-.":     "タ", "..-.":  "チ", "..--.": "ツ", ".-.--": "テ", "..-.." :"ト",
  ".-." :   "ナ", "-.-.":  "ニ", "....":  "ヌ", "--.-":  "ネ", "..--":  "ノ",
  "-...":   "ハ", "--..-": "ヒ", "--..":  "フ", ".":     "ヘ", "-.."  : "ホ",
  "-..-":   "マ", "..-.-": "ミ", "-":     "ム", "-...-": "メ", "-..-." :"モ",
  ".--":    "ヤ", "-..--.": "ユ", "--":   "ヨ",
  "...":    "ラ", "--.":   "リ", "-.--.": "ル", "---":   "レ", ".-.-":  "ロ",
  "-.-":    "ワ", ".---":  "ヲ", ".-.-." :"ン",
  ".-..-":  "ヰ", ".--..": "ヱ",
};

// ── JA+: カタカナ + 和文記号 ────────────────────────
const MORSE_JA_PLUS = {
  ...MORSE_JA_BASE,
  "..":       "゛",   // 濁点
  "..--." :   "゜",   // 半濁点
  ".--.-":    "ー",   // 長音
  ".-.-.-":   "、",   // 区切点（読点）
  ".-.-.." :  "└",   // 段落
  "-.--.-":   "（",   // 下向き括弧
  ".-..-.":   "）",   // 上向き括弧
};

// ── モード定義 ────────────────────────────────────────
const MODES = {
  EN:  { map: MORSE_EN_BASE, label: "ENG",   sub: "英字",         maxDepth: 4 },
  ENP: { map: MORSE_EN_PLUS, label: "ENG+",  sub: "英字・数字・記号", maxDepth: 6 },
  JA:  { map: MORSE_JA_BASE, label: "日本語", sub: "カタカナ",      maxDepth: 6 },
  JAP: { map: MORSE_JA_PLUS, label: "日本語+", sub: "カタカナ・記号", maxDepth: 7 },
};

// ── リバースマップ（再生用）──────────────────────────
function buildRev(map) {
  const r = {};
  for (const [code, ch] of Object.entries(map)) r[ch] = code;
  return r;
}
const REV = Object.fromEntries(
  Object.entries(MODES).map(([k, v]) => [k, buildRev(v.map)])
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TREE  BUILDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildTree(morseMap) {
  const tree = { char: null, dot: null, dash: null, code: "" };
  for (const [code, char] of Object.entries(morseMap)) {
    let node = tree;
    let path = "";
    for (const sym of code) {
      path += sym;
      const dir = sym === "." ? "dot" : "dash";
      if (!node[dir]) node[dir] = { char: null, dot: null, dash: null, code: path };
      node = node[dir];
    }
    node.char = char;
  }
  return tree;
}

const TREES = Object.fromEntries(
  Object.entries(MODES).map(([k, v]) => [k, buildTree(v.map)])
);

function getNode(tree, code) {
  let n = tree;
  for (const s of code) {
    if (!n) return null;
    n = s === "." ? n.dot : n.dash;
  }
  return n;
}

function getReachable(node) {
  const s = new Set();
  function walk(n) {
    if (!n) return;
    if (n.char) s.add(n.code);
    walk(n.dot); walk(n.dash);
  }
  walk(node);
  return s;
}

// ── SVG ツリーレイアウト ──────────────────────────────
function computeLayout(root, width, rowH, maxDepth) {
  const nodes = [], edges = [];
  function walk(node, depth, xMin, xMax, pX, pY) {
    if (!node || depth > maxDepth) return;
    const x = (xMin + xMax) / 2;
    const y = depth * rowH + rowH / 2;
    nodes.push({ node, x, y });
    if (pX !== null) edges.push({ x1: pX, y1: pY, x2: x, y2: y });
    const mid = (xMin + xMax) / 2;
    walk(node.dot,  depth + 1, xMin, mid, x, y);
    walk(node.dash, depth + 1, mid,  xMax, x, y);
  }
  walk(root, 0, 0, width, null, null);
  return { nodes, edges };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  THEME
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const G = {
  bg:          "#0e0c08",
  border:      "#4a3a18",
  borderBright:"#b8942a",
  gold:        "#d4a832",
  goldLight:   "#f0cc60",
  goldDim:     "#7a5c18",
  dimNode:     "#3d3220",
  dimText:     "#6a5830",
  dimEdge:     "#3d3218",
  dimFill:     "#181508",
  text:        "#f0e4c0",
  dot:         "#a0c8ff",
  dash:        "#ffaa50",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PLAYBACK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DIT      = 80;
const DAH      = 240;
const ELEM_GAP = 80;
const CHAR_GAP = 240;
const WORD_GAP = 560;

function textToSeq(text, modeKey) {
  // 再生時は全モードのリバースを合成してできるだけ変換
  const combined = {
    ...REV.EN, ...REV.ENP, ...REV.JA, ...REV.JAP,
    ...REV[modeKey],
  };
  const seq = [];
  const words = text.trim().split(/\s+/);
  words.forEach((word, wi) => {
    [...word].forEach((ch, ci) => {
      const code = combined[ch.toUpperCase()] || combined[ch];
      if (!code) return;
      [...code].forEach((sym, si) => {
        if (si > 0) seq.push({ type: "gap", ms: ELEM_GAP });
        seq.push({ type: sym === "." ? "dit" : "dah", ms: sym === "." ? DIT : DAH });
      });
      if (ci < word.length - 1) seq.push({ type: "gap", ms: CHAR_GAP });
    });
    if (wi < words.length - 1) seq.push({ type: "gap", ms: WORD_GAP });
  });
  return seq;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const THRESHOLD = 300;

export default function MorseApp() {
  const [modeKey, setModeKey]     = useState("EN");
  const [currentCode, setCC]      = useState("");
  const [output, setOutput]       = useState("");
  const [isPressed, setIsPressed] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const pressStart  = useRef(null);
  const letterTimer = useRef(null);
  const wordTimer   = useRef(null);
  const audioCtx    = useRef(null);
  const playbackRef = useRef(null);

  const mode       = MODES[modeKey];
  const tree       = TREES[modeKey];
  const curNode    = getNode(tree, currentCode);
  const reachable  = getReachable(curNode ?? tree);

  // ── commit ──────────────────────────────────────
  function commit(code) {
    const n = getNode(tree, code);
    if (n?.char) setOutput(p => p + n.char);
    else if (code.length > 0) setOutput(p => p + "?");
    setCC("");
  }

  // ── audio ctx ───────────────────────────────────
  function ensureCtx() {
    if (!audioCtx.current)
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.current.state === "suspended") audioCtx.current.resume();
    return audioCtx.current;
  }

  // ── key press / release ─────────────────────────
  function startPress(e) {
    e.preventDefault();
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    pressStart.current = Date.now();
    setIsPressed(true);
    // sine tone
    try {
      const ctx = ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 700;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
      osc.start();
      // store for stop
      audioCtx._pressosc  = osc;
      audioCtx._pressgain = gain;
    } catch(e) {}
  }

  function endPress(e) {
    e.preventDefault();
    if (!pressStart.current) return;
    const dur = Date.now() - pressStart.current;
    pressStart.current = null;
    setIsPressed(false);
    try {
      const ctx = audioCtx.current;
      if (audioCtx._pressgain) {
        audioCtx._pressgain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.02);
        setTimeout(() => { try { audioCtx._pressosc.stop(); } catch(e){} }, 30);
      }
    } catch(e) {}

    const sym = dur < THRESHOLD ? "." : "-";
    const newCode = currentCode + sym;
    setCC(newCode);
    letterTimer.current = setTimeout(() => {
      commit(newCode);
      wordTimer.current = setTimeout(() => setOutput(p => p + " "), 800);
    }, 800);
  }

  // ── controls ────────────────────────────────────
  function handleDelete() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    if (currentCode.length > 0) setCC(p => p.slice(0,-1));
    else setOutput(p => p.slice(0,-1));
  }
  function handleCommit()  {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    commit(currentCode);
  }
  function handleSpace() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    if (currentCode.length > 0) commit(currentCode);
    setOutput(p => p + " ");
  }
  function handleClear() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    setCC(""); setOutput("");
  }

  // ── playback ────────────────────────────────────
  async function togglePlay() {
    if (isPlaying) {
      playbackRef.current?.abort();
      setIsPlaying(false);
      return;
    }
    const text = output.trim();
    if (!text) return;
    const seq = textToSeq(text, modeKey);
    if (!seq.length) return;
    setIsPlaying(true);
    const abort = new AbortController();
    playbackRef.current = abort;
    const ctx = ensureCtx();

    const delay = (ms) => new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      abort.signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("aborted")); });
    });
    const beep = (ms) => new Promise((res, rej) => {
      try {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = 700;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.005);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + ms/1000 - 0.005);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms/1000);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + ms/1000);
        osc.onended = res;
        abort.signal.addEventListener("abort", () => { try{osc.stop();}catch(e){} rej(new Error("aborted")); });
      } catch(e) { rej(e); }
    });

    try {
      for (const step of seq) {
        if (abort.signal.aborted) break;
        if (step.type === "gap") await delay(step.ms);
        else await Promise.all([beep(step.ms), delay(step.ms)]);
      }
    } catch(e) {}
    setIsPlaying(false);
  }

  useEffect(() => () => {
    playbackRef.current?.abort();
    clearTimeout(letterTimer.current);
    clearTimeout(wordTimer.current);
  }, []);

  // ── SVG ────────────────────────────────────────
  const SVG_W  = 380;
  const ROW_H  = 52;
  const SVG_H  = (mode.maxDepth + 1) * ROW_H + 20;
  const { nodes, edges } = computeLayout(tree, SVG_W, ROW_H, mode.maxDepth);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={{
      minHeight: "100vh", background: G.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Courier New', monospace",
      padding: "0 0 40px", boxSizing: "border-box",
    }}>
      {/* overlay to close menu */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 10 }} />
      )}

      <div style={{ width: "100%", maxWidth: 440, margin: "0 auto", padding: "0 16px", boxSizing: "border-box" }}>
        {/* ── Card ── */}
        <div style={{
          background: "linear-gradient(160deg,#1a1608 0%,#0e0c08 60%)",
          border: `2px solid ${G.borderBright}`,
          borderRadius: 20,
          padding: "18px 16px 22px",
          marginTop: 16,
          boxShadow: "0 0 0 1px #0a0800,0 0 40px #00000080,inset 0 1px 0 #6a5228",
          position: "relative",
        }}>

          {/* corner hole */}
          <div style={{
            position: "absolute", top: 14, right: 14,
            width: 10, height: 10, borderRadius: "50%",
            border: `2px solid ${G.borderBright}`, background: G.bg,
          }} />

          {/* ── Header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 5, color: G.goldDim, marginBottom: 2 }}>▸ SIGNAL</div>
              <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 4, color: G.gold, textShadow: `0 0 12px ${G.goldDim}` }}>
                MORSE CODE
              </div>
              <div style={{ fontSize: 8, letterSpacing: 3, color: G.goldDim, marginTop: 2 }}>
                {mode.sub}
              </div>
            </div>

            {/* ── Hamburger ── */}
            <div style={{ position: "relative", zIndex: 20 }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="モード切り替え"
                style={{
                  background: menuOpen ? "#1e1800" : "none",
                  border: `1px solid ${menuOpen ? G.borderBright : G.border}`,
                  color: G.gold, padding: "7px 10px",
                  cursor: "pointer", borderRadius: 7,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4, transition: "all 0.15s",
                }}
              >
                {menuOpen
                  ? <span style={{ fontSize: 13, lineHeight: 1, color: G.goldLight }}>✕</span>
                  : <>
                      <div style={{ width: 17, height: 1.5, background: G.gold, borderRadius: 1 }} />
                      <div style={{ width: 17, height: 1.5, background: G.gold, borderRadius: 1 }} />
                      <div style={{ width: 17, height: 1.5, background: G.gold, borderRadius: 1 }} />
                    </>
                }
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#111009",
                  border: `1px solid ${G.borderBright}`,
                  borderRadius: 10, overflow: "hidden", minWidth: 160,
                  boxShadow: "0 10px 40px #000000b0",
                }}>
                  <div style={{ fontSize: 7, letterSpacing: 4, color: G.goldDim, padding: "9px 14px 5px" }}>
                    MODE
                  </div>
                  {Object.entries(MODES).map(([key, m]) => {
                    const active = key === modeKey;
                    return (
                      <button key={key}
                        onClick={() => { setModeKey(key); setCC(""); setOutput(""); setMenuOpen(false); }}
                        style={{
                          width: "100%", textAlign: "left",
                          background: active ? "#1e1800" : "none",
                          border: "none",
                          borderTop: `1px solid ${G.border}`,
                          color: active ? G.goldLight : G.gold,
                          padding: "10px 14px",
                          cursor: "pointer",
                          fontFamily: "'Courier New', monospace",
                          display: "flex", flexDirection: "column", gap: 2,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, letterSpacing: 2 }}>{m.label}</span>
                          {active && <span style={{ fontSize: 9, color: G.goldLight }}>◀</span>}
                        </div>
                        <span style={{ fontSize: 8, letterSpacing: 1, color: active ? G.goldDim : "#5a4820" }}>
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Output ── */}
          <div style={{
            background: "#080702", border: `1px solid ${G.border}`,
            borderRadius: 8, padding: "10px 12px", marginBottom: 10, minHeight: 52,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 8, letterSpacing: 4, color: G.goldDim }}>OUTPUT</div>
              {/* Play button */}
              <button onClick={togglePlay}
                disabled={!output.trim() && !isPlaying}
                style={{
                  background: isPlaying ? "linear-gradient(135deg,#4a3205,#1e1400)" : "none",
                  border: `1px solid ${isPlaying ? G.gold : output.trim() ? G.goldDim : G.border}`,
                  color: output.trim() || isPlaying ? G.gold : G.goldDim,
                  borderRadius: 5, padding: "3px 9px", cursor: output.trim() || isPlaying ? "pointer" : "default",
                  fontSize: 9, letterSpacing: 2, fontFamily: "'Courier New', monospace",
                  display: "flex", alignItems: "center", gap: 5,
                  opacity: !output.trim() && !isPlaying ? 0.35 : 1,
                  transition: "all 0.15s",
                }}
              >
                {isPlaying ? (
                  <>
                    <span style={{ width: 7, height: 7, background: G.gold, display: "inline-block", borderRadius: 1 }} />
                    STOP
                  </>
                ) : (
                  <>
                    <span style={{
                      display: "inline-block", width: 0, height: 0,
                      borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
                      borderLeft: `7px solid ${G.goldDim}`,
                    }} />
                    PLAY
                  </>
                )}
              </button>
            </div>
            <div style={{ fontSize: 22, letterSpacing: 4, color: G.text, minHeight: 30, wordBreak: "break-all" }}>
              {output || <span style={{ color: "#222" }}>—</span>}
              {currentCode && (
                <span style={{ color: G.gold, animation: "blink 0.8s infinite", textShadow: `0 0 10px ${G.gold}` }}>
                  {curNode?.char || "·"}
                </span>
              )}
            </div>
          </div>

          {/* ── Code display ── */}
          <div style={{
            background: "#080702", border: `1px solid ${G.border}`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8, minHeight: 40,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: G.goldDim, flexShrink: 0 }}>CODE</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 22, letterSpacing: 6 }}>
              {currentCode ? currentCode.split("").map((s, i) => (
                <span key={i} style={{
                  color: s === "." ? G.dot : G.dash,
                  textShadow: s === "." ? `0 0 8px ${G.dot}` : `0 0 8px ${G.dash}`,
                }}>{s}</span>
              )) : <span style={{ color: "#222", fontSize: 12 }}>· · ·</span>}
            </div>
            <div style={{ flexShrink: 0, minWidth: 20 }}>
              {curNode?.char
                ? <span style={{ color: G.goldLight, fontSize: 18, fontWeight: "bold" }}>{curNode.char}</span>
                : currentCode ? <span style={{ color: "#444" }}>?</span> : null}
            </div>
          </div>

          {/* ── Tree SVG ── */}
          <div style={{
            background: "#060500", border: `1px solid ${G.border}`,
            borderRadius: 10, marginBottom: 16, overflow: "hidden", padding: "8px 0 4px",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: G.goldDim, textAlign: "center", marginBottom: 4 }}>
              · DOT &nbsp;&nbsp; — DASH &nbsp;&nbsp; [{mode.label}]
            </div>
            <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block" }}>
              {/* Edges */}
              {edges.map((e, i) => {
                const child = nodes.find(n => n.x === e.x2 && n.y === e.y2);
                const cc    = child?.node?.code ?? "";
                const isDot = cc.length > 0 && cc[cc.length - 1] === ".";
                const reach = reachable.has(cc);
                const act   = currentCode === cc || (currentCode.startsWith(cc) && cc.length > 0);
                return (
                  <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={act ? G.goldLight : reach ? G.goldDim : G.dimEdge}
                    strokeWidth={act ? 2 : 1}
                    strokeDasharray={isDot ? "3,3" : "none"}
                    opacity={reach ? 1 : 0.65}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((item, i) => {
                const { node, x, y } = item;
                const code   = node.code ?? "";
                const isCur  = currentCode === code && code.length > 0;
                const reach  = reachable.has(code);
                const isRoot = code === "";

                if (isRoot) {
                  return (
                    <g key={i}>
                      <polygon points={`${x},${y-12} ${x-8},${y+4} ${x+8},${y+4}`}
                        fill="none" stroke={G.gold} strokeWidth="1.5" />
                      <line x1={x} y1={y+4} x2={x} y2={y+10} stroke={G.gold} strokeWidth="1.5" />
                    </g>
                  );
                }
                if (node.char) {
                  const w = 22, h = 18;
                  return (
                    <g key={i}>
                      <rect x={x-w/2} y={y-h/2} width={w} height={h} rx={3}
                        fill={isCur ? G.gold : reach ? "#1e1800" : G.dimFill}
                        stroke={isCur ? G.goldLight : reach ? G.goldDim : G.dimNode}
                        strokeWidth={isCur ? 2 : 1}
                      />
                      <text x={x} y={y+5} textAnchor="middle"
                        fontSize={10} fontFamily="'Courier New', monospace"
                        fontWeight={isCur ? "bold" : "normal"}
                        fill={isCur ? "#000" : reach ? G.gold : G.dimText}
                      >
                        {node.char}
                      </text>
                    </g>
                  );
                }
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={7}
                      fill={reach ? "#1a1500" : "#0a0900"}
                      stroke={reach ? G.goldDim : G.dimNode}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* ── Key button ── */}
          <button
            onMouseDown={startPress} onMouseUp={endPress}
            onMouseLeave={e => { if (isPressed) endPress(e); }}
            onTouchStart={startPress} onTouchEnd={endPress}
            style={{
              width: "100%", height: 110,
              background: isPressed
                ? "radial-gradient(ellipse at 50% 40%,#c8a030 0%,#5a3e08 50%,#1a1200 100%)"
                : "radial-gradient(ellipse at 50% 35%,#2a2008 0%,#0e0c08 100%)",
              border: `2px solid ${isPressed ? G.goldLight : G.border}`,
              borderRadius: 14, cursor: "pointer",
              transition: "border-color 0.05s,background 0.05s",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              userSelect: "none", WebkitUserSelect: "none",
              boxShadow: isPressed ? `0 0 30px ${G.goldDim},inset 0 2px 8px #00000080` : "inset 0 2px 8px #00000080",
              marginBottom: 12,
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              background: isPressed
                ? `radial-gradient(circle,${G.goldLight} 0%,${G.gold} 60%,#7a5010 100%)`
                : "radial-gradient(circle,#2a2008 0%,#1a1200 100%)",
              border: `2px solid ${isPressed ? G.goldLight : G.goldDim}`,
              boxShadow: isPressed ? `0 0 24px ${G.gold}` : "inset 0 2px 4px #00000080",
              transition: "all 0.05s",
            }} />
            <div style={{ fontSize: 9, letterSpacing: 4, color: isPressed ? G.goldLight : G.goldDim }}>
              {isPressed ? "— — —" : "PRESS  ·  HOLD"}
            </div>
          </button>

          {/* ── Sub controls ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "⌫", sub: "DEL", fn: handleDelete },
              { label: "↵", sub: "OK",  fn: handleCommit },
              { label: "␣", sub: "SPC", fn: handleSpace  },
              { label: "✕", sub: "CLR", fn: handleClear  },
            ].map(b => (
              <button key={b.sub} onClick={b.fn} style={{
                background: "#0e0c08", border: `1px solid ${G.border}`,
                color: G.gold, borderRadius: 8, padding: "8px 4px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 16,
              }}>
                {b.label}
                <span style={{ fontSize: 7, letterSpacing: 2, color: G.goldDim }}>{b.sub}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}

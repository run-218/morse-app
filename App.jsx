import { useState, useRef } from "react";

const MORSE_EN = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
  "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
  "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
  ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
  "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
  "--..": "Z",
};

const MORSE_JA = {
  ".-": "ア", "...-": "イ", "-...-": "ウ", "-.---": "エ", ".-...": "オ",
  ".-..": "カ", "-.-..": "キ", "...-...": "ク", "-..-": "ケ", "---..": "コ",
  "-.--.": "サ", "--.-.": "シ", "---.-": "ス", ".---.": "セ", "---.": "ソ",
  "-.": "タ", "..-.": "チ", ".-.": "テ", "..-..": "ト",
  "-.-.": "ナ", "....": "ヌ", "--.-..": "ネ", "..--": "ノ",
  "-....": "ハ", "-..-.": "ヒ", "--..": "フ", ".": "ヘ", "-..-..": "ホ",
  "--": "マ", "..-.-": "ミ", "-..---": "メ", "-...-": "モ",
  ".--": "ヤ", "--.-": "ヨ",
  "...": "ラ", "--.": "リ", "-.-": "ル", "---": "レ", ".-.-": "ロ",
  ".--.-": "ワ", ".---": "ヲ", ".-.-.-": "ン",
};

function buildTree(morseMap) {
  const tree = { char: null, dot: null, dash: null, code: "" };
  for (const [code, char] of Object.entries(morseMap)) {
    let node = tree;
    let path = "";
    for (const symbol of code) {
      path += symbol;
      if (symbol === ".") {
        if (!node.dot) node.dot = { char: null, dot: null, dash: null, code: path };
        node = node.dot;
      } else {
        if (!node.dash) node.dash = { char: null, dot: null, dash: null, code: path };
        node = node.dash;
      }
    }
    node.char = char;
  }
  return tree;
}

const TREE_EN = buildTree(MORSE_EN);
const TREE_JA = buildTree(MORSE_JA);

function getReachableCodes(node) {
  if (!node) return new Set();
  const result = new Set();
  function walk(n) {
    if (!n) return;
    if (n.char) result.add(n.code);
    walk(n.dot);
    walk(n.dash);
  }
  walk(node);
  return result;
}

function getNode(tree, code) {
  let node = tree;
  for (const s of code) {
    if (!node) return null;
    node = s === "." ? node.dot : node.dash;
  }
  return node;
}

// Layout: assign (x, y) to every node in the tree via BFS
// depth = row, left-to-right order within depth
function layoutTree(root, maxDepth = 5) {
  // Collect nodes per depth
  const levels = [];
  function walk(node, depth) {
    if (!node || depth > maxDepth) return;
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    walk(node.dot, depth + 1);
    walk(node.dash, depth + 1);
  }
  walk(root, 0);

  // Assign positions
  const positions = new Map();
  levels.forEach((nodes, depth) => {
    const count = nodes.length;
    nodes.forEach((node, i) => {
      // x: evenly spaced, y: based on depth
      positions.set(node.code ?? "__root__", {
        x: (i + 0.5) / count,
        y: depth,
        node,
      });
    });
  });
  return { levels, positions };
}

// For EN tree, we manually define the classic morse tree positions
// to match the card image layout (binary tree, top=root, branches down)
// We'll render an SVG tree

const THRESHOLD = 300;

const G = {
  bg: "#0e0c08",
  card: "#141209",
  border: "#4a3a18",
  borderBright: "#b8942a",
  gold: "#d4a832",
  goldLight: "#f0cc60",
  goldDim: "#7a5c18",
  text: "#f0e4c0",
  textDim: "#7a6840",
  dot: "#a0c8ff",
  dash: "#ffaa50",
};

// Build flat list of nodes with x/y for SVG rendering
// Standard morse tree: root at top, dot=left, dash=right, 4 levels deep
function computeTreeLayout(root, width, rowHeight, maxDepth) {
  const nodes = [];
  const edges = [];

  function walk(node, depth, xMin, xMax, parentX, parentY) {
    if (!node || depth > maxDepth) return;
    const x = (xMin + xMax) / 2;
    const y = depth * rowHeight + rowHeight / 2;

    nodes.push({ node, x, y, depth });
    if (parentX !== null) {
      edges.push({ x1: parentX, y1: parentY, x2: x, y2: y, isDot: node === getNodeByCode(root, node.code) });
    }

    const mid = (xMin + xMax) / 2;
    walk(node.dot, depth + 1, xMin, mid, x, y);
    walk(node.dash, depth + 1, mid, xMax, x, y);
  }

  walk(root, 0, 0, width, null, null);
  return { nodes, edges };
}

function getNodeByCode(root, code) {
  if (!code) return root;
  let n = root;
  for (const s of code) {
    if (!n) return null;
    n = s === "." ? n.dot : n.dash;
  }
  return n;
}

// Determine if an edge leads to a dot-branch or dash-branch
function isDotEdge(root, childCode) {
  if (!childCode || childCode.length === 0) return null;
  const lastSymbol = childCode[childCode.length - 1];
  return lastSymbol === ".";
}

export default function MorseApp() {
  const [lang, setLang] = useState("EN");
  const [currentCode, setCurrentCode] = useState("");
  const [output, setOutput] = useState("");
  const [isPressed, setIsPressed] = useState(false);
  const pressStart = useRef(null);
  const letterTimer = useRef(null);
  const wordTimer = useRef(null);
  const audioCtx = useRef(null);
  const oscillator = useRef(null);
  const gainNode = useRef(null);

  const tree = lang === "EN" ? TREE_EN : TREE_JA;

  const currentNode = getNode(tree, currentCode);
  const reachableCodes = getReachableCodes(currentNode ?? tree);
  const activeCode = currentCode;

  function commitLetter(code) {
    const node = getNode(tree, code);
    if (node && node.char) setOutput(prev => prev + node.char);
    else if (code.length > 0) setOutput(prev => prev + "?");
    setCurrentCode("");
  }

  function startTone() {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") ctx.resume();
      oscillator.current = ctx.createOscillator();
      gainNode.current = ctx.createGain();
      oscillator.current.connect(gainNode.current);
      gainNode.current.connect(ctx.destination);
      oscillator.current.type = "sine";
      oscillator.current.frequency.setValueAtTime(700, ctx.currentTime);
      gainNode.current.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.current.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
      oscillator.current.start();
    } catch (e) {}
  }

  function stopTone() {
    try {
      if (gainNode.current && audioCtx.current) {
        gainNode.current.gain.linearRampToValueAtTime(0, audioCtx.current.currentTime + 0.02);
        setTimeout(() => { try { oscillator.current.stop(); } catch(e) {} }, 30);
      }
    } catch (e) {}
  }

  function startPress(e) {
    e.preventDefault();
    clearTimeout(letterTimer.current);
    clearTimeout(wordTimer.current);
    pressStart.current = Date.now();
    setIsPressed(true);
    startTone();
  }

  function endPress(e) {
    e.preventDefault();
    if (!pressStart.current) return;
    const duration = Date.now() - pressStart.current;
    pressStart.current = null;
    setIsPressed(false);
    stopTone();
    const symbol = duration < THRESHOLD ? "." : "-";
    const newCode = currentCode + symbol;
    setCurrentCode(newCode);
    letterTimer.current = setTimeout(() => {
      commitLetter(newCode);
      wordTimer.current = setTimeout(() => setOutput(prev => prev + " "), 800);
    }, 800);
  }

  function handleDelete() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    if (currentCode.length > 0) setCurrentCode(prev => prev.slice(0, -1));
    else setOutput(prev => prev.slice(0, -1));
  }
  function handleClear() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    setCurrentCode(""); setOutput("");
  }
  function handleSpace() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    if (currentCode.length > 0) commitLetter(currentCode);
    setOutput(prev => prev + " ");
  }
  function handleCommit() {
    clearTimeout(letterTimer.current); clearTimeout(wordTimer.current);
    commitLetter(currentCode);
  }

  // SVG tree dimensions
  const SVG_W = 380;
  const ROW_H = 52;
  const MAX_DEPTH = lang === "EN" ? 4 : 4;
  const SVG_H = (MAX_DEPTH + 1) * ROW_H + 20;

  const { nodes, edges } = computeTreeLayout(tree, SVG_W, ROW_H, MAX_DEPTH);

  // Node radius
  const R = 13;

  return (
    <div style={{
      minHeight: "100vh",
      background: G.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Courier New', monospace",
      padding: "0 0 40px 0",
      boxSizing: "border-box",
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        margin: "0 auto", padding: "0 16px",
        boxSizing: "border-box",
      }}>
        {/* Card frame */}
        <div style={{
          background: "linear-gradient(160deg, #1a1608 0%, #0e0c08 60%)",
          border: `2px solid ${G.borderBright}`,
          borderRadius: 20,
          padding: "18px 16px 22px",
          marginTop: 16,
          boxShadow: `0 0 0 1px #0a0800, 0 0 40px #00000080, inset 0 1px 0 #6a5228`,
          position: "relative",
        }}>

          {/* Corner hole */}
          <div style={{
            position: "absolute", top: 14, right: 14,
            width: 10, height: 10, borderRadius: "50%",
            border: `2px solid ${G.borderBright}`, background: G.bg,
          }} />

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 5, color: G.goldDim, marginBottom: 2 }}>▸ SIGNAL</div>
              <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 4, color: G.gold, textShadow: `0 0 12px ${G.goldDim}` }}>
                MORSE CODE
              </div>
            </div>
            <button onClick={() => { setLang(l => l === "EN" ? "JA" : "EN"); handleClear(); }}
              style={{
                background: "none", border: `1px solid ${G.border}`, color: G.gold,
                padding: "4px 10px", cursor: "pointer", fontSize: 10, letterSpacing: 2, borderRadius: 4,
              }}>
              {lang === "EN" ? "日本語" : "EN"}
            </button>
          </div>

          {/* Output */}
          <div style={{
            background: "#080702", border: `1px solid ${G.border}`,
            borderRadius: 8, padding: "10px 12px", marginBottom: 10, minHeight: 52,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: G.goldDim, marginBottom: 4 }}>OUTPUT</div>
            <div style={{ fontSize: 24, letterSpacing: 4, color: G.text, minHeight: 30, wordBreak: "break-all" }}>
              {output || <span style={{ color: "#222" }}>—</span>}
              {currentCode && (
                <span style={{ color: G.gold, animation: "blink 0.8s infinite", textShadow: `0 0 10px ${G.gold}` }}>
                  {currentNode?.char || "·"}
                </span>
              )}
            </div>
          </div>

          {/* Code display */}
          <div style={{
            background: "#080702", border: `1px solid ${G.border}`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8, minHeight: 40,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: G.goldDim, flexShrink: 0 }}>CODE</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 22, letterSpacing: 6 }}>
              {currentCode.split("").map((s, i) => (
                <span key={i} style={{
                  color: s === "." ? G.dot : G.dash,
                  textShadow: s === "." ? `0 0 8px ${G.dot}` : `0 0 8px ${G.dash}`,
                }}>{s}</span>
              ))}
              {!currentCode && <span style={{ color: "#222", fontSize: 12 }}>· · ·</span>}
            </div>
            <div style={{ flexShrink: 0, minWidth: 20 }}>
              {currentNode?.char
                ? <span style={{ color: G.goldLight, fontSize: 18, fontWeight: "bold" }}>{currentNode.char}</span>
                : currentCode ? <span style={{ color: "#444" }}>?</span> : null}
            </div>
          </div>

          {/* ── MORSE TREE SVG ── */}
          <div style={{
            background: "#060500",
            border: `1px solid ${G.border}`,
            borderRadius: 10,
            marginBottom: 16,
            overflow: "hidden",
            padding: "8px 0 4px",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: G.goldDim, textAlign: "center", marginBottom: 4 }}>
              · DOT &nbsp;&nbsp; — DASH
            </div>
            <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block" }}>
              {/* Edges */}
              {edges.map((e, i) => {
                const childNode = nodes.find(n => n.x === e.x2 && n.y === e.y2);
                const childCode = childNode?.node?.code ?? "";
                const isDot = isDotEdge(tree, childCode);
                const isReachable = reachableCodes.has(childCode);
                const isActive = activeCode === childCode || activeCode.startsWith(childCode) && childCode.length > 0;
                return (
                  <line key={i}
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={
                      isActive ? G.goldLight
                      : isReachable ? G.goldDim
                      : "#2a2010"
                    }
                    strokeWidth={isActive ? 2 : 1}
                    strokeDasharray={isDot ? "3,3" : "none"}
                    opacity={isReachable ? 1 : 0.4}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((item, i) => {
                const { node, x, y } = item;
                const code = node.code ?? "";
                const isCurrentTarget = activeCode === code && code.length > 0;
                const isReachable = reachableCodes.has(code);
                const hasChar = !!node.char;
                const isRoot = code === "";

                if (isRoot) {
                  // Antenna/signal icon at root
                  return (
                    <g key={i}>
                      <polygon
                        points={`${x},${y - 12} ${x - 8},${y + 4} ${x + 8},${y + 4}`}
                        fill="none"
                        stroke={G.gold}
                        strokeWidth="1.5"
                      />
                      <line x1={x} y1={y + 4} x2={x} y2={y + 10} stroke={G.gold} strokeWidth="1.5" />
                    </g>
                  );
                }

                if (hasChar) {
                  // Square node for characters (like the card's rectangles)
                  const w = 22, h = 18;
                  return (
                    <g key={i}>
                      <rect
                        x={x - w/2} y={y - h/2} width={w} height={h}
                        rx={3}
                        fill={isCurrentTarget ? G.gold : isReachable ? "#1e1800" : "#0e0c06"}
                        stroke={isCurrentTarget ? G.goldLight : isReachable ? G.goldDim : "#2a2010"}
                        strokeWidth={isCurrentTarget ? 2 : 1}
                      />
                      <text
                        x={x} y={y + 5}
                        textAnchor="middle"
                        fontSize={11}
                        fontFamily="'Courier New', monospace"
                        fontWeight={isCurrentTarget ? "bold" : "normal"}
                        fill={isCurrentTarget ? "#000" : isReachable ? G.gold : "#3a3010"}
                      >
                        {node.char}
                      </text>
                    </g>
                  );
                } else {
                  // Circle node for branch points (no character)
                  return (
                    <g key={i}>
                      <circle
                        cx={x} cy={y} r={R - 3}
                        fill={isReachable ? "#1a1500" : "#0a0900"}
                        stroke={isReachable ? G.goldDim : "#1e1c10"}
                        strokeWidth={1}
                      />
                    </g>
                  );
                }
              })}
            </svg>
          </div>

          {/* Big key button */}
          <button
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={(e) => { if (isPressed) endPress(e); }}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            style={{
              width: "100%", height: 110,
              background: isPressed
                ? `radial-gradient(ellipse at 50% 40%, #c8a030 0%, #5a3e08 50%, #1a1200 100%)`
                : `radial-gradient(ellipse at 50% 35%, #2a2008 0%, #0e0c08 100%)`,
              border: `2px solid ${isPressed ? G.goldLight : G.border}`,
              borderRadius: 14, cursor: "pointer",
              transition: "border-color 0.05s, background 0.05s",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8,
              userSelect: "none", WebkitUserSelect: "none",
              boxShadow: isPressed ? `0 0 30px ${G.goldDim}, inset 0 2px 8px #00000080` : `inset 0 2px 8px #00000080`,
              marginBottom: 12,
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              background: isPressed
                ? `radial-gradient(circle, ${G.goldLight} 0%, ${G.gold} 60%, #7a5010 100%)`
                : `radial-gradient(circle, #2a2008 0%, #1a1200 100%)`,
              border: `2px solid ${isPressed ? G.goldLight : G.goldDim}`,
              boxShadow: isPressed ? `0 0 24px ${G.gold}` : `inset 0 2px 4px #00000080`,
              transition: "all 0.05s",
            }} />
            <div style={{ fontSize: 9, letterSpacing: 4, color: isPressed ? G.goldLight : G.goldDim }}>
              {isPressed ? "— — —" : "PRESS  ·  HOLD"}
            </div>
          </button>

          {/* Sub controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "⌫", sub: "DEL", fn: handleDelete },
              { label: "↵", sub: "OK", fn: handleCommit },
              { label: "␣", sub: "SPC", fn: handleSpace },
              { label: "✕", sub: "CLR", fn: handleClear },
            ].map(b => (
              <button key={b.sub} onClick={b.fn} style={{
                background: "#0e0c08", border: `1px solid ${G.border}`,
                color: G.gold, borderRadius: 8, padding: "8px 4px",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 2, fontSize: 16,
              }}>
                {b.label}
                <span style={{ fontSize: 7, letterSpacing: 2, color: G.goldDim }}>{b.sub}</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

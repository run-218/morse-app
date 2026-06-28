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
const SVG_W    = 380;
const ROW_H    = 52;   // 深さ0-4 行高さ
const ROW_H_D  = 44;   // 深さ5以降 行高さ
const DEEP_CUT = 4;    // この深さまでは二分木配置

// 深さ5以降: 「親のx座標を希望値として、左右に押し合いながら配置」
// 左→右パスで右に押し、右端オーバーなら右→左パスで左に戻す
function placeNoOverlap(preferredXs, width, minSep, margin) {
  const n = preferredXs.length;
  if (n === 0) return [];
  if (n === 1) return [Math.max(margin, Math.min(width - margin, preferredXs[0]))];

  // 入りきらない場合は均等割り
  if (n * minSep > width - 2 * margin) {
    return Array.from({ length: n }, (_, i) =>
      n === 1 ? width / 2 : margin + i * (width - 2 * margin) / (n - 1)
    );
  }

  // 希望x順にソート (元インデックスを記憶)
  const order = [...Array(n).keys()].sort((a, b) => preferredXs[a] - preferredXs[b]);
  const pos   = order.map(i => preferredXs[i]);

  // 左→右パス
  for (let i = 1; i < n; i++) {
    if (pos[i] < pos[i - 1] + minSep) pos[i] = pos[i - 1] + minSep;
  }
  // 右端オーバーなら右→左パス
  if (pos[n - 1] > width - margin) {
    pos[n - 1] = width - margin;
    for (let i = n - 2; i >= 0; i--) {
      if (pos[i] > pos[i + 1] - minSep) pos[i] = pos[i + 1] - minSep;
    }
  }
  // 結果を元インデックスに戻す
  const result = new Array(n);
  order.forEach((origIdx, i) => { result[origIdx] = pos[i]; });
  return result;
}

function computeLayout(root, maxDepth) {
  const W = SVG_W;
  const allNodes = [], allEdges = [];

  // ── Phase 1: 深さ0〜DEEP_CUT は通常の二分木配置 ──
  // まず深さ0〜DEEP_CUT のノードを収集（x,y確定）
  const deepAncestors = new Map(); // code → {x, y}

  function walkShallow(node, depth, xMin, xMax, pX, pY) {
    if (!node || depth > Math.min(maxDepth, DEEP_CUT)) return;
    const x = (xMin + xMax) / 2;
    const y = depth * ROW_H + ROW_H / 2;
    const BOX_W = 22, BOX_H = 18, FONT = 10;
    allNodes.push({ node, x, y, depth, boxW: BOX_W, boxH: BOX_H, fontSize: FONT });
    if (pX !== null) allEdges.push({ x1: pX, y1: pY, x2: x, y2: y });
    deepAncestors.set(node.code, { x, y });
    const mid = (xMin + xMax) / 2;
    walkShallow(node.dot,  depth + 1, xMin, mid, x, y);
    walkShallow(node.dash, depth + 1, mid, xMax, x, y);
  }
  walkShallow(root, 0, 0, W, null, null);

  if (maxDepth <= DEEP_CUT) {
    const totalHeight = (DEEP_CUT + 1) * ROW_H + 16;
    return { nodes: allNodes, edges: allEdges, totalWidth: W, totalHeight };
  }

  // ── Phase 2: 深さ5以降は衝突回避配置 ──
  // 各深さを個別に処理
  let baseY = (DEEP_CUT + 1) * ROW_H;  // Phase2の開始Y

  for (let depth = DEEP_CUT + 1; depth <= maxDepth; depth++) {
    const y = baseY + ROW_H_D / 2;

    // この深さの全ノードを「親のxを希望値」として収集
    const deepNodes = []; // { node, parentX, parentY, parentCode }

    function collectDeep(node, d, parentCode) {
      if (!node || d !== depth) {
        if (!node || d >= depth) return;
        collectDeep(node.dot,  d + 1, node.code);
        collectDeep(node.dash, d + 1, node.code);
        return;
      }
      const parentPos = deepAncestors.get(parentCode) ?? { x: W / 2, y: baseY - ROW_H_D / 2 };
      deepNodes.push({ node, parentX: parentPos.x, parentY: parentPos.y });
    }
    collectDeep(root, 0, "");

    if (deepNodes.length === 0) { baseY += ROW_H_D; continue; }

    // 衝突回避でx座標を決定
    const BOX_W = 18, BOX_H = 14, FONT = 9;
    const MIN_SEP = BOX_W + 4;
    const preferredXs = deepNodes.map(n => n.parentX);
    const placedXs    = placeNoOverlap(preferredXs, W, MIN_SEP, 10);

    deepNodes.forEach((dn, i) => {
      const x = placedXs[i];
      allNodes.push({ node: dn.node, x, y, depth, boxW: BOX_W, boxH: BOX_H, fontSize: FONT });
      allEdges.push({ x1: dn.parentX, y1: dn.parentY, x2: x, y2: y });
      deepAncestors.set(dn.node.code, { x, y });
    });

    baseY += ROW_H_D;
  }

  const totalHeight = baseY + 8;
  return { nodes: allNodes, edges: allEdges, totalWidth: W, totalHeight };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  THEMES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const THEMES = {
  dark: {
    name: "ダーク",
    icon: "◼",
    // 背景・カード
    bg:            "#0e0c08",
    cardBg:        "linear-gradient(160deg,#1a1608 0%,#0e0c08 60%)",
    cardBorder:    "#b8942a",
    cardShadow:    "0 0 0 1px #0a0800,0 0 40px #00000080,inset 0 1px 0 #6a5228",
    panelBg:       "#080702",
    panelBorder:   "#4a3a18",
    treeBg:        "#060500",
    dropdownBg:    "#111009",
    // テキスト
    text:          "#f0e4c0",
    label:         "#7a5c18",   // 薄いラベル
    // アクセント（金）
    accent:        "#d4a832",
    accentLight:   "#f0cc60",
    accentDim:     "#7a5c18",
    // ツリー: active経路
    edgeActive:    "#f0cc60",
    edgePath:      "#c8961e",   // ★ 経路上の中間エッジ（新）
    edgeReach:     "#7a5c18",
    edgeDim:       "#3d3218",
    nodeActiveFill:"#d4a832",
    nodeActiveText:"#000000",
    nodePathFill:  "#2a2000",   // ★ 経路上の中間ノード塗り（新）
    nodePathStroke:"#c8961e",   // ★ 経路上の中間ノード枠（新）
    nodePathText:  "#e8b840",   // ★ 経路上の中間ノード文字（新）
    nodeReachFill: "#1e1800",
    nodeReachStroke:"#7a5c18",
    nodeReachText: "#d4a832",
    nodeDimFill:   "#181508",
    nodeDimStroke: "#3d3220",
    nodeDimText:   "#6a5830",
    circlePath:    "#2a2000",   // ★ 経路上の中間円ノード
    circleReach:   "#1a1500",
    circleDim:     "#0a0900",
    // その他
    dot:           "#a0c8ff",
    dash:          "#ffaa50",
    keyBgOff:      "radial-gradient(ellipse at 50% 35%,#2a2008 0%,#0e0c08 100%)",
    keyBgOn:       "radial-gradient(ellipse at 50% 40%,#c8a030 0%,#5a3e08 50%,#1a1200 100%)",
    keyBorderOff:  "#4a3a18",
    keyBorderOn:   "#f0cc60",
    keyKnobOff:    "radial-gradient(circle,#2a2008 0%,#1a1200 100%)",
    keyKnobOn:     "radial-gradient(circle,#f0cc60 0%,#d4a832 60%,#7a5010 100%)",
    ctrlBg:        "#0e0c08",
  },

  light: {
    name: "ライト",
    icon: "◻",
    bg:            "#f0f0ee",
    cardBg:        "linear-gradient(160deg,#ffffff 0%,#f4f2ee 100%)",
    cardBorder:    "#888880",
    cardShadow:    "0 2px 20px #00000018,inset 0 1px 0 #ffffff",
    panelBg:       "#ffffff",
    panelBorder:   "#d0cec8",
    treeBg:        "#fafaf8",
    dropdownBg:    "#ffffff",
    text:          "#1a1a18",
    label:         "#888880",
    accent:        "#2a2a28",
    accentLight:   "#111110",
    accentDim:     "#888880",
    edgeActive:    "#111110",
    edgePath:      "#444440",
    edgeReach:     "#aaaaaa",
    edgeDim:       "#e0e0e0",
    nodeActiveFill:"#1a1a18",
    nodeActiveText:"#ffffff",
    nodePathFill:  "#e8e8e6",
    nodePathStroke:"#444440",
    nodePathText:  "#222220",
    nodeReachFill: "#ffffff",
    nodeReachStroke:"#aaaaaa",
    nodeReachText: "#333330",
    nodeDimFill:   "#f4f4f2",
    nodeDimStroke: "#d8d8d8",
    nodeDimText:   "#bbbbba",
    circlePath:    "#e0e0de",
    circleReach:   "#ffffff",
    circleDim:     "#f4f4f2",
    dot:           "#2255cc",
    dash:          "#cc4400",
    keyBgOff:      "linear-gradient(180deg,#ffffff 0%,#e8e8e6 100%)",
    keyBgOn:       "linear-gradient(180deg,#333330 0%,#111110 100%)",
    keyBorderOff:  "#c0c0be",
    keyBorderOn:   "#111110",
    keyKnobOff:    "radial-gradient(circle,#f0f0ee 0%,#d8d8d6 100%)",
    keyKnobOn:     "radial-gradient(circle,#888880 0%,#333330 100%)",
    ctrlBg:        "#ffffff",
  },

  pcb: {
    name: "基板",
    icon: "▦",
    bg:            "#0a1a0e",
    cardBg:        "linear-gradient(160deg,#0e2212 0%,#081508 60%)",
    cardBorder:    "#22aa44",
    cardShadow:    "0 0 0 1px #041008,0 0 40px #00200880,inset 0 1px 0 #1a5228",
    panelBg:       "#061008",
    panelBorder:   "#185528",
    treeBg:        "#040e06",
    dropdownBg:    "#081208",
    text:          "#a0ffb8",
    label:         "#2a7a40",
    accent:        "#22cc55",
    accentLight:   "#66ff88",
    accentDim:     "#185530",
    edgeActive:    "#66ff88",
    edgePath:      "#33cc55",
    edgeReach:     "#1a6630",
    edgeDim:       "#0a2a12",
    nodeActiveFill:"#22cc55",
    nodeActiveText:"#000000",
    nodePathFill:  "#0a2a14",
    nodePathStroke:"#33cc55",
    nodePathText:  "#55ee77",
    nodeReachFill: "#061408",
    nodeReachStroke:"#1a6630",
    nodeReachText: "#22cc55",
    nodeDimFill:   "#040e06",
    nodeDimStroke: "#0e3018",
    nodeDimText:   "#1a5528",
    circlePath:    "#0a2a14",
    circleReach:   "#061408",
    circleDim:     "#040e06",
    dot:           "#55ddff",
    dash:          "#ffcc22",
    keyBgOff:      "radial-gradient(ellipse at 50% 35%,#0e2212 0%,#040e06 100%)",
    keyBgOn:       "radial-gradient(ellipse at 50% 40%,#22cc55 0%,#0a5520 50%,#041008 100%)",
    keyBorderOff:  "#185528",
    keyBorderOn:   "#66ff88",
    keyKnobOff:    "radial-gradient(circle,#0e2212 0%,#040e06 100%)",
    keyKnobOn:     "radial-gradient(circle,#66ff88 0%,#22cc55 60%,#0a5520 100%)",
    ctrlBg:        "#061008",
  },
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

// output文字列 → モールス符号テキスト（例: "... --- ..."）
// 文字間スペース1つ、単語間 " / "
function textToMorseText(text, modeKey) {
  const combined = {
    ...REV.EN, ...REV.ENP, ...REV.JA, ...REV.JAP,
    ...REV[modeKey],
  };
  const words = text.trim().split(/\s+/);
  return words
    .map(word =>
      [...word]
        .map(ch => combined[ch.toUpperCase()] || combined[ch] || "?")
        .join(" ")
    )
    .join("   /   ");
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const THRESHOLD = 300;

export default function MorseApp() {
  const [modeKey, setModeKey]     = useState("EN");
  const [themeKey, setThemeKey]   = useState("dark");
  const [currentCode, setCC]      = useState("");
  const [output, setOutput]       = useState("");
  const [isPressed, setIsPressed] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copyDone, setCopyDone]   = useState(false);  // コピー完了フラッシュ用

  const G = THEMES[themeKey];   // ← テーマをここで解決

  const pressStart  = useRef(null);
  const letterTimer = useRef(null);
  const wordTimer   = useRef(null);
  const audioCtx    = useRef(null);
  const playbackRef = useRef(null);

  const mode       = MODES[modeKey];
  const tree       = TREES[modeKey];
  const curNode    = getNode(tree, currentCode);
  const reachable  = getReachable(curNode ?? tree);

  // 現在入力中のコードのすべての前置コード（経路上の中間ノード）
  // 例: currentCode=".-" → pathCodes = {".", ".-"}  (rootは除く)
  const pathCodes = new Set();
  for (let i = 1; i <= currentCode.length; i++) {
    pathCodes.add(currentCode.slice(0, i));
  }

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

    // 末端ノード判定: dot も dash も子がない → 次の遷移が存在しない → 即確定
    const nextNode = getNode(tree, newCode);
    const isLeaf   = nextNode && !nextNode.dot && !nextNode.dash;

    if (isLeaf) {
      setCC(newCode);
      // 1フレーム後に確定（押した瞬間が見えるように）
      requestAnimationFrame(() => {
        commit(newCode);
        wordTimer.current = setTimeout(() => setOutput(p => p + " "), 800);
      });
    } else {
      setCC(newCode);
      letterTimer.current = setTimeout(() => {
        commit(newCode);
        wordTimer.current = setTimeout(() => setOutput(p => p + " "), 800);
      }, 800);
    }
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

  // ── モールス符号テキストをクリップボードにコピー ──
  function handleCopyMorse() {
    if (!output.trim()) return;
    const morseText = textToMorseText(output, modeKey);
    navigator.clipboard.writeText(morseText).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1800);
    }).catch(() => {
      // fallback: textarea経由
      const ta = document.createElement("textarea");
      ta.value = morseText;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1800);
    });
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
  const { nodes, edges, totalWidth: SVG_W_OUT, totalHeight: SVG_H } =
    computeLayout(tree, mode.maxDepth);

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
          background: G.cardBg,
          border: `2px solid ${G.cardBorder}`,
          borderRadius: 20,
          padding: "18px 16px 22px",
          marginTop: 16,
          boxShadow: G.cardShadow,
          position: "relative",
        }}>

          {/* ── Header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 5, color: G.label, marginBottom: 2 }}>▸ SIGNAL</div>
              <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 4, color: G.accent }}>
                MORSE CODE
              </div>
              <div style={{ fontSize: 8, letterSpacing: 3, color: G.label, marginTop: 2 }}>
                {mode.sub}
              </div>
            </div>

            {/* ── Hamburger ── */}
            <div style={{ position: "relative", zIndex: 20 }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="メニュー"
                style={{
                  background: menuOpen ? G.nodeReachFill : "transparent",
                  border: `1px solid ${menuOpen ? G.cardBorder : G.panelBorder}`,
                  color: G.accent, padding: "7px 10px",
                  cursor: "pointer", borderRadius: 7,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4, transition: "all 0.15s",
                }}
              >
                {menuOpen
                  ? <span style={{ fontSize: 13, lineHeight: 1, color: G.accentLight }}>✕</span>
                  : <>
                      <div style={{ width: 17, height: 1.5, background: G.accent, borderRadius: 1 }} />
                      <div style={{ width: 17, height: 1.5, background: G.accent, borderRadius: 1 }} />
                      <div style={{ width: 17, height: 1.5, background: G.accent, borderRadius: 1 }} />
                    </>
                }
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: G.dropdownBg,
                  border: `1px solid ${G.cardBorder}`,
                  borderRadius: 10, overflow: "hidden", minWidth: 170,
                  boxShadow: "0 10px 40px #00000080",
                }}>
                  {/* MODE セクション */}
                  <div style={{ fontSize: 7, letterSpacing: 4, color: G.label, padding: "9px 14px 5px" }}>
                    MODE
                  </div>
                  {Object.entries(MODES).map(([key, m]) => {
                    const active = key === modeKey;
                    return (
                      <button key={key}
                        onClick={() => { setModeKey(key); setCC(""); setOutput(""); setMenuOpen(false); }}
                        style={{
                          width: "100%", textAlign: "left",
                          background: active ? G.nodeReachFill : "transparent",
                          border: "none",
                          borderTop: `1px solid ${G.panelBorder}`,
                          color: active ? G.accentLight : G.accent,
                          padding: "9px 14px",
                          cursor: "pointer",
                          fontFamily: "'Courier New', monospace",
                          display: "flex", flexDirection: "column", gap: 2,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, letterSpacing: 2 }}>{m.label}</span>
                          {active && <span style={{ fontSize: 9, color: G.accentLight }}>◀</span>}
                        </div>
                        <span style={{ fontSize: 8, letterSpacing: 1, color: G.label }}>
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}

                  {/* THEME セクション */}
                  <div style={{
                    fontSize: 7, letterSpacing: 4, color: G.label,
                    padding: "9px 14px 5px",
                    borderTop: `2px solid ${G.panelBorder}`,
                    marginTop: 2,
                  }}>
                    THEME
                  </div>
                  {Object.entries(THEMES).map(([key, th]) => {
                    const active = key === themeKey;
                    return (
                      <button key={key}
                        onClick={() => { setThemeKey(key); setMenuOpen(false); }}
                        style={{
                          width: "100%", textAlign: "left",
                          background: active ? G.nodeReachFill : "transparent",
                          border: "none",
                          borderTop: `1px solid ${G.panelBorder}`,
                          color: active ? G.accentLight : G.accent,
                          padding: "9px 14px",
                          cursor: "pointer",
                          fontFamily: "'Courier New', monospace",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, letterSpacing: 2 }}>
                          <span style={{ marginRight: 6 }}>{th.icon}</span>{th.name}
                        </span>
                        {active && <span style={{ fontSize: 9, color: G.accentLight }}>◀</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Output ── */}
          <div style={{
            background: G.panelBg, border: `1px solid ${G.panelBorder}`,
            borderRadius: 8, padding: "10px 12px", marginBottom: 10, minHeight: 52,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 8, letterSpacing: 4, color: G.label }}>OUTPUT</div>
              {/* ボタン群 */}
              <div style={{ display: "flex", gap: 6 }}>
                {/* Copy Morse button */}
                <button onClick={handleCopyMorse}
                  disabled={!output.trim()}
                  title="モールス符号としてコピー"
                  style={{
                    background: copyDone ? G.nodeReachFill : "transparent",
                    border: `1px solid ${copyDone ? G.accent : output.trim() ? G.accentDim : G.panelBorder}`,
                    color: copyDone ? G.accentLight : output.trim() ? G.accentDim : G.label,
                    borderRadius: 5, padding: "3px 9px", cursor: output.trim() ? "pointer" : "default",
                    fontSize: 9, letterSpacing: 1, fontFamily: "'Courier New', monospace",
                    display: "flex", alignItems: "center", gap: 4,
                    opacity: !output.trim() ? 0.35 : 1,
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copyDone ? (
                    <>✓ COPIED</>
                  ) : (
                    <>·−  COPY</>
                  )}
                </button>
                {/* Play button */}
                <button onClick={togglePlay}
                  disabled={!output.trim() && !isPlaying}
                  style={{
                    background: isPlaying ? G.nodeReachFill : "transparent",
                    border: `1px solid ${isPlaying ? G.accent : output.trim() ? G.accentDim : G.panelBorder}`,
                    color: output.trim() || isPlaying ? G.accent : G.label,
                    borderRadius: 5, padding: "3px 9px", cursor: output.trim() || isPlaying ? "pointer" : "default",
                    fontSize: 9, letterSpacing: 2, fontFamily: "'Courier New', monospace",
                    display: "flex", alignItems: "center", gap: 5,
                    opacity: !output.trim() && !isPlaying ? 0.35 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {isPlaying ? (
                    <>
                      <span style={{ width: 7, height: 7, background: G.accent, display: "inline-block", borderRadius: 1 }} />
                      STOP
                    </>
                  ) : (
                    <>
                      <span style={{
                        display: "inline-block", width: 0, height: 0,
                        borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
                        borderLeft: `7px solid ${G.accentDim}`,
                      }} />
                      PLAY
                    </>
                  )}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 22, letterSpacing: 4, color: G.text, minHeight: 30, wordBreak: "break-all" }}>
              {output || <span style={{ color: G.label, opacity: 0.4 }}>—</span>}
              {currentCode && (
                <span style={{ color: G.accent, animation: "blink 0.8s infinite" }}>
                  {curNode?.char || "·"}
                </span>
              )}
            </div>
          </div>

          {/* ── Code display ── */}
          <div style={{
            background: G.panelBg, border: `1px solid ${G.panelBorder}`,
            borderRadius: 8, padding: "8px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8, minHeight: 40,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: G.label, flexShrink: 0 }}>CODE</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 22, letterSpacing: 6 }}>
              {currentCode ? currentCode.split("").map((s, i) => (
                <span key={i} style={{ color: s === "." ? G.dot : G.dash }}>{s}</span>
              )) : <span style={{ color: G.label, opacity: 0.3, fontSize: 12 }}>· · ·</span>}
            </div>
            <div style={{ flexShrink: 0, minWidth: 20 }}>
              {curNode?.char
                ? <span style={{ color: G.accentLight, fontSize: 18, fontWeight: "bold" }}>{curNode.char}</span>
                : currentCode ? <span style={{ color: G.accentDim }}>?</span> : null}
            </div>
          </div>

          {/* ── Tree SVG ── */}
          <div style={{
            background: G.treeBg, border: `1px solid ${G.panelBorder}`,
            borderRadius: 10, marginBottom: 16,
            overflow: "hidden", padding: "8px 0 4px",
          }}>
            <div style={{ fontSize: 8, letterSpacing: 4, color: G.label, textAlign: "center", marginBottom: 4 }}>
              · DOT &nbsp;&nbsp; — DASH &nbsp;&nbsp; [{mode.label}]
            </div>
            <svg width="100%" viewBox={`0 0 ${SVG_W_OUT} ${SVG_H}`} style={{ display: "block" }}>

              {/* Edges */}
              {edges.map((e, i) => {
                const child  = nodes.find(n => n.x === e.x2 && n.y === e.y2);
                const cc     = child?.node?.code ?? "";
                const isDot  = cc.length > 0 && cc[cc.length - 1] === ".";
                const isAct  = currentCode === cc && cc.length > 0;
                const isPath = !isAct && pathCodes.has(cc);
                const reach  = !isAct && !isPath && reachable.has(cc);
                const stroke = isAct ? G.edgeActive : isPath ? G.edgePath : reach ? G.edgeReach : G.edgeDim;
                return (
                  <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={stroke}
                    strokeWidth={isAct || isPath ? 2 : 1}
                    strokeDasharray={isDot ? "3,3" : "none"}
                    opacity={isAct || isPath || reach ? 1 : 0.6}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((item, i) => {
                const { node, x, y, boxW, boxH, fontSize: fz } = item;
                const code   = node.code ?? "";
                const isAct  = currentCode === code && code.length > 0;
                const isPath = !isAct && pathCodes.has(code);
                const reach  = !isAct && !isPath && reachable.has(code);
                const isRoot = code === "";

                if (isRoot) {
                  return (
                    <g key={i}>
                      <polygon points={`${x},${y-10} ${x-7},${y+4} ${x+7},${y+4}`}
                        fill="none" stroke={G.accent} strokeWidth="1.5" />
                      <line x1={x} y1={y+4} x2={x} y2={y+9} stroke={G.accent} strokeWidth="1.5" />
                    </g>
                  );
                }

                if (node.char) {
                  const fill   = isAct ? G.nodeActiveFill : isPath ? G.nodePathFill  : reach ? G.nodeReachFill  : G.nodeDimFill;
                  const stroke = isAct ? G.nodeActiveFill : isPath ? G.nodePathStroke : reach ? G.nodeReachStroke : G.nodeDimStroke;
                  const tFill  = isAct ? G.nodeActiveText : isPath ? G.nodePathText  : reach ? G.nodeReachText  : G.nodeDimText;
                  return (
                    <g key={i}>
                      <rect x={x - boxW/2} y={y - boxH/2} width={boxW} height={boxH} rx={2}
                        fill={fill} stroke={stroke} strokeWidth={isAct || isPath ? 2 : 1}
                      />
                      <text x={x} y={y + fz * 0.38} textAnchor="middle"
                        fontSize={fz} fontFamily="'Courier New', monospace"
                        fontWeight={isAct || isPath ? "bold" : "normal"} fill={tFill}
                      >
                        {node.char}
                      </text>
                    </g>
                  );
                }

                const r       = Math.max(4, Math.min(7, boxW * 0.3));
                const cFill   = isPath ? G.circlePath : reach ? G.circleReach : G.circleDim;
                const cStroke = isPath ? G.edgePath   : reach ? G.edgeReach   : G.nodeDimStroke;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={r} fill={cFill} stroke={cStroke} strokeWidth={isPath ? 1.5 : 1} />
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
              background: isPressed ? G.keyBgOn : G.keyBgOff,
              border: `2px solid ${isPressed ? G.keyBorderOn : G.keyBorderOff}`,
              borderRadius: 14, cursor: "pointer",
              transition: "border-color 0.05s,background 0.05s",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              userSelect: "none", WebkitUserSelect: "none",
              boxShadow: "inset 0 2px 8px #00000040",
              marginBottom: 12,
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              background: isPressed ? G.keyKnobOn : G.keyKnobOff,
              border: `2px solid ${isPressed ? G.keyBorderOn : G.accentDim}`,
              transition: "all 0.05s",
            }} />
            <div style={{ fontSize: 9, letterSpacing: 4, color: isPressed ? G.accentLight : G.accentDim }}>
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
                background: G.ctrlBg, border: `1px solid ${G.panelBorder}`,
                color: G.accent, borderRadius: 8, padding: "8px 4px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 16,
              }}>
                {b.label}
                <span style={{ fontSize: 7, letterSpacing: 2, color: G.accentDim }}>{b.sub}</span>
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

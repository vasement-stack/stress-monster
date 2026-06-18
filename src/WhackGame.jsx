import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 打地鼠玩法元件 — 可重用（一擊必倒版）
 * 由外部傳入這一關要出的怪物清單(monsters)、關卡名稱(levelName)、
 * 結束回呼(onExit 回關卡列表)。
 *
 * 玩法：怪冒出顯示「正常」表情，點一下直接打倒、切「投降」表情後縮回得 1 分。
 *       （三階段血量變化保留給之後的慢節奏關卡，打地鼠走快速連打爽感。）
 */

const GRID = 9;
const GAME_TIME = 30;
const STAY_MIN = 700;       // 怪停留最短毫秒（比三下版短，連打更順）
const STAY_MAX = 1400;
const SPAWN_MIN = 380;      // 冒出間隔最短毫秒（更密）
const SPAWN_MAX = 720;
const DEFEAT_HOLD = 280;    // 投降表情停留毫秒後縮回
const DEFAULT_BG = "/bg_park.png";

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 怪物貼圖：stage 0 = 正常(剛冒出)、stage 2 = 投降(被打中)
function HoleSprite({ monster, stage }) {
  const [imgOk, setImgOk] = useState(true);
  if (!monster) return null;
  if (imgOk) {
    return (
      <img src={monster.sprites[stage]} alt={monster.name}
        onError={() => setImgOk(false)} draggable={false}
        style={{ width: "78%", height: "78%", objectFit: "contain", pointerEvents: "none",
          filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.25))" }} />
    );
  }
  return <span style={{ fontSize: 38, lineHeight: 1,
    filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.25))" }}>{monster.fallback[stage]}</span>;
}

export default function WhackGame({ monsters, levelName, bg, muted, onToggleMute, onExit }) {
  const BG = bg || DEFAULT_BG;
  const [holes, setHoles] = useState(() =>
    Array.from({ length: GRID }, () => ({ active: false, defeated: false, monster: null }))
  );
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [phase, setPhase] = useState("idle");
  const [popIdx, setPopIdx] = useState(-1);
  const [bgOk, setBgOk] = useState(true);

  const tickRef = useRef(null);
  const spawnRef = useRef(null);
  const retractRefs = useRef(Array(GRID).fill(null));
  const runningRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgOk(true);
    img.onerror = () => setBgOk(false);
    img.src = BG;
  }, [BG]);

  const clearHole = useCallback((i) => {
    if (retractRefs.current[i]) { clearTimeout(retractRefs.current[i]); retractRefs.current[i] = null; }
    setHoles((hs) => {
      const next = hs.slice();
      next[i] = { active: false, defeated: false, monster: null };
      return next;
    });
  }, []);

  const spawn = useCallback(() => {
    if (!runningRef.current) return;
    setHoles((hs) => {
      const empties = hs.map((h, i) => (!h.active ? i : -1)).filter((i) => i >= 0);
      if (empties.length) {
        const i = pick(empties);
        const next = hs.slice();
        next[i] = { active: true, defeated: false, monster: pick(monsters) };
        const stay = rand(STAY_MIN, STAY_MAX);
        retractRefs.current[i] = setTimeout(() => {
          setHoles((cur) => {
            if (cur[i].active && !cur[i].defeated) {
              const n2 = cur.slice();
              n2[i] = { active: false, defeated: false, monster: null };
              return n2;
            }
            return cur;
          });
        }, stay);
        return next;
      }
      return hs;
    });
    spawnRef.current = setTimeout(spawn, rand(SPAWN_MIN, SPAWN_MAX));
  }, [monsters]);

  const start = useCallback(() => {
    retractRefs.current.forEach((t) => t && clearTimeout(t));
    retractRefs.current = Array(GRID).fill(null);
    setHoles(Array.from({ length: GRID }, () => ({ active: false, defeated: false, monster: null })));
    setScore(0);
    setTimeLeft(GAME_TIME);
    setPhase("playing");
    runningRef.current = true;
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          runningRef.current = false;
          clearInterval(tickRef.current);
          clearTimeout(spawnRef.current);
          retractRefs.current.forEach((rt) => rt && clearTimeout(rt));
          setPhase("over");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    spawn();
    return () => { clearInterval(tickRef.current); clearTimeout(spawnRef.current); };
  }, [phase, spawn]);

  useEffect(() => () => {
    clearInterval(tickRef.current);
    clearTimeout(spawnRef.current);
    retractRefs.current.forEach((t) => t && clearTimeout(t));
  }, []);

  const whack = useCallback((i) => {
    if (phase === "idle") { start(); return; }
    if (phase !== "playing") return;
    setHoles((hs) => {
      const h = hs[i];
      if (!h.active || h.defeated) return hs;
      const next = hs.slice();
      next[i] = { ...h, defeated: true };   // 一擊即倒：直接標記投降
      return next;
    });
    setScore((s) => s + 1);
    if (retractRefs.current[i]) { clearTimeout(retractRefs.current[i]); retractRefs.current[i] = null; }
    setTimeout(() => clearHole(i), DEFEAT_HOLD);
    setPopIdx(i);
    setTimeout(() => setPopIdx((p) => (p === i ? -1 : p)), 90);
  }, [phase, start, clearHole]);

  const encourage = (s) =>
    s >= 24 ? "壓力被你壓制得死死的，太猛了！"
    : s >= 14 ? "發洩得不錯，壓力少了一大半。"
    : s >= 6 ? "有打到幾隻，輕鬆一下也好。"
    : "慢慢來，下一局再放鬆發洩。";

  const sceneBg = bgOk
    ? `url(${BG}) center top / cover no-repeat`
    : "linear-gradient(#7ec9f5 0%, #9ad9f7 26%, #bfe89a 44%, #cbe84e 58%, #c5e84a 100%)";

  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={{ ...S.scene, background: sceneBg }}>

        <div style={S.topBar}>
          <button style={S.backBtn} onClick={onExit} aria-label="返回關卡列表">‹ 關卡</button>
          <div style={S.levelPlate}>{levelName}</div>
          <button style={S.muteBtn} onClick={onToggleMute} aria-label={muted ? "開啟音樂" : "關閉音樂"}>
            {muted ? "🔇" : "🔊"}
          </button>
        </div>

        <div style={S.statRow}>
          <div style={S.statCard}>
            <div style={S.statLabel}>打倒</div>
            <div style={{ ...S.statVal, color: "#C0392B" }}>{score}</div>
          </div>
          <div style={S.statCard}>
            <div style={S.statLabel}>剩餘</div>
            <div style={{ ...S.statVal, color: "#2E7D32" }}>{timeLeft}</div>
          </div>
        </div>

        <div style={S.grid}>
          {holes.map((h, i) => (
            <button key={i} onClick={() => whack(i)}
              aria-label={h.active ? `打 ${h.monster?.name}` : `洞口 ${i + 1}`} style={S.cell}>
              <span style={S.dirt} />
              {h.active && (
                <span style={{ ...S.sprite,
                  transform: popIdx === i ? "translateX(-50%) scale(0.86)" : "translateX(-50%) scale(1)" }}>
                  <HoleSprite monster={h.monster} stage={h.defeated ? 2 : 0} />
                </span>
              )}
            </button>
          ))}
        </div>

        <p style={S.hint}>
          {phase === "idle" ? "點任一格開始" : phase === "playing" ? "看到怪就點！" : ""}
        </p>

        {phase === "over" && (
          <div style={S.overlayMask}>
            <div style={S.overlay}>
              <div style={S.ovEmoji}>🏳️</div>
              <h2 style={S.ovTitle}>時間到！</h2>
              <p style={S.ovText}>這局打倒了 {score} 隻壓力怪。{encourage(score)}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button style={S.againBtn} onClick={start}>再來一局</button>
                <button style={S.exitBtn} onClick={onExit}>回關卡</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const css = `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`;

const S = {
  root: { minHeight: "100vh", margin: 0, display: "flex", justifyContent: "center", alignItems: "flex-start",
    background: "#cbe84e", fontFamily: "'Segoe UI','PingFang TC','Microsoft JhengHei',system-ui,sans-serif" },
  scene: { position: "relative", width: "100%", maxWidth: 430, minHeight: "100vh", padding: "20px 18px 40px",
    boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" },
  topBar: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: { border: "none", background: "rgba(255,255,255,0.9)", color: "#5B3A29", fontSize: 14, fontWeight: 700,
    padding: "7px 14px", borderRadius: 999, cursor: "pointer", boxShadow: "0 3px 0 rgba(180,140,90,0.4)", width: 56 },
  muteBtn: { border: "none", background: "rgba(255,255,255,0.9)", fontSize: 16, width: 40, height: 40,
    borderRadius: "50%", cursor: "pointer", boxShadow: "0 3px 0 rgba(180,140,90,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center" },
  levelPlate: { background: "#fff", color: "#C0392B", fontSize: 17, fontWeight: 800, letterSpacing: 1,
    padding: "8px 20px", borderRadius: 999, boxShadow: "0 4px 0 #E3A86B, 0 8px 14px rgba(0,0,0,0.12)" },
  statRow: { width: "100%", maxWidth: 360, display: "flex", justifyContent: "space-between", marginBottom: 16 },
  statCard: { background: "rgba(255,255,255,0.9)", borderRadius: 16, padding: "7px 22px", textAlign: "center",
    boxShadow: "0 3px 0 rgba(180,140,90,0.45)", minWidth: 80 },
  statLabel: { fontSize: 12, color: "#7a5b3a", fontWeight: 600 },
  statVal: { fontSize: 24, fontWeight: 800, lineHeight: 1.1 },
  grid: { width: "100%", maxWidth: 380, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 },
  cell: { position: "relative", aspectRatio: "1 / 1", border: "none", background: "transparent", cursor: "pointer",
    padding: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", WebkitTapHighlightColor: "transparent" },
  dirt: { position: "absolute", left: "8%", right: "8%", bottom: "6%", height: "46%",
    background: "radial-gradient(ellipse at 50% 35%, #6b4a2e 0%, #5a3d25 60%, #4a3020 100%)", borderRadius: "50%",
    boxShadow: "inset 0 6px 8px rgba(0,0,0,0.45), 0 3px 4px rgba(0,0,0,0.15)" },
  sprite: { position: "absolute", left: "50%", bottom: "16%", zIndex: 2, width: "84%", height: "84%",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.08s ease", transformOrigin: "bottom center" },
  hint: { marginTop: 18, fontSize: 14, fontWeight: 600, color: "#4a6b1f", background: "rgba(255,255,255,0.7)",
    padding: "4px 16px", borderRadius: 999, height: 22, display: "flex", alignItems: "center" },
  overlayMask: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 24, zIndex: 10 },
  overlay: { background: "#fff", borderRadius: 24, padding: "26px 28px", textAlign: "center", maxWidth: 320,
    boxShadow: "0 16px 40px rgba(0,0,0,0.25)" },
  ovEmoji: { fontSize: 60 },
  ovTitle: { fontSize: 23, fontWeight: 800, margin: "4px 0 0", color: "#C0392B" },
  ovText: { fontSize: 14, color: "#6b5a48", margin: "10px 0 20px", lineHeight: 1.6 },
  againBtn: { border: "none", background: "#C0392B", color: "#fff", fontSize: 15, fontWeight: 700,
    padding: "11px 26px", borderRadius: 999, cursor: "pointer", boxShadow: "0 5px 0 #8E2A1E" },
  exitBtn: { border: "none", background: "#fff", color: "#C0392B", fontSize: 15, fontWeight: 700,
    padding: "11px 26px", borderRadius: 999, cursor: "pointer", boxShadow: "0 5px 0 #E3A86B" },
};
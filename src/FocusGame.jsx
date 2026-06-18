import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 玩法 C — 干擾型辨認 (FocusGame)
 * 九宮格裡同時冒出「真的壓力怪」和「干擾物(無害小圖案)」，
 * 玩家只點真的怪、別點干擾物。點對得分，點到干擾物短暫卡住(懲罰)。
 * 對應「焦慮型」：資訊混亂、怕判斷錯，考驗在混亂中精準辨認。
 *
 * props：monsters(這關的真怪清單)、levelName、bg、muted、onToggleMute、onExit
 */

const GRID = 9;
const GAME_TIME = 30;
const STAY_MIN = 800;
const STAY_MAX = 1500;
const SPAWN_MIN = 360;
const SPAWN_MAX = 700;
const PENALTY_MS = 600;     // 點到干擾物卡住毫秒
const DECOY_RATE = 0.5;     // 冒出時有多少機率是干擾物
const BG = "/bg_park.png";

// 干擾物：無害小圖案(emoji)，跟有描邊的怪物視覺上不同類
const DECOYS = ["🫧", "🍃", "✨", "💭", "🪶", "☁️"];

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function MonsterImg({ monster }) {
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <img src={monster.sprites[0]} alt={monster.name}
        onError={() => setImgOk(false)} draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none",
          filter: "drop-shadow(0 4px 5px rgba(0,0,0,0.28))" }} />
    );
  }
  return <span style={{ fontSize: 50, lineHeight: 1 }}>{monster.fallback[0]}</span>;
}

export default function FocusGame({ monsters, levelName, bg, muted, onToggleMute, onExit }) {
  const theBg = bg || BG;
  // 每格：{ active, kind: 'monster'|'decoy', monster, decoy }
  const [holes, setHoles] = useState(() =>
    Array.from({ length: GRID }, () => ({ active: false, kind: null, monster: null, decoy: null }))
  );
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [phase, setPhase] = useState("idle");
  const [popIdx, setPopIdx] = useState(-1);
  const [wrongIdx, setWrongIdx] = useState(-1);   // 點錯的格子(紅閃)
  const [penalty, setPenalty] = useState(false);  // 卡住中
  const [bgOk, setBgOk] = useState(true);

  const tickRef = useRef(null);
  const spawnRef = useRef(null);
  const retractRefs = useRef(Array(GRID).fill(null));
  const penaltyRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgOk(true);
    img.onerror = () => setBgOk(false);
    img.src = theBg;
  }, [theBg]);

  const clearHole = useCallback((i) => {
    if (retractRefs.current[i]) { clearTimeout(retractRefs.current[i]); retractRefs.current[i] = null; }
    setHoles((hs) => {
      const next = hs.slice();
      next[i] = { active: false, kind: null, monster: null, decoy: null };
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
        const isDecoy = Math.random() < DECOY_RATE;
        next[i] = isDecoy
          ? { active: true, kind: "decoy", monster: null, decoy: pick(DECOYS) }
          : { active: true, kind: "monster", monster: pick(monsters), decoy: null };
        const stay = rand(STAY_MIN, STAY_MAX);
        retractRefs.current[i] = setTimeout(() => {
          setHoles((cur) => {
            if (cur[i].active) {
              const n2 = cur.slice();
              n2[i] = { active: false, kind: null, monster: null, decoy: null };
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
    clearTimeout(penaltyRef.current);
    setHoles(Array.from({ length: GRID }, () => ({ active: false, kind: null, monster: null, decoy: null })));
    setScore(0);
    setTimeLeft(GAME_TIME);
    setPenalty(false);
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
    clearTimeout(penaltyRef.current);
    retractRefs.current.forEach((t) => t && clearTimeout(t));
  }, []);

  const tap = useCallback((i) => {
    if (phase === "idle") { start(); return; }
    if (phase !== "playing" || penalty) return;
    const h = holes[i];
    if (!h.active) return;

    if (h.kind === "monster") {
      setScore((s) => s + 1);
      clearHole(i);
      setPopIdx(i);
      setTimeout(() => setPopIdx((p) => (p === i ? -1 : p)), 90);
    } else {
      // 點到干擾物：紅閃 + 短暫卡住
      setWrongIdx(i);
      setTimeout(() => setWrongIdx((w) => (w === i ? -1 : w)), 300);
      setPenalty(true);
      clearTimeout(penaltyRef.current);
      penaltyRef.current = setTimeout(() => setPenalty(false), PENALTY_MS);
    }
  }, [phase, penalty, holes, start, clearHole]);

  const encourage = (s) =>
    s >= 20 ? "在混亂中超精準，焦慮被你看破手腳！"
    : s >= 12 ? "辨認得不錯，沒被干擾物騙到。"
    : s >= 5 ? "有抓到幾隻，慢慢就能分清楚。"
    : "別急，看清楚再點，下一局會更穩。";

  const sceneBg = bgOk ? `url(${theBg}) center top / cover no-repeat`
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

        <p style={S.tip}>只點「壓力怪」，別點到飄浮的小東西！</p>

        <div style={{ ...S.grid, opacity: penalty ? 0.55 : 1 }}>
          {holes.map((h, i) => (
            <button key={i} onClick={() => tap(i)} style={{
              ...S.cell,
              background: wrongIdx === i ? "rgba(192,57,43,0.25)" : "transparent",
            }} aria-label={h.active ? (h.kind === "monster" ? "壓力怪" : "干擾物") : `洞口 ${i + 1}`}>
              <span style={S.dirt} />
              {h.active && (
                <span style={{ ...S.sprite,
                  transform: popIdx === i ? "translateX(-50%) scale(0.86)" : "translateX(-50%) scale(1)" }}>
                  {h.kind === "monster"
                    ? <MonsterImg monster={h.monster} />
                    : <span style={S.decoy}>{h.decoy}</span>}
                </span>
              )}
            </button>
          ))}
        </div>

        <p style={S.hint}>
          {phase === "idle" ? "點任一格開始" : phase === "playing" ? (penalty ? "點錯了！稍等…" : "看清楚再點！") : ""}
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
  levelPlate: { background: "#fff", color: "#C0392B", fontSize: 17, fontWeight: 800, letterSpacing: 1,
    padding: "8px 20px", borderRadius: 999, boxShadow: "0 4px 0 #E3A86B, 0 8px 14px rgba(0,0,0,0.12)" },
  muteBtn: { border: "none", background: "rgba(255,255,255,0.9)", fontSize: 16, width: 40, height: 40,
    borderRadius: "50%", cursor: "pointer", boxShadow: "0 3px 0 rgba(180,140,90,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center" },
  statRow: { width: "100%", maxWidth: 360, display: "flex", justifyContent: "space-between", marginBottom: 10 },
  statCard: { background: "rgba(255,255,255,0.9)", borderRadius: 16, padding: "7px 22px", textAlign: "center",
    boxShadow: "0 3px 0 rgba(180,140,90,0.45)", minWidth: 80 },
  statLabel: { fontSize: 12, color: "#7a5b3a", fontWeight: 600 },
  statVal: { fontSize: 24, fontWeight: 800, lineHeight: 1.1 },
  tip: { fontSize: 13, fontWeight: 600, color: "#5B3A29", background: "rgba(255,255,255,0.75)",
    padding: "5px 16px", borderRadius: 999, marginBottom: 14, textAlign: "center" },
  grid: { width: "100%", maxWidth: 380, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18,
    transition: "opacity 0.15s ease" },
  cell: { position: "relative", aspectRatio: "1 / 1", border: "none", cursor: "pointer", borderRadius: 16,
    padding: 0, display: "flex", alignItems: "flex-end", justifyContent: "center",
    WebkitTapHighlightColor: "transparent", transition: "background 0.15s ease" },
  dirt: { position: "absolute", left: "8%", right: "8%", bottom: "6%", height: "46%",
    background: "radial-gradient(ellipse at 50% 35%, #6b4a2e 0%, #5a3d25 60%, #4a3020 100%)", borderRadius: "50%",
    boxShadow: "inset 0 6px 8px rgba(0,0,0,0.45), 0 3px 4px rgba(0,0,0,0.15)" },
  sprite: { position: "absolute", left: "50%", bottom: "22%", zIndex: 2, width: "112%", height: "112%",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.08s ease", transformOrigin: "bottom center" },
  decoy: { fontSize: 46, lineHeight: 1, opacity: 0.92 },
  hint: { marginTop: 16, fontSize: 14, fontWeight: 600, color: "#4a6b1f", background: "rgba(255,255,255,0.7)",
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

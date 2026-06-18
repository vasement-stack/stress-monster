import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 玩法 B — 限時狂點單怪 (RushGame)
 * 中央一隻大怪、血量多，限時內狂點打到投降。
 * 血量經過三階段：正常(>60%) → 崩潰(60~20%) → 投降(<=20%)，用到 stage_2 崩潰圖。
 *
 * props：monster(這關的主怪，取第一隻)、levelName、bg、muted、onToggleMute、onExit
 */

const GAME_TIME = 20;       // 限時秒數
const MONSTER_HP = 30;      // 怪血量
const HIT_DAMAGE = 2;       // 每點扣血(30/2 = 點 15 下打倒)
const BG = "/bg_park.png";

function stageIndex(hp) {
  const pct = (hp / MONSTER_HP) * 100;
  if (pct > 60) return 0;
  if (pct > 20) return 1;
  return 2;
}

function Sprite({ monster, stage, shake }) {
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <img src={monster.sprites[stage]} alt={monster.name}
        onError={() => setImgOk(false)} draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none",
          transition: "transform 0.06s ease",
          transform: shake ? "scale(0.93) rotate(-2deg)" : "scale(1)",
          filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.28))" }} />
    );
  }
  return <span style={{ fontSize: 150, lineHeight: 1, display: "inline-block",
    transition: "transform 0.06s ease", transform: shake ? "scale(0.93)" : "scale(1)" }}>
    {monster.fallback[stage]}</span>;
}

export default function RushGame({ monster, levelName, bg, muted, onToggleMute, onExit }) {
  const theBg = bg || BG;
  const [hp, setHp] = useState(MONSTER_HP);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [phase, setPhase] = useState("idle"); // idle | playing | win | lose
  const [shake, setShake] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [bgOk, setBgOk] = useState(true);

  const tickRef = useRef(null);
  const shakeRef = useRef(null);
  const fid = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgOk(true);
    img.onerror = () => setBgOk(false);
    img.src = theBg;
  }, [theBg]);

  const start = useCallback(() => {
    setHp(MONSTER_HP);
    setTimeLeft(GAME_TIME);
    setFloaters([]);
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
          setPhase((p) => (p === "playing" ? "lose" : p));
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [phase]);

  useEffect(() => () => {
    clearInterval(tickRef.current);
    clearTimeout(shakeRef.current);
  }, []);

  const hit = useCallback((e) => {
    if (phase === "idle") { start(); return; }
    if (phase !== "playing") return;

    setHp((prev) => {
      const next = Math.max(0, prev - HIT_DAMAGE);
      if (next <= 0) {
        runningRef.current = false;
        clearInterval(tickRef.current);
        setTimeout(() => setPhase("win"), 350);
      }
      return next;
    });

    setShake(true);
    clearTimeout(shakeRef.current);
    shakeRef.current = setTimeout(() => setShake(false), 70);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = fid.current++;
    setFloaters((fs) => [...fs, { id, x, y }]);
    setTimeout(() => setFloaters((fs) => fs.filter((f) => f.id !== id)), 600);
  }, [phase, start]);

  const hpPct = (hp / MONSTER_HP) * 100;
  const stage = stageIndex(hp);
  const stageColor = stage === 0 ? "#D85A30" : stage === 1 ? "#EF9F27" : "#378ADD";
  const stageLabel = stage === 0 ? "正常" : stage === 1 ? "崩潰" : "投降";

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

        <div style={{ ...S.timeCard, background: timeLeft <= 5 ? "#C0392B" : "rgba(255,255,255,0.9)",
          color: timeLeft <= 5 ? "#fff" : "#2E7D32" }}>
          {timeLeft}
        </div>

        {/* 血條 + 階段 */}
        <div style={S.hpWrap}>
          <div style={{ ...S.stageTag, background: stageColor }}>{stageLabel}</div>
          <div style={S.hpBarOuter}>
            <div style={{ ...S.hpBarInner, width: `${hpPct}%`, background: stageColor }} />
          </div>
        </div>

        {/* 中央大怪 */}
        <button onClick={hit} style={S.monsterBtn} aria-label={`狂點 ${monster.name}`}
          disabled={phase === "win" || phase === "lose"}>
          <Sprite monster={monster} stage={stage} shake={shake} />
          {floaters.map((f) => (
            <span key={f.id} style={{ ...S.floater, left: f.x, top: f.y }}>-{HIT_DAMAGE}</span>
          ))}
        </button>

        <p style={S.hint}>
          {phase === "idle" ? "點怪物開始，限時內狂點打倒它！"
            : phase === "playing" ? "快狂點！" : ""}
        </p>

        {(phase === "win" || phase === "lose") && (
          <div style={S.overlayMask}>
            <div style={S.overlay}>
              <div style={S.ovEmoji}>{phase === "win" ? "🏳️" : "⏰"}</div>
              <h2 style={S.ovTitle}>{phase === "win" ? "打倒了！" : "時間到"}</h2>
              <p style={S.ovText}>
                {phase === "win"
                  ? `成功在時間內擊潰「${monster.name}」，壓力清空，超爽快！`
                  : `這次差一點，再來一次把它打到投降吧。`}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button style={S.againBtn} onClick={start}>再來一次</button>
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
  topBar: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backBtn: { border: "none", background: "rgba(255,255,255,0.9)", color: "#5B3A29", fontSize: 14, fontWeight: 700,
    padding: "7px 14px", borderRadius: 999, cursor: "pointer", boxShadow: "0 3px 0 rgba(180,140,90,0.4)", width: 56 },
  levelPlate: { background: "#fff", color: "#C0392B", fontSize: 17, fontWeight: 800, letterSpacing: 1,
    padding: "8px 20px", borderRadius: 999, boxShadow: "0 4px 0 #E3A86B, 0 8px 14px rgba(0,0,0,0.12)" },
  muteBtn: { border: "none", background: "rgba(255,255,255,0.9)", fontSize: 16, width: 40, height: 40,
    borderRadius: "50%", cursor: "pointer", boxShadow: "0 3px 0 rgba(180,140,90,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center" },
  timeCard: { fontSize: 30, fontWeight: 800, padding: "4px 28px", borderRadius: 999, marginBottom: 18,
    boxShadow: "0 4px 0 rgba(180,140,90,0.45)", minWidth: 70, textAlign: "center",
    transition: "background 0.2s ease, color 0.2s ease" },
  hpWrap: { width: "100%", maxWidth: 320, marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" },
  stageTag: { color: "#fff", fontSize: 13, fontWeight: 700, padding: "3px 16px", borderRadius: 999, marginBottom: 8,
    transition: "background 0.3s ease" },
  hpBarOuter: { width: "100%", height: 18, background: "rgba(255,255,255,0.7)", borderRadius: 999, overflow: "hidden",
    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15)" },
  hpBarInner: { height: "100%", borderRadius: 999, transition: "width 0.12s ease, background 0.3s ease" },
  monsterBtn: { position: "relative", border: "none", background: "transparent", width: 260, height: 260,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    WebkitTapHighlightColor: "transparent", padding: 0 },
  floater: { position: "absolute", transform: "translate(-50%,0)", fontWeight: 800, fontSize: 24, color: "#C0392B",
    pointerEvents: "none", animation: "rushFloat 0.6s ease-out forwards" },
  hint: { marginTop: 8, fontSize: 14, fontWeight: 600, color: "#4a6b1f", background: "rgba(255,255,255,0.7)",
    padding: "5px 18px", borderRadius: 999, minHeight: 22, display: "flex", alignItems: "center", textAlign: "center" },
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

// 浮動數字動畫(需注入 keyframes)
if (typeof document !== "undefined" && !document.getElementById("rush-kf")) {
  const st = document.createElement("style");
  st.id = "rush-kf";
  st.textContent = "@keyframes rushFloat{0%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-46px) scale(1.4)}}";
  document.head.appendChild(st);
}

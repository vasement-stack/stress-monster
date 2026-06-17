import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 壓力紓壓打怪遊戲 — 打地鼠版 (prototype v3 · UI 升級)
 * 新增：草地公園背景、地鼠土洞造型、圓潤標題與計分卡片。
 *
 * ───────────────────────────────────────────────────────────
 * ✅ 你要放的圖（兩個地方）：
 *  1. 背景：public/bg_park.png            ← 那張草地公園插畫
 *  2. 怪物：public/monsters/xxx.png       ← 18 張去背怪物（命名見下方 MONSTERS）
 *
 *  背景沒放會 fallback 成漸層草地色，怪物沒放會 fallback 成 emoji，都不會壞。
 * ───────────────────────────────────────────────────────────
 */

const GRID = 9;
const GAME_TIME = 30;
const MONSTER_HP = 24;
const HIT_DAMAGE = 8;
const STAY_MIN = 900;
const STAY_MAX = 1800;
const SPAWN_MIN = 480;
const SPAWN_MAX = 900;
const BASE = "/monsters";
const BG = "/bg_park.png";

const MONSTERS = [
  { id: "fire_dog", name: "火爆汪",  fallback: ["😤","😵","🥹"],
    sprites: [`${BASE}/fire_dog_stage_1.png`, `${BASE}/fire_dog_stage_2.png`, `${BASE}/fire_dog_stage_3.png`] },
  { id: "clock", name: "時鐘怪", fallback: ["😖","😵","🥹"],
    sprites: [`${BASE}/clock_monster_stage_1.png`, `${BASE}/clock_monster_stage_2.png`, `${BASE}/clock_monster_stage_3.png`] },
  { id: "bowl", name: "碗碗怪", fallback: ["😣","😵","🥹"],
    sprites: [`${BASE}/bowl_monster_stage_1.png`, `${BASE}/bowl_monster_stage_2.png`, `${BASE}/bowl_monster_stage_3.png`] },
  { id: "jellyfish", name: "問號水母", fallback: ["😟","😵","🥹"],
    sprites: [`${BASE}/jellyfish_stage_1.png`, `${BASE}/jellyfish_stage_2.png`, `${BASE}/jellyfish_stage_3.png`] },
  { id: "eraser", name: "橡皮擦怪", fallback: ["😑","😵","🥹"],
    sprites: [`${BASE}/eraser_monster_stage_1.png`, `${BASE}/eraser_monster_stage_2.png`, `${BASE}/eraser_monster_stage_3.png`] },
  { id: "cloud", name: "棉花雲怪", fallback: ["😪","😴","🥹"],
    sprites: [`${BASE}/cloud_monster_stage_1.png`, `${BASE}/cloud_monster_stage_2.png`, `${BASE}/cloud_monster_stage_3.png`] },
];

function stageIndex(hp) {
  const pct = (hp / MONSTER_HP) * 100;
  if (pct > 60) return 0;
  if (pct > 20) return 1;
  return 2;
}
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function HoleSprite({ monster, stage }) {
  const [imgOk, setImgOk] = useState(true);
  if (!monster) return null;
  if (imgOk) {
    return (
      <img
        src={monster.sprites[stage]}
        alt={monster.name}
        onError={() => setImgOk(false)}
        draggable={false}
        style={{ width: "78%", height: "78%", objectFit: "contain", pointerEvents: "none",
          filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.25))" }}
      />
    );
  }
  return <span style={{ fontSize: 38, lineHeight: 1,
    filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.25))" }}>{monster.fallback[stage]}</span>;
}

export default function App() {
  const [holes, setHoles] = useState(() =>
    Array.from({ length: GRID }, () => ({ active: false, hp: 0, monster: null, defeated: false }))
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
  }, []);

  const clearHole = useCallback((i) => {
    if (retractRefs.current[i]) { clearTimeout(retractRefs.current[i]); retractRefs.current[i] = null; }
    setHoles((hs) => {
      const next = hs.slice();
      next[i] = { active: false, hp: 0, monster: null, defeated: false };
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
        next[i] = { active: true, hp: MONSTER_HP, monster: pick(MONSTERS), defeated: false };
        const stay = rand(STAY_MIN, STAY_MAX);
        retractRefs.current[i] = setTimeout(() => {
          setHoles((cur) => {
            if (cur[i].active && !cur[i].defeated) {
              const n2 = cur.slice();
              n2[i] = { active: false, hp: 0, monster: null, defeated: false };
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
  }, []);

  const start = useCallback(() => {
    retractRefs.current.forEach((t) => t && clearTimeout(t));
    retractRefs.current = Array(GRID).fill(null);
    setHoles(Array.from({ length: GRID }, () => ({ active: false, hp: 0, monster: null, defeated: false })));
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
      const newHp = Math.max(0, h.hp - HIT_DAMAGE);
      if (newHp <= 0) {
        next[i] = { ...h, hp: 0, defeated: true };
        setScore((s) => s + 1);
        if (retractRefs.current[i]) { clearTimeout(retractRefs.current[i]); retractRefs.current[i] = null; }
        setTimeout(() => clearHole(i), 380);
      } else {
        next[i] = { ...h, hp: newHp };
      }
      return next;
    });
    setPopIdx(i);
    setTimeout(() => setPopIdx((p) => (p === i ? -1 : p)), 90);
  }, [phase, start, clearHole]);

  const encourage = (s) =>
    s >= 18 ? "壓力被你壓制得死死的，太猛了！"
    : s >= 10 ? "發洩得不錯，壓力少了一大半。"
    : s >= 4 ? "有打到幾隻，輕鬆一下也好。"
    : "慢慢來，下一局再放鬆發洩。";

  const sceneBg = bgOk
    ? `url(${BG}) center top / cover no-repeat`
    : "linear-gradient(#7ec9f5 0%, #9ad9f7 26%, #bfe89a 44%, #cbe84e 58%, #c5e84a 100%)";

  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={{ ...S.scene, background: sceneBg }}>

        <div style={S.titleWrap}>
          <div style={S.titlePlate}>壓力紓壓打怪</div>
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
            <button
              key={i}
              onClick={() => whack(i)}
              aria-label={h.active ? `打 ${h.monster?.name}` : `洞口 ${i + 1}`}
              style={S.cell}
            >
              <span style={S.dirt} />
              {h.active && (
                <span style={{
                  ...S.sprite,
                  transform: popIdx === i ? "translateX(-50%) scale(0.86)" : "translateX(-50%) scale(1)",
                }}>
                  <HoleSprite monster={h.monster} stage={stageIndex(h.hp)} />
                </span>
              )}
            </button>
          ))}
        </div>

        <p style={S.hint}>
          {phase === "idle" ? "點任一格開始" : phase === "playing" ? "快打！" : ""}
        </p>

        {phase === "over" && (
          <div style={S.overlayMask}>
            <div style={S.overlay}>
              <div style={S.ovEmoji}>🏳️</div>
              <h2 style={S.ovTitle}>時間到！</h2>
              <p style={S.ovText}>這局打倒了 {score} 隻壓力怪。{encourage(score)}</p>
              <button style={S.againBtn} onClick={start}>再來一局</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const css = `
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

const S = {
  root: {
    minHeight: "100vh", margin: 0, display: "flex", justifyContent: "center",
    alignItems: "flex-start", background: "#cbe84e",
    fontFamily: "'Segoe UI','PingFang TC','Microsoft JhengHei',system-ui,sans-serif",
  },
  scene: {
    position: "relative", width: "100%", maxWidth: 430, minHeight: "100vh",
    padding: "26px 18px 40px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  titleWrap: { marginBottom: 16 },
  titlePlate: {
    background: "#fff", color: "#C0392B", fontSize: 20, fontWeight: 800,
    letterSpacing: 1.5, padding: "9px 26px", borderRadius: 999,
    boxShadow: "0 4px 0 #E3A86B, 0 8px 14px rgba(0,0,0,0.12)",
  },
  statRow: { width: "100%", maxWidth: 360, display: "flex", justifyContent: "space-between", marginBottom: 18 },
  statCard: {
    background: "rgba(255,255,255,0.9)", borderRadius: 16, padding: "7px 22px", textAlign: "center",
    boxShadow: "0 3px 0 rgba(180,140,90,0.45)", minWidth: 80,
  },
  statLabel: { fontSize: 12, color: "#7a5b3a", fontWeight: 600 },
  statVal: { fontSize: 24, fontWeight: 800, lineHeight: 1.1 },
  grid: {
    width: "100%", maxWidth: 380, display: "grid",
    gridTemplateColumns: "repeat(3,1fr)", gap: 14,
  },
  cell: {
    position: "relative", aspectRatio: "1 / 1", border: "none", background: "transparent",
    cursor: "pointer", padding: 0, display: "flex", alignItems: "flex-end", justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
  },
  dirt: {
    position: "absolute", left: "8%", right: "8%", bottom: "6%", height: "46%",
    background: "radial-gradient(ellipse at 50% 35%, #6b4a2e 0%, #5a3d25 60%, #4a3020 100%)",
    borderRadius: "50%",
    boxShadow: "inset 0 6px 8px rgba(0,0,0,0.45), 0 3px 4px rgba(0,0,0,0.15)",
  },
  sprite: {
    position: "absolute", left: "50%", bottom: "16%", zIndex: 2,
    width: "84%", height: "84%", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform 0.08s ease", transformOrigin: "bottom center",
  },
  hint: {
    marginTop: 18, fontSize: 14, fontWeight: 600, color: "#4a6b1f",
    background: "rgba(255,255,255,0.7)", padding: "4px 16px", borderRadius: 999, height: 22,
    display: "flex", alignItems: "center",
  },
  overlayMask: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 10,
  },
  overlay: {
    background: "#fff", borderRadius: 24, padding: "26px 28px", textAlign: "center", maxWidth: 320,
    boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
  },
  ovEmoji: { fontSize: 60 },
  ovTitle: { fontSize: 23, fontWeight: 800, margin: "4px 0 0", color: "#C0392B" },
  ovText: { fontSize: 14, color: "#6b5a48", margin: "10px 0 20px", lineHeight: 1.6 },
  againBtn: {
    border: "none", background: "#C0392B", color: "#fff", fontSize: 16, fontWeight: 700,
    padding: "12px 34px", borderRadius: 999, cursor: "pointer",
    boxShadow: "0 5px 0 #8E2A1E",
  },
};
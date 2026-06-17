import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 壓力紓壓打怪遊戲 — 打地鼠版 (prototype v2)
 * 玩法：3x3 九宮格，壓力怪隨機冒出，點擊扣血，打到「投降」階段得 1 分，
 *       怪會自己溜走，30 秒倒數後結算。
 *
 * ───────────────────────────────────────────────────────────
 * ✅ 怎麼接你的真圖（只需做一件事）：
 *    把去背好的透明 PNG 放進專案的  public/monsters/  資料夾，
 *    檔名照下面 MONSTERS 裡寫的路徑命名即可（已用你 zip 原本的命名規則）。
 *    放好後圖會自動顯示；沒放圖時會 fallback 顯示 emoji 佔位，不會壞掉。
 *
 *    需要的 18 個檔案（6 隻怪 × 3 階段）：
 *      public/monsters/fire_dog_stage_1.png   (2,3)
 *      public/monsters/clock_monster_stage_1.png (2,3)
 *      public/monsters/bowl_monster_stage_1.png  (2,3)
 *      public/monsters/jellyfish_stage_1.png     (2,3)
 *      public/monsters/eraser_monster_stage_1.png(2,3)
 *      public/monsters/cloud_monster_stage_1.png (2,3)
 *    ※ 修正版(v2)的圖，請用上面這些「不帶 v2」的乾淨檔名存進去。
 * ───────────────────────────────────────────────────────────
 *
 * 架構沿用單怪原型的零件：getStage() 與三階段判斷邏輯完全相同，
 * 只是從「一個 Level 管一隻怪」擴成「一個 Board 管九個 Hole」。
 */

// ── 遊戲參數：手感全部在這裡調 ──────────────────────────────
const GRID = 9;            // 九宮格
const GAME_TIME = 30;      // 倒數秒數
const MONSTER_HP = 24;     // 每隻怪血量
const HIT_DAMAGE = 8;      // 每次點擊扣血（24/8 = 點 3 下打倒一隻）
const STAY_MIN = 900;      // 怪停留最短毫秒
const STAY_MAX = 1800;     // 怪停留最長毫秒
const SPAWN_MIN = 480;     // 冒出間隔最短毫秒
const SPAWN_MAX = 900;     // 冒出間隔最長毫秒
const BASE = "/monsters";  // 圖片資料夾路徑
// ────────────────────────────────────────────────────────────

// 六隻壓力怪。sprites 是三階段圖片路徑；fallback 是沒放圖時的 emoji。
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

// 血量百分比 → 階段索引（0 正常 / 1 崩潰 / 2 投降）。與單怪原型同一套邏輯。
function stageIndex(hp) {
  const pct = (hp / MONSTER_HP) * 100;
  if (pct > 60) return 0;
  if (pct > 20) return 1;
  return 2;
}

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 單一格的怪物貼圖：優先顯示真圖，圖載入失敗自動 fallback emoji。
function HoleSprite({ monster, stage }) {
  const [imgOk, setImgOk] = useState(true);
  if (!monster) return null;
  const src = monster.sprites[stage];
  if (imgOk) {
    return (
      <img
        src={src}
        alt={monster.name}
        onError={() => setImgOk(false)}
        draggable={false}
        style={{ width: "82%", height: "82%", objectFit: "contain", pointerEvents: "none" }}
      />
    );
  }
  return <span style={{ fontSize: 44, lineHeight: 1 }}>{monster.fallback[stage]}</span>;
}

export default function App() {
  const [holes, setHoles] = useState(() =>
    Array.from({ length: GRID }, () => ({ active: false, hp: 0, monster: null, defeated: false }))
  );
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [phase, setPhase] = useState("idle"); // idle | playing | over
  const [popIdx, setPopIdx] = useState(-1);    // 被點擊正在縮放回饋的格子

  // 用 ref 存計時器與每格的縮回 timer，避免 re-render 影響
  const tickRef = useRef(null);
  const spawnRef = useRef(null);
  const retractRefs = useRef(Array(GRID).fill(null));
  const runningRef = useRef(false);

  const clearHole = useCallback((i) => {
    if (retractRefs.current[i]) {
      clearTimeout(retractRefs.current[i]);
      retractRefs.current[i] = null;
    }
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
        // 安排自動縮回
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
    // 清掉所有殘留 timer
    retractRefs.current.forEach((t) => t && clearTimeout(t));
    retractRefs.current = Array(GRID).fill(null);
    setHoles(Array.from({ length: GRID }, () => ({ active: false, hp: 0, monster: null, defeated: false })));
    setScore(0);
    setTimeLeft(GAME_TIME);
    setPhase("playing");
    runningRef.current = true;
  }, []);

  // phase 進入 playing 時啟動倒數與冒出迴圈
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
    return () => {
      clearInterval(tickRef.current);
      clearTimeout(spawnRef.current);
    };
  }, [phase, spawn]);

  // 卸載時清乾淨
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
        // 投降表情停留一下再縮回
        setTimeout(() => clearHole(i), 380);
      } else {
        next[i] = { ...h, hp: newHp };
      }
      return next;
    });
    // 點擊縮放回饋
    setPopIdx(i);
    setTimeout(() => setPopIdx((p) => (p === i ? -1 : p)), 90);
  }, [phase, start, clearHole]);

  const encourage = (s) =>
    s >= 18 ? "壓力被你壓制得死死的，太猛了！"
    : s >= 10 ? "發洩得不錯，壓力少了一大半。"
    : s >= 4 ? "有打到幾隻，輕鬆一下也好。"
    : "慢慢來，下一局再放鬆發洩。";

  return (
    <div style={S.root}>
      <style>{css}</style>
      <header style={S.header}>
        <h1 style={S.title}>壓力紓壓打怪</h1>
        <p style={S.subtitle}>怪會自己溜走，手腳要快</p>
      </header>

      <div style={S.statRow}>
        <div style={S.stat}>
          <div style={S.statLabel}>打倒</div>
          <div style={S.statVal}>{score}</div>
        </div>
        <div style={S.stat}>
          <div style={S.statLabel}>剩餘時間</div>
          <div style={S.statVal}>{timeLeft}</div>
        </div>
      </div>

      <div style={S.grid}>
        {holes.map((h, i) => (
          <button
            key={i}
            onClick={() => whack(i)}
            aria-label={h.active ? `打 ${h.monster?.name}` : `洞口 ${i + 1}`}
            style={{
              ...S.cell,
              background: h.active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
              transform: popIdx === i ? "scale(0.9)" : "scale(1)",
            }}
          >
            {h.active && <HoleSprite monster={h.monster} stage={stageIndex(h.hp)} />}
          </button>
        ))}
      </div>

      <p style={S.hint}>
        {phase === "idle" ? "點任一格開始" : phase === "playing" ? "快打！" : ""}
      </p>

      {phase === "over" && (
        <div style={S.overlay}>
          <div style={S.ovEmoji}>🏳️</div>
          <h2 style={S.ovTitle}>時間到！</h2>
          <p style={S.ovText}>這局打倒了 {score} 隻壓力怪。{encourage(score)}</p>
          <button style={S.againBtn} onClick={start}>再來一局</button>
        </div>
      )}
    </div>
  );
}

const css = `
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}`;

const S = {
  root: {
    minHeight: "100vh", margin: 0, boxSizing: "border-box",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "28px 16px 40px",
    fontFamily: "'Segoe UI','PingFang TC','Microsoft JhengHei',system-ui,sans-serif",
    background: "radial-gradient(circle at 50% 0%, #FFF3E6 0%, #FFE3CC 45%, #FFD2B3 100%)",
    color: "#5B3A29",
  },
  header: { textAlign: "center", marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 800, margin: 0, color: "#C0392B", letterSpacing: 1 },
  subtitle: { fontSize: 14, margin: "6px 0 0", opacity: 0.75 },
  statRow: { width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", padding: "0 4px", marginBottom: 14 },
  stat: { textAlign: "center" },
  statLabel: { fontSize: 12, opacity: 0.7 },
  statVal: { fontSize: 26, fontWeight: 800, color: "#C0392B" },
  grid: {
    width: "100%", maxWidth: 420,
    display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10,
  },
  cell: {
    aspectRatio: "1 / 1", borderRadius: 18, border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 6px 16px rgba(192,57,43,0.12)",
    transition: "transform 0.08s ease, background 0.15s ease",
    WebkitTapHighlightColor: "transparent", overflow: "hidden", padding: 0,
  },
  hint: { fontSize: 14, opacity: 0.6, marginTop: 16, height: 20 },
  overlay: {
    marginTop: 18, textAlign: "center", padding: "22px 26px",
    background: "rgba(255,255,255,0.7)", borderRadius: 20, maxWidth: 360,
  },
  ovEmoji: { fontSize: 56 },
  ovTitle: { fontSize: 22, fontWeight: 800, margin: "4px 0 0", color: "#C0392B" },
  ovText: { fontSize: 14, opacity: 0.8, margin: "10px 0 18px" },
  againBtn: {
    border: "none", background: "#C0392B", color: "#fff", fontSize: 15, fontWeight: 700,
    padding: "11px 30px", borderRadius: 999, cursor: "pointer",
    boxShadow: "0 8px 20px rgba(192,57,43,0.3)",
  },
};

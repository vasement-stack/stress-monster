import { useState, useRef, useEffect } from "react";
import WhackGame from "./WhackGame";
import RushGame from "./RushGame";
import FocusGame from "./FocusGame";

/**
 * 主控檔 — 畫面切換 + 關卡資料 + 背景音樂
 * 畫面：home(首頁選包) → levels(關卡列表) → game(打地鼠)
 *
 * 圖片：public/  下放 bg_park.png(預設)、bg_work/bg_life/bg_family.png(各包場景)
 * 音樂：public/audio/menu_bgm.mp3（整個遊戲共用一首，循環）
 */

const BASE = "/monsters";
const M = {
  fire_dog:  { id: "fire_dog",  name: "火爆汪",   fallback: ["😤","😵","🥹"],
    sprites: [`${BASE}/fire_dog_stage_1.png`,`${BASE}/fire_dog_stage_2.png`,`${BASE}/fire_dog_stage_3.png`] },
  clock:     { id: "clock",     name: "時鐘怪",   fallback: ["😖","😵","🥹"],
    sprites: [`${BASE}/clock_monster_stage_1.png`,`${BASE}/clock_monster_stage_2.png`,`${BASE}/clock_monster_stage_3.png`] },
  bowl:      { id: "bowl",      name: "碗碗怪",   fallback: ["😣","😵","🥹"],
    sprites: [`${BASE}/bowl_monster_stage_1.png`,`${BASE}/bowl_monster_stage_2.png`,`${BASE}/bowl_monster_stage_3.png`] },
  jellyfish: { id: "jellyfish", name: "問號水母", fallback: ["😟","😵","🥹"],
    sprites: [`${BASE}/jellyfish_stage_1.png`,`${BASE}/jellyfish_stage_2.png`,`${BASE}/jellyfish_stage_3.png`] },
  eraser:    { id: "eraser",    name: "橡皮擦怪", fallback: ["😑","😵","🥹"],
    sprites: [`${BASE}/eraser_monster_stage_1.png`,`${BASE}/eraser_monster_stage_2.png`,`${BASE}/eraser_monster_stage_3.png`] },
  cloud:     { id: "cloud",     name: "棉花雲怪", fallback: ["😪","😴","🥹"],
    sprites: [`${BASE}/cloud_monster_stage_1.png`,`${BASE}/cloud_monster_stage_2.png`,`${BASE}/cloud_monster_stage_3.png`] },
};

// 三包 × 三關。bg = 這包的遊戲場景背景。monsters = 這關會冒出的怪。
const PACKS = [
  { id: "work", name: "職場包", emoji: "💼", color: "#378ADD", bg: "/bg_work.png",
    face: `${BASE}/clock_monster_stage_1.png`, faceFallback: "😖",
    levels: [
      { id: "ppt",     name: "寫PPT",   mode: "rush",  monsters: [M.clock, M.eraser] },
      { id: "report",  name: "趕報告",  mode: "rush",  monsters: [M.clock, M.eraser] },
      { id: "meeting", name: "會議轟炸", mode: "whack", monsters: [M.clock, M.fire_dog] },
    ] },
  { id: "life", name: "生活雜事包", emoji: "🧺", color: "#1D9E75", bg: "/bg_life.png",
    face: `${BASE}/bowl_monster_stage_1.png`, faceFallback: "😣",
    levels: [
      { id: "dish",    name: "洗碗",    mode: "whack", monsters: [M.bowl, M.cloud] },
      { id: "trash",   name: "倒垃圾",  mode: "whack", monsters: [M.bowl, M.cloud] },
      { id: "tidy",    name: "整理房間", mode: "focus", monsters: [M.bowl, M.cloud] },
    ] },
  { id: "family", name: "家庭包", emoji: "🏠", color: "#7F77DD", bg: "/bg_family.png",
    face: `${BASE}/fire_dog_stage_1.png`, faceFallback: "😤",
    levels: [
      { id: "marry",   name: "被催婚",   mode: "focus", monsters: [M.fire_dog, M.jellyfish] },
      { id: "compare", name: "親戚比較", mode: "focus", monsters: [M.jellyfish, M.fire_dog] },
      { id: "chore",   name: "家務衝突", mode: "whack", monsters: [M.fire_dog, M.bowl] },
    ] },
];

const BGM = "/audio/menu_bgm.mp3";

// 怪物頭像：真圖優先，載入失敗 fallback emoji
function Face({ src, fallback, size }) {
  const [ok, setOk] = useState(true);
  if (ok) {
    return (
      <img src={src} alt="" onError={() => setOk(false)} draggable={false}
        style={{ width: size, height: size, objectFit: "contain",
          filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.2))" }} />
    );
  }
  return <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>{fallback}</span>;
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [packId, setPackId] = useState(null);
  const [level, setLevel] = useState(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const audioRef = useRef(null);

  const pack = PACKS.find((p) => p.id === packId);

  // 建立背景音樂物件(只建一次)，實際播放在「開始」按鈕點擊當下觸發
  useEffect(() => {
    const a = new Audio(BGM);
    a.loop = true;
    a.volume = 0.5;
    a.preload = "auto";
    audioRef.current = a;
    return () => { a.pause(); audioRef.current = null; };
  }, []);

  // 玩家點「開始」：在使用者手勢當下直接播放，手機瀏覽器才會放行
  const handleStart = () => {
    const a = audioRef.current;
    if (a) { a.play().catch(() => {}); }
    setStarted(true);
  };

  // 靜音切換
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const MuteButton = () => (
    <button
      onClick={() => setMuted((m) => !m)}
      aria-label={muted ? "開啟音樂" : "關閉音樂"}
      style={S.muteBtn}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );

  if (!started) {
    return (
      <div style={S.root}>
        <div style={{ ...S.scene, justifyContent: "center" }}>
          <div style={S.titlePlate}>壓力紓壓打怪</div>
          <p style={S.sub}>把煩人的事變成可愛怪物，打爆它紓壓</p>
          <button style={S.startBtn} onClick={handleStart}>▶ 開始</button>
          <p style={S.startHint}>點「開始」會播放背景音樂 🎵</p>
        </div>
      </div>
    );
  }

  if (screen === "game" && level && pack) {
    const common = {
      levelName: level.name,
      bg: pack.bg,
      muted: muted,
      onToggleMute: () => setMuted((m) => !m),
      onExit: () => setScreen("levels"),
    };
    if (level.mode === "rush") {
      return <RushGame monster={level.monsters[0]} {...common} />;
    }
    if (level.mode === "focus") {
      return <FocusGame monsters={level.monsters} {...common} />;
    }
    return <WhackGame monsters={level.monsters} {...common} />;
  }

  return (
    <div style={S.root}>
      <div style={S.scene}>
        <MuteButton />

        {screen === "home" && (
          <>
            <div style={S.titlePlate}>壓力紓壓打怪</div>
            <p style={S.sub}>選一個今天讓你煩的場景</p>
            <div style={S.packList}>
              {PACKS.map((p) => (
                <button key={p.id} style={{ ...S.packCard, boxShadow: `0 6px 0 ${shade(p.color)}` }}
                  onClick={() => { setPackId(p.id); setScreen("levels"); }}>
                  <span style={{ ...S.packFace, background: tint(p.color) }}>
                    <Face src={p.face} fallback={p.faceFallback} size={56} />
                  </span>
                  <span style={S.packText}>
                    <span style={{ ...S.packName, color: shade(p.color) }}>{p.name}</span>
                    <span style={S.packCount}>{p.levels.length} 個關卡</span>
                  </span>
                  <span style={{ ...S.packArrow, color: p.color }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {screen === "levels" && pack && (
          <>
            <div style={S.levelTop}>
              <button style={S.backBtn} onClick={() => setScreen("home")} aria-label="返回首頁">‹ 首頁</button>
              <div style={{ ...S.titlePlate, fontSize: 18, padding: "8px 22px" }}>{pack.name}</div>
              <div style={{ width: 56 }} />
            </div>
            <div style={S.levelList}>
              {pack.levels.map((lv, i) => (
                <button key={lv.id} style={{ ...S.levelCard, boxShadow: `0 5px 0 ${shade(pack.color)}` }}
                  onClick={() => { setLevel(lv); setScreen("game"); }}>
                  <span style={{ ...S.levelFace, background: tint(pack.color) }}>
                    <Face src={lv.monsters[0].sprites[0]} fallback={lv.monsters[0].fallback[0]} size={40} />
                  </span>
                  <span style={S.levelText}>
                    <span style={S.levelStage}>第 {i + 1} 關</span>
                    <span style={S.levelName}>{lv.name}</span>
                  </span>
                  <span style={{ ...S.levelGo, background: pack.color }}>開打</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 50);
  const g = Math.max(0, ((n >> 8) & 255) - 50);
  const b = Math.max(0, (n & 255) - 50);
  return `rgb(${r},${g},${b})`;
}

function tint(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},0.16)`;
}

const S = {
  root: { minHeight: "100vh", margin: 0, display: "flex", justifyContent: "center", alignItems: "flex-start",
    background: "url(/bg_park.png) center top / cover no-repeat, linear-gradient(#7ec9f5 0%, #9ad9f7 30%, #bfe89a 55%, #cbe84e 100%)",
    fontFamily: "'Segoe UI','PingFang TC','Microsoft JhengHei',system-ui,sans-serif" },
  scene: { position: "relative", width: "100%", maxWidth: 430, minHeight: "100vh", padding: "32px 22px 40px",
    boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" },
  muteBtn: { position: "absolute", top: 20, right: 18, border: "none", background: "rgba(255,255,255,0.9)",
    fontSize: 18, width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
    boxShadow: "0 3px 0 rgba(180,140,90,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 },
  titlePlate: { background: "#fff", color: "#C0392B", fontSize: 24, fontWeight: 800, letterSpacing: 1.5,
    padding: "10px 28px", borderRadius: 999, boxShadow: "0 4px 0 #E3A86B, 0 8px 14px rgba(0,0,0,0.12)" },
  sub: { fontSize: 15, color: "#5B3A29", margin: "16px 0 28px", fontWeight: 600,
    background: "rgba(255,255,255,0.6)", padding: "5px 16px", borderRadius: 999, textAlign: "center" },
  startBtn: { border: "none", background: "#C0392B", color: "#fff", fontSize: 22, fontWeight: 800,
    padding: "16px 56px", borderRadius: 999, cursor: "pointer", boxShadow: "0 6px 0 #8E2A1E",
    letterSpacing: 2, marginTop: 8 },
  startHint: { fontSize: 13, color: "#5B3A29", marginTop: 18, opacity: 0.7 },
  packList: { width: "100%", display: "flex", flexDirection: "column", gap: 16 },
  packCard: { display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "none",
    borderRadius: 22, padding: "16px 18px", cursor: "pointer", WebkitTapHighlightColor: "transparent" },
  packFace: { width: 72, height: 72, borderRadius: 18, display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0 },
  packText: { display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1, gap: 3 },
  packName: { fontSize: 21, fontWeight: 800, textAlign: "left" },
  packCount: { fontSize: 13, color: "#9a8c7a", fontWeight: 600 },
  packArrow: { fontSize: 28, fontWeight: 800, flexShrink: 0, marginRight: 4 },
  levelTop: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 },
  backBtn: { border: "none", background: "rgba(255,255,255,0.9)", color: "#5B3A29", fontSize: 14, fontWeight: 700,
    padding: "7px 14px", borderRadius: 999, cursor: "pointer", boxShadow: "0 3px 0 rgba(180,140,90,0.4)", width: 56 },
  levelList: { width: "100%", display: "flex", flexDirection: "column", gap: 14 },
  levelCard: { display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "none",
    borderRadius: 18, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent" },
  levelFace: { width: 54, height: 54, borderRadius: 14, display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0 },
  levelText: { display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1, gap: 2 },
  levelStage: { fontSize: 12, color: "#9a8c7a", fontWeight: 700 },
  levelName: { fontSize: 19, fontWeight: 800, color: "#5B3A29", textAlign: "left" },
  levelGo: { fontSize: 14, color: "#fff", fontWeight: 800, padding: "7px 18px", borderRadius: 999, flexShrink: 0 },
};
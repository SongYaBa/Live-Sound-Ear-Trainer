import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─── 테마 색상 ─────────────────────────────────────────────────────
// CSS 변수로 두어, Solo 모드에서 주황↔초록 전환을 루트에서 한 번에 처리.
// (inline style은 var() 사용 가능 / canvas는 var() 불가 → 별도 PALETTE 사용)
const AC = "var(--ac)";
const AC_DIM = "var(--ac-dim)";
const AC_BORDER = "var(--ac-border)";
const AC_SOFT = "var(--ac-soft)";

// 구체 색상값 (canvas 및 CSS 변수 주입용)
const PALETTE = {
  normal:{ ac:"#d97757", dim:"rgba(217,119,87,0.15)", border:"rgba(217,119,87,0.5)", soft:"rgba(217,119,87,0.08)" },
  solo:{ ac:"#4caf72", dim:"rgba(76,175,114,0.15)", border:"rgba(76,175,114,0.5)", soft:"rgba(76,175,114,0.08)" },
};
// 현재 accent 구체값을 canvas 컴포넌트에 전달하기 위한 컨텍스트
const ThemeCtx = createContext(PALETTE.normal.ac);
const useAccent = ()=>useContext(ThemeCtx);
// hex(#rrggbb) → rgba 문자열
const hexA=(hex,a)=>{ const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };
// 이펙터 짧은 라벨 (괄호 앞 한글명만)
const effectLabelShort=(name)=>name.split(" (")[0];
// Solo 모드 on/off 컨텍스트 (탭들이 읽어 동작 변경: 기본 무음, 선택 주파수만 솔로 재생)
const SoloCtx = createContext(false);
const useSolo = ()=>useContext(SoloCtx);

// ─── SVG 아이콘 컴포넌트 ──────────────────────────────────────────
const svgStyle={display:"inline-block",verticalAlign:"middle",flexShrink:0};
const IcoVolume=({size=18})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>;
const IcoMute=({size=18})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>;
const IcoHeadphones=({size=14})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>;
const IcoUpload=({size=14})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>;
const IcoCheck=({size=14})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>;
const IcoNear=({size=15})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>;
const IcoX=({size=14})=><svg style={svgStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;

// ─── 채점 결과 메시지 (아이콘 + 텍스트) ─────────────────────────
const row={display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"};
const GradeMsg=({kind, extra=""})=>{
  if(kind==="ok")   return <span style={row}><IcoCheck size={15}/><span>(+{fmtPt(PER_Q)}점)</span>{extra}</span>;
  if(kind==="near") return <span style={row}><IcoNear size={15}/><span>±1칸 (+{fmtPt(PER_Q_NEAR)}점)</span>{extra}</span>;
  if(kind==="near2")return <span style={row}><IcoNear size={15}/><span>±2칸 (+{fmtPt(PER_Q_NEAR2)}점)</span>{extra}</span>;
  return <span style={row}><IcoX size={15}/>{extra}</span>;
};
// desc: 수단→결과 구조의 메커니즘 한 줄 해설 (명사형 종결)
const SOUND_EFFECTS = [
  { name: "리버브 (Reverb)", desc:"미세 지연된 다수 반사음 합산을 통한 공간 잔향 형성" },
  { name: "딜레이 (Delay)", desc:"입력 신호의 일정 시간 지연·반복 재생을 통한 메아리 형성" },
  { name: "디스토션 (Distortion)", desc:"신호 진폭의 의도적 클리핑을 통한 하모닉 왜곡 생성" },
  { name: "코러스 (Chorus)", desc:"짧게 지연된 복제음의 피치 미세 변조·합산을 통한 음원 다중화" },
  { name: "플랜저 (Flanger)", desc:"매우 짧은 가변 지연음 합산 시 발생하는 빗살무늬 간섭을 통한 휘몰아치는 음색 변조" },
  { name: "페이저 (Phaser)", desc:"다단 올패스 필터의 위상 이동으로 생기는 노치 이동을 통한 쓸어내리는 음색 변조" },
  { name: "트레몰로 (Tremolo)", desc:"LFO 신호 연동을 통한 출력 볼륨의 주기적 변화" },
  { name: "비브라토 (Vibrato)", desc:"LFO 연동 지연시간 변조를 통한 피치의 주기적 흔들림" },
  { name: "오토패너 (Auto Pan)", desc:"LFO 연동 좌우 정위 이동을 통한 음상의 주기적 패닝" },
  { name: "비트크러셔 (Bitcrusher)", desc:"비트심도·샘플레이트 강제 저하를 통한 디지털 양자화 노이즈 생성" },
  { name: "링모듈레이터 (Ring Mod)", desc:"입력과 캐리어 신호의 진폭 곱셈을 통한 비조화 금속성 음색 생성" },
  { name: "와우 (Wah / Auto-Wah)", desc:"가변 대역통과 필터의 중심 주파수 이동을 통한 대역별 음색 변조" },
  { name: "로우패스 필터 (LPF)", desc:"차단 주파수 이상 고역 감쇠를 통한 어둡고 둔탁한 음색 형성" },
  { name: "하이패스 필터 (HPF)", desc:"차단 주파수 이하 저역 감쇠를 통한 얇고 가벼운 음색 형성" },
  { name: "밴드패스 필터 (BPF)", desc:"특정 대역만 통과·양측 감쇠를 통한 전화기 같은 중역 집중 음색 형성" },
  { name: "노치 필터 (Notch)", desc:"특정 협대역만 감쇠를 통한 좁은 구간 주파수 제거" },
];

// 헷갈리기 쉬운 이펙터끼리 묶음 — 오답 보기는 같은 그룹에서 우선 추출
const EFFECT_GROUPS = [
  // 시간/변조 계열 (딜레이성)
  ["딜레이 (Delay)","코러스 (Chorus)","플랜저 (Flanger)","페이저 (Phaser)","비브라토 (Vibrato)"],
  // 진폭/팬 변조 계열
  ["트레몰로 (Tremolo)","오토패너 (Auto Pan)","비브라토 (Vibrato)","코러스 (Chorus)"],
  // 공간계
  ["리버브 (Reverb)","딜레이 (Delay)","코러스 (Chorus)","페이저 (Phaser)"],
  // 하모닉/왜곡 계열
  ["디스토션 (Distortion)","비트크러셔 (Bitcrusher)","링모듈레이터 (Ring Mod)","와우 (Wah / Auto-Wah)"],
  // 필터 계열
  ["로우패스 필터 (LPF)","하이패스 필터 (HPF)","밴드패스 필터 (BPF)","노치 필터 (Notch)","와우 (Wah / Auto-Wah)"],
];

// ─── EQ 주파수 세트 ──────────────────────────────────────────────
const EQ_10 = [31,63,125,250,500,1000,2000,4000,8000,16000];
const EQ_31 = [20,25,31,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,
  1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];

// ─── 사인파 주파수 ───────────────────────────────────────────────
// 1옥타브 간격 (10개)
const SINE_OCT = [31.5,63,125,250,500,1000,2000,4000,8000,16000];
// 1/3옥타브 간격 (31개) ISO
const SINE_THIRD = [20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,
  1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
const fmtFreq=f=>f>=1000?`${(f/1000).toString().replace(/\.0$/,"")}kHz`:`${f}Hz`;

// 가중 랜덤: 60Hz 미만 / 16kHz 초과 주파수는 출제 확률 1/3로 축소
const freqWeight=f=>(f<60||f>16000)?1/3:1;
// freqs 배열에서 가중치 반영해 인덱스 하나 선택
function weightedFreqIndex(freqs){
  const w=freqs.map(freqWeight);
  const total=w.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<freqs.length;i++){ r-=w[i]; if(r<0) return i; }
  return freqs.length-1;
}

// ─── 핑크노이즈 생성 ─────────────────────────────────────────────
function createPinkNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < len; i++) {
    const w = Math.random()*2-1;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    data[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
  }
  return buf;
}

// ─── EQ 커브 캔버스 ──────────────────────────────────────────────
function EQCanvas({ bands, height = 80 }) {
  const ref = useRef(null);
  const accent = useAccent();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,W,H);
    const freqToX = f => (Math.log10(f/20)/Math.log10(20000/20))*W;
    ctx.strokeStyle=hexA(accent,0.08); ctx.lineWidth=1;
    [63,125,250,500,1000,2000,4000,8000,16000].forEach(f=>{
      const x=freqToX(f); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    });
    [-12,-6,0,6,12].forEach(db=>{
      const y=H/2-(db/24)*(H/2-8);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    });
    ctx.strokeStyle=hexA(accent,0.25); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
    ctx.strokeStyle=accent; ctx.lineWidth=2;
    ctx.shadowColor=accent; ctx.shadowBlur=6; ctx.beginPath();
    for(let px=0;px<W;px++){
      const freq=Math.pow(10,(px/W)*(Math.log10(20000)-Math.log10(20))+Math.log10(20));
      let db=0;
      bands.forEach(({freq:cf,gain,q=3})=>{
        if(gain===0) return;
        db+=gain*(1/(1+Math.pow((freq-cf)/(cf/q*1.4),2)));
      });
      const y=H/2-(db/24)*(H/2-8);
      px===0?ctx.moveTo(px,y):ctx.lineTo(px,y);
    }
    ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle=hexA(accent,0.4); ctx.font="9px monospace"; ctx.textAlign="center";
    [{f:125,l:"125"},{f:500,l:"500"},{f:1000,l:"1k"},{f:4000,l:"4k"},{f:8000,l:"8k"}].forEach(({f,l})=>{
      ctx.fillText(l, freqToX(f), H-2);
    });
  }, [bands, accent]);
  return (
    <canvas ref={ref} width={600} height={height}
      style={{width:"100%",height,borderRadius:8,background:"rgba(0,0,0,0.4)",display:"block"}} />
  );
}

// ─── 레벨 스텝 (7단계) ───────────────────────────────────────────
const LEVEL_STEPS = [-12,-6,-3,0,3,6,12];

// ─── FR 그래프 선택기 (가로 드래그=주파수 / 칸 단위 스텝) ─────────
// freqs: 선택 가능한 주파수 배열
// selIdx: 선택된 밴드 인덱스 (없으면 null)
// gain: 현재 dB (그래프에 봉우리 표시용)
// onPick: (idx) => void
function FRGraph({freqs, selIdx, gain=0, q=3, onPick, height=120, showGain=true, ansIdx=null, ansGain=0, bandsOnly=false}) {
  const ref=useRef(null);
  const draggingRef=useRef(false);
  const accent=useAccent();

  const idxFromX=(clientX)=>{
    const rect=ref.current.getBoundingClientRect();
    let r=(clientX-rect.left)/rect.width;
    r=Math.max(0,Math.min(0.999,r));
    return Math.floor(r*freqs.length);
  };
  const handleDown=(e)=>{ draggingRef.current=true; const x=e.touches?e.touches[0].clientX:e.clientX; onPick(idxFromX(x)); };
  const handleMove=(e)=>{ if(!draggingRef.current) return; const x=e.touches?e.touches[0].clientX:e.clientX; onPick(idxFromX(x)); };
  const handleUp=()=>{ draggingRef.current=false; };

  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const W=canvas.width,H=canvas.height,ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,W,H);
    const n=freqs.length, bw=W/n;
    for(let i=0;i<n;i++){
      // base
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(i*bw,0,bw-1,H);
      // 선택 칸(주황/초록) — 먼저
      if(i===selIdx){ ctx.fillStyle=hexA(accent,0.22); ctx.fillRect(i*bw,0,bw-1,H); }
      // 정답 칸(초록) — 위에 겹쳐 칠해 같은 칸이면 색이 섞임
      if(i===ansIdx){ ctx.fillStyle="rgba(76,175,80,0.3)"; ctx.fillRect(i*bw,0,bw-1,H); }
    }
    ctx.strokeStyle=hexA(accent,0.08); ctx.lineWidth=1;
    [-12,-6,0,6,12].forEach(db=>{ const y=H/2-(db/16)*(H/2-8); ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); });
    ctx.strokeStyle=hexA(accent,0.22); ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    // 봉우리 곡선 그리기 헬퍼
    const drawPeak=(idx,g,color)=>{
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.shadowColor=color; ctx.shadowBlur=8;
      ctx.beginPath();
      for(let px=0;px<W;px++){
        const bandIdx=Math.floor(px/bw);
        const dist=Math.abs(bandIdx-idx);
        const db = g*Math.exp(-(dist*dist)/(2*(0.8+8/q)));
        const y=H/2-(db/16)*(H/2-8);
        px===0?ctx.moveTo(px,y):ctx.lineTo(px,y);
      }
      ctx.stroke(); ctx.shadowBlur=0;
    };
    // bandsOnly 모드(사인파)에서는 곡선/라인 없이 밴드 칸 하이라이트만 사용
    if(!bandsOnly){
      // 정답 봉우리 (초록) 먼저
      if(ansIdx!=null) drawPeak(ansIdx, ansGain, "#4caf50");
      // 내 답 봉우리 (주황/빨강)
      if(selIdx!=null) drawPeak(selIdx, gain, gain<0?"#ff6666":accent);
    }
    // 주파수 라벨 — 10밴드 기준(63,125,250,500,1k,2k,4k,8k,16k) 우선 표시
    ctx.fillStyle="rgba(255,220,200,0.8)"; ctx.font="bold 11px monospace"; ctx.textAlign="center";
    const KEY=[31.5,63,125,250,500,1000,2000,4000,8000,16000];
    if(n<=10){
      for(let i=0;i<n;i++){
        const f=freqs[i]; const l=f>=1000?(f/1000)+"k":""+f;
        ctx.fillText(l, i*bw+bw/2, H-5);
      }
    } else {
      // 31밴드: KEY 주파수에 가장 가까운 밴드에만 라벨
      KEY.forEach(kf=>{
        let bi=0,best=1e9;
        freqs.forEach((f,i)=>{ const d=Math.abs(Math.log2(f/kf)); if(d<best){best=d;bi=i;} });
        const f=freqs[bi]; const l=f>=1000?(f/1000)+"k":""+f;
        ctx.fillText(l, bi*bw+bw/2, H-5);
      });
    }
    // 선택된 대역 주파수를 크게 강조 표시
    if(selIdx!=null){
      const f=freqs[selIdx]; const l=f>=1000?`${f/1000}kHz`:`${f}Hz`;
      ctx.fillStyle=accent; ctx.font="bold 18px monospace"; ctx.textAlign="center";
      ctx.fillText(l, W/2, 22);
    }
  },[freqs,selIdx,gain,q,ansIdx,ansGain,bandsOnly,accent]);

  return (
    <canvas ref={ref} width={600} height={height}
      onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
      onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}
      style={{width:"100%",height,borderRadius:8,background:"rgba(0,0,0,0.45)",display:"block",touchAction:"none",cursor:"pointer"}} />
  );
}

const NODRAG = {userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"};

// 주파수 대역 선택 시 자동으로 채울 dB
function autoGainOnPick(mode, diff){
  if(diff==="extra") return 0;
  const v = DIFFICULTY[diff].gainAbs;
  return mode==="cut" ? -v : v;
}

// 누르고 있는 동안 동작 + 눌림 색변화 버튼
function HoldButton({onStart,onEnd,children}) {
  const [down,setDown]=useState(false);
  const start=(e)=>{ e.preventDefault(); setDown(true); onStart(); };
  const end=()=>{ setDown(false); onEnd(); };
  return (
    <button
      onMouseDown={start} onMouseUp={end} onMouseLeave={()=>{ if(down) end(); }}
      onTouchStart={start} onTouchEnd={end}
      style={{
        width:"100%",padding:"14px 18px",fontSize:15,fontFamily:"inherit",borderRadius:8,
        marginBottom:0,cursor:"pointer",transition:"all 0.08s",...NODRAG,
        background: down?AC:"rgba(255,255,255,0.06)",
        border: down?"1px solid "+AC:"1px solid rgba(255,255,255,0.1)",
        color: down?"#1a1208":"#aa9", fontWeight: down?"bold":"normal",
      }}>{children}</button>
  );
}

// 주파수 슬라이더 (밴드 인덱스 스텝)
function FreqSlider({freqs, idx, onChange}) {
  return (
    <input type="range" min={0} max={freqs.length-1} step={1} value={idx==null?Math.floor(freqs.length/2):idx}
      onChange={e=>onChange(+e.target.value)}
      style={{width:"100%",accentColor:AC,cursor:"pointer",marginTop:8}} />
  );
}

// ─── 레벨 스텝 슬라이더 (난이도+모드 조합별 선택지) ───────────────
function levelStepsFor(mode, diff){
  if(diff==="extra"){
    if(mode==="boost") return [3,6,12];
    if(mode==="cut") return [-3,-6,-12];
    return [-12,-6,-3,0,3,6,12]; // all + xhard
  }
  const v = DIFFICULTY[diff].gainAbs; // 12/6/3
  if(mode==="all") return [v,-v];     // all: +v / -v
  return null; // boost/cut + easy/normal/hard → dB 고정
}

function LevelStep({value,onChange,mode,diff}) {
  const steps = levelStepsFor(mode,diff);
  if(!steps) return null;
  return (
    <div style={{display:"flex",gap:4,marginTop:4,...NODRAG}}>
      {steps.map(s=>{
        const on=value===s; const pos=s>0, neg=s<0;
        return (
          <button key={s} onClick={()=>onChange(s)} style={{
            flex:1,padding:"14px 2px",borderRadius:6,fontFamily:"inherit",
            fontSize:14,fontWeight:on?"bold":"normal",cursor:"pointer",...NODRAG,
            background:on?(neg?"rgba(255,60,60,0.15)":pos?AC_DIM:"rgba(255,255,255,0.08)"):"rgba(255,255,255,0.03)",
            border:on?(neg?"1px solid #ff6666":pos?"1px solid "+AC:"1px solid #888"):"1px solid rgba(255,255,255,0.08)",
            color:on?(neg?"#ff6666":pos?AC:"#ccc"):"#776",
          }}>{s>0?`+${s}`:s}</button>
        );
      })}
    </div>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────
const S = {
  page: {
    minHeight:"100vh", background:"#0b0f15", color:"#e8e0d8",
    fontFamily:"'SF Mono','Courier New',monospace", maxWidth:480, margin:"0 auto",
    paddingBottom:96,
  },
  header: {
    background:"linear-gradient(180deg,"+AC_SOFT+" 0%,transparent 100%)",
    borderBottom:"1px solid "+AC_BORDER, padding:"16px 16px 12px",
  },
  tabBar: {
    position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
    width:"100%", maxWidth:480,
    background:"rgba(11,15,21,0.97)", borderTop:"1px solid "+AC_BORDER,
    display:"flex", zIndex:100,
  },
  tabBtn: (active) => ({
    flex:1, padding:"10px 2px 12px", border:"none", background:"none",
    color: active?AC:"#665", fontFamily:"inherit", fontSize:9.5, cursor:"pointer",
    display:"flex", flexDirection:"column", alignItems:"center", gap:3,
    borderTop: active?"2px solid "+AC:"2px solid transparent", transition:"all 0.15s",
  }),
  card: {
    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:12, padding:16, marginBottom:12,
  },
  label: { fontSize:13, color:"#998", letterSpacing:1.5, marginBottom:9 },
  btn: (accent,disabled) => ({
    padding:"14px 18px", fontSize:15, fontFamily:"inherit",
    background: accent?AC_DIM:"rgba(255,255,255,0.06)",
    border: accent?"1px solid "+AC_BORDER:"1px solid rgba(255,255,255,0.1)",
    borderRadius:8, color: accent?AC:"#aa9",
    cursor: disabled?"not-allowed":"pointer",
    opacity: disabled?0.4:1, transition:"all 0.15s", width:"100%", marginBottom:8,
  }),
  result: (kind) => {
    // kind: "ok"(정답 초록) | "near"(근사 노랑) | "near2"(반의반절 주황) | "no"(오답 빨강)
    const col = kind==="ok"?"#4caf50":kind==="near"?"#e0b020":kind==="near2"?"#d98a3a":"#ff6666";
    const bg = kind==="ok"?"rgba(76,175,80,0.1)":kind==="near"?"rgba(224,176,32,0.1)":kind==="near2"?"rgba(217,138,58,0.1)":"rgba(255,60,60,0.08)";
    return {
      padding:"14px 16px", borderRadius:8, fontSize:15,
      background:bg, border:`1px solid ${col}`, color:col, marginBottom:12,
    };
  },
  seg: (active)=>({
    flex:1, padding:"11px 4px", fontSize:"clamp(10px,2.6vw,13px)", fontFamily:"inherit", borderRadius:6,
    whiteSpace:"pre-line", lineHeight:1.3,
    background: active?AC_DIM:"rgba(255,255,255,0.04)",
    border: active?"1px solid "+AC:"1px solid rgba(255,255,255,0.08)",
    color: active?AC:"#998", cursor:"pointer", transition:"all 0.1s",
  }),
};

function Btn({children,onClick,accent,disabled,style={}}) {
  return <button onClick={onClick} disabled={disabled} style={{...S.btn(accent,disabled),...style}}>{children}</button>;
}

// 세그먼트 버튼 그룹
function Segmented({options,value,onChange}) {
  return (
    <div style={{display:"flex",gap:6,marginBottom:8}}>
      {options.map(o=>(
        <button key={o.value} onClick={()=>onChange(o.value)} style={S.seg(value===o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 마스터 오디오 (전체 공유) — AudioContext + 마스터 게인
// ════════════════════════════════════════════════════════════════
function useMaster(masterVol, muted) {
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const ensure = () => {
    if(!ctxRef.current||ctxRef.current.state==="closed"){
      const c = new (window.AudioContext||window.webkitAudioContext)();
      const g = c.createGain();
      g.gain.value = muted ? 0 : masterVol;
      g.connect(c.destination);
      ctxRef.current = c; masterRef.current = g;
    }
    return { ctx: ctxRef.current, master: masterRef.current };
  };
  const getCtx = () => ensure().ctx;
  const getMaster = () => ensure().master;
  useEffect(()=>{
    if(masterRef.current){
      masterRef.current.gain.value = muted ? 0 : masterVol;
    }
  },[masterVol,muted]);
  return { getCtx, getMaster, masterVol, muted };
}

// ════════════════════════════════════════════════════════════════
// ① 사인파
// ════════════════════════════════════════════════════════════════
function SineTab({addScore, resetScore, audio}) {
  const solo=useSolo();
  const [octMode,setOctMode]=useState("oct"); // oct=1옥타브 third=1/3옥타브
  const [target,setTarget]=useState(null);
  const [guess,setGuess]=useState(null);
  const [result,setResult]=useState(null);
  const [playing,setPlaying]=useState(false);
  const [soloFreq,setSoloFreq]=useState(null); // solo 모드에서 현재 울리는 주파수
  const oscRef=useRef(null);
  const gRef=useRef(null);

  const freqs = octMode==="oct"?SINE_OCT:SINE_THIRD;

  const stop=()=>{ try{oscRef.current?.stop();}catch(e){} oscRef.current=null; gRef.current=null; setPlaying(false); setSoloFreq(null); };

  // 지정 주파수를 무한 재생 시작 (항상 새로 시작)
  const startLoop=async(freq)=>{
    try{oscRef.current?.stop();}catch(e){} oscRef.current=null;
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const osc=ctx.createOscillator();
    const g=ctx.createGain();
    osc.type="sine"; osc.frequency.value=freq;
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+0.05);
    osc.connect(g); g.connect(audio.getMaster());
    osc.start();
    oscRef.current=osc; gRef.current=g; setPlaying(true);
  };

  // 살아있는 오실레이터 주파수만 부드럽게 변경 (클릭 방지). 재생 중이 아니면 새로 시작.
  const retune=(freq)=>{
    if(!oscRef.current){ startLoop(freq); return; }
    const ctx=audio.getCtx();
    try{
      oscRef.current.frequency.setTargetAtTime(freq, ctx.currentTime, 0.015);
    }catch(e){ startLoop(freq); }
  };

  // 무한 재생 토글 (문제 재생 버튼용 — 일반 모드)
  const playLoop=async(freq)=>{
    if(playing){ stop(); return; }
    await startLoop(freq);
  };

  // 새 문제 (일반 모드). autoplay=true면 새 주파수를 바로 재생.
  const newQ=(autoplay=false)=>{
    stop();
    const f=freqs[weightedFreqIndex(freqs)];
    setTarget(f);
    setGuess(null); setResult(null);
    if(autoplay) startLoop(f);
  };

  const submit=()=>{
    if(!guess||!target) return;
    const gi=freqs.indexOf(guess), ti=freqs.indexOf(target);
    const {grade:kind, pts} = freqProximity(gi, ti, freqs.length);
    setResult({kind,target,guess});
    addScore(pts);
    stop(); // 정답 제출 시 문제 소리 뮤트
  };

  // Solo 모드: "재생" 누르면 1kHz부터, 주파수 선택 시 그 주파수만 솔로(연속 드래그는 retune)
  const soloPlayDefault=()=>{
    if(playing){ stop(); return; }
    const f=1000;
    setSoloFreq(f); setGuess(f); startLoop(f);
  };
  const soloPick=(i)=>{
    const f=freqs[i];
    setGuess(f); setSoloFreq(f);
    if(playing) retune(f); else startLoop(f);
  };

  // Solo 모드 진입/해제 시: 정지 + 선택 초기화 (기본 무음)
  useEffect(()=>{ stop(); setGuess(null); setResult(null); },[solo]);
  useEffect(()=>{ return stop; },[]);
  useEffect(()=>{ resetScore(); stop(); setGuess(null); setResult(null); if(!solo) newQ(); },[octMode]);

  // 그래프에 표시할 선택 인덱스 (solo: soloFreq / 일반: guess)
  const shownIdx = solo ? (soloFreq==null?null:freqs.indexOf(soloFreq)) : (guess==null?null:freqs.indexOf(guess));

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>① 사인파 주파수 {solo?"솔로 청음":"맞추기"}</div>
        <div style={{fontSize:13,color:"#998",marginBottom:10}}>
          {solo?"재생을 누르면 1kHz부터 들립니다. 주파수를 선택하면 그 음만 들려요":"옥타브 간격 선택 후 재생, 주파수를 맞추세요"}
        </div>
        <Segmented
          options={[{value:"oct",label:"1옥타브 (10)"},{value:"third",label:"1/3옥타브 (31)"}]}
          value={octMode} onChange={setOctMode}/>
        {solo
          ? <Btn accent onClick={soloPlayDefault} style={{marginTop:4}}>
              {playing?"■ 정지":"▶ 재생 (1kHz)"}
            </Btn>
          : <Btn accent onClick={()=>target&&playLoop(target)} style={{marginTop:4}}>
              {playing?"■ 재생 정지":"▶ 문제 재생"}
            </Btn>}
      </div>

      <div style={S.card}>
        <div style={S.label}>주파수 — 그래프 드래그 또는 슬라이더로 선택</div>
        <FRGraph freqs={freqs} selIdx={shownIdx} gain={shownIdx!=null?12:0} q={6}
          ansIdx={(!solo&&result)?freqs.indexOf(result.target):null}
          onPick={(i)=>{ if(solo){ soloPick(i); } else { if(result) return; setGuess(freqs[i]); } }}
          height={140}/>
        <FreqSlider freqs={freqs} idx={shownIdx}
          onChange={(i)=>{ if(solo){ soloPick(i); } else { if(result) return; setGuess(freqs[i]); } }}/>
        <div style={{fontSize:15,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
          {shownIdx==null?"대역 미선택":fmtFreq(freqs[shownIdx])}
        </div>
      </div>

      {!solo&&(!result
        ? <Btn accent onClick={submit} disabled={!guess}>정답 제출</Btn>
        : <Btn accent onClick={()=>newQ(true)}>다음 문제 →</Btn>)}
      {!solo&&result&&(
        <div style={{...S.result(result.kind),marginTop:12,marginBottom:0}}>
          <GradeMsg kind={result.kind}/>
          {" 정답: "}<strong>{fmtFreq(result.target)}</strong>
          {result.kind!=="ok"&&<> | 선택: {fmtFreq(result.guess)}</>}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 공통 EQ 로직 (핑크노이즈 / 음원 둘 다 사용)
// ════════════════════════════════════════════════════════════════
const DIFFICULTY = {
  easy:   { label:"Easy",  gainAbs:12 },
  normal: { label:"Normal",gainAbs:6  },
  hard:   { label:"Hard",  gainAbs:3  },
  extra:  { label:"X-Hard",gainAbs:0  }, // 랜덤
};
// 난이도별 정답 게인 후보 (사용자가 슬라이더로 입력해야 할 값)
function snapGains(diffKey){
  if(diffKey==="easy") return [12];
  if(diffKey==="normal") return [6];
  if(diffKey==="hard") return [3];
  return [3,6,9,12]; // extra
}

function makeEqQuestion(freqs, diffKey, mode, userQ) {
  // mode: "boost" | "cut" | "all" — 한 문제에 1밴드만
  const idx = weightedFreqIndex(freqs); // 60Hz↓/16kHz↑ 확률 1/3
  const gains = snapGains(diffKey);
  const gainAbs = gains[Math.floor(Math.random()*gains.length)];
  const q = diffKey==="extra" ? [1,2,3,5,8][Math.floor(Math.random()*5)] : userQ;
  let sign;
  if(mode==="boost") sign=1;
  else if(mode==="cut") sign=-1;
  else sign = Math.random()<0.5?1:-1;
  return [{freq:freqs[idx], gain:sign*gainAbs, q}];
}

// ════════════════════════════════════════════════════════════════
// EQ 입력 그룹 (밴드 수에 따라 3줄 분할)
// snapVal: 난이도별 게인 절댓값. null이면 X-Hard(슬라이더)
// mode: boost/cut/all
// ════════════════════════════════════════════════════════════════
function EqSliders({userBands, setUserBands, rows=1, snapVal, mode}) {
  const fLabel=f=>f>=1000?`${f/1000}k`:`${f}`;
  const perRow = Math.ceil(userBands.length/rows);
  const chunks=[];
  for(let i=0;i<userBands.length;i+=perRow) chunks.push(userBands.slice(i,i+perRow));
  const big = userBands.length<=10; // 10밴드는 크게, 31밴드는 작게

  const setGain=(gi,val)=>setUserBands(prev=>prev.map((x,j)=>j===gi?{...x,gain:val}:x));

  // boost/cut 단일 버튼 토글
  const tapSingle=(gi,cur)=>{
    const v = mode==="cut"?-snapVal:snapVal;
    setGain(gi, cur===v?0:v);
  };

  // ── X-Hard: 슬라이더 모드 ──
  if(snapVal==null){
    return (
      <>
        {chunks.map((chunk,ci)=>(
          <div key={ci} style={{display:"flex",justifyContent:"space-around",marginBottom:10,gap:2}}>
            {chunk.map((b)=>{
              const gi=userBands.indexOf(b);
              return (
                <div key={b.freq} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1,minWidth:0}}>
                  <div style={{fontSize:big?12:9,fontWeight:"bold",color:b.gain>0?AC:b.gain<0?"#f66":"#554",textAlign:"center"}}>
                    {b.gain>0?`+${b.gain}`:b.gain}
                  </div>
                  <input type="range" min={-12} max={12} step={1} value={b.gain}
                    onChange={e=>setGain(gi,+e.target.value)}
                    style={{writingMode:"vertical-lr",direction:"rtl",height:90,accentColor:AC,cursor:"pointer",width:16}} />
                  <div style={{fontSize:big?11:8,color:"#998",fontWeight:"bold"}}>{fLabel(b.freq)}</div>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{fontSize:10,color:"#665",textAlign:"center",marginTop:2}}>X-Hard: 슬라이더로 직접 맞추기</div>
      </>
    );
  }

  // ── All 모드: 위(부스트)/아래(컷) 버튼 ──
  if(mode==="all"){
    return (
      <>
        {chunks.map((chunk,ci)=>(
          <div key={ci} style={{display:"flex",justifyContent:"space-around",marginBottom:10,gap:big?6:3}}>
            {chunk.map((b)=>{
              const gi=userBands.indexOf(b);
              const upOn=b.gain>0, dnOn=b.gain<0;
              return (
                <div key={b.freq} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1,minWidth:0}}>
                  <button onClick={()=>setGain(gi, upOn?0:snapVal)} style={{
                    width:"100%",padding:big?"10px 0":"7px 0",borderRadius:6,fontFamily:"inherit",
                    fontSize:big?14:10,fontWeight:"bold",cursor:"pointer",
                    background:upOn?AC_DIM:"rgba(255,255,255,0.04)",
                    border:upOn?"1px solid "+AC:"1px solid rgba(255,255,255,0.1)",
                    color:upOn?AC:"#778",
                  }}>▲</button>
                  <div style={{fontSize:big?13:9,fontWeight:"bold",color:b.gain>0?AC:b.gain<0?"#f66":"#554"}}>
                    {b.gain>0?`+${b.gain}`:b.gain}
                  </div>
                  <button onClick={()=>setGain(gi, dnOn?0:-snapVal)} style={{
                    width:"100%",padding:big?"10px 0":"7px 0",borderRadius:6,fontFamily:"inherit",
                    fontSize:big?14:10,fontWeight:"bold",cursor:"pointer",
                    background:dnOn?"rgba(255,60,60,0.12)":"rgba(255,255,255,0.04)",
                    border:dnOn?"1px solid #ff6666":"1px solid rgba(255,255,255,0.1)",
                    color:dnOn?"#ff6666":"#778",
                  }}>▼</button>
                  <div style={{fontSize:big?12:8,color:"#998",fontWeight:"bold",marginTop:2}}>{fLabel(b.freq)}</div>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{fontSize:10,color:"#665",textAlign:"center",marginTop:2}}>▲ +{snapVal}dB 부스트 / ▼ -{snapVal}dB 컷</div>
      </>
    );
  }

  // ── Boost / Cut 모드: 단일 토글 버튼 ──
  return (
    <>
      {chunks.map((chunk,ci)=>(
        <div key={ci} style={{display:"flex",justifyContent:"space-around",marginBottom:10,gap:big?6:3}}>
          {chunk.map((b)=>{
            const gi=userBands.indexOf(b);
            const on=b.gain!==0;
            const isCut=mode==="cut";
            return (
              <div key={b.freq} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flex:1,minWidth:0}}>
                <button onClick={()=>tapSingle(gi,b.gain)} style={{
                  width:"100%",padding:big?"16px 0":"11px 0",borderRadius:8,fontFamily:"inherit",
                  fontSize:big?14:10,fontWeight:"bold",cursor:"pointer",
                  background:on?(isCut?"rgba(255,60,60,0.12)":AC_DIM):"rgba(255,255,255,0.04)",
                  border:on?(isCut?"1px solid #ff6666":"1px solid "+AC):"1px solid rgba(255,255,255,0.1)",
                  color:on?(isCut?"#ff6666":AC):"#778",
                }}>{on?(b.gain>0?`+${b.gain}`:b.gain):(isCut?"▼":"▲")}</button>
                <div style={{fontSize:big?12:8,color:"#998",fontWeight:"bold"}}>{fLabel(b.freq)}</div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{fontSize:10,color:"#665",textAlign:"center",marginTop:2}}>밴드 탭: {isCutLabel(mode)}{snapVal}dB</div>
    </>
  );
}
function isCutLabel(mode){ return mode==="cut"?"-":"+"; }

// 옵션 패널 (밴드/모드/난이도/Q) — 공통. Q는 항상 조절 가능.
function EqOptions({bandSet,setBandSet,mode,setMode,diff,setDiff,qVal,setQVal}) {
  const [hidden,setHidden]=useState(false);
  const modeL={boost:"부스트",cut:"컷",all:"All"}[mode];
  const diffL={easy:"Easy",normal:"Normal",hard:"Hard",extra:"X-Hard"}[diff];
  return (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:hidden?0:8}}>
        <div style={{fontSize:12,color:"#776"}}>
          {hidden?`${bandSet}밴드 · ${modeL} · ${diffL} · Q${qVal.toFixed(1)}`:"옵션"}
        </div>
        <button onClick={()=>setHidden(h=>!h)} style={{
          fontSize:11,fontFamily:"inherit",padding:"4px 10px",borderRadius:5,cursor:"pointer",
          background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:"#998",
        }}>{hidden?"▼ 펼치기":"▲ 접기"}</button>
      </div>
      {!hidden&&(<>
        <div style={S.label}>밴드</div>
        <Segmented options={[{value:10,label:"10밴드"},{value:31,label:"31밴드"}]} value={bandSet} onChange={setBandSet}/>
        <div style={S.label}>모드</div>
        <Segmented options={[{value:"boost",label:"부스트"},{value:"cut",label:"컷"},{value:"all",label:"All"}]} value={mode} onChange={setMode}/>
        <div style={S.label}>난이도</div>
        <Segmented options={[{value:"easy",label:"Easy\n±12dB"},{value:"normal",label:"Normal\n±6dB"},{value:"hard",label:"Hard\n±3dB"},{value:"extra",label:"X-Hard\n±3~12dB"}]} value={diff} onChange={setDiff}/>
        <div style={{...S.label,marginTop:8}}>Q 팩터: <span style={{color:AC}}>{qVal.toFixed(1)}</span></div>
        <input type="range" min={0.5} max={10} step={0.1} value={qVal}
          onChange={e=>setQVal(+e.target.value)}
          style={{width:"100%",accentColor:AC,cursor:"pointer"}} />
      </>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ② EQ 맞추기 (핑크노이즈 / 음원 소스 스위칭 통합)
// ════════════════════════════════════════════════════════════════
function EQTab({addScore, resetScore, audio, sharedFile}) {
  const solo=useSolo();
  const [source,setSource]=useState("pink"); // pink | music
  const [bandSet,setBandSet]=useState(10);
  const [mode,setMode]=useState("boost");
  const [diff,setDiff]=useState("easy");
  const [qVal,setQVal]=useState(3.0);
  const [qBands,setQBands]=useState(null);
  const [userIdx,setUserIdx]=useState(null);
  const [userGain,setUserGain]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [soloIdx,setSoloIdx]=useState(null); // solo 모드: 현재 솔로 중인 밴드
  const [result,setResult]=useState(null);
  const srcRef=useRef(null);
  const outGainRef=useRef(null);
  const soloFiltRef=useRef(null); // solo peaking 필터 [peak] (retune용)
  const bufRef=useRef(null); // 핑크노이즈 버퍼
  const wasPlayingRef=useRef(false);
  const posRef=useRef(0);        // 음원 내 현재 재생 위치(초, 절대)
  const startedAtRef=useRef(0);  // 재생 시작한 ctx.currentTime

  const freqs = bandSet===10?EQ_10:EQ_31;
  const file = sharedFile.file;
  const musicReady = file && file.buffer;
  const ready = source==="pink" ? true : musicReady;

  // 음원 루프 구간 [ls,le] 계산
  const loopRange=(buffer)=>{
    const dur=buffer.duration;
    const ls=(file?.loopStart??0)*dur, le=(file?.loopEnd??1)*dur;
    return (le>ls+0.05)?[ls,le]:[0,dur];
  };

  const stopAudio=()=>{
    // 정지 시점의 재생 위치 저장 (음원만)
    if(source==="music" && srcRef.current && playing){
      const ctx=audio.getCtx();
      const buffer=file.buffer;
      const [ls,le]=loopRange(buffer);
      const elapsed=ctx.currentTime-startedAtRef.current;
      let pos=posRef.current+elapsed;
      // 루프 구간 안에서 wrap
      const span=le-ls;
      while(pos>=le) pos-=span;
      posRef.current=pos;
    }
    try{srcRef.current?.stop();}catch(e){}srcRef.current=null;setPlaying(false);
    soloFiltRef.current=null;
    if(sharedFile.playheadRef) sharedFile.playheadRef.current.get=null;
  };

  const play=async(bands, opts={})=>{
    const { solo=false, soloFreq=null, muted=false } = opts;
    stopAudio();
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    let buffer;
    if(source==="pink"){
      if(!bufRef.current) bufRef.current=createPinkNoiseBuffer(ctx);
      buffer=bufRef.current;
    } else {
      if(!musicReady) return;
      buffer=file.buffer;
    }
    const src=ctx.createBufferSource();
    src.buffer=buffer; src.loop=true;
    let startOffset=0;
    if(source==="music" && file){
      const [ls,le]=loopRange(buffer);
      src.loopStart=ls; src.loopEnd=le;
      // 저장된 위치가 구간 밖이면 구간 시작으로
      if(posRef.current<ls||posRef.current>=le) posRef.current=ls;
      startOffset=posRef.current;
    }
    let prev=src;
    if(solo && soloFreq){
      // 풀레인지 소스 + 선택 주파수에 EQ 적용(부스트/컷). 대역통과 솔로가 아님.
      const gainAbs = diff==="extra" ? 12 : DIFFICULTY[diff].gainAbs;
      const g0 = mode==="cut" ? -gainAbs : gainAbs; // all 모드는 부스트로 들려줌
      const peak=ctx.createBiquadFilter();
      peak.type="peaking"; peak.frequency.value=soloFreq; peak.gain.value=g0; peak.Q.value=qVal;
      prev.connect(peak); prev=peak;
      soloFiltRef.current=[peak];
    } else {
      soloFiltRef.current=null;
      bands.forEach(({freq,gain,q=3})=>{
        if(gain===0) return;
        const f=ctx.createBiquadFilter();
        f.type="peaking"; f.frequency.value=freq; f.gain.value=gain; f.Q.value=q;
        prev.connect(f); prev=f;
      });
    }
    const g=ctx.createGain();
    g.gain.value=muted?0:(source==="pink"?0.5:0.8);
    prev.connect(g); g.connect(audio.getMaster());
    if(source==="music") src.start(0, startOffset);
    else src.start();
    startedAtRef.current=ctx.currentTime;
    srcRef.current=src; outGainRef.current=g; setPlaying(true);
    // 음원이면 플레이헤드 위치 계산 함수 등록 (0~1 비율)
    if(source==="music" && file && sharedFile.playheadRef){
      const [ls,le]=loopRange(buffer); const span=le-ls; const dur=buffer.duration;
      sharedFile.playheadRef.current.get=()=>{
        let pos=posRef.current+(audio.getCtx().currentTime-startedAtRef.current);
        while(pos>=le) pos-=span;
        return pos/dur;
      };
    }
  };

  const hasPlayedRef=useRef(false);
  const togglePlay=()=>{ if(playing) stopAudio(); else { hasPlayedRef.current=true; play(qBands); } };
  // 원본 — 누르고 있는 동안만. 누르기 전 문제 재생 중이었으면 떼면 복귀
  const holdStart=()=>{ wasPlayingRef.current=playing; play([{freq:1000,gain:0}]); };
  const holdEnd=()=>{ if(wasPlayingRef.current){ play(qBands); } else { stopAudio(); } };

  // Solo 모드: "재생"=소스(핑크/음원) 그대로. 밴드 선택 시 그 대역만 솔로(선택 바뀌면 전환)
  const soloPlaySource=()=>{
    if(playing&&soloIdx==null){ stopAudio(); return; } // 소스 재생 중 → 정지
    setSoloIdx(null); play([],{}); // 멈춰있거나 솔로 중 → 드라이 소스 재생
  };
  const soloBand=(i)=>{
    setSoloIdx(i);
    const f=freqs[i];
    // 이미 솔로 재생 중이면 필터만 retune (연속 드래그 클릭 방지)
    if(soloFiltRef.current && srcRef.current){
      const ctx=audio.getCtx();
      try{ soloFiltRef.current.forEach(bp=>bp.frequency.setTargetAtTime(f,ctx.currentTime,0.015)); }catch(e){ play(qBands,{solo:true,soloFreq:f}); }
    } else {
      play(qBands,{solo:true,soloFreq:f});
    }
  };

  const newQ=(forcePlay=false)=>{
    if(source==="pink") bufRef.current=null;
    const bands=makeEqQuestion(freqs,diff,mode,qVal);
    setQBands(bands);
    setUserIdx(null); setUserGain(0); setSoloIdx(null);
    setResult(null); stopAudio(); posRef.current=0;
    // Solo 모드에서는 자동 재생 안 함. 일반 모드만 자동 재생.
    if(!solo && (forcePlay||hasPlayedRef.current)){ hasPlayedRef.current=true; setTimeout(()=>play(bands),60); }
  };

  const submit=()=>{
    if(!qBands||userIdx==null) return;
    const ans=qBands[0];
    const ansIdx=freqs.indexOf(ans.freq);
    const fp=freqProximity(userIdx, ansIdx, freqs.length); // 주파수 근접 등급
    const freqExact=fp.grade==="ok";
    const freqNear=fp.grade==="near"||fp.grade==="near2";
    const gainErr=Math.abs(userGain-ans.gain);
    const gainTol=(diff==="hard"||diff==="extra")?3:6;
    let kind,pts;
    if(freqExact&&gainErr===0){ kind="ok"; pts=1; }
    else if(freqNear&&gainErr<=gainTol){ kind=fp.grade; pts=fp.pts; } // near 또는 near2
    else { kind="no"; pts=0; }
    setResult({kind,freqExact,freqNear,gainErr,answer:ans});
    addScore(pts); stopAudio();
  };

  useEffect(()=>{ return ()=>stopAudio(); },[]);
  // Solo 모드 진입/해제 시: 정지 + 선택 초기화
  useEffect(()=>{ stopAudio(); setSoloIdx(null); setUserIdx(null); setUserGain(0); setResult(null); },[solo]);
  // 난이도/밴드/모드/소스 변경 시: 점수 초기화 + 새 문제
  useEffect(()=>{ resetScore(); hasPlayedRef.current=false; if(ready) newQ(); },[bandSet,mode,diff,source,musicReady]);
  // Q 팩터 변경 시: 새 문제만 (점수 유지)
  const qInit=useRef(true);
  useEffect(()=>{ if(qInit.current){ qInit.current=false; return; } if(ready) newQ(); },[qVal]);

  const curGain = userIdx==null?0:userGain;

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <Segmented options={[{value:"pink",label:"핑크노이즈"},{value:"music",label:"음원"}]} value={source} onChange={setSource}/>
        {source==="music"&&<div style={{marginTop:8}}><FileUploader sharedFile={sharedFile} audio={audio}/></div>}
      </div>

      {ready&&(
        <EqOptions {...{bandSet,setBandSet,mode,setMode,diff,setDiff,qVal,setQVal}}/>
      )}

      {qBands&&ready&&(
        <>
          <div style={S.card}>
            {solo
              ? <Btn accent onClick={soloPlaySource} style={{marginBottom:8}}>
                  {playing&&soloIdx==null?"■ 정지":soloIdx!=null?<span style={{display:"flex",alignItems:"center",gap:6}}><IcoHeadphones size={14}/>{fmtFreq(freqs[soloIdx])} {mode==="cut"?"컷":"부스트"} 적용 중 · 탭하면 원본</span>:`▶ 재생 (${source==="pink"?"핑크노이즈":"음원"})`}
                </Btn>
              : <Btn accent onClick={togglePlay} style={{marginBottom:8}}>
                  {playing?"■ 재생 정지":"▶ 문제 재생"}
                </Btn>}
            {!solo&&<HoldButton onStart={holdStart} onEnd={holdEnd}>원본 (누르는 동안)</HoldButton>}
          </div>

          <div style={S.card}>
            <div style={S.label}>{solo?`주파수 — 선택하면 그 대역을 ${mode==="cut"?"컷":"부스트"}한 소리`:"① 주파수 — 그래프 드래그 또는 슬라이더"}</div>
            <FRGraph freqs={freqs} selIdx={solo?soloIdx:userIdx} gain={solo?(soloIdx!=null?(mode==="cut"?-(diff==="extra"?12:DIFFICULTY[diff].gainAbs):(diff==="extra"?12:DIFFICULTY[diff].gainAbs)):0):curGain} q={qVal}
              ansIdx={(!solo&&result)?freqs.indexOf(result.answer.freq):null} ansGain={(!solo&&result)?result.answer.gain:0}
              onPick={(i)=>{ if(solo){ soloBand(i); } else { if(result) return; setUserIdx(i); setUserGain(autoGainOnPick(mode,diff)); } }}
              height={150}/>
            <FreqSlider freqs={freqs} idx={solo?soloIdx:userIdx}
              onChange={(i)=>{ if(solo){ soloBand(i); } else { setUserIdx(i); setUserGain(autoGainOnPick(mode,diff)); } }}/>
            <div style={{fontSize:15,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
              {solo
                ? (soloIdx==null?"대역 미선택":fmtFreq(freqs[soloIdx]))
                : (userIdx==null?"대역 미선택":`${fmtFreq(freqs[userIdx])}  ${userGain>0?"+":""}${userGain}dB`)}
            </div>
          </div>

          {!solo&&levelStepsFor(mode,diff)&&(
            <div style={S.card}>
              <div style={S.label}>② 레벨 — dB 선택</div>
              <LevelStep value={userGain} onChange={setUserGain} mode={mode} diff={diff}/>
            </div>
          )}

          {!solo&&(!result
            ? <Btn accent onClick={submit} disabled={userIdx==null}>정답 제출</Btn>
            : <Btn accent onClick={()=>newQ(true)}>다음 문제 →</Btn>)}
          {!solo&&result&&(
            <div style={{...S.result(result.kind),marginTop:12,marginBottom:0}}>
              <GradeMsg kind={result.kind}/>
              {result.kind!=="ok"&&<div style={{fontSize:13,marginTop:6}}>{result.freqExact?"주파수 정확":result.freqNear?"주파수 인접":"주파수 틀림"} · 레벨오차 {result.gainErr}dB</div>}
              <div style={{fontSize:14,marginTop:6}}>
                정답: {result.answer.freq>=1000?`${result.answer.freq/1000}kHz`:`${result.answer.freq}Hz`} {result.answer.gain>0?"+":""}{result.answer.gain}dB
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════
// ④ 이펙터 청음 (공유 파일 사용)
// ════════════════════════════════════════════════════════════════
function EffectsTab({addScore, resetScore, audio, sharedFile}) {
  const solo=useSolo();
  const [source,setSource]=useState("pink"); // pink | music
  const [q,setQ]=useState(null);
  const [choices,setChoices]=useState([]);
  const [selected,setSelected]=useState(null);
  const [playing,setPlaying]=useState(false);
  const [soloList,setSoloList]=useState(false); // solo 모드: 이펙터 목록 표시 여부
  const [soloFx,setSoloFx]=useState(null);      // solo 모드: 현재 재생 중인 이펙터명
  const srcRef=useRef(null);
  const posRef=useRef(0);
  const startedAtRef=useRef(0);
  const playingRef=useRef(false);
  const wasEffectRef=useRef(false); // 원본 누르기 전 이펙터 재생 중이었나
  const pinkRef=useRef(null);       // 핑크노이즈 버퍼 캐시
  const file = sharedFile.file;

  // 현재 소스에 쓸 버퍼 (pink=생성 버퍼, music=업로드 파일)
  const getSrcBuffer=()=>{
    if(source==="pink"){
      if(!pinkRef.current) pinkRef.current=createPinkNoiseBuffer(audio.getCtx());
      return pinkRef.current;
    }
    return file?.buffer||null;
  };
  // 소스 준비 여부 (pink은 항상 준비됨)
  const srcReady = source==="pink" || !!(file&&file.buffer);

  const loopRange=(buffer)=>{
    const dur=buffer.duration;
    // 핑크노이즈는 전체 루프, 음원은 사용자 지정 구간
    if(source==="pink") return [0,dur];
    const ls=(file?.loopStart??0)*dur, le=(file?.loopEnd??1)*dur;
    return (le>ls+0.05)?[ls,le]:[0,dur];
  };

  const stopAudio=()=>{
    const buf=getSrcBuffer();
    if(srcRef.current && playingRef.current && buf){
      const ctx=audio.getCtx();
      const [ls,le]=loopRange(buf);
      const elapsed=ctx.currentTime-startedAtRef.current;
      let pos=posRef.current+elapsed;
      const span=le-ls;
      while(pos>=le) pos-=span;
      posRef.current=pos;
    }
    try{srcRef.current?.stop();}catch(e){}srcRef.current=null;
    playingRef.current=false; setPlaying(false);
    if(sharedFile.playheadRef) sharedFile.playheadRef.current.get=null;
  };

  const makeImpulse=(ctx,dur=2.2,decay=2.5)=>{
    const rate=ctx.sampleRate, len=rate*dur;
    const imp=ctx.createBuffer(2,len,rate);
    for(let ch=0;ch<2;ch++){
      const d=imp.getChannelData(ch);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
    }
    return imp;
  };
  const makeDistortionCurve=(amount=400)=>{
    const n=44100, curve=new Float32Array(n), deg=Math.PI/180;
    for(let i=0;i<n;i++){const x=i*2/n-1;curve[i]=(3+amount)*x*20*deg/(Math.PI+amount*Math.abs(x));}
    return curve;
  };

  const playWithEffect=async(effectName)=>{
    stopAudio();
    const buf=getSrcBuffer();
    if(!buf) return;
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const src=ctx.createBufferSource();
    src.buffer=buf; src.loop=true;
    const [ls,le]=loopRange(buf);
    src.loopStart=ls; src.loopEnd=le;
    if(posRef.current<ls||posRef.current>=le) posRef.current=ls;
    const startOffset=posRef.current;
    const dest=audio.getMaster();
    const out=ctx.createGain(); out.gain.value=0.8;
    let last=src;

    if(effectName===null){}
    else if(effectName==="리버브 (Reverb)"){
      const conv=ctx.createConvolver(); conv.buffer=makeImpulse(ctx);
      const wet=ctx.createGain(); wet.gain.value=0.9; const dry=ctx.createGain(); dry.gain.value=0.6;
      src.connect(dry); dry.connect(out); src.connect(conv); conv.connect(wet); wet.connect(out); last=null;
    } else if(effectName==="딜레이 (Delay)"){
      const dl=ctx.createDelay(); dl.delayTime.value=0.32; const fb=ctx.createGain(); fb.gain.value=0.45;
      const wet=ctx.createGain(); wet.gain.value=0.7;
      src.connect(out); src.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out); last=null;
    } else if(effectName==="디스토션 (Distortion)"){
      const ws=ctx.createWaveShaper(); ws.curve=makeDistortionCurve(400); ws.oversample="4x";
      const lvl=ctx.createGain(); lvl.gain.value=0.4; src.connect(ws); ws.connect(lvl); last=lvl;
    } else if(effectName==="코러스 (Chorus)"){
      const dl=ctx.createDelay(); dl.delayTime.value=0.03;
      const lfo=ctx.createOscillator(); lfo.frequency.value=1.2; const lg=ctx.createGain(); lg.gain.value=0.003;
      lfo.connect(lg); lg.connect(dl.delayTime); lfo.start(); const wet=ctx.createGain(); wet.gain.value=0.6;
      src.connect(out); src.connect(dl); dl.connect(wet); wet.connect(out); last=null;
    } else if(effectName==="플랜저 (Flanger)"){
      const dl=ctx.createDelay(); dl.delayTime.value=0.005;
      const lfo=ctx.createOscillator(); lfo.frequency.value=0.4; const lg=ctx.createGain(); lg.gain.value=0.004;
      lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
      const fb=ctx.createGain(); fb.gain.value=0.7; const wet=ctx.createGain(); wet.gain.value=0.7;
      src.connect(out); src.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(out); last=null;
    } else if(effectName==="트레몰로 (Tremolo)"){
      const tg=ctx.createGain(); const lfo=ctx.createOscillator(); lfo.frequency.value=6;
      const lg=ctx.createGain(); lg.gain.value=0.5; lfo.connect(lg); lg.connect(tg.gain); lfo.start();
      src.connect(tg); last=tg;
    } else if(effectName==="로우패스 필터 (LPF)"){
      const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=600; f.Q.value=1; src.connect(f); last=f;
    } else if(effectName==="하이패스 필터 (HPF)"){
      const f=ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=2500; f.Q.value=1; src.connect(f); last=f;
    } else if(effectName==="밴드패스 필터 (BPF)"){
      const f=ctx.createBiquadFilter(); f.type="bandpass"; f.frequency.value=1200; f.Q.value=2.5; src.connect(f); last=f;
    } else if(effectName==="노치 필터 (Notch)"){
      const f=ctx.createBiquadFilter(); f.type="notch"; f.frequency.value=1500; f.Q.value=3; src.connect(f); last=f;
    } else if(effectName==="페이저 (Phaser)"){
      // 여러 allpass를 LFO로 흔들기
      const lfo=ctx.createOscillator(); lfo.frequency.value=0.5;
      const lg=ctx.createGain(); lg.gain.value=800; lfo.connect(lg); lfo.start();
      let node=src;
      for(let i=0;i<4;i++){
        const ap=ctx.createBiquadFilter(); ap.type="allpass"; ap.frequency.value=400+i*300;
        lg.connect(ap.frequency); node.connect(ap); node=ap;
      }
      const wet=ctx.createGain(); wet.gain.value=0.7;
      src.connect(out); node.connect(wet); wet.connect(out); last=null;
    } else if(effectName==="비브라토 (Vibrato)"){
      const dl=ctx.createDelay(); dl.delayTime.value=0.005;
      const lfo=ctx.createOscillator(); lfo.frequency.value=5;
      const lg=ctx.createGain(); lg.gain.value=0.003;
      lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
      src.connect(dl); last=dl; // 원음 없이 변조만 → 피치 흔들림
    } else if(effectName==="오토패너 (Auto Pan)"){
      const panner=ctx.createStereoPanner();
      const lfo=ctx.createOscillator(); lfo.frequency.value=1.5;
      const lg=ctx.createGain(); lg.gain.value=0.9;
      lfo.connect(lg); lg.connect(panner.pan); lfo.start();
      src.connect(panner); last=panner;
    } else if(effectName==="비트크러셔 (Bitcrusher)"){
      // WaveShaper로 양자화 계단 만들기
      const ws=ctx.createWaveShaper();
      const bits=4, steps=Math.pow(2,bits), n=44100, curve=new Float32Array(n);
      for(let i=0;i<n;i++){ const x=i*2/n-1; curve[i]=Math.round(x*steps)/steps; }
      ws.curve=curve; src.connect(ws); last=ws;
    } else if(effectName==="링모듈레이터 (Ring Mod)"){
      const ring=ctx.createGain(); ring.gain.value=0;
      const carrier=ctx.createOscillator(); carrier.frequency.value=300;
      carrier.connect(ring.gain); carrier.start();
      src.connect(ring); last=ring;
    } else if(effectName==="와우 (Wah / Auto-Wah)"){
      const f=ctx.createBiquadFilter(); f.type="bandpass"; f.Q.value=5;
      const lfo=ctx.createOscillator(); lfo.frequency.value=1.2;
      const lg=ctx.createGain(); lg.gain.value=700;
      const base=ctx.createConstantSource(); base.offset.value=900; base.start();
      base.connect(f.frequency); lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      src.connect(f); last=f;
    }
    if(last) last.connect(out);
    out.connect(dest);
    src.start(0, startOffset);
    startedAtRef.current=ctx.currentTime;
    srcRef.current=src; playingRef.current=true; setPlaying(true);
    if(source==="music" && sharedFile.playheadRef){
      const dur=buf.duration; const span=le-ls;
      sharedFile.playheadRef.current.get=()=>{
        let pos=posRef.current+(audio.getCtx().currentTime-startedAtRef.current);
        while(pos>=le) pos-=span;
        return pos/dur;
      };
    }
  };

  const newQ=(autoplay=false)=>{
    const item=SOUND_EFFECTS[Math.floor(Math.random()*SOUND_EFFECTS.length)];
    // 정답이 속한 그룹들에서 헷갈리는 오답 우선 추출
    const related=new Set();
    EFFECT_GROUPS.forEach(g=>{ if(g.includes(item.name)) g.forEach(n=>{ if(n!==item.name) related.add(n); }); });
    let pool=[...related];
    pool.sort(()=>Math.random()-0.5);
    // 그룹에서 3개 못 채우면 전체에서 보충
    if(pool.length<3){
      const extra=SOUND_EFFECTS.map(e=>e.name).filter(n=>n!==item.name&&!related.has(n)).sort(()=>Math.random()-0.5);
      pool=[...pool,...extra];
    }
    const wrong=pool.slice(0,3).map(n=>({name:n}));
    setChoices([item,...wrong].sort(()=>Math.random()-0.5));
    setQ(item); setSelected(null); stopAudio(); posRef.current=0;
    if(autoplay) playWithEffect(item.name);
  };

  const select=(c)=>{ if(selected) return; setSelected(c); addScore(c.name===q.name?1:0); stopAudio(); };

  // 이펙터 소리 토글
  const toggleEffect=()=>{ if(playing) stopAudio(); else playWithEffect(q.name); };
  // 원본 hold: 누르는 동안 원본, 떼면 이펙터로 복귀(이펙터 재생 중이었으면)
  const origStart=()=>{ wasEffectRef.current=playing; playWithEffect(null); };
  const origEnd=()=>{ if(wasEffectRef.current){ playWithEffect(q.name); } else { stopAudio(); } };

  // Solo 모드: "재생"=소스 원본(이펙트 없음) + 이펙터 목록 표시. 이펙터 탭하면 그것만 재생.
  const soloPlay=()=>{
    if(playing&&soloFx==null){ stopAudio(); setSoloList(false); return; }
    setSoloFx(null); setSoloList(true); playWithEffect(null);
  };
  const soloPickFx=(name)=>{ setSoloFx(name); playWithEffect(name); };

  useEffect(()=>{ return ()=>stopAudio(); },[]);
  // 소스(핑크/음원) 변경 시: 정지 + 점수·문제 초기화
  useEffect(()=>{ stopAudio(); posRef.current=0; setQ(null); setSelected(null); setChoices([]); setSoloFx(null); setSoloList(false); resetScore(); },[source]);
  // Solo 모드 진입/해제 시: 정지 + 초기화
  useEffect(()=>{ stopAudio(); posRef.current=0; setSoloFx(null); setSoloList(false); setQ(null); setSelected(null); setChoices([]); },[solo]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>④ 이펙터 {solo?"솔로 청음":"청음 맞추기"}</div>
        <div style={{fontSize:12,color:"#776",marginBottom:12}}>
          {solo?"재생을 누르면 이펙터 목록이 나옵니다. 누른 이펙터만 들려요":"걸린 이펙터를 듣고 맞추세요. 원본과 비교해보세요."}
        </div>
        <Segmented options={[{value:"pink",label:"핑크노이즈"},{value:"music",label:"음원"}]} value={source} onChange={setSource}/>
        {source==="music"&&<div style={{marginTop:10}}><FileUploader sharedFile={sharedFile} audio={audio}/></div>}
        {!solo&&srcReady&&<Btn accent onClick={newQ} style={{marginTop:10}}>문제 생성</Btn>}
        {solo&&srcReady&&<Btn accent onClick={soloPlay} style={{marginTop:10}}>
          {playing&&soloFx==null?"■ 정지":soloFx!=null?<span style={{display:"flex",alignItems:"center",gap:6}}><IcoHeadphones size={14}/>{effectLabelShort(soloFx)} 재생 중 · 탭하면 원본</span>:"▶ 재생 (이펙터 목록 보기)"}
        </Btn>}
        {source==="music"&&!srcReady&&<div style={{fontSize:12,color:"#776",marginTop:8}}>음원을 업로드하면 {solo?"청음":"문제를 생성"}할 수 있습니다</div>}
      </div>

      {/* Solo 모드: 이펙터 전체 목록 */}
      {solo&&soloList&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {SOUND_EFFECTS.map(fx=>{
            const active=soloFx===fx.name;
            return (
              <button key={fx.name} onClick={()=>soloPickFx(fx.name)} style={{
                padding:"13px 8px",borderRadius:10,cursor:"pointer",fontSize:12.5,fontFamily:"inherit",
                textAlign:"center",lineHeight:1.35,transition:"all 0.15s",
                background:active?AC_DIM:"rgba(255,255,255,0.04)",
                border:active?"1px solid "+AC:"1px solid rgba(255,255,255,0.08)",
                color:active?AC:"#ccc",
              }}>{fx.name}</button>
            );
          })}
        </div>
      )}
      {solo&&soloFx&&(()=>{ const m=SOUND_EFFECTS.find(e=>e.name===soloFx); return m?(
        <div style={{...S.result("ok"),marginTop:0}}>
          <strong style={{color:AC}}>{m.name}</strong><br/>
          <span style={{fontSize:13,lineHeight:1.5,color:"#ddd"}}>{m.desc}</span>
        </div>
      ):null; })()}

      {!solo&&q&&(
        <>
          <div style={S.card}>
            <Btn accent onClick={toggleEffect} style={{marginBottom:8}}>
              {playing?"■ 이펙터 정지":"▶ 이펙터 소리"}
            </Btn>
            <HoldButton onStart={origStart} onEnd={origEnd}>원본 (누르는 동안)</HoldButton>
          </div>

          <div style={{fontSize:12,color:"#776",margin:"4px 2px 10px"}}>지금 걸린 이펙터는?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {choices.map(c=>{
              const isCorrect=c.name===q.name; const isSel=selected?.name===c.name;
              let bg="rgba(255,255,255,0.04)",border="1px solid rgba(255,255,255,0.08)",color="#ccc";
              if(selected){
                if(isCorrect){bg=AC_DIM;border="1px solid "+AC;color=AC;}
                else if(isSel){bg="rgba(255,60,60,0.1)";border="1px solid #ff3c3c";color="#ff6666";}
              }
              return (
                <button key={c.name} onClick={()=>select(c)} style={{
                  padding:"16px 10px",background:bg,border,borderRadius:10,color,
                  cursor:selected?"default":"pointer",fontSize:13,fontFamily:"inherit",
                  textAlign:"center",transition:"all 0.15s",lineHeight:1.4,
                }}>{c.name}</button>
              );
            })}
          </div>

          {selected&&<Btn accent onClick={()=>newQ(true)}>다음 문제 →</Btn>}
          {selected&&(
            <div style={{...S.result(selected.name===q.name?"ok":"no"),marginTop:12,marginBottom:0}}>
              {selected.name===q.name
                ?<span style={row}><IcoCheck size={15}/><span>(+{fmtPt(PER_Q)}점)</span></span>
                :<span style={row}><IcoX size={15}/><span>{q.name}</span></span>}
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.12)",fontSize:13,lineHeight:1.5,color:"#ddd"}}>
                <strong style={{color:AC}}>{q.name}</strong><br/>{q.desc}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ⑤ 피드백(하울링) 트레이너 — 점점 커지는 링잉 재현
// ════════════════════════════════════════════════════════════════
const FB_TIME = { easy:0, normal:20, hard:10, extra:5 }; // 초, 0=무제한
const FB_LABEL = { easy:"Easy(무제한)", normal:"Normal(20s)", hard:"Hard(10s)", extra:"X-Hard(5s)" };

function FeedbackTab({addScore, resetScore, audio, sharedFile}) {
  const solo=useSolo();
  const [source,setSource]=useState("pink"); // pink | music
  const [bandSet,setBandSet]=useState(10);
  const [diff,setDiff]=useState("easy");
  const [optHidden,setOptHidden]=useState(false);
  const [target,setTarget]=useState(null);
  const [userIdx,setUserIdx]=useState(null);
  const [running,setRunning]=useState(false);
  const [result,setResult]=useState(null);
  const [timeLeft,setTimeLeft]=useState(null);
  const [soloIdx,setSoloIdx]=useState(null); // solo 모드: 현재 솔로 중 밴드
  const srcRef=useRef(null);
  const bufRef=useRef(null);
  const peakRef=useRef(null); // 하울링 peaking 필터 (solo retune용)
  const outGRef=useRef(null); // 하울링 출력 게인 (solo 주파수 변경 시 페이드용)
  const rampRef=useRef(null);
  const timerRef=useRef(null);
  const soloSrcRef=useRef(null); // 솔로 청취용 별도 소스
  const wasRunningRef=useRef(false);

  const freqs = bandSet===10?EQ_10:EQ_31;
  const file = sharedFile.file;
  const musicReady = file && file.buffer;
  const ready = source==="pink" ? true : musicReady;

  const clearTimers=()=>{
    if(rampRef.current){ clearInterval(rampRef.current); rampRef.current=null; }
    if(timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; }
  };
  const stopAudio=()=>{
    clearTimers();
    try{srcRef.current?.stop();}catch(e){}
    srcRef.current=null; peakRef.current=null; outGRef.current=null; setRunning(false);
  };

  const start=async(freq)=>{
    stopAudio();
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    let buffer;
    if(source==="pink"){
      if(!bufRef.current) bufRef.current=createPinkNoiseBuffer(ctx);
      buffer=bufRef.current;
    } else {
      if(!musicReady) return;
      buffer=file.buffer;
    }
    const src=ctx.createBufferSource();
    src.buffer=buffer; src.loop=true;
    if(source==="music" && file){
      const dur=buffer.duration;
      const ls=(file.loopStart??0)*dur, le=(file.loopEnd??1)*dur;
      if(le>ls+0.05){ src.loopStart=ls; src.loopEnd=le; }
    }
    const peak=ctx.createBiquadFilter();
    peak.type="peaking"; peak.frequency.value=freq; peak.Q.value=18; peak.gain.value=0;
    peakRef.current=peak;
    const bg=ctx.createGain(); bg.gain.value=source==="pink"?0.35:0.55;
    src.connect(bg); bg.connect(peak);
    const g=ctx.createGain();
    // 페이드 인 (재생 시작 시 툭 끊기지 않게)
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime+0.18);
    peak.connect(g); g.connect(audio.getMaster());
    outGRef.current=g;
    if(source==="music" && file && src.loopStart>0) src.start(0, src.loopStart);
    else src.start();
    srcRef.current=src;

    // 하울링 상승 (최대레벨 기존 +6dB → 42dB)
    let db=0;
    rampRef.current=setInterval(()=>{ db+=1.2; if(db>42) db=42; try{peak.gain.value=db;}catch(e){} },120);
    setRunning(true);

    // 시간 제한. 일반 모드: 초과 시 자동 오답. Solo 모드: 그 초 동안만 재생 후 정지(채점 없음).
    const limit=FB_TIME[diff];
    if(limit>0){
      setTimeLeft(limit);
      timerRef.current=setInterval(()=>{
        setTimeLeft(t=>{
          if(t<=1){
            clearTimers(); try{srcRef.current?.stop();}catch(e){} srcRef.current=null; setRunning(false);
            if(!solo){ setResult({kind:"no",answer:target,timeout:true}); addScore(0); }
            return null;
          }
          return t-1;
        });
      },1000);
    } else setTimeLeft(null);
  };

  const newRound=(autoplay=false)=>{
    const f=freqs[weightedFreqIndex(freqs)];
    setTarget(f); setUserIdx(null); setResult(null); setTimeLeft(null);
    if(source==="pink") bufRef.current=null;
    stopAudio();
    if(autoplay) setTimeout(()=>start(f),60); // 다음 문제 시 하울링 자동 재생
  };

  const submit=()=>{
    if(target==null||userIdx==null) return;
    const ansIdx=freqs.indexOf(target);
    const {grade:kind, pts} = freqProximity(userIdx, ansIdx, freqs.length);
    setResult({kind,answer:target});
    addScore(pts); stopAudio();
  };

  // 현재 울리는 주파수(target)를 솔로로 청취 — 누르고 있는 동안만 (하울링 일시정지)
  const stopSolo=()=>{ try{soloSrcRef.current?.stop();}catch(e){} soloSrcRef.current=null; };
  const soloStart=async()=>{
    if(target==null) return;
    wasRunningRef.current=running;
    clearTimers(); try{srcRef.current?.stop();}catch(e){} srcRef.current=null; setRunning(false);
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    let buffer;
    if(source==="pink"){ if(!bufRef.current) bufRef.current=createPinkNoiseBuffer(ctx); buffer=bufRef.current; }
    else { if(!musicReady) return; buffer=file.buffer; }
    const src=ctx.createBufferSource(); src.buffer=buffer; src.loop=true;
    if(source==="music" && file){
      const dur=buffer.duration; const ls=(file.loopStart??0)*dur, le=(file.loopEnd??1)*dur;
      if(le>ls+0.05){ src.loopStart=ls; src.loopEnd=le; }
    }
    // 좁은 대역통과 2단으로 해당 주파수만 솔로
    const bp1=ctx.createBiquadFilter(); bp1.type="bandpass"; bp1.frequency.value=target; bp1.Q.value=8;
    const bp2=ctx.createBiquadFilter(); bp2.type="bandpass"; bp2.frequency.value=target; bp2.Q.value=8;
    const g=ctx.createGain(); g.gain.value=1.0;
    src.connect(bp1); bp1.connect(bp2); bp2.connect(g); g.connect(audio.getMaster());
    if(source==="music" && file && src.loopStart>0) src.start(0, src.loopStart); else src.start();
    soloSrcRef.current=src;
  };
  const soloEnd=()=>{ stopSolo(); if(wasRunningRef.current) start(target); };

  // Solo 모드: 밴드 선택 시 그 대역 하울링을 재생. 이미 재생 중이면 주파수 변경 + 페이드 인.
  const soloBand=(i)=>{
    setSoloIdx(i); setTarget(freqs[i]);
    const f=freqs[i];
    if(running && peakRef.current && srcRef.current){
      const ctx=audio.getCtx(); const now=ctx.currentTime;
      try{
        // 출력을 잠깐 줄였다가(0.05s) 새 주파수로 바꾼 뒤 페이드 인(0.18s)
        if(outGRef.current){
          const g=outGRef.current.gain;
          g.cancelScheduledValues(now);
          g.setValueAtTime(g.value, now);
          g.linearRampToValueAtTime(0, now+0.05);
          g.linearRampToValueAtTime(0.5, now+0.05+0.18);
        }
        peakRef.current.frequency.setTargetAtTime(f, now+0.05, 0.02);
      }catch(e){ setTimeout(()=>start(f),0); }
    } else {
      setTimeout(()=>start(f),0);
    }
  };

  useEffect(()=>{ return ()=>{ stopAudio(); stopSolo(); }; },[]);
  // Solo 모드 진입/해제 시: 정지 + 초기화
  useEffect(()=>{ stopAudio(); stopSolo(); setSoloIdx(null); setUserIdx(null); setResult(null); setTimeLeft(null); },[solo]);
  // 밴드/난이도/소스 변경 시 새 라운드 (점수는 수동 초기화만)
  useEffect(()=>{ resetScore(); if(ready && !solo) newRound(); },[bandSet,diff,source,musicReady]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <Segmented options={[{value:"pink",label:"핑크노이즈"},{value:"music",label:"음원"}]} value={source} onChange={setSource}/>
        {source==="music"&&<div style={{marginTop:8}}><FileUploader sharedFile={sharedFile} audio={audio}/></div>}
        <div style={{fontSize:13,color:"#998",marginTop:6}}>
          {solo?"대역을 선택하면 그 주파수의 하울링이 재생됩니다":"재생하면 특정 대역이 점점 울립니다. 어느 주파수인지 찾으세요"}
        </div>
      </div>

      {ready&&(<>
      <div style={S.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:optHidden?0:8}}>
          <div style={{fontSize:12,color:"#776"}}>
            {optHidden?`${bandSet}밴드 · ${{easy:"Easy ∞",normal:"20s",hard:"10s",extra:"5s"}[diff]}`:"옵션"}
          </div>
          <button onClick={()=>setOptHidden(h=>!h)} style={{
            fontSize:11,fontFamily:"inherit",padding:"4px 10px",borderRadius:5,cursor:"pointer",
            background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:"#998",
          }}>{optHidden?"▼ 펼치기":"▲ 접기"}</button>
        </div>
        {!optHidden&&(<>
          <div style={S.label}>밴드</div>
          <Segmented options={[{value:10,label:"10밴드"},{value:31,label:"31밴드"}]} value={bandSet} onChange={setBandSet}/>
          <div style={{...S.label,marginTop:10}}>{solo?"재생 시간":"제한시간"}</div>
          <Segmented options={[{value:"easy",label:"Easy ∞"},{value:"normal",label:"20s"},{value:"hard",label:"10s"},{value:"extra",label:"5s"}]} value={diff} onChange={setDiff}/>
        </>)}
      </div>

      {!solo&&(
      <div style={S.card}>
        <Btn accent onClick={()=>running?stopAudio():start(target)} style={{marginBottom:8}}>
          {running?"■ 정지":"▶ 하울링 재생"}
        </Btn>
        <HoldButton onStart={soloStart} onEnd={soloEnd}><span style={{display:"flex",alignItems:"center",gap:6}}><IcoHeadphones size={14}/> 현재 주파수 솔로 (누르는 동안)</span></HoldButton>
        {running&&(
          <div style={{marginTop:8}}>
            <div style={{fontSize:13,color:"#ff6666",fontWeight:"bold",marginBottom:4}}>
              ◉ 하울링 상승 중{timeLeft!=null?` · ${timeLeft}초`:" · 무제한"}
            </div>
            {timeLeft!=null&&FB_TIME[diff]>0&&(
              <div style={{height:8,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:(timeLeft/FB_TIME[diff]*100)+"%",
                  background:timeLeft<=3?"#ff3c3c":AC,transition:"width 1s linear"}}/>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {solo&&running&&(
        <div style={S.card}>
          <Btn onClick={()=>{stopAudio();setSoloIdx(null);}} style={{marginBottom:0}}>■ 정지</Btn>
          <div style={{fontSize:13,color:AC,fontWeight:"bold",marginTop:8}}>
            ◉ {soloIdx!=null?fmtFreq(freqs[soloIdx]):""} 하울링 재생 중{timeLeft!=null?` · ${timeLeft}초`:""}
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.label}>{solo?"대역 선택 — 그 주파수 하울링 재생":"울리는 대역 — 그래프 드래그 또는 슬라이더"}</div>
        <FRGraph freqs={freqs} selIdx={solo?soloIdx:userIdx} gain={(solo?soloIdx:userIdx)==null?0:12} q={18}
          ansIdx={(!solo&&result)?freqs.indexOf(result.answer):null} ansGain={12}
          onPick={(i)=>{ if(solo){ soloBand(i); } else { if(result) return; setUserIdx(i); } }} height={150}/>
        <FreqSlider freqs={freqs} idx={solo?soloIdx:userIdx}
          onChange={(i)=>{ if(solo){ soloBand(i); } else { if(result) return; setUserIdx(i); } }}/>
        <div style={{fontSize:15,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
          {(solo?soloIdx:userIdx)==null?"대역 미선택":fmtFreq(freqs[solo?soloIdx:userIdx])}
        </div>
      </div>

      {!solo&&(!result
        ? <Btn accent onClick={submit} disabled={userIdx==null}>정답 제출</Btn>
        : <Btn accent onClick={()=>newRound(true)}>다음 문제 →</Btn>)}
      {!solo&&result&&(
        <div style={{...S.result(result.kind),marginTop:12,marginBottom:0}}>
          {result.kind==="ok"?<span style={row}><IcoCheck size={15}/><span>(+{fmtPt(PER_Q)}점)</span></span>
          :result.kind==="near"?<span style={row}><IcoNear size={15}/><span>±1칸 (+{fmtPt(PER_Q_NEAR)}점)</span></span>
          :result.kind==="near2"?<span style={row}><IcoNear size={15}/><span>±2칸 (+{fmtPt(PER_Q_NEAR2)}점)</span></span>
          :result.timeout?<span style={row}><IcoX size={15}/><span>시간 초과</span></span>
          :<span style={row}><IcoX size={15}/></span>}
          <div style={{marginTop:6,fontSize:14}}>정답: {fmtFreq(result.answer)}</div>
        </div>
      )}
      </>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 공유 파일 업로더 (로딩바 포함)
// ════════════════════════════════════════════════════════════════
// 파형 다운샘플 → 피크 배열
function computePeaks(buffer, n=300){
  const ch=buffer.getChannelData(0);
  const block=Math.floor(ch.length/n);
  const peaks=[];
  for(let i=0;i<n;i++){
    let max=0;
    for(let j=0;j<block;j++){ const v=Math.abs(ch[i*block+j]||0); if(v>max)max=v; }
    peaks.push(max);
  }
  return peaks;
}

// 파형 + 구간 선택 (좌/우 핸들 드래그) + 실시간 플레이헤드
function WaveformSelector({buffer, loopStart, loopEnd, onChange, playheadRef}) {
  const ref=useRef(null);
  const headRef=useRef(null);
  const peaksRef=useRef(null);
  const dragRef=useRef(null); // "start" | "end" | null
  const accent=useAccent();

  if(!peaksRef.current || peaksRef.current.buf!==buffer){
    peaksRef.current={buf:buffer, peaks:computePeaks(buffer,300)};
  }

  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const W=canvas.width,H=canvas.height,ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,W,H);
    const peaks=peaksRef.current.peaks, n=peaks.length, bw=W/n;
    const sX=loopStart*W, eX=loopEnd*W;
    for(let i=0;i<n;i++){
      const x=i*bw, h=peaks[i]*(H*0.9);
      const inLoop = x>=sX && x<=eX;
      ctx.fillStyle = inLoop ? accent : "rgba(255,255,255,0.12)";
      ctx.fillRect(x, H/2-h/2, Math.max(1,bw-0.5), h);
    }
    ctx.fillStyle=accent;
    ctx.fillRect(sX-2,0,4,H); ctx.fillRect(eX-2,0,4,H);
  },[buffer,loopStart,loopEnd,accent]);

  // 플레이헤드 실시간 그리기 (오버레이 캔버스)
  useEffect(()=>{
    let raf;
    const draw=()=>{
      const c=headRef.current;
      if(c){
        const W=c.width,H=c.height,ctx=c.getContext("2d");
        ctx.clearRect(0,0,W,H);
        const get=playheadRef&&playheadRef.current&&playheadRef.current.get;
        if(get){
          const r=get(); // 0~1
          if(r!=null && r>=0 && r<=1){
            const x=r*W;
            ctx.fillStyle="#fff"; ctx.fillRect(x-1,0,2,H);
            ctx.fillStyle="#fff"; ctx.beginPath();
            ctx.moveTo(x-4,0); ctx.lineTo(x+4,0); ctx.lineTo(x,6); ctx.closePath(); ctx.fill();
          }
        }
      }
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(raf);
  },[playheadRef]);

  const xToR=(clientX)=>{
    const rect=ref.current.getBoundingClientRect();
    return Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
  };
  const down=(e)=>{
    const x=e.touches?e.touches[0].clientX:e.clientX;
    const r=xToR(x);
    dragRef.current = Math.abs(r-loopStart)<Math.abs(r-loopEnd)?"start":"end";
    move(e);
  };
  const move=(e)=>{
    if(!dragRef.current) return;
    const x=e.touches?e.touches[0].clientX:e.clientX;
    const r=xToR(x);
    if(dragRef.current==="start") onChange(Math.min(r,loopEnd-0.02), loopEnd);
    else onChange(loopStart, Math.max(r,loopStart+0.02));
  };
  const up=()=>{ dragRef.current=null; };

  return (
    <div style={{position:"relative",marginTop:8}}>
      <canvas ref={ref} width={600} height={70}
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
        onTouchStart={down} onTouchMove={move} onTouchEnd={up}
        style={{width:"100%",height:70,borderRadius:8,background:"rgba(0,0,0,0.4)",
          display:"block",touchAction:"none",cursor:"ew-resize"}} />
      <canvas ref={headRef} width={600} height={70}
        style={{width:"100%",height:70,position:"absolute",top:0,left:0,pointerEvents:"none"}} />
    </div>
  );
}

function FileUploader({sharedFile, audio}) {
  const {file,setFile}=sharedFile;
  const [progress,setProgress]=useState(0);
  const [waveHidden,setWaveHidden]=useState(false);

  const handleFile=(e)=>{
    const f=e.target.files && e.target.files[0];
    if(!f){ return; }
    // ★ 제스처 직속에서 즉시 ctx 깨우기 (iOS 정책). 콜백 안에서 하면 무시됨
    const ctx=audio.getCtx();
    try{ ctx.resume(); }catch(err){}
    // 무음 버퍼를 즉시 한번 재생해 컨텍스트를 확실히 활성화
    try{
      const s=ctx.createBufferSource();
      s.buffer=ctx.createBuffer(1,1,ctx.sampleRate);
      s.connect(ctx.destination); s.start(0);
    }catch(err){}

    setFile({name:f.name,buffer:null,loading:true});
    setProgress(0);

    const reader=new FileReader();
    reader.onprogress=(ev)=>{ if(ev.lengthComputable) setProgress(Math.round(ev.loaded/ev.total*100)); };
    reader.onerror=()=>setFile({name:f.name,buffer:null,loading:false,error:true,errMsg:"파일 읽기 실패"});
    reader.onload=async()=>{
      setProgress(100);
      try{
        try{ if(ctx.state!=="running") await ctx.resume(); }catch(err){}
        const ab=reader.result;
        const buffer=await new Promise((resolve,reject)=>{
          try{
            const p=ctx.decodeAudioData(ab, resolve, reject);
            if(p&&p.then) p.then(resolve).catch(reject);
          }catch(err){ reject(err); }
        });
        setFile({name:f.name,buffer,loading:false,loopStart:0,loopEnd:1});
      }catch(err){
        setFile({name:f.name,buffer:null,loading:false,error:true,errMsg:"디코딩 실패: "+(err&&err.message||err)});
      }
    };
    reader.readAsArrayBuffer(f);
  };

  return (
    <div>
      {/* 최상단 접기 토글 (파일 있을 때만, 오른쪽 정렬) */}
      {file&&file.buffer&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:waveHidden?0:8}}>
          {waveHidden?<div style={{fontSize:12,color:AC,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}><IcoCheck size={12}/> {file.name}</div>:<div/>}
          <button onClick={()=>setWaveHidden(h=>!h)} style={{
            fontSize:11,fontFamily:"inherit",padding:"4px 10px",borderRadius:5,cursor:"pointer",flexShrink:0,
            background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:"#998",
          }}>{waveHidden?"▼ 펼치기":"▲ 접기"}</button>
        </div>
      )}

      {!waveHidden&&(<>
        <label style={{
          display:"block",padding:"16px",textAlign:"center",
          background:AC_SOFT,border:"1px dashed "+AC_BORDER,
          borderRadius:8,cursor:"pointer",fontSize:14,
        }}>
          <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><IcoUpload size={14}/> 음원 업로드 (MP3 / WAV / M4A)</span>
          <input type="file"
            onChange={handleFile} style={{display:"none"}} />
        </label>

        {file&&file.loading&&(
          <div style={{marginTop:10}}>
            <div style={{fontSize:12,color:"#cc9",marginBottom:4}}>⏳ 불러오는 중... {progress}%</div>
            <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:progress+"%",background:AC,transition:"width 0.1s"}}/>
            </div>
          </div>
        )}
        {file&&file.error&&<div style={{fontSize:13,color:"#ff6666",marginTop:8}}><IcoX size={13}/> {file.errMsg||"재생 불가"}. 다른 음원(MP3/WAV)을 써보세요.</div>}
        {file&&file.buffer&&(
          <>
            <div style={{fontSize:13,color:AC,marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><IcoCheck size={13}/> {file.name}</div>
            <WaveformSelector buffer={file.buffer}
              loopStart={file.loopStart??0} loopEnd={file.loopEnd??1}
              onChange={(s,en)=>setFile({...file,loopStart:s,loopEnd:en})}
              playheadRef={sharedFile.playheadRef}/>
            <div style={{fontSize:11,color:"#776",marginTop:4}}>주황 구간만 반복 재생됩니다 · 좌우 핸들 드래그로 구간 조절</div>
          </>
        )}
        {!file&&<div style={{fontSize:12,color:"#554",marginTop:8}}>저작권 없는 음원을 사용하세요</div>}
      </>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════════
const TABS=[
  {id:"sine",icon:"〜",label:"사인파"},
  {id:"eq",icon:"⋯",label:"EQ"},
  {id:"effects",icon:"◈",label:"이펙터"},
  {id:"feedback",icon:"◭",label:"피드백"},
];
const MAX_Q = 20; // 20문제 = 100점 만점
const PER_Q = 100/MAX_Q;            // 문제당 만점 (정답)
const PER_Q_NEAR = PER_Q/2;         // 근사값(인접) 점수
const PER_Q_NEAR2 = PER_Q/4;        // 반의 반절(2칸) 점수
const fmtPt = v => Number.isInteger(v)?`${v}`:(+v.toFixed(2)).toString(); // 5 / 2.5 / 1.25 표기

// 주파수 인접 정도로 근사 등급 산정.
// 10밴드: ±1칸=절반(near). 31밴드: ±1칸=절반(near), ±2칸=반의반절(near2). 그 외 오답.
// 반환: {grade, pts}  grade: "ok"|"near"|"near2"|"no"
function freqProximity(userIdx, ansIdx, bandCount){
  const d = Math.abs(userIdx-ansIdx);
  if(d===0) return {grade:"ok", pts:1};
  if(d===1) return {grade:"near", pts:0.5};
  if(d===2 && bandCount>=31) return {grade:"near2", pts:0.25};
  return {grade:"no", pts:0};
}

export default function App() {
  const [tab,setTab]=useState("sine");
  const [scores,setScores]=useState({sine:{ok:0,total:0},eq:{ok:0,total:0},effects:{ok:0,total:0},feedback:{ok:0,total:0}});
  const [masterVol,setMasterVol]=useState(0.8);
  const [muted,setMuted]=useState(false);
  const [volOpen,setVolOpen]=useState(false); // 상단 볼륨바 기본 숨김
  const [soloMode,setSoloMode]=useState(false); // Solo 모드 (초록 테마 + 선택 주파수 솔로)
  const [file,setFile]=useState(null);

  const audio = useMaster(masterVol, muted);
  const playheadRef = useRef({get:null}); // 현재 재생위치(0~1) 반환 함수 등록용
  const sharedFile={file,setFile,playheadRef};

  // iOS: 첫 사용자 입력(터치/클릭)에서 AudioContext를 깨워둔다
  useEffect(()=>{
    const wake=()=>{
      try{
        const ctx=audio.getCtx();
        if(ctx.state!=="running") ctx.resume();
        const s=ctx.createBufferSource();
        s.buffer=ctx.createBuffer(1,1,ctx.sampleRate);
        s.connect(ctx.destination); s.start(0);
      }catch(e){}
    };
    document.addEventListener("touchend",wake,{once:true});
    document.addEventListener("click",wake,{once:true});
    return ()=>{
      document.removeEventListener("touchend",wake);
      document.removeEventListener("click",wake);
    };
  },[]);

  // 탭 전환/복귀 시 AudioContext가 suspend 되어 소리가 끊기는 버그 방지.
  // 화면 복귀 또는 창 포커스 시 컨텍스트를 다시 깨운다. (점수는 건드리지 않음)
  useEffect(()=>{
    const resume=()=>{
      try{
        const ctx=audio.getCtx();
        if(ctx&&ctx.state==="suspended") ctx.resume();
      }catch(e){}
    };
    const onVis=()=>{ if(document.visibilityState==="visible") resume(); };
    document.addEventListener("visibilitychange",onVis);
    window.addEventListener("focus",resume);
    window.addEventListener("pageshow",resume);
    return ()=>{
      document.removeEventListener("visibilitychange",onVis);
      window.removeEventListener("focus",resume);
      window.removeEventListener("pageshow",resume);
    };
  },[]);

  // 파트별 점수 추가 (20문제 만점). pts: 1=정답, 0.5=근사, 0.25=2칸, 0=오답
  // 20문제를 모두 푼 뒤 다시 답하면 자동으로 새 세트(1문제부터)로 초기화.
  const addScore=(part,pts)=>setScores(s=>{
    const cur=s[part];
    if(cur.total>=MAX_Q) return {...s,[part]:{ok:pts,total:1}};
    return {...s,[part]:{ok:cur.ok+pts,total:cur.total+1}};
  });
  // 파트 점수 초기화
  const resetScore=(part)=>setScores(s=>({...s,[part]:{ok:0,total:0}}));

  const cur = scores[tab];
  const pts = fmtPt(+((cur.ok/MAX_Q)*100).toFixed(2));

  // Solo 모드 팔레트 → CSS 변수로 주입 (canvas는 ThemeCtx로 전달)
  const pal = soloMode?PALETTE.solo:PALETTE.normal;
  const cssVars = { "--ac":pal.ac, "--ac-dim":pal.dim, "--ac-border":pal.border, "--ac-soft":pal.soft };

  return (
    <SoloCtx.Provider value={soloMode}>
    <ThemeCtx.Provider value={pal.ac}>
    <div style={{...S.page, ...cssVars}}>
      {/* 헤더 */}
      <div style={S.header}>
        {/* 타이틀 + (볼륨/Solo 아이콘 + 스코어) */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{minWidth:0,flex:1,marginRight:12,overflow:"hidden"}}>
            <div style={{fontSize:10,color:AC,letterSpacing:3,marginBottom:2}}>EAR TRAINING{soloMode&&<span style={{color:AC,marginLeft:6,fontWeight:700}}>· SOLO</span>}</div>
            <div style={{fontSize:"clamp(12px,3.4vw,16px)",fontWeight:"bold",letterSpacing:0.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>LIVE SOUND EAR TRAINER</div>
          </div>
          <div style={{display:"flex",alignItems:"stretch",gap:8,flexShrink:0}}>
            {/* 볼륨 아이콘 + 그 아래 Solo(S) 토글 */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={()=>setVolOpen(v=>!v)} title="마스터 볼륨" style={{
                width:30,height:30,flexShrink:0,padding:0,fontFamily:"inherit",
                borderRadius:6,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                background:volOpen?AC_DIM:"rgba(255,255,255,0.05)",
                border:volOpen?"1px solid "+AC:(muted?"1px solid #ff3c3c":"1px solid rgba(255,255,255,0.12)"),
                color:muted?"#ff6666":(volOpen?AC:"#998"),
              }}>{muted?<IcoMute size={16}/>:<IcoVolume size={16}/>}</button>
              <button onClick={()=>setSoloMode(s=>!s)} title="Solo 모드" style={{
                width:30,height:30,flexShrink:0,padding:0,fontSize:15,fontWeight:800,fontFamily:"inherit",
                borderRadius:6,cursor:"pointer",lineHeight:1,transition:"all 0.15s",
                background:soloMode?"#4caf72":"rgba(255,255,255,0.05)",
                border:soloMode?"1px solid #4caf72":"1px solid rgba(255,255,255,0.12)",
                color:soloMode?"#0b0f15":"#4caf72",
              }}>S</button>
            </div>
            <button onClick={()=>resetScore(tab)} title="눌러서 점수 초기화" style={{
              background:AC_SOFT,border:"1px solid "+AC_BORDER,borderRadius:10,
              padding:"8px 14px",textAlign:"right",minWidth:74,cursor:"pointer",
              fontFamily:"inherit",color:"inherit",
            }}>
              <div style={{fontSize:10,color:AC,letterSpacing:1}}>SCORE ⟳</div>
              <div style={{fontSize:20,fontWeight:"bold"}}>
                {pts}<span style={{color:"#665",fontSize:12}}>점</span>
              </div>
              <div style={{fontSize:10,color:"#665"}}>{cur.total}/{MAX_Q}문제</div>
            </button>
          </div>
        </div>

        {/* 볼륨 슬라이더 — 볼륨 아이콘 누를 때만 펼침 */}
        {volOpen&&(
          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
            <button onClick={()=>setMuted(m=>!m)} style={{
              padding:"6px 12px",fontSize:13,fontFamily:"inherit",borderRadius:6,
              background:muted?"rgba(255,60,60,0.15)":"rgba(255,255,255,0.05)",
              border:muted?"1px solid #ff3c3c":"1px solid rgba(255,255,255,0.1)",
              color:muted?"#ff6666":"#998",cursor:"pointer",whiteSpace:"nowrap",
            }}>{muted?<IcoMute size={16}/>:<IcoVolume size={16}/>}</button>
            <input type="range" min={0} max={1} step={0.01} value={masterVol}
              onChange={e=>setMasterVol(+e.target.value)}
              style={{flex:1,accentColor:AC,cursor:"pointer"}} />
            <div style={{fontSize:12,color:"#998",minWidth:32,textAlign:"right"}}>{Math.round(masterVol*100)}</div>
          </div>
        )}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {tab==="sine"&&<SineTab addScore={(ok)=>addScore("sine",ok)} resetScore={()=>resetScore("sine")} audio={audio}/>}
        {tab==="eq"&&<EQTab addScore={(ok)=>addScore("eq",ok)} resetScore={()=>resetScore("eq")} audio={audio} sharedFile={sharedFile}/>}
        {tab==="effects"&&<EffectsTab addScore={(ok)=>addScore("effects",ok)} resetScore={()=>resetScore("effects")} audio={audio} sharedFile={sharedFile}/>}
        {tab==="feedback"&&<FeedbackTab addScore={(ok)=>addScore("feedback",ok)} resetScore={()=>resetScore("feedback")} audio={audio} sharedFile={sharedFile}/>}
      </div>

      {/* 카피라이트 */}
      <div style={{textAlign:"center",fontSize:11,color:"#554",padding:"20px 0 8px"}}>
        © 2026 LIVE SOUND EAR TRAINER · YaBa
      </div>

      {/* 하단 탭바 */}
      <div style={S.tabBar}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={S.tabBtn(tab===t.id)}>
            <span style={{fontSize:18}}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
    </ThemeCtx.Provider>
    </SoloCtx.Provider>
  );
}

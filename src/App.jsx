import { useState, useEffect, useRef, useCallback } from "react";

// ─── 테마 색상 (클로드 시그니처 주황) ─────────────────────────────
const AC = "#d97757";          // accent orange
const AC_DIM = "rgba(217,119,87,0.15)";
const AC_BORDER = "rgba(217,119,87,0.5)";
const AC_SOFT = "rgba(217,119,87,0.08)";

// ─── 청음용 이펙터 ────────────────────────────────────────────────
const SOUND_EFFECTS = [
  { name: "리버브 (Reverb)" },
  { name: "딜레이 (Delay)" },
  { name: "디스토션 (Distortion)" },
  { name: "코러스 (Chorus)" },
  { name: "플랜저 (Flanger)" },
  { name: "페이저 (Phaser)" },
  { name: "트레몰로 (Tremolo)" },
  { name: "비브라토 (Vibrato)" },
  { name: "오토패너 (Auto Pan)" },
  { name: "비트크러셔 (Bitcrusher)" },
  { name: "링모듈레이터 (Ring Mod)" },
  { name: "와우 (Wah / Auto-Wah)" },
  { name: "로우패스 필터 (LPF)" },
  { name: "하이패스 필터 (HPF)" },
  { name: "밴드패스 필터 (BPF)" },
  { name: "노치 필터 (Notch)" },
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
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,W,H);
    const freqToX = f => (Math.log10(f/20)/Math.log10(20000/20))*W;
    ctx.strokeStyle="rgba(217,119,87,0.08)"; ctx.lineWidth=1;
    [63,125,250,500,1000,2000,4000,8000,16000].forEach(f=>{
      const x=freqToX(f); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    });
    [-12,-6,0,6,12].forEach(db=>{
      const y=H/2-(db/24)*(H/2-8);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    });
    ctx.strokeStyle="rgba(217,119,87,0.25)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
    ctx.strokeStyle=AC; ctx.lineWidth=2;
    ctx.shadowColor=AC; ctx.shadowBlur=6; ctx.beginPath();
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
    ctx.fillStyle="rgba(217,119,87,0.4)"; ctx.font="9px monospace"; ctx.textAlign="center";
    [{f:125,l:"125"},{f:500,l:"500"},{f:1000,l:"1k"},{f:4000,l:"4k"},{f:8000,l:"8k"}].forEach(({f,l})=>{
      ctx.fillText(l, freqToX(f), H-2);
    });
  }, [bands]);
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
function FRGraph({freqs, selIdx, gain=0, q=3, onPick, height=120, showGain=true}) {
  const ref=useRef(null);
  const draggingRef=useRef(false);

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
    // 세로 칸 그리드
    for(let i=0;i<n;i++){
      ctx.fillStyle = (i===selIdx)? "rgba(217,119,87,0.18)":"rgba(255,255,255,0.02)";
      ctx.fillRect(i*bw,0,bw-1,H);
    }
    // dB 그리드 라인
    ctx.strokeStyle="rgba(217,119,87,0.08)"; ctx.lineWidth=1;
    [-12,-6,0,6,12].forEach(db=>{ const y=H/2-(db/16)*(H/2-8); ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); });
    ctx.strokeStyle="rgba(217,119,87,0.22)"; ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    // 선택 밴드 봉우리 곡선
    if(selIdx!=null){
      const cf=freqs[selIdx];
      ctx.strokeStyle=gain<0?"#ff6666":AC; ctx.lineWidth=2.5; ctx.shadowColor=gain<0?"#ff6666":AC; ctx.shadowBlur=8;
      ctx.beginPath();
      for(let px=0;px<W;px++){
        const bandIdx=Math.floor(px/bw);
        const dist=Math.abs(bandIdx-selIdx);
        const db = gain*Math.exp(-(dist*dist)/(2*(0.8+8/q)));
        const y=H/2-(db/16)*(H/2-8);
        px===0?ctx.moveTo(px,y):ctx.lineTo(px,y);
      }
      ctx.stroke(); ctx.shadowBlur=0;
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
      ctx.fillStyle=AC; ctx.font="bold 18px monospace"; ctx.textAlign="center";
      ctx.fillText(l, W/2, 22);
    }
  },[freqs,selIdx,gain,q]);

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
        width:"100%",padding:"12px 18px",fontSize:13,fontFamily:"inherit",borderRadius:8,
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
  label: { fontSize:10, color:"#776", letterSpacing:2, marginBottom:8 },
  btn: (accent,disabled) => ({
    padding:"12px 18px", fontSize:13, fontFamily:"inherit",
    background: accent?AC_DIM:"rgba(255,255,255,0.06)",
    border: accent?"1px solid "+AC_BORDER:"1px solid rgba(255,255,255,0.1)",
    borderRadius:8, color: accent?AC:"#aa9",
    cursor: disabled?"not-allowed":"pointer",
    opacity: disabled?0.4:1, transition:"all 0.15s", width:"100%", marginBottom:8,
  }),
  result: (ok) => ({
    padding:"12px 16px", borderRadius:8, fontSize:13,
    background: ok?AC_SOFT:"rgba(255,60,60,0.08)",
    border:`1px solid ${ok?AC_BORDER:"rgba(255,60,60,0.3)"}`,
    color: ok?AC:"#ff6666", marginBottom:12,
  }),
  seg: (active)=>({
    flex:1, padding:"8px 4px", fontSize:11, fontFamily:"inherit", borderRadius:6,
    background: active?AC_DIM:"rgba(255,255,255,0.04)",
    border: active?"1px solid "+AC:"1px solid rgba(255,255,255,0.08)",
    color: active?AC:"#776", cursor:"pointer", transition:"all 0.1s",
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
function SineTab({addScore, audio}) {
  const [octMode,setOctMode]=useState("oct"); // oct=1옥타브 third=1/3옥타브
  const [target,setTarget]=useState(null);
  const [guess,setGuess]=useState(null);
  const [result,setResult]=useState(null);
  const [playing,setPlaying]=useState(false);
  const oscRef=useRef(null);

  const freqs = octMode==="oct"?SINE_OCT:SINE_THIRD;

  const stop=()=>{ try{oscRef.current?.stop();}catch(e){} oscRef.current=null; setPlaying(false); };

  // 무한 재생 (문제 재생용). 다시 부르면 토글 정지.
  const playLoop=async(freq)=>{
    if(playing){ stop(); return; }
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const osc=ctx.createOscillator();
    const g=ctx.createGain();
    osc.type="sine"; osc.frequency.value=freq;
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+0.05);
    osc.connect(g); g.connect(audio.getMaster());
    osc.start();
    oscRef.current=osc; setPlaying(true);
  };

  // 짧은 미리듣기 (보기 클릭용). 누르면 기존 재생 정지 후 잠깐 들려줌.
  const preview=async(freq,dur=1.5)=>{
    stop();
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const osc=ctx.createOscillator();
    const g=ctx.createGain();
    osc.type="sine"; osc.frequency.value=freq;
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+0.05);
    g.gain.linearRampToValueAtTime(0,ctx.currentTime+dur-0.05);
    osc.connect(g); g.connect(audio.getMaster());
    osc.start(); osc.stop(ctx.currentTime+dur);
    oscRef.current=osc;
  };

  const newQ=()=>{
    stop();
    setTarget(freqs[Math.floor(Math.random()*freqs.length)]);
    setGuess(null); setResult(null);
  };

  const submit=()=>{
    if(!guess||!target) return;
    const tol = octMode==="oct"?0.42:0.18;
    const ok=Math.abs(Math.log2(guess/target))<tol;
    setResult({ok,target,guess});
    addScore(ok);
  };

  useEffect(()=>{ return stop; },[]);
  useEffect(()=>{ newQ(); },[octMode]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>① 사인파 주파수 맞추기</div>
        <div style={{fontSize:12,color:"#776",marginBottom:10}}>옥타브 간격 선택 후 재생, 주파수를 맞추세요</div>
        <Segmented
          options={[{value:"oct",label:"1옥타브 (10)"},{value:"third",label:"1/3옥타브 (31)"}]}
          value={octMode} onChange={setOctMode}/>
        <Btn accent onClick={()=>target&&playLoop(target)} style={{marginTop:4}}>
          {playing?"■ 재생 정지":"▶ 문제 재생"}
        </Btn>
      </div>

      <div style={S.card}>
        <div style={S.label}>주파수 — 그래프 드래그 또는 슬라이더로 선택</div>
        <FRGraph freqs={freqs} selIdx={guess==null?null:freqs.indexOf(guess)} gain={guess!=null?10:0} q={6}
          onPick={(i)=>{ const f=freqs[i]; setGuess(f); }}
          height={140}/>
        <FreqSlider freqs={freqs} idx={guess==null?null:freqs.indexOf(guess)}
          onChange={(i)=>{ const f=freqs[i]; setGuess(f); }}/>
        <div style={{fontSize:15,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
          {guess==null?"대역 미선택":fmtFreq(guess)}
        </div>
      </div>

      {result&&(
        <div style={S.result(result.ok)}>
          {result.ok?"✓ 정답!":"✗ 오답."}
          {" 정답: "}<strong>{fmtFreq(result.target)}</strong>
          {!result.ok&&<> | 선택: {fmtFreq(result.guess)}</>}
        </div>
      )}
      {!result
        ? <Btn accent onClick={submit} disabled={!guess}>정답 제출</Btn>
        : <Btn accent onClick={newQ}>다음 문제 →</Btn>}
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
  const idx = Math.floor(Math.random()*freqs.length);
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
  return (
    <div style={S.card}>
      <div style={S.label}>밴드</div>
      <Segmented options={[{value:10,label:"10밴드"},{value:31,label:"31밴드"}]} value={bandSet} onChange={setBandSet}/>
      <div style={S.label}>모드</div>
      <Segmented options={[{value:"boost",label:"부스트"},{value:"cut",label:"컷"},{value:"all",label:"All"}]} value={mode} onChange={setMode}/>
      <div style={S.label}>난이도</div>
      <Segmented options={[{value:"easy",label:"Easy"},{value:"normal",label:"Normal"},{value:"hard",label:"Hard"},{value:"extra",label:"X-Hard"}]} value={diff} onChange={setDiff}/>
      <div style={{...S.label,marginTop:8}}>Q 팩터: <span style={{color:AC}}>{qVal.toFixed(1)}</span></div>
      <input type="range" min={0.5} max={10} step={0.1} value={qVal}
        onChange={e=>setQVal(+e.target.value)}
        style={{width:"100%",accentColor:AC,cursor:"pointer"}} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ② 핑크노이즈 EQ
// ════════════════════════════════════════════════════════════════
function PinkNoiseTab({addScore, audio}) {
  const [bandSet,setBandSet]=useState(10);
  const [mode,setMode]=useState("boost");
  const [diff,setDiff]=useState("easy");
  const [qVal,setQVal]=useState(3.0);
  const [qBands,setQBands]=useState(null);
  const [userIdx,setUserIdx]=useState(null);   // 선택 밴드 인덱스
  const [userGain,setUserGain]=useState(0);     // 선택 dB
  const [playing,setPlaying]=useState(false);
  const [result,setResult]=useState(null);
  const srcRef=useRef(null);
  const bufRef=useRef(null); // 핑크노이즈 버퍼 (원본/문제 동일 소스)

  const freqs = bandSet===10?EQ_10:EQ_31;

  const stopAudio=()=>{try{srcRef.current?.stop();}catch(e){}srcRef.current=null;setPlaying(false);};

  const play=async(bands)=>{
    stopAudio();
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    if(!bufRef.current) bufRef.current=createPinkNoiseBuffer(ctx);
    const src=ctx.createBufferSource();
    src.buffer=bufRef.current; src.loop=true;
    let prev=src;
    bands.forEach(({freq,gain,q=3})=>{
      if(gain===0) return;
      const f=ctx.createBiquadFilter();
      f.type="peaking"; f.frequency.value=freq; f.gain.value=gain; f.Q.value=q;
      prev.connect(f); prev=f;
    });
    const g=ctx.createGain(); g.gain.value=0.5;
    prev.connect(g); g.connect(audio.getMaster());
    src.start(); srcRef.current=src; setPlaying(true);
  };

  // 문제 재생 토글
  const togglePlay=()=>{ if(playing) stopAudio(); else play(qBands); };
  // 원본 — 누르고 있는 동안만. 누르기 전 문제 재생 중이었으면 떼고 나서 복귀
  const wasPlayingRef=useRef(false);
  const holdStart=()=>{ wasPlayingRef.current=playing; play([{freq:1000,gain:0}]); };
  const holdEnd=()=>{ if(wasPlayingRef.current){ play(qBands); } else { stopAudio(); } };

  const newQ=()=>{
    bufRef.current=null; // 새 노이즈
    setQBands(makeEqQuestion(freqs,diff,mode,qVal));
    setUserIdx(null); setUserGain(0);
    setResult(null); stopAudio();
  };

  const submit=()=>{
    if(!qBands||userIdx==null) return;
    const ans=qBands[0];
    const ansIdx=freqs.indexOf(ans.freq);
    const freqOk = userIdx===ansIdx;
    const gainErr = Math.abs(userGain-ans.gain);
    const tol = diff==="hard"||diff==="extra"?3:4;
    const ok = freqOk && gainErr<=tol;
    setResult({ok,freqOk,gainErr,answer:ans});
    addScore(ok); stopAudio();
  };

  useEffect(()=>{ return ()=>stopAudio(); },[]);
  // 옵션이 바뀌면 자동으로 새 문제 생성 (수동 버튼 불필요)
  useEffect(()=>{ newQ(); },[bandSet,mode,diff,qVal]);

  const curGain = userIdx==null?0:userGain;

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>② 핑크노이즈 EQ 맞추기</div>
        <div style={{fontSize:12,color:"#776"}}>옵션을 바꾸면 자동으로 새 문제가 나옵니다</div>
      </div>

      <EqOptions {...{bandSet,setBandSet,mode,setMode,diff,setDiff,qVal,setQVal}}/>

      {qBands&&(
        <>
          <div style={S.card}>
            <Btn accent onClick={togglePlay} style={{marginBottom:8}}>
              {playing?"■ 재생 정지":"▶ 문제 재생"}
            </Btn>
            <HoldButton onStart={holdStart} onEnd={holdEnd}>원본</HoldButton>
          </div>

          <div style={S.card}>
            <div style={S.label}>① 주파수 — 그래프 드래그 또는 슬라이더</div>
            <FRGraph freqs={freqs} selIdx={userIdx} gain={curGain} q={qVal}
              onPick={(i)=>{ setUserIdx(i); setUserGain(autoGainOnPick(mode,diff)); }}
              height={140}/>
            <FreqSlider freqs={freqs} idx={userIdx}
              onChange={(i)=>{ setUserIdx(i); setUserGain(autoGainOnPick(mode,diff)); }}/>
            <div style={{fontSize:13,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
              {userIdx==null?"대역 미선택":`${fmtFreq(freqs[userIdx])}  ${userGain>0?"+":""}${userGain}dB`}
            </div>
          </div>

          {levelStepsFor(mode,diff)&&(
            <div style={S.card}>
              <div style={S.label}>② 레벨 — dB 선택</div>
              <LevelStep value={userGain} onChange={setUserGain} mode={mode} diff={diff}/>
            </div>
          )}

          {result&&(
            <div style={S.result(result.ok)}>
              {result.ok?"✓ 정답!":"✗ 오답."}
              {!result.ok&&<span style={{fontSize:11}}> {result.freqOk?"주파수 맞음":"주파수 틀림"} · 레벨오차 {result.gainErr}dB</span>}
              <div style={{marginTop:6,fontSize:12}}>
                정답: {result.answer.freq>=1000?`${result.answer.freq/1000}kHz`:`${result.answer.freq}Hz`} {result.answer.gain>0?"+":""}{result.answer.gain}dB
              </div>
            </div>
          )}
          {!result
            ? <Btn accent onClick={submit} disabled={userIdx==null}>정답 제출</Btn>
            : <Btn accent onClick={newQ}>다음 문제 →</Btn>}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ③ 음원 EQ (공유 파일 사용)
// ════════════════════════════════════════════════════════════════
function MusicEQTab({addScore, audio, sharedFile}) {
  const [bandSet,setBandSet]=useState(10);
  const [mode,setMode]=useState("boost");
  const [diff,setDiff]=useState("easy");
  const [qVal,setQVal]=useState(3.0);
  const [qBands,setQBands]=useState(null);
  const [userIdx,setUserIdx]=useState(null);
  const [userGain,setUserGain]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [result,setResult]=useState(null);
  const srcRef=useRef(null);

  const freqs = bandSet===10?EQ_10:EQ_31;
  const file = sharedFile.file;

  const stopAudio=()=>{try{srcRef.current?.stop();}catch(e){}srcRef.current=null;setPlaying(false);};

  const play=async(bands)=>{
    stopAudio();
    if(!file||!file.buffer) return;
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const src=ctx.createBufferSource();
    src.buffer=file.buffer; src.loop=true;
    let prev=src;
    bands.forEach(({freq,gain,q=3})=>{
      if(gain===0) return;
      const f=ctx.createBiquadFilter();
      f.type="peaking"; f.frequency.value=freq; f.gain.value=gain; f.Q.value=q;
      prev.connect(f); prev=f;
    });
    const g=ctx.createGain(); g.gain.value=0.8;
    prev.connect(g); g.connect(audio.getMaster());
    src.start(); srcRef.current=src; setPlaying(true);
  };

  const togglePlay=()=>{ if(playing) stopAudio(); else play(qBands); };
  const wasPlayingRef=useRef(false);
  const holdStart=()=>{ wasPlayingRef.current=playing; play([{freq:1000,gain:0}]); };
  const holdEnd=()=>{ if(wasPlayingRef.current){ play(qBands); } else { stopAudio(); } };

  const newQ=()=>{
    if(!file||!file.buffer) return;
    setQBands(makeEqQuestion(freqs,diff,mode,qVal));
    setUserIdx(null); setUserGain(0);
    setResult(null); stopAudio();
  };

  const submit=()=>{
    if(!qBands||userIdx==null) return;
    const ans=qBands[0];
    const ansIdx=freqs.indexOf(ans.freq);
    const freqOk=userIdx===ansIdx;
    const gainErr=Math.abs(userGain-ans.gain);
    const tol=diff==="hard"||diff==="extra"?3:4;
    const ok=freqOk&&gainErr<=tol;
    setResult({ok,freqOk,gainErr,answer:ans});
    addScore(ok); stopAudio();
  };

  useEffect(()=>{ return ()=>stopAudio(); },[]);
  // 파일 준비됐거나 옵션 바뀌면 자동으로 새 문제
  useEffect(()=>{ if(file&&file.buffer) newQ(); },[bandSet,mode,diff,qVal,file]);

  const curGain = userIdx==null?0:userGain;

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>③ 음원 EQ 맞추기</div>
        <FileUploader sharedFile={sharedFile} audio={audio}/>
      </div>

      {file&&file.buffer&&(
        <EqOptions {...{bandSet,setBandSet,mode,setMode,diff,setDiff,qVal,setQVal}}/>
      )}

      {qBands&&(
        <>
          <div style={S.card}>
            <Btn accent onClick={togglePlay} style={{marginBottom:8}}>
              {playing?"■ 재생 정지":"▶ 문제 재생"}
            </Btn>
            <HoldButton onStart={holdStart} onEnd={holdEnd}>원본</HoldButton>
          </div>

          <div style={S.card}>
            <div style={S.label}>① 주파수 — 그래프 드래그 또는 슬라이더</div>
            <FRGraph freqs={freqs} selIdx={userIdx} gain={curGain} q={qVal}
              onPick={(i)=>{ setUserIdx(i); setUserGain(autoGainOnPick(mode,diff)); }}
              height={140}/>
            <FreqSlider freqs={freqs} idx={userIdx}
              onChange={(i)=>{ setUserIdx(i); setUserGain(autoGainOnPick(mode,diff)); }}/>
            <div style={{fontSize:13,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
              {userIdx==null?"대역 미선택":`${fmtFreq(freqs[userIdx])}  ${userGain>0?"+":""}${userGain}dB`}
            </div>
          </div>

          {levelStepsFor(mode,diff)&&(
            <div style={S.card}>
              <div style={S.label}>② 레벨 — dB 선택</div>
              <LevelStep value={userGain} onChange={setUserGain} mode={mode} diff={diff}/>
            </div>
          )}

          {result&&(
            <div style={S.result(result.ok)}>
              {result.ok?"✓ 정답!":"✗ 오답."}
              {!result.ok&&<span style={{fontSize:11}}> {result.freqOk?"주파수 맞음":"주파수 틀림"} · 레벨오차 {result.gainErr}dB</span>}
              <div style={{marginTop:6,fontSize:12}}>
                정답: {result.answer.freq>=1000?`${result.answer.freq/1000}kHz`:`${result.answer.freq}Hz`} {result.answer.gain>0?"+":""}{result.answer.gain}dB
              </div>
            </div>
          )}
          {!result
            ? <Btn accent onClick={submit} disabled={userIdx==null}>정답 제출</Btn>
            : <Btn accent onClick={newQ}>다음 문제 →</Btn>}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ④ 이펙터 청음 (공유 파일 사용)
// ════════════════════════════════════════════════════════════════
function EffectsTab({addScore, audio, sharedFile}) {
  const [q,setQ]=useState(null);
  const [choices,setChoices]=useState([]);
  const [selected,setSelected]=useState(null);
  const [playing,setPlaying]=useState(false);
  const srcRef=useRef(null);
  const file = sharedFile.file;

  const stopAudio=()=>{try{srcRef.current?.stop();}catch(e){}srcRef.current=null;setPlaying(false);};

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
    if(!file||!file.buffer) return;
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const src=ctx.createBufferSource();
    src.buffer=file.buffer; src.loop=true;
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
    src.start(); srcRef.current=src; setPlaying(true);
  };

  const newQ=()=>{
    const item=SOUND_EFFECTS[Math.floor(Math.random()*SOUND_EFFECTS.length)];
    const wrong=SOUND_EFFECTS.filter(e=>e.name!==item.name).sort(()=>Math.random()-0.5).slice(0,3);
    setChoices([item,...wrong].sort(()=>Math.random()-0.5));
    setQ(item); setSelected(null); stopAudio();
  };

  const select=(c)=>{ if(selected) return; setSelected(c); addScore(c.name===q.name); stopAudio(); };

  useEffect(()=>{ return ()=>stopAudio(); },[]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>④ 이펙터 청음 맞추기</div>
        <div style={{fontSize:12,color:"#776",marginBottom:12}}>걸린 이펙터를 듣고 맞추세요. 원본과 비교해보세요.</div>
        <FileUploader sharedFile={sharedFile} audio={audio}/>
        {file&&file.buffer&&<Btn accent onClick={newQ} style={{marginTop:8}}>문제 생성</Btn>}
      </div>

      {q&&(
        <>
          <div style={S.card}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Btn accent onClick={()=>playWithEffect(q.name)} disabled={playing} style={{marginBottom:0}}>▶ 이펙터 소리</Btn>
              <Btn onClick={()=>playWithEffect(null)} disabled={playing} style={{marginBottom:0}}>▶ 원본</Btn>
            </div>
            <Btn onClick={stopAudio} disabled={!playing}>■ 정지</Btn>
            {playing&&<div style={{fontSize:11,color:AC}}>◉ 재생 중</div>}
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

          {selected&&(
            <div style={S.result(selected.name===q.name)}>
              {selected.name===q.name?"✓ 정답!":"✗ 오답. 정답: "+q.name}
            </div>
          )}
          {selected&&<Btn accent onClick={newQ}>다음 문제 →</Btn>}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ⑤ 피드백(하울링) 트레이너 — 점점 커지는 링잉 재현
// ════════════════════════════════════════════════════════════════
function FeedbackTab({addScore, audio}) {
  const [bandSet,setBandSet]=useState(31); // 피드백은 정밀하게 31밴드 기본
  const [target,setTarget]=useState(null); // 정답 주파수
  const [userIdx,setUserIdx]=useState(null);
  const [running,setRunning]=useState(false);
  const [result,setResult]=useState(null);
  const srcRef=useRef(null);
  const nodesRef=useRef([]);
  const bufRef=useRef(null);
  const rampRef=useRef(null);

  const freqs = bandSet===10?EQ_10:EQ_31;

  const stopAudio=()=>{
    if(rampRef.current){ clearInterval(rampRef.current); rampRef.current=null; }
    try{srcRef.current?.stop();}catch(e){}
    srcRef.current=null; nodesRef.current=[]; setRunning(false);
  };

  // 배경 핑크노이즈 + 정답 주파수 피크필터를 서서히 키워 하울링 재현
  const start=async(freq)=>{
    stopAudio();
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    if(!bufRef.current) bufRef.current=createPinkNoiseBuffer(ctx);
    const src=ctx.createBufferSource();
    src.buffer=bufRef.current; src.loop=true;

    // 하울링 피크 (아주 좁은 Q, 게인 0에서 시작)
    const peak=ctx.createBiquadFilter();
    peak.type="peaking"; peak.frequency.value=freq; peak.Q.value=18; peak.gain.value=0;
    // 배경은 살짝 줄이고, 피드백 강조
    const bg=ctx.createGain(); bg.gain.value=0.35;

    src.connect(bg); bg.connect(peak);
    const g=ctx.createGain(); g.gain.value=0.5;
    peak.connect(g); g.connect(audio.getMaster());
    src.start();
    srcRef.current=src; nodesRef.current=[peak];

    // 게인을 0 → 점점 키워서 하울링이 "올라오는" 느낌
    let db=0;
    rampRef.current=setInterval(()=>{
      db+=1.2;
      if(db>30) db=30; // 상한
      try{ peak.gain.value=db; }catch(e){}
    },120);
    setRunning(true);
  };

  const newRound=()=>{
    const f=freqs[Math.floor(Math.random()*freqs.length)];
    setTarget(f); setUserIdx(null); setResult(null);
    bufRef.current=null; stopAudio();
  };

  const submit=()=>{
    if(target==null||userIdx==null) return;
    const ansIdx=freqs.indexOf(target);
    // 인접 1밴드까지 정답 인정 (현장에서도 근처면 잡음)
    const ok=Math.abs(userIdx-ansIdx)<=1;
    setResult({ok,exact:userIdx===ansIdx,answer:target});
    addScore(ok); stopAudio();
  };

  useEffect(()=>{ return ()=>stopAudio(); },[]);
  useEffect(()=>{ newRound(); },[bandSet]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>⑤ 피드백(하울링) 주파수 찾기</div>
        <div style={{fontSize:12,color:"#776"}}>재생하면 특정 대역이 점점 울립니다. 어느 주파수인지 찾으세요</div>
      </div>

      <div style={S.card}>
        <div style={S.label}>밴드</div>
        <Segmented options={[{value:10,label:"10밴드"},{value:31,label:"31밴드"}]} value={bandSet} onChange={setBandSet}/>
      </div>

      <div style={S.card}>
        <Btn accent onClick={()=>running?stopAudio():start(target)} style={{marginBottom:8}}>
          {running?"■ 정지":"▶ 하울링 재생"}
        </Btn>
        <Btn onClick={newRound}>새 라운드 (다른 주파수)</Btn>
        {running&&<div style={{fontSize:11,color:"#ff6666",marginTop:4}}>◉ 하울링 상승 중... 빨리 찾아서 정지!</div>}
      </div>

      <div style={S.card}>
        <div style={S.label}>울리는 대역 — 그래프 드래그 또는 슬라이더</div>
        <FRGraph freqs={freqs} selIdx={userIdx} gain={userIdx==null?0:12} q={18}
          onPick={(i)=>setUserIdx(i)} height={140}/>
        <FreqSlider freqs={freqs} idx={userIdx} onChange={(i)=>setUserIdx(i)}/>
        <div style={{fontSize:15,color:AC,textAlign:"center",marginTop:6,fontWeight:"bold"}}>
          {userIdx==null?"대역 미선택":fmtFreq(freqs[userIdx])}
        </div>
      </div>

      {result&&(
        <div style={S.result(result.ok)}>
          {result.ok?(result.exact?"✓ 정확히 맞춤!":"✓ 정답! (인접 대역 허용)"):"✗ 오답."}
          <div style={{marginTop:6,fontSize:12}}>정답: {fmtFreq(result.answer)}</div>
        </div>
      )}
      {!result
        ? <Btn accent onClick={submit} disabled={userIdx==null}>정답 제출</Btn>
        : <Btn accent onClick={newRound}>다음 라운드 →</Btn>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 공유 파일 업로더 (로딩바 포함)
// ════════════════════════════════════════════════════════════════
function FileUploader({sharedFile, audio}) {
  const {file,setFile}=sharedFile;
  const [progress,setProgress]=useState(0);

  const handleFile=async(e)=>{
    const f=e.target.files[0];
    if(!f) return;
    setFile({name:f.name,buffer:null,loading:true});
    setProgress(0);
    try{
      // 진행률 표시용 ProgressEvent 리더
      const ab = await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onprogress=(ev)=>{ if(ev.lengthComputable) setProgress(Math.round(ev.loaded/ev.total*100)); };
        reader.onload=()=>{ setProgress(100); resolve(reader.result); };
        reader.onerror=()=>reject(reader.error);
        reader.readAsArrayBuffer(f);
      });
      const ctx=audio.getCtx();
      if(ctx.state==="suspended") await ctx.resume();
      const buffer=await ctx.decodeAudioData(ab);
      setFile({name:f.name,buffer,loading:false});
    }catch(err){
      setFile({name:f.name,buffer:null,loading:false,error:true});
    }
  };

  return (
    <div>
      <label style={{
        display:"block",padding:"16px",textAlign:"center",
        background:AC_SOFT,border:"1px dashed "+AC_BORDER,
        borderRadius:8,cursor:"pointer",fontSize:13,
      }}>
        📁 음원 업로드 (MP3 / WAV / M4A)
        <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          onChange={handleFile} style={{display:"none"}} />
      </label>

      {file&&file.loading&&(
        <div style={{marginTop:10}}>
          <div style={{fontSize:11,color:"#cc9",marginBottom:4}}>⏳ 불러오는 중... {progress}%</div>
          <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:progress+"%",background:AC,transition:"width 0.1s"}}/>
          </div>
        </div>
      )}
      {file&&file.error&&<div style={{fontSize:12,color:"#ff6666",marginTop:8}}>✗ 재생 불가. 다른 음원(MP3/WAV)을 써보세요.</div>}
      {file&&file.buffer&&<div style={{fontSize:12,color:AC,marginTop:8}}>✓ {file.name} <span style={{color:"#665",fontSize:10}}>(모든 탭 공유)</span></div>}
      {!file&&<div style={{fontSize:11,color:"#443",marginTop:8}}>저작권 없는 음원을 사용하세요</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 메인 앱
// ════════════════════════════════════════════════════════════════
const TABS=[
  {id:"sine",icon:"〜",label:"사인파"},
  {id:"pink",icon:"⋯",label:"노이즈EQ"},
  {id:"music",icon:"♫",label:"음원EQ"},
  {id:"effects",icon:"◈",label:"이펙터"},
  {id:"feedback",icon:"◭",label:"피드백"},
];

export default function App() {
  const [tab,setTab]=useState("sine");
  const [score,setScore]=useState({ok:0,total:0});
  const [masterVol,setMasterVol]=useState(0.8);
  const [muted,setMuted]=useState(false);
  const [file,setFile]=useState(null); // 공유 파일 (앱 최상위)

  const audio = useMaster(masterVol, muted);
  const addScore=(ok)=>setScore(s=>({ok:s.ok+(ok?1:0),total:s.total+1}));
  const sharedFile={file,setFile};

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:9,color:AC,letterSpacing:3,marginBottom:2}}>EAR TRAINING</div>
            <div style={{fontSize:18,fontWeight:"bold",letterSpacing:1}}>STAGE AUDIO TRAINER</div>
          </div>
          <div style={{
            background:AC_SOFT,border:"1px solid "+AC_BORDER,borderRadius:10,
            padding:"8px 14px",textAlign:"right",
          }}>
            <div style={{fontSize:9,color:AC,letterSpacing:1}}>SCORE</div>
            <div style={{fontSize:16,fontWeight:"bold"}}>
              {score.ok}<span style={{color:"#443",fontSize:11}}> / {score.total}</span>
            </div>
            {score.total>0&&<div style={{fontSize:9,color:"#665"}}>{Math.round(score.ok/score.total*100)}%</div>}
          </div>
        </div>

        {/* 마스터 페이더 + 뮤트 */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setMuted(m=>!m)} style={{
            padding:"6px 12px",fontSize:11,fontFamily:"inherit",borderRadius:6,
            background:muted?"rgba(255,60,60,0.15)":"rgba(255,255,255,0.05)",
            border:muted?"1px solid #ff3c3c":"1px solid rgba(255,255,255,0.1)",
            color:muted?"#ff6666":"#998",cursor:"pointer",whiteSpace:"nowrap",
          }}>{muted?"🔇 MUTE":"🔊 ON"}</button>
          <input type="range" min={0} max={1} step={0.01} value={masterVol}
            onChange={e=>setMasterVol(+e.target.value)}
            style={{flex:1,accentColor:AC,cursor:"pointer"}} />
          <div style={{fontSize:10,color:"#776",minWidth:32,textAlign:"right"}}>{Math.round(masterVol*100)}</div>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {tab==="sine"&&<SineTab addScore={addScore} audio={audio}/>}
        {tab==="pink"&&<PinkNoiseTab addScore={addScore} audio={audio}/>}
        {tab==="music"&&<MusicEQTab addScore={addScore} audio={audio} sharedFile={sharedFile}/>}
        {tab==="effects"&&<EffectsTab addScore={addScore} audio={audio} sharedFile={sharedFile}/>}
        {tab==="feedback"&&<FeedbackTab addScore={addScore} audio={audio}/>}
      </div>

      {/* 카피라이트 */}
      <div style={{textAlign:"center",fontSize:10,color:"#443",padding:"20px 0 8px"}}>
        © 2026 STAGE AUDIO TRAINER · YaBa
      </div>

      {/* 하단 탭바 */}
      <div style={S.tabBar}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={S.tabBtn(tab===t.id)}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

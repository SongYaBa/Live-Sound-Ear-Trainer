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
  { name: "트레몰로 (Tremolo)" },
  { name: "로우패스 필터 (LPF)" },
  { name: "하이패스 필터 (HPF)" },
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
    flex:1, padding:"10px 4px 12px", border:"none", background:"none",
    color: active?AC:"#665", fontFamily:"inherit", fontSize:10, cursor:"pointer",
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
        <div style={S.label}>주파수 선택 (클릭 시 미리듣기)</div>
        <div style={{display:"grid",gridTemplateColumns:octMode==="oct"?"1fr 1fr":"1fr 1fr 1fr",gap:6}}>
          {freqs.map(f=>{
            const sel=guess===f;
            return (
              <button key={f} onClick={()=>{setGuess(f);preview(f);setPlaying(false);}} style={{
                padding:octMode==="oct"?"14px 8px":"10px 4px", borderRadius:8, fontFamily:"inherit",
                fontSize:octMode==="oct"?14:11, fontWeight:sel?"bold":"normal",
                background:sel?AC_DIM:"rgba(255,255,255,0.04)",
                border:sel?"1px solid "+AC:"1px solid rgba(255,255,255,0.1)",
                color:sel?AC:"#aa9", cursor:"pointer", transition:"all 0.1s",
              }}>{fmtFreq(f)}</button>
            );
          })}
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
  // mode: "boost" | "cut" | "all"
  const n = Math.floor(Math.random()*2)+1; // 1~2밴드
  const bands=[]; const used=new Set();
  const gains = snapGains(diffKey);
  for(let i=0;i<n;i++){
    let idx; do{idx=Math.floor(Math.random()*freqs.length);}while(used.has(idx));
    used.add(idx);
    const gainAbs = gains[Math.floor(Math.random()*gains.length)];
    const q = diffKey==="extra" ? [1,2,3,5,8][Math.floor(Math.random()*5)] : userQ;
    let sign;
    if(mode==="boost") sign=1;
    else if(mode==="cut") sign=-1;
    else sign = Math.random()<0.5?1:-1;
    bands.push({freq:freqs[idx], gain:sign*gainAbs, q});
  }
  return bands;
}

// ════════════════════════════════════════════════════════════════
// EQ 슬라이더 그룹 (밴드 수에 따라 3줄 분할)
// snapVal: 난이도별 게인 절댓값 (easy12/normal6/hard3), extra는 null
// mode: boost/cut/all → 슬라이더 클릭 시 자동으로 채워줄 부호 결정
// ════════════════════════════════════════════════════════════════
function EqSliders({userBands, setUserBands, rows=1, snapVal, mode}) {
  const fLabel=f=>f>=1000?`${f/1000}k`:`${f}`;
  const perRow = Math.ceil(userBands.length/rows);
  const chunks=[];
  for(let i=0;i<userBands.length;i+=perRow) chunks.push(userBands.slice(i,i+perRow));

  // 밴드 클릭(탭) 시 난이도 값으로 자동 설정. all이면 +/- 토글.
  const handleTap=(gi,cur)=>{
    if(snapVal==null) return; // extra는 수동
    setUserBands(prev=>prev.map((x,j)=>{
      if(j!==gi) return x;
      let next;
      if(mode==="boost") next = (cur===snapVal?0:snapVal);
      else if(mode==="cut") next = (cur===-snapVal?0:-snapVal);
      else { // all: 0 → +snap → -snap → 0 순환
        if(cur===0) next=snapVal;
        else if(cur===snapVal) next=-snapVal;
        else next=0;
      }
      return {...x,gain:next};
    }));
  };

  return (
    <>
      {chunks.map((chunk,ci)=>(
        <div key={ci} style={{display:"flex",justifyContent:"space-around",marginBottom:10,gap:2}}>
          {chunk.map((b)=>{
            const gi=userBands.indexOf(b);
            return (
              <div key={b.freq} onClick={()=>handleTap(gi,b.gain)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1,minWidth:0,cursor:snapVal!=null?"pointer":"default"}}>
                <div style={{fontSize:8,color:b.gain>0?AC:b.gain<0?"#f66":"#554",minWidth:20,textAlign:"center"}}>
                  {b.gain>0?`+${b.gain}`:b.gain}
                </div>
                <input type="range" min={-12} max={12} step={1} value={b.gain}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>setUserBands(prev=>prev.map((x,j)=>j===gi?{...x,gain:+e.target.value}:x))}
                  style={{writingMode:"vertical-lr",direction:"rtl",height:90,accentColor:AC,cursor:"pointer",width:14}} />
                <div style={{fontSize:7,color:"#665"}}>{fLabel(b.freq)}</div>
              </div>
            );
          })}
        </div>
      ))}
      {snapVal!=null&&(
        <div style={{fontSize:9,color:"#665",textAlign:"center",marginTop:2}}>
          {mode==="all"?`밴드 탭: 0 → +${snapVal} → -${snapVal} 순환`:`밴드 탭: ${mode==="cut"?"-":"+"}${snapVal}dB 자동 / 슬라이더로 미세조정`}
        </div>
      )}
    </>
  );
}

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
  const [mode,setMode]=useState("all");
  const [diff,setDiff]=useState("normal");
  const [qVal,setQVal]=useState(3.0);
  const [qBands,setQBands]=useState(null);
  const [userBands,setUserBands]=useState([]);
  const [playing,setPlaying]=useState(false);
  const [result,setResult]=useState(null);
  const srcRef=useRef(null);

  const freqs = bandSet===10?EQ_10:EQ_31;

  const stopAudio=()=>{try{srcRef.current?.stop();}catch(e){}srcRef.current=null;setPlaying(false);};

  const playNoise=async(bands)=>{
    stopAudio();
    const ctx=audio.getCtx();
    if(ctx.state==="suspended") await ctx.resume();
    const buf=createPinkNoiseBuffer(ctx);
    const src=ctx.createBufferSource();
    src.buffer=buf; src.loop=true;
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

  const newQ=()=>{
    const bands=makeEqQuestion(freqs,diff,mode,qVal);
    setQBands(bands);
    setUserBands(freqs.map(f=>({freq:f,gain:0})));
    setResult(null); stopAudio();
  };

  const submit=()=>{
    if(!qBands) return;
    let err=0;
    qBands.forEach(qb=>{
      const ub=userBands.find(b=>b.freq===qb.freq);
      err+=Math.abs((ub?.gain||0)-qb.gain);
    });
    const avg=err/qBands.length;
    const tol = diff==="hard"||diff==="extra"?3:4;
    const ok=avg<=tol;
    setResult({ok,avg:avg.toFixed(1),answer:qBands});
    addScore(ok); stopAudio();
  };

  // ⭐ 탭 떠날 때 반드시 정지 (버그 수정)
  useEffect(()=>{ return ()=>stopAudio(); },[]);
  useEffect(()=>{ stopAudio(); setQBands(null); setResult(null); },[bandSet]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>② 핑크노이즈 EQ 맞추기</div>
        <div style={{fontSize:12,color:"#776"}}>옵션 선택 후 문제를 생성하세요</div>
      </div>

      <EqOptions {...{bandSet,setBandSet,mode,setMode,diff,setDiff,qVal,setQVal}}/>

      <Btn accent onClick={newQ}>새 문제 생성</Btn>

      {qBands&&(
        <>
          <div style={S.card}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Btn accent onClick={()=>playNoise(qBands)} disabled={playing} style={{marginBottom:0}}>▶ 문제 재생</Btn>
              <Btn onClick={()=>playNoise([{freq:1000,gain:0}])} disabled={playing} style={{marginBottom:0}}>▶ 원본 (Flat)</Btn>
            </div>
            <Btn onClick={stopAudio} disabled={!playing}>■ 정지</Btn>
            {playing&&<div style={{fontSize:11,color:AC}}>◉ 재생 중</div>}
          </div>

          <div style={S.card}>
            <div style={S.label}>EQ 설정 ({bandSet}밴드)</div>
            <EqSliders userBands={userBands} setUserBands={setUserBands} rows={bandSet===31?3:1} snapVal={diff==="extra"?null:DIFFICULTY[diff].gainAbs} mode={mode}/>
            <EQCanvas bands={userBands} height={80}/>
          </div>

          {result&&(
            <div style={S.result(result.ok)}>
              {result.ok?"✓ 정답!":"✗ 오답."} 평균 오차 {result.avg}dB
              <div style={{marginTop:6,fontSize:12}}>
                정답: {result.answer.map(b=>`${b.freq>=1000?`${b.freq/1000}kHz`:`${b.freq}Hz`} ${b.gain>0?"+":""}${b.gain}dB`).join(" / ")}
              </div>
            </div>
          )}
          {!result
            ? <Btn accent onClick={submit}>정답 제출</Btn>
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
  const [mode,setMode]=useState("all");
  const [diff,setDiff]=useState("normal");
  const [qVal,setQVal]=useState(3.0);
  const [qBands,setQBands]=useState(null);
  const [userBands,setUserBands]=useState([]);
  const [playing,setPlaying]=useState(false);
  const [result,setResult]=useState(null);
  const srcRef=useRef(null);

  const freqs = bandSet===10?EQ_10:EQ_31;
  const file = sharedFile.file;

  const stopAudio=()=>{try{srcRef.current?.stop();}catch(e){}srcRef.current=null;setPlaying(false);};

  const playAudio=async(bands)=>{
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

  const newQ=()=>{
    if(!file||!file.buffer) return;
    setQBands(makeEqQuestion(freqs,diff,mode,qVal));
    setUserBands(freqs.map(f=>({freq:f,gain:0})));
    setResult(null); stopAudio();
  };

  const submit=()=>{
    if(!qBands) return;
    let err=0;
    qBands.forEach(qb=>{
      const ub=userBands.find(b=>b.freq===qb.freq);
      err+=Math.abs((ub?.gain||0)-qb.gain);
    });
    const avg=err/qBands.length;
    const tol = diff==="hard"||diff==="extra"?3:4;
    const ok=avg<=tol;
    setResult({ok,avg:avg.toFixed(1),answer:qBands});
    addScore(ok); stopAudio();
  };

  useEffect(()=>{ return ()=>stopAudio(); },[]);
  useEffect(()=>{ stopAudio(); setQBands(null); setResult(null); },[bandSet]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>③ 음원 EQ 맞추기</div>
        <FileUploader sharedFile={sharedFile} audio={audio}/>
      </div>

      {file&&file.buffer&&(
        <>
          <EqOptions {...{bandSet,setBandSet,mode,setMode,diff,setDiff,qVal,setQVal}}/>
          <Btn accent onClick={newQ}>새 문제 생성</Btn>
        </>
      )}

      {qBands&&(
        <>
          <div style={S.card}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Btn accent onClick={()=>playAudio(qBands)} disabled={playing} style={{marginBottom:0}}>▶ 문제 재생</Btn>
              <Btn onClick={()=>playAudio([{freq:1000,gain:0}])} disabled={playing} style={{marginBottom:0}}>▶ 원본</Btn>
            </div>
            <Btn onClick={stopAudio} disabled={!playing}>■ 정지</Btn>
            {playing&&<div style={{fontSize:11,color:AC}}>◉ 재생 중</div>}
          </div>

          <div style={S.card}>
            <div style={S.label}>EQ 설정 ({bandSet}밴드)</div>
            <EqSliders userBands={userBands} setUserBands={setUserBands} rows={bandSet===31?3:1} snapVal={diff==="extra"?null:DIFFICULTY[diff].gainAbs} mode={mode}/>
            <EQCanvas bands={userBands} height={80}/>
          </div>

          {result&&(
            <div style={S.result(result.ok)}>
              {result.ok?"✓ 정답!":"✗ 오답."} 평균 오차 {result.avg}dB
              <div style={{marginTop:6,fontSize:12}}>
                정답: {result.answer.map(b=>`${b.freq>=1000?`${b.freq/1000}kHz`:`${b.freq}Hz`} ${b.gain>0?"+":""}${b.gain}dB`).join(" / ")}
              </div>
            </div>
          )}
          {!result
            ? <Btn accent onClick={submit}>정답 제출</Btn>
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

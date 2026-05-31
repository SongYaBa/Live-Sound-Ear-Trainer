import { useState, useEffect, useRef, useCallback } from "react";

// ─── 이펙터 데이터 ────────────────────────────────────────────────
const EFFECTS_DATA = [
  { name: "리버브 (Reverb)", category: "공간계", desc: "공간의 잔향을 시뮬레이션. 홀, 룸, 플레이트 등 다양한 공간감 표현", hint: "콘서트홀 잔향" },
  { name: "딜레이 (Delay)", category: "시간계", desc: "원음을 일정 시간 후 반복 재생하는 에코 효과", hint: "메아리" },
  { name: "코러스 (Chorus)", category: "공간계", desc: "원음을 약간 피치/타이밍 변조해 겹쳐 여러 명이 연주하는 효과", hint: "풍성한 사운드" },
  { name: "플랜저 (Flanger)", category: "시간계", desc: "짧은 딜레이를 LFO로 변조해 금속성 스위핑 효과 생성", hint: "제트기 소리" },
  { name: "페이저 (Phaser)", category: "시간계", desc: "위상 변이로 빗형 필터 효과 생성. 부드러운 스위핑", hint: "와이와이 사운드" },
  { name: "트레몰로 (Tremolo)", category: "시간계", desc: "음량을 LFO로 주기적으로 변조하는 효과", hint: "볼륨이 떨림" },
  { name: "비브라토 (Vibrato)", category: "시간계", desc: "피치를 LFO로 주기적으로 변조하는 효과", hint: "피치가 흔들림" },
  { name: "피치시프터 (Pitch Shifter)", category: "공간계", desc: "원음의 피치를 올리거나 내림. 하모나이저 포함", hint: "음정 변환" },
  { name: "오토튠 (Auto-Tune)", category: "공간계", desc: "보컬 피치를 자동으로 보정하거나 극단적 변조", hint: "피치 보정" },
  { name: "컴프레서 (Compressor)", category: "다이나믹", desc: "다이나믹 레인지 축소. 큰 소리는 줄이고 작은 소리는 상대적으로 올림", hint: "다이나믹 조절" },
  { name: "노이즈 게이트 (Noise Gate)", category: "다이나믹", desc: "특정 레벨 이하의 신호를 차단해 노이즈를 제거", hint: "조용할 때 차단" },
  { name: "리미터 (Limiter)", category: "다이나믹", desc: "설정한 레벨 이상으로 신호가 넘지 않도록 제한", hint: "클리핑 방지" },
  { name: "이퀄라이저 (EQ)", category: "필터", desc: "특정 주파수 대역의 레벨을 부스트 또는 컷", hint: "주파수 조절" },
  { name: "익사이터 (Exciter)", category: "하모닉", desc: "고주파 하모닉을 추가해 존재감과 선명도 향상", hint: "에어감 추가" },
  { name: "스테레오 이미저 (Stereo Imager)", category: "공간계", desc: "스테레오 필드의 넓이를 조절하는 효과", hint: "스테레오 폭 조절" },
  { name: "링 모듈레이터 (Ring Modulator)", category: "시간계", desc: "두 신호를 곱하여 금속적이고 불협화음적인 사운드 생성", hint: "로봇 목소리" },
  { name: "워머 (Warmer/Saturator)", category: "하모닉", desc: "아날로그 테이프/튜브의 포화 특성을 모방해 따뜻한 음색 추가", hint: "따뜻한 디스토션" },
  { name: "디에서 (De-esser)", category: "다이나믹", desc: "보컬의 치찰음(S, SH)을 다이나믹하게 억제", hint: "S음 억제" },
];

const CATEGORIES = ["전체", "공간계", "시간계", "다이나믹", "필터", "하모닉"];
const EQ_FREQS = [63, 125, 250, 500, 1000, 2000, 4000, 8000];

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
function EQCanvas({ bands, height = 100 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,W,H);
    const freqToX = f => (Math.log10(f/20)/Math.log10(20000/20))*W;
    // 그리드
    ctx.strokeStyle="rgba(0,255,180,0.07)"; ctx.lineWidth=1;
    [63,125,250,500,1000,2000,4000,8000,16000].forEach(f=>{
      const x=freqToX(f); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    });
    [-12,-6,0,6,12].forEach(db=>{
      const y=H/2-(db/24)*(H/2-8);
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    });
    // 0dB
    ctx.strokeStyle="rgba(0,255,180,0.2)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
    // 커브
    ctx.strokeStyle="#00ffb4"; ctx.lineWidth=2;
    ctx.shadowColor="#00ffb4"; ctx.shadowBlur=6;
    ctx.beginPath();
    for(let px=0;px<W;px++){
      const freq=Math.pow(10,(px/W)*(Math.log10(20000)-Math.log10(20))+Math.log10(20));
      let db=0;
      bands.forEach(({freq:cf,gain,q=1.4})=>{
        if(gain===0) return;
        const w=freq/cf;
        const A=Math.pow(10,gain/40);
        const num=w*w+(A*(w/q))+1; // simplified peaking
        const den=w*w+(1/(A)*(w/q))+1;
        db+=gain*(1/(1+Math.pow((freq-cf)/(cf/q*2),2)));
      });
      const y=H/2-(db/24)*(H/2-8);
      px===0?ctx.moveTo(px,y):ctx.lineTo(px,y);
    }
    ctx.stroke(); ctx.shadowBlur=0;
    // 주파수 라벨
    ctx.fillStyle="rgba(0,255,180,0.4)"; ctx.font="9px monospace"; ctx.textAlign="center";
    [{f:125,l:"125"},{f:500,l:"500"},{f:1000,l:"1k"},{f:4000,l:"4k"},{f:8000,l:"8k"}].forEach(({f,l})=>{
      ctx.fillText(l, freqToX(f), H-2);
    });
  }, [bands]);
  return (
    <canvas ref={ref} width={600} height={height}
      style={{width:"100%",height,borderRadius:8,background:"rgba(0,0,0,0.4)",display:"block"}} />
  );
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────
const S = {
  page: {
    minHeight:"100vh", background:"#0b0f15", color:"#dde4ee",
    fontFamily:"'SF Mono','Courier New',monospace", maxWidth:480, margin:"0 auto",
    paddingBottom:80,
  },
  header: {
    background:"linear-gradient(180deg,rgba(0,255,180,0.06) 0%,transparent 100%)",
    borderBottom:"1px solid rgba(0,255,180,0.15)",
    padding:"16px 16px 0",
  },
  tabBar: {
    position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
    width:"100%", maxWidth:480,
    background:"rgba(11,15,21,0.97)", borderTop:"1px solid rgba(0,255,180,0.15)",
    display:"flex", zIndex:100,
  },
  tabBtn: (active) => ({
    flex:1, padding:"10px 4px 12px", border:"none", background:"none",
    color: active?"#00ffb4":"#445",
    fontFamily:"inherit", fontSize:10, cursor:"pointer",
    display:"flex", flexDirection:"column", alignItems:"center", gap:3,
    borderTop: active?"2px solid #00ffb4":"2px solid transparent",
    transition:"all 0.15s",
  }),
  card: {
    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:12, padding:16, marginBottom:12,
  },
  label: { fontSize:10, color:"#445", letterSpacing:2, marginBottom:8 },
  btn: (accent,disabled) => ({
    padding:"12px 18px", fontSize:13, fontFamily:"inherit",
    background: accent?"rgba(0,255,180,0.15)":"rgba(255,255,255,0.06)",
    border: accent?"1px solid rgba(0,255,180,0.5)":"1px solid rgba(255,255,255,0.1)",
    borderRadius:8, color: accent?"#00ffb4":"#99a",
    cursor: disabled?"not-allowed":"pointer",
    opacity: disabled?0.4:1, transition:"all 0.15s", width:"100%",
    marginBottom:8,
  }),
  result: (ok) => ({
    padding:"12px 16px", borderRadius:8, fontSize:13,
    background: ok?"rgba(0,255,180,0.08)":"rgba(255,60,60,0.08)",
    border:`1px solid ${ok?"rgba(0,255,180,0.3)":"rgba(255,60,60,0.3)"}`,
    color: ok?"#00ffb4":"#ff6666", marginBottom:12,
  }),
};

function Btn({children,onClick,accent,disabled,style={}}) {
  return <button onClick={onClick} disabled={disabled} style={{...S.btn(accent,disabled),...style}}>{children}</button>;
}

// ════════════════════════════════════════════════════════════════
// ① 사인파
// ════════════════════════════════════════════════════════════════
const SINE_FREQS = [31.5,63,125,250,500,1000,2000,4000,8000,16000];

function SineTab({addScore}) {
  const [target,setTarget]=useState(null);
  const [guess,setGuess]=useState(null);
  const [result,setResult]=useState(null);
  const [playing,setPlaying]=useState(false);
  const ctxRef=useRef(null);
  const oscRef=useRef(null);

  const getCtx=()=>{
    if(!ctxRef.current||ctxRef.current.state==="closed")
      ctxRef.current=new(window.AudioContext||window.webkitAudioContext)();
    return ctxRef.current;
  };

  const stop=()=>{ try{oscRef.current?.stop();}catch(e){} setPlaying(false); };

  const play=(freq,dur=2.5)=>{
    stop();
    const ctx=getCtx();
    if(ctx.state==="suspended") ctx.resume();
    const osc=ctx.createOscillator();
    const g=ctx.createGain();
    osc.type="sine"; osc.frequency.value=freq;
    g.gain.setValueAtTime(0,ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+0.05);
    g.gain.linearRampToValueAtTime(0,ctx.currentTime+dur-0.05);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime+dur);
    oscRef.current=osc; setPlaying(true);
    setTimeout(()=>setPlaying(false),dur*1000);
  };

  const newQ=()=>{
    setTarget(SINE_FREQS[Math.floor(Math.random()*SINE_FREQS.length)]);
    setGuess(null); setResult(null); stop();
  };

  const submit=()=>{
    if(!guess||!target) return;
    const diff=Math.abs(Math.log2(guess/target));
    const ok=diff<0.42;
    setResult({ok,target,guess});
    addScore(ok);
  };

  useEffect(()=>{newQ();},[]);

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>① 사인파 주파수 맞추기</div>
        <div style={{fontSize:12,color:"#556",marginBottom:12}}>
          재생 후 어떤 주파수인지 선택하세요
        </div>
        <Btn accent onClick={()=>target&&play(target)} disabled={playing}>
          {playing?"▶ 재생 중...":"▶ 문제 재생"}
        </Btn>
        <Btn onClick={()=>target&&play(target,1)} disabled={playing}>
          짧게 재생 (1초)
        </Btn>
      </div>

      <div style={S.card}>
        <div style={S.label}>주파수 선택 (클릭 시 재생)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {SINE_FREQS.map(f=>{
            const label=f>=1000?`${f/1000}kHz`:`${f}Hz`;
            const selected=guess===f;
            return (
              <button key={f} onClick={()=>{setGuess(f);play(f,1.5);}} style={{
                padding:"14px 8px", borderRadius:8, fontFamily:"inherit",
                fontSize:14, fontWeight:selected?"bold":"normal",
                background:selected?"rgba(0,255,180,0.18)":"rgba(255,255,255,0.04)",
                border:selected?"1px solid #00ffb4":"1px solid rgba(255,255,255,0.1)",
                color:selected?"#00ffb4":"#aaa", cursor:"pointer",
                transition:"all 0.1s",
              }}>{label}</button>
            );
          })}
        </div>
      </div>

      {result && (
        <div style={S.result(result.ok)}>
          {result.ok?"✓ 정답!":"✗ 오답."}
          {" 정답: "}<strong>{result.target>=1000?`${result.target/1000}kHz`:`${result.target}Hz`}</strong>
          {!result.ok&&<> | 선택: {result.guess>=1000?`${result.guess/1000}kHz`:`${result.guess}Hz`}</>}
        </div>
      )}

      <div style={{display:"flex",gap:8}}>
        {!result
          ? <Btn accent onClick={submit} disabled={!guess}>정답 제출</Btn>
          : <Btn accent onClick={newQ}>다음 문제 →</Btn>
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ② 핑크노이즈 EQ
// ════════════════════════════════════════════════════════════════
function PinkNoiseTab({addScore}) {
  const [qBands,setQBands]=useState(null);
  const [userBands,setUserBands]=useState(EQ_FREQS.map(f=>({freq:f,gain:0})));
  const [playing,setPlaying]=useState(false);
  const [mode,setMode]=useState("q"); // q=문제 f=flat
  const [result,setResult]=useState(null);
  const ctxRef=useRef(null);
  const srcRef=useRef(null);

  const getCtx=()=>{
    if(!ctxRef.current||ctxRef.current.state==="closed")
      ctxRef.current=new(window.AudioContext||window.webkitAudioContext)();
    return ctxRef.current;
  };

  const stopAudio=()=>{ try{srcRef.current?.stop();}catch(e){} setPlaying(false); };

  const playNoise=(bands)=>{
    stopAudio();
    const ctx=getCtx();
    if(ctx.state==="suspended") ctx.resume();
    const buf=createPinkNoiseBuffer(ctx);
    const src=ctx.createBufferSource();
    src.buffer=buf; src.loop=true;
    let prev=src;
    bands.forEach(({freq,gain,q=1.4})=>{
      if(gain===0) return;
      const f=ctx.createBiquadFilter();
      f.type="peaking"; f.frequency.value=freq;
      f.gain.value=gain; f.Q.value=q;
      prev.connect(f); prev=f;
    });
    const g=ctx.createGain(); g.gain.value=0.5;
    prev.connect(g); g.connect(ctx.destination);
    src.start(); srcRef.current=src; setPlaying(true);
  };

  const newQ=()=>{
    const n=Math.floor(Math.random()*2)+1;
    const bands=[]; const used=new Set();
    for(let i=0;i<n;i++){
      let idx; do{idx=Math.floor(Math.random()*EQ_FREQS.length);}while(used.has(idx));
      used.add(idx);
      const gains=[-18,-12,-9,-6,6,9,12,18];
      bands.push({freq:EQ_FREQS[idx],gain:gains[Math.floor(Math.random()*gains.length)],q:1.4});
    }
    setQBands(bands);
    setUserBands(EQ_FREQS.map(f=>({freq:f,gain:0})));
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
    const ok=avg<=4;
    setResult({ok,avg:avg.toFixed(1),answer:qBands});
    addScore(ok); stopAudio();
  };

  useEffect(()=>{newQ();},[]);

  const fLabel=f=>f>=1000?`${f/1000}k`:`${f}`;

  return (
    <div style={{padding:16}}>
      <div style={S.card}>
        <div style={S.label}>② 핑크노이즈 EQ 맞추기</div>
        <div style={{fontSize:12,color:"#556",marginBottom:12}}>
          문제 재생 후 어느 주파수가 부스트/컷 됐는지 슬라이더로 맞추세요
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <Btn accent onClick={()=>qBands&&playNoise(qBands)} disabled={playing}>
            ▶ 문제 재생
          </Btn>
          <Btn onClick={()=>playNoise([{freq:1000,gain:0}])} disabled={playing}>
            ▶ 원본 (Flat)
          </Btn>
        </div>
        {playing&&<div style={{fontSize:11,color:"#00ffb4"}}>◉ 재생 중 — 탭하여 정지</div>}
        <Btn onClick={stopAudio} disabled={!playing} style={{marginTop:4}}>■ 정지</Btn>
      </div>

      {/* EQ 슬라이더 */}
      <div style={S.card}>
        <div style={S.label}>EQ 설정</div>
        <div style={{display:"flex",justifyContent:"space-around",marginBottom:12}}>
          {userBands.map((b,i)=>(
            <div key={b.freq} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:b.gain>0?"#4f9":b.gain<0?"#f66":"#445",minWidth:28,textAlign:"center"}}>
                {b.gain>0?`+${b.gain}`:b.gain}
              </div>
              <input type="range" min={-24} max={24} step={3} value={b.gain}
                onChange={e=>setUserBands(prev=>prev.map((x,j)=>j===i?{...x,gain:+e.target.value}:x))}
                style={{writingMode:"vertical-lr",direction:"rtl",height:110,accentColor:"#00ffb4",cursor:"pointer"}}
              />
              <div style={{fontSize:9,color:"#556"}}>{fLabel(b.freq)}</div>
            </div>
          ))}
        </div>
        <EQCanvas bands={userBands} height={80} />
      </div>

      {result&&(
        <div style={S.result(result.ok)}>
          {result.ok?"✓ 정답!":"✗ 오답."} 평균 오차 {result.avg}dB
          <div style={{marginTop:6,fontSize:12}}>
            정답: {result.answer.map(b=>`${b.freq>=1000?`${b.freq/1000}kHz`:`${b.freq}Hz`} ${b.gain>0?"+":""}${b.gain}dB`).join(" / ")}
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8}}>
        {!result
          ?<Btn accent onClick={submit}>정답 제출</Btn>
          :<Btn accent onClick={newQ}>다음 문제 →</Btn>
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ③ 음원 EQ
// ════════════════════════════════════════════════════════════════
function MusicEQTab({addScore}) {
  const [file,setFile]=useState(null);
  const [qBands,setQBands]=useState(null);
  const [userBands,setUserBands]=useState(EQ_FREQS.map(f=>({freq:f,gain:0})));
  const [playing,setPlaying]=useState(false);
  const [result,setResult]=useState(null);
  const ctxRef=useRef(null);
  const srcRef=useRef(null);

  const getCtx=()=>{
    if(!ctxRef.current||ctxRef.current.state==="closed")
      ctxRef.current=new(window.AudioContext||window.webkitAudioContext)();
    return ctxRef.current;
  };
  const stopAudio=()=>{try{srcRef.current?.stop();}catch(e){}setPlaying(false);};

  const playAudio=async(bands)=>{
    stopAudio();
    if(!file) return;
    const ctx=getCtx();
    if(ctx.state==="suspended") ctx.resume();
    const resp=await fetch(file.url);
    const ab=await resp.arrayBuffer();
    const audioBuf=await ctx.decodeAudioData(ab);
    const src=ctx.createBufferSource();
    src.buffer=audioBuf; src.loop=true;
    let prev=src;
    bands.forEach(({freq,gain,q=1.4})=>{
      if(gain===0) return;
      const f=ctx.createBiquadFilter();
      f.type="peaking"; f.frequency.value=freq; f.gain.value=gain; f.Q.value=q;
      prev.connect(f); prev=f;
    });
    const g=ctx.createGain(); g.gain.value=0.7;
    prev.connect(g); g.connect(ctx.destination);
    src.start(); srcRef.current=src; setPlaying(true);
  };

  const newQ=()=>{
    if(!file) return;
    const n=Math.floor(Math.random()*2)+1;
    const bands=[]; const used=new Set();
    for(let i=0;i<n;i++){
      let idx; do{idx=Math.floor(Math.random()*EQ_FREQS.length);}while(used.has(idx));
      used.add(idx);
      const gs=[-18,-12,-9,-6,6,9,12,18];
      bands.push({freq:EQ_FREQS[idx],gain:gs[Math.floor(Math.random()*gs.length)],q:1.4});
    }
    setQBands(bands);
    setUserBands(EQ_FREQS.map(f=>({freq:f,gain:0})));
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
    const ok=avg<=4;
    setResult({ok,avg:avg.toFixed(1),answer:qBands});
    addScore(ok); stopAudio();
  };

  const fLabel=f=>f>=1000?`${f/1000}k`:`${f}`;

  return (
    <div style={{padding:16}}>
      {/* 파일 업로드 */}
      <div style={S.card}>
        <div style={S.label}>③ 음원 EQ 맞추기</div>
        <label style={{
          display:"block",padding:"16px",textAlign:"center",
          background:"rgba(0,255,180,0.06)",border:"1px dashed rgba(0,255,180,0.3)",
          borderRadius:8,cursor:"pointer",fontSize:13,marginBottom:8,
        }}>
          📁 음원 파일 업로드 (MP3 / WAV)
          <input type="file" accept="audio/*"
            onChange={e=>{
              const f=e.target.files[0];
              if(f) setFile({name:f.name,url:URL.createObjectURL(f)});
            }}
            style={{display:"none"}} />
        </label>
        {file&&(
          <div style={{fontSize:12,color:"#00ffb4",marginBottom:8}}>✓ {file.name}</div>
        )}
        {file&&(
          <Btn accent onClick={newQ}>문제 생성</Btn>
        )}
        {!file&&(
          <div style={{fontSize:11,color:"#334"}}>저작권 없는 음원을 사용하세요</div>
        )}
      </div>

      {qBands&&(
        <>
          <div style={S.card}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Btn accent onClick={()=>playAudio(qBands)} disabled={playing}>▶ 문제 재생</Btn>
              <Btn onClick={()=>playAudio([{freq:1000,gain:0}])} disabled={playing}>▶ 원본 (Flat)</Btn>
            </div>
            <Btn onClick={stopAudio} disabled={!playing}>■ 정지</Btn>
            <Btn onClick={newQ}>새 문제</Btn>
            {playing&&<div style={{fontSize:11,color:"#00ffb4"}}>◉ 재생 중</div>}
          </div>

          <div style={S.card}>
            <div style={S.label}>EQ 설정</div>
            <div style={{display:"flex",justifyContent:"space-around",marginBottom:12}}>
              {userBands.map((b,i)=>(
                <div key={b.freq} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{fontSize:9,color:b.gain>0?"#4f9":b.gain<0?"#f66":"#445",minWidth:28,textAlign:"center"}}>
                    {b.gain>0?`+${b.gain}`:b.gain}
                  </div>
                  <input type="range" min={-24} max={24} step={3} value={b.gain}
                    onChange={e=>setUserBands(prev=>prev.map((x,j)=>j===i?{...x,gain:+e.target.value}:x))}
                    style={{writingMode:"vertical-lr",direction:"rtl",height:110,accentColor:"#00ffb4",cursor:"pointer"}}
                  />
                  <div style={{fontSize:9,color:"#556"}}>{fLabel(b.freq)}</div>
                </div>
              ))}
            </div>
            <EQCanvas bands={userBands} height={80} />
          </div>

          {result&&(
            <div style={S.result(result.ok)}>
              {result.ok?"✓ 정답!":"✗ 오답."} 평균 오차 {result.avg}dB
              <div style={{marginTop:6,fontSize:12}}>
                정답: {result.answer.map(b=>`${b.freq>=1000?`${b.freq/1000}kHz`:`${b.freq}Hz`} ${b.gain>0?"+":""}${b.gain}dB`).join(" / ")}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:8}}>
            {!result
              ?<Btn accent onClick={submit}>정답 제출</Btn>
              :<Btn accent onClick={newQ}>다음 문제 →</Btn>
            }
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ④ 이펙터 퀴즈
// ════════════════════════════════════════════════════════════════
function EffectsTab({addScore}) {
  const [cat,setCat]=useState("전체");
  const [q,setQ]=useState(null);
  const [choices,setChoices]=useState([]);
  const [selected,setSelected]=useState(null);
  const [hint,setHint]=useState(false);

  const pool=cat==="전체"?EFFECTS_DATA:EFFECTS_DATA.filter(e=>e.category===cat);

  const newQ=useCallback(()=>{
    if(pool.length<4) return;
    const item=pool[Math.floor(Math.random()*pool.length)];
    const wrong=EFFECTS_DATA.filter(e=>e.name!==item.name).sort(()=>Math.random()-0.5).slice(0,3);
    setChoices([item,...wrong].sort(()=>Math.random()-0.5));
    setQ(item); setSelected(null); setHint(false);
  },[cat,pool.length]);

  useEffect(()=>{newQ();},[cat]);

  const select=(c)=>{
    if(selected) return;
    setSelected(c);
    addScore(c.name===q.name);
  };

  return (
    <div style={{padding:16}}>
      {/* 카테고리 필터 */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {CATEGORIES.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            padding:"6px 12px",fontSize:11,fontFamily:"inherit",borderRadius:20,
            background:cat===c?"rgba(0,255,180,0.15)":"rgba(255,255,255,0.04)",
            border:cat===c?"1px solid #00ffb4":"1px solid rgba(255,255,255,0.08)",
            color:cat===c?"#00ffb4":"#556",cursor:"pointer",
          }}>{c}</button>
        ))}
      </div>

      {q&&(
        <>
          <div style={S.card}>
            <div style={S.label}>④ 이펙터 이름 맞추기</div>
            <div style={{fontSize:15,lineHeight:1.7,color:"#dde4ee",marginBottom:12}}>
              {q.desc}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,color:"#445"}}>
                카테고리: <span style={{color:"#667"}}>{q.category}</span>
              </div>
              {!hint?(
                <button onClick={()=>setHint(true)} style={{
                  fontSize:11,background:"none",border:"1px solid #334",
                  borderRadius:4,color:"#445",padding:"3px 10px",cursor:"pointer",fontFamily:"inherit",
                }}>힌트</button>
              ):(
                <div style={{fontSize:11,color:"#cc9",padding:"3px 10px"}}>💡 {q.hint}</div>
              )}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {choices.map(c=>{
              const isCorrect=c.name===q.name;
              const isSel=selected?.name===c.name;
              let bg="rgba(255,255,255,0.04)";
              let border="1px solid rgba(255,255,255,0.08)";
              let color="#ccc";
              if(selected){
                if(isCorrect){bg="rgba(0,255,180,0.12)";border="1px solid #00ffb4";color="#00ffb4";}
                else if(isSel){bg="rgba(255,60,60,0.1)";border="1px solid #ff3c3c";color="#ff6666";}
              }
              return (
                <button key={c.name} onClick={()=>select(c)} style={{
                  padding:"16px 10px",background:bg,border,borderRadius:10,
                  color,cursor:selected?"default":"pointer",
                  fontSize:13,fontFamily:"inherit",textAlign:"center",
                  transition:"all 0.15s",lineHeight:1.4,
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
  const addScore=(ok)=>setScore(s=>({ok:s.ok+(ok?1:0),total:s.total+1}));

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{fontSize:9,color:"#00ffb4",letterSpacing:3,marginBottom:2}}>STAGE AUDIO TRAINER</div>
            <div style={{fontSize:17,fontWeight:"bold",letterSpacing:1}}>무대음향 실기 대비</div>
          </div>
          <div style={{
            background:"rgba(0,255,180,0.07)",border:"1px solid rgba(0,255,180,0.2)",
            borderRadius:10,padding:"8px 14px",textAlign:"right",
          }}>
            <div style={{fontSize:9,color:"#00ffb4",letterSpacing:1}}>SCORE</div>
            <div style={{fontSize:16,fontWeight:"bold"}}>
              {score.ok}<span style={{color:"#334",fontSize:11}}> / {score.total}</span>
            </div>
            {score.total>0&&(
              <div style={{fontSize:9,color:"#556"}}>{Math.round(score.ok/score.total*100)}%</div>
            )}
          </div>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{paddingBottom:8}}>
        {tab==="sine"&&<SineTab addScore={addScore}/>}
        {tab==="pink"&&<PinkNoiseTab addScore={addScore}/>}
        {tab==="music"&&<MusicEQTab addScore={addScore}/>}
        {tab==="effects"&&<EffectsTab addScore={addScore}/>}
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

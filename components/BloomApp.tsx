"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Circle, Clock3, Download, Droplets, Heart, Layers3, Pause, Pencil, Play, Plus, RotateCcw, Settings2, SkipForward, Sparkles, Sun, Sunrise, Sunset, Target, Trash2, Upload, Volume2, X } from "lucide-react";
import { addDays, BloomData, cloneSeed, countWeek, currentVersion, dateKey, getOccurrence, monday, migrateLocalData, Routine, scheduled, scheduledStreak, validateImport, weekday } from "@/lib/model";

type View = "today" | "week" | "goals" | "progress" | "settings";
type SoundscapeType = "none" | "rain" | "breeze" | "calm";

const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const nav: {id:View; label:string; icon: typeof Heart}[] = [
  {id:"today",label:"Today",icon:Heart},
  {id:"week",label:"Week",icon:CalendarDays},
  {id:"goals",label:"Goals",icon:Target},
  {id:"progress",label:"Progress",icon:ChartNoAxesCombined},
  {id:"settings",label:"Settings",icon:Settings2}
];
const icons: Record<string, typeof Heart> = {
  book:BookOpen, sparkle:Sparkles, phone:Clock3, heart:Heart, pencil:Pencil, language:BookOpen, drop:Droplets, droplets:Droplets, layers:Layers3, palette:Sparkles
};

const niceDate = (key:string, options:Intl.DateTimeFormatOptions={weekday:"long",month:"long",day:"numeric"}) =>
  new Intl.DateTimeFormat("en",{...options,timeZone:"UTC"}).format(new Date(`${key}T12:00:00Z`));
const uid = () => Math.random().toString(36).slice(2,10);
const minutes = (n:number) => `${n} min`;
function SmallLabel({children}:{children:React.ReactNode}){ return <span className="eyebrow">{children}</span>; }

function getTimeSlot(routine: Routine, date: string): "morning" | "afternoon" | "evening" {
  const v = currentVersion(routine, date);
  if (v?.time) {
    const h = parseInt(v.time.split(":")[0], 10);
    if (!isNaN(h)) {
      if (h < 12) return "morning";
      if (h < 17) return "afternoon";
      return "evening";
    }
  }
  if (["water", "scalp", "workout"].includes(routine.id)) return "morning";
  if (["pm", "sketch", "spanish", "arabic", "skills"].includes(routine.id)) return "afternoon";
  return "evening";
}

let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioClass();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playDone(){
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const play = () => {
      const now = ctx.currentTime;
      // Note 1: C5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc1.start(now); osc1.stop(now + 0.55);

      // Note 2: E5
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.55, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.start(now + 0.15); osc2.stop(now + 0.7);

      // Note 3: G5
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(783.99, now + 0.3);
      gain3.gain.setValueAtTime(0.45, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc3.connect(gain3); gain3.connect(ctx.destination);
      osc3.start(now + 0.3); osc3.stop(now + 0.95);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(play).catch(play);
    } else {
      play();
    }
  } catch {}
}

let activeVibrateInterval: any = null;
let capHaptics: any = null;

if (typeof window !== "undefined") {
  import("@capacitor/haptics")
    .then((mod) => {
      capHaptics = mod.Haptics;
    })
    .catch(() => {});
}

async function triggerCapacitorHaptic(durationMs = 500) {
  if (capHaptics) {
    try {
      await capHaptics.impact({ style: "HEAVY" });
      await capHaptics.vibrate({ duration: durationMs });
    } catch {}
  }
}

function triggerIosHapticPulse() {
  if (typeof document === "undefined") return;
  const label = document.getElementById("bloom-ios-haptic-label");
  if (label) {
    try { label.click(); } catch {}
  }
}

function playSubBassHapticPulse() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(42, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.12);
    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch {}
}

function stopHaptic(){
  if(activeVibrateInterval){ clearInterval(activeVibrateInterval); activeVibrateInterval=null; }
  if(typeof navigator!=="undefined" && "vibrate" in navigator){ try{ navigator.vibrate(0); }catch{} }
}

function haptic(ms: number = 5000){
  stopHaptic();

  // 1. Capacitor Native iOS & Android Taptic Engine
  triggerCapacitorHaptic(ms);

  // 2. Android standard Vibration API
  if(typeof navigator!=="undefined" && "vibrate" in navigator){
    try{
      const pattern: number[] = [];
      let acc = 0;
      while(acc < ms){
        const on = Math.min(800, ms - acc);
        pattern.push(on);
        acc += on;
        if(acc < ms){ pattern.push(200); acc += 200; }
      }
      navigator.vibrate(pattern);
    }catch{}
  }

  // iOS WebKit Switch Taptic click + tactile acoustic vibration
  triggerIosHapticPulse();
  playSubBassHapticPulse();

  if(ms > 100){
    const start = Date.now();
    activeVibrateInterval = setInterval(()=>{
      if(Date.now() - start >= ms){
        stopHaptic();
      } else {
        triggerCapacitorHaptic(400);
        if(typeof navigator!=="undefined" && "vibrate" in navigator){
          try{ navigator.vibrate([600, 200]); }catch{}
        }
        triggerIosHapticPulse();
        playSubBassHapticPulse();
      }
    }, 450);
  }
}

function playDrop(){
  try{
    const ctx=getAudioContext();
    if(!ctx)return;
    const play=()=>{
      const now=ctx.currentTime;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type="sine";
      osc.frequency.setValueAtTime(800,now);
      osc.frequency.exponentialRampToValueAtTime(1250,now+0.08);
      gain.gain.setValueAtTime(0.4,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now+0.25);
    };
    if(ctx.state==="suspended")ctx.resume().then(play).catch(play);
    else play();
  }catch{}
}

let activeAmbientSound: { type: SoundscapeType; stop: () => void } | null = null;
function stopAmbientSound() {
  if (activeAmbientSound) {
    try { activeAmbientSound.stop(); } catch {}
    activeAmbientSound = null;
  }
}
function startAmbientSound(type: SoundscapeType, volume = 0.28) {
  if (type === "none") {
    stopAmbientSound();
    return;
  }
  if (activeAmbientSound && activeAmbientSound.type === type) return;
  stopAmbientSound();
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 1.2);
    masterGain.connect(ctx.destination);

    if (type === "calm") {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();
      o1.type = "sine";
      o2.type = "sine";
      o1.frequency.setValueAtTime(216, ctx.currentTime);
      o2.frequency.setValueAtTime(216.7, ctx.currentTime);
      g1.gain.setValueAtTime(0.2, ctx.currentTime);
      g2.gain.setValueAtTime(0.2, ctx.currentTime);
      o1.connect(g1); g1.connect(masterGain);
      o2.connect(g2); g2.connect(masterGain);
      o1.start(); o2.start();
      activeAmbientSound = {
        type,
        stop: () => {
          try {
            masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
            setTimeout(() => { o1.stop(); o2.stop(); o1.disconnect(); o2.disconnect(); masterGain.disconnect(); }, 700);
          } catch {}
        }
      };
    } else {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === "rain") {
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * 3.2;
        } else {
          lastOut = (lastOut + (0.015 * white)) / 1.015;
          data[i] = lastOut * 4.0;
        }
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      let lfo: OscillatorNode | null = null;
      if (type === "rain") {
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(950, ctx.currentTime);
        filter.Q.setValueAtTime(0.4, ctx.currentTime);
      } else {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(300, ctx.currentTime);
        lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
        lfoGain.gain.setValueAtTime(160, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
      }

      noise.connect(filter);
      filter.connect(masterGain);
      noise.start();
      activeAmbientSound = {
        type,
        stop: () => {
          try {
            masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
            if (lfo) { try { lfo.stop(); lfo.disconnect(); } catch {} }
            setTimeout(() => { noise.stop(); noise.disconnect(); masterGain.disconnect(); }, 700);
          } catch {}
        }
      };
    }
  } catch {}
}

export default function BloomApp(){
  const [data,setData] = useState<BloomData>(cloneSeed);
  const [loaded,setLoaded] = useState(false);
  const [view,setView] = useState<View>("today");
  const [now,setNow] = useState(Date.now());
  const [selected,setSelected] = useState("");
  const [weekStart,setWeekStart] = useState("");
  const [editing,setEditing] = useState<string|null>(null);
  const [modal,setModal] = useState<"routine"|"goal"|"course"|null>(null);
  const [message,setMessage] = useState("");
  const [selectedCategory,setSelectedCategory] = useState<string>("All");
  const [groupByTime,setGroupByTime] = useState<boolean>(false);
  const [soundscape,setSoundscape] = useState<SoundscapeType>("none");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{
    try{
      const raw = localStorage.getItem("bloom-v1");
      if(raw) setData(migrateLocalData(validateImport(JSON.parse(raw))));
    }catch{
      setMessage("Saved data could not be read. You can import a backup in Settings.");
    }
    setLoaded(true);
  },[]);

  useEffect(()=>{ if(loaded) localStorage.setItem("bloom-v1", JSON.stringify(data)); },[data,loaded]);
  useEffect(()=>{ const id=window.setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(id); },[]);

  // PWA Service Worker registration
  useEffect(()=>{
    if(typeof window!=="undefined" && "serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }
  },[]);

  let today:string;
  try{ today=dateKey(new Date(now),data.profile.timezone) }catch{ today=dateKey(new Date(now),"UTC") }
  let formattedTime:string;
  try{ formattedTime=new Intl.DateTimeFormat("en-GB",{timeZone:data.profile.timezone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(now)) }
  catch{ formattedTime=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(now)) }

  const activeDay = selected||today;
  const activeWeek = weekStart||monday(today);
  const dayRoutines = useMemo(()=>data.routines.filter(r=>scheduled(r,activeDay)),[data.routines,activeDay]);
  const filteredRoutines = useMemo(()=>{
    if(selectedCategory==="All") return dayRoutines;
    return dayRoutines.filter(r=>r.category===selectedCategory);
  },[dayRoutines,selectedCategory]);

  const todayCount = dayRoutines.filter(r=>getOccurrence(data,r.id,activeDay)?.status==="completed").length;
  const isFullDayComplete = dayRoutines.length > 0 && todayCount === dayRoutines.length;
  const weekCounts = countWeek(data,activeWeek);
  const progressPercent = weekCounts.total?Math.round(weekCounts.done/weekCounts.total*100):0;
  const focus = data.focus;
  const focusElapsed = focus.elapsed+(focus.status==="running"&&focus.startedAt?Math.max(0,Math.floor((now-focus.startedAt)/1000)):0);
  const focusLeft = Math.max(0,focus.length-focusElapsed);

  useEffect(()=>{
    if(focus.status==="running" && focusElapsed>=focus.length){
      stopAmbientSound();
      playDone();
      haptic();
      setData(d=>({...d,focus:{...d.focus,status:"finished",elapsed:d.focus.length,startedAt:null}}));
    }
  },[focus.status,focus.length,focusElapsed]);

  useEffect(()=>{
    const unlock=()=>{ getAudioContext(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    return ()=>window.removeEventListener("pointerdown", unlock);
  },[]);

  // Gentle notifications & periodic hydration check
  useEffect(()=>{
    if(!data.profile.notificationsEnabled || typeof window==="undefined" || !("Notification" in window) || Notification.permission!=="granted") return;
    const intervalId=window.setInterval(()=>{
      const curHour=new Date().getHours();
      if(curHour>=9 && curHour<=21){
        const todayKey=dateKey(new Date(),data.profile.timezone);
        const waterCount=data.water?.[todayKey]||0;
        if(waterCount<8){
          const lastNotified=Number(localStorage.getItem("bloom-last-water-notif")||"0");
          const intervalMs=(data.profile.waterReminderInterval||2)*60*60*1000;
          if(Date.now()-lastNotified>=intervalMs){
            localStorage.setItem("bloom-last-water-notif",String(Date.now()));
            playDrop();
            new Notification("Bloom · Gentle Sip Reminder",{
              body:`You've logged ${waterCount} of 8 glasses today. Time for a refreshing sip! 💧`,
              icon:"/icon-192.png"
            });
          }
        }
      }
    },15*60*1000);
    return ()=>clearInterval(intervalId);
  },[data.profile.notificationsEnabled,data.profile.waterReminderInterval,data.profile.timezone,data.water]);

  const update = (fn:(d:BloomData)=>BloomData) => setData(d=>fn(structuredClone(d)));

  const setStatus = (id:string,key:string,status:"completed"|"skipped"|null) => {
    if(status==="completed"){ playDone(); haptic(400); }
    else{ stopHaptic(); }
    update(d=>{
      d.occurrences=d.occurrences.filter(x=>!(x.routineId===id&&x.date===key));
      if(status) d.occurrences.push({routineId:id,date:key,status,...(status==="completed"?{completedAt:new Date().toISOString()}:{})});
      if(id==="water"){
        if(status==="completed"&&(!d.water?.[key]||d.water[key]<8)){ if(!d.water)d.water={}; d.water[key]=8; }
        else if(status===null&&(d.water?.[key]||0)>=8){ if(d.water)d.water[key]=0; }
      }
      return d;
    });
  };

  const logWater = (key:string,count:number) => {
    const current = data.water?.[key]||0;
    const next = Math.max(0,count);
    if(next>current){
      if(next>=8&&current<8){ playDone(); haptic(5000); setStatus("water",key,"completed"); }
      else{ playDrop(); haptic(60); }
    }else if(next<8&&current>=8){
      setStatus("water",key,null);
    }
    update(d=>{
      if(!d.water) d.water={};
      d.water[key]=next;
      return d;
    });
  };

  const editDate = addDays(today,1);
  const setVersion = (id:string,change:Partial<{weekdays:number[];duration:number;time:string;active:boolean}>) =>
    update(d=>{
      const r=d.routines.find(x=>x.id===id); if(!r)return d;
      const prior=currentVersion(r,editDate); if(!prior)return d;
      const next={...prior,...change,from:editDate};
      r.versions=r.versions.filter(v=>v.from!==editDate);
      r.versions.push(next);
      return d;
    });

  const handleSoundscapeChange = (snd: SoundscapeType) => {
    setSoundscape(snd);
    if(focus.status==="running"){
      if(snd==="none") stopAmbientSound();
      else startAmbientSound(snd);
    }
  };

  const focusAction = (action:"start"|"pause"|"cancel") => {
    if(action==="start"){
      getAudioContext();
      if(soundscape!=="none") startAmbientSound(soundscape);
    }
    if(action==="pause" || action==="cancel"){
      stopAmbientSound();
      if(action==="cancel") stopHaptic();
    }
    update(d=>{
      const f=d.focus;
      const elapsed=f.elapsed+(f.status==="running"&&f.startedAt?Math.floor((Date.now()-f.startedAt)/1000):0);
      d.focus=action==="cancel"?{taskId:null,length:20*60,elapsed:0,startedAt:null,status:"idle"}:action==="pause"?{...f,elapsed,startedAt:null,status:"paused"}:{...f,startedAt:Date.now(),status:"running"};
      return d;
    });
  };

  const startFocus = (id:string|null,length:number) => {
    getAudioContext();
    if(soundscape!=="none") startAmbientSound(soundscape);
    update(d=>{
      d.focus={taskId:id,length:length*60,elapsed:0,startedAt:Date.now(),status:"running"};
      return d;
    });
  };

  const requestNotificationPermission = async () => {
    if(typeof window==="undefined" || !("Notification" in window)){
      setMessage("Notifications are not supported by this browser.");
      return;
    }
    try{
      const perm = await Notification.requestPermission();
      if(perm==="granted"){
        update(d=>{ if(!d.profile) d.profile={name:"",timezone:"Asia/Dubai",allowance:45}; d.profile.notificationsEnabled=true; return d; });
        setMessage("Notifications enabled! You'll receive gentle sip reminders.");
        new Notification("Bloom · Reminders Enabled",{
          body:"Gentle hydration and routine check-ins are active 🌿",
          icon:"/icon-192.png"
        });
      }else{
        update(d=>{ if(d.profile) d.profile.notificationsEnabled=false; return d; });
        setMessage("Notification permission was denied in your browser settings.");
      }
    }catch{
      setMessage("Could not request notification permissions.");
    }
  };

  const sendTestNotification = () => {
    if(typeof window==="undefined" || !("Notification" in window)){
      setMessage("Notifications are not supported by this browser.");
      return;
    }
    if(Notification.permission!=="granted"){
      requestNotificationPermission();
      return;
    }
    playDrop();
    haptic(100);
    new Notification("Bloom · Hydration Reminder",{
      body:"Take a gentle pause for a sip of water 💧 (Glass 4 of 8)",
      icon:"/icon-192.png"
    });
    setMessage("Test notification sent!");
  };

  const exportData = () => {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`bloom-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file:File) => {
    try{
      const parsed=migrateLocalData(validateImport(JSON.parse(await file.text())));
      if(!window.confirm("Replace everything in Bloom with this backup?")) return;
      setData(parsed);
      setMessage("Backup restored.");
      setView("today");
    }catch(e){
      setMessage(e instanceof Error?e.message:"Could not import this file.");
    }
  };

  const headerName = data.profile.name.trim()?`, ${data.profile.name.trim()}`:"";
  const localHour = Number(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hourCycle:"h23",timeZone:data.profile.timezone}).format(new Date(now)));
  const greeting = localHour<12?"morning":localHour<17?"afternoon":"evening";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div style={{width:"28px",height:"28px",borderRadius:"7px",background:"#40E0D0",display:"grid",placeItems:"center",color:"#fff",fontWeight:700,fontSize:"17px",lineHeight:1,boxShadow:"0 2px 8px rgba(64,224,208,0.35)",flexShrink:0}}>b</div>
        <span>bloom<span className="brand-dot">.</span></span>
      </div>
      <div className="side-kicker">YOUR SPACE TO GROW</div>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(item=><button key={item.id} className={`nav-item ${view===item.id?"active":""}`} onClick={()=>setView(item.id)}><item.icon size={19} strokeWidth={1.8}/><span>{item.label}</span>{view===item.id&&<span className="nav-pip"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-flower" style={{color:"#40E0D0"}}>✳</div><p>A little progress<br/>counts.</p><small>Continue at your pace.</small></div>
    </aside>
    <main className="main-content">
      <div className="topbar">
        <span><Sparkles size={18} color="#40E0D0"/> A gentle space for your days</span>
        <div className="top-date-time">
          <span className="top-date-item"><CalendarDays size={15}/>{niceDate(today,{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</span>
          <span className="top-sep">·</span>
          <span className="top-time-item"><Clock3 size={15}/>{formattedTime}</span>
        </div>
      </div>
      {message&&<div className="notice" role="status">{message}<button aria-label="Dismiss message" onClick={()=>setMessage("")}><X size={16}/></button></div>}

      {view==="today"&&<>
        <section className="hero">
          <div className="hero-text">
            <SmallLabel>{niceDate(today,{weekday:"long"}).toUpperCase()} IS FOR GROWING, TOO</SmallLabel>
            <h1>Good {greeting}{headerName}<span className="hero-period">.</span></h1>
            <p>Small steps, lovely momentum. Make today yours.</p>
            <div className="hero-tags">
              <span><Sparkles size={15}/> {todayCount} of {dayRoutines.length} done</span>
              <span><Clock3 size={15}/> At your own pace</span>
              {data.water?.[activeDay] ? <span><Droplets size={14}/> {data.water[activeDay]} glasses water</span> : null}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="sun"/><div className="stem stem-one"/><div className="stem stem-two"/><div className="petal p1"/><div className="petal p2"/><div className="petal p3"/><div className="petal p4"/><div className="petal p5"/><div className="flower-center"/>
          </div>
        </section>

        <div className="section-heading">
          <div>
            <SmallLabel>THE LITTLE THINGS</SmallLabel>
            <h2>{activeDay===today?"Your today":niceDate(activeDay)}</h2>
            <p>Choose what fits. There’s no catching up to do.</p>
          </div>
          <div className="day-switch">
            <button onClick={()=>setSelected(addDays(activeDay,-1))} aria-label="Previous day"><ChevronLeft size={18}/></button>
            <button onClick={()=>setSelected(today)}>Today</button>
            <button onClick={()=>setSelected(addDays(activeDay,1))} aria-label="Next day"><ChevronRight size={18}/></button>
          </div>
        </div>

        {/* Feature 7: Full Day Completion Bloom Celebration */}
        {isFullDayComplete && (
          <div className="day-complete-card">
            <div className="bloom-flourish-icon">
              <Sparkles size={25} color="#40E0D0"/>
            </div>
            <div className="day-complete-content">
              <SmallLabel>A GENTLE FLOURISH</SmallLabel>
              <h3>You flourished today.</h3>
              <p>All {todayCount} planned routines are complete. Take a deep breath and rest deeply.</p>
            </div>
          </div>
        )}

        {/* Feature 5: Category Filtering & Time of Day Grouping */}
        <div className="filter-bar">
          <div className="category-filters">
            {["All", "Wellbeing", "Everyday", "Movement", "Creative", "Learning"].map(cat => (
              <button
                key={cat}
                type="button"
                className={`cat-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`grouping-toggle ${groupByTime ? "active" : ""}`}
            onClick={() => setGroupByTime(v => !v)}
            title="Toggle time-of-day groups"
          >
            {groupByTime ? <Sun size={13} /> : <Clock3 size={13} />}
            {groupByTime ? "Time groups" : "Group by time"}
          </button>
        </div>

        <div className="today-grid">
          <div>
            {groupByTime ? (
              <div>
                {(["morning", "afternoon", "evening"] as const).map(slot => {
                  const slotRoutines = filteredRoutines.filter(r => getTimeSlot(r, activeDay) === slot);
                  if (!slotRoutines.length) return null;
                  const label = slot === "morning" ? "Morning" : slot === "afternoon" ? "Afternoon" : "Evening";
                  const SlotIcon = slot === "morning" ? Sunrise : slot === "afternoon" ? Sun : Sunset;
                  return (
                    <div key={slot}>
                      <div className="time-group-heading">
                        <SlotIcon size={14} /> {label}
                      </div>
                      <div className="task-list" style={{ gap: "10px", marginBottom: "16px" }}>
                        {slotRoutines.map(r => (
                          <TaskCard
                            key={r.id}
                            routine={r}
                            data={data}
                            date={activeDay}
                            onStatus={setStatus}
                            focus={focus}
                            focusElapsed={focusElapsed}
                            focusLeft={focusLeft}
                            onFocusAction={focusAction}
                            onStartFocus={(id, len) => startFocus(id, len)}
                            onLogWater={logWater}
                            soundscape={soundscape}
                            onSoundscapeChange={handleSoundscapeChange}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!filteredRoutines.length && (
                  <div className="empty-card">No routines in this category for today.</div>
                )}
              </div>
            ) : (
              <div className="task-list">
                {filteredRoutines.length ? (
                  filteredRoutines.map(r => (
                    <TaskCard
                      key={r.id}
                      routine={r}
                      data={data}
                      date={activeDay}
                      onStatus={setStatus}
                      focus={focus}
                      focusElapsed={focusElapsed}
                      focusLeft={focusLeft}
                      onFocusAction={focusAction}
                      onStartFocus={(id, len) => startFocus(id, len)}
                      onLogWater={logWater}
                      soundscape={soundscape}
                      onSoundscapeChange={handleSoundscapeChange}
                    />
                  ))
                ) : (
                  <div className="empty-card">
                    {selectedCategory === "All" ? "Nothing planned for this day. Make it your own." : `No ${selectedCategory} routines scheduled today.`}
                  </div>
                )}
              </div>
            )}

            {/* Feature 3: One Lovely Thing — Daily Reflection Note */}
            <div className="reflection-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <SmallLabel>EVENING REFLECTION</SmallLabel>
                <small style={{ color: "#8a988b" }}>{activeDay === today ? "Today" : niceDate(activeDay, { month: "short", day: "numeric" })}</small>
              </div>
              <h3>One lovely thing</h3>
              <textarea
                className="reflection-textarea"
                value={data.notes?.[activeDay] || ""}
                placeholder="A small win, a quiet moment, or something that brought a smile today..."
                onChange={e => {
                  const val = e.target.value;
                  update(d => {
                    if (!d.notes) d.notes = {};
                    d.notes[activeDay] = val;
                    return d;
                  });
                }}
              />
              <div className="reflection-footer">
                <span>🌿 A gentle thought just for you</span>
                <span>{data.notes?.[activeDay]?.trim() ? "Saved to Bloom" : "Private & local"}</span>
              </div>
            </div>
          </div>

          <div className="today-aside">
            {focus.taskId && focus.status!=="idle" ? (
              <div className="focus-card active-notice">
                <div className="card-top"><div className="small-round"><Clock3 size={20}/></div><SmallLabel>ACTIVITY IN PROGRESS</SmallLabel></div>
                <h3>Timer is running</h3>
                <p>Your session for <strong>{data.routines.find(r=>r.id===focus.taskId)?.title||"this activity"}</strong> is active directly underneath its card on the left.</p>
              </div>
            ) : (
              <div className="focus-card">
                <div className="card-top"><div className="small-round"><Clock3 size={20}/></div><SmallLabel>FOCUS SPACE</SmallLabel></div>
                <h3>One thing at a time.</h3>
                <p>Give a little pocket of time to what matters.</p>
                <div className="timer-display">{Math.floor(focusLeft/60).toString().padStart(2,"0")}:{(focusLeft%60).toString().padStart(2,"0")}</div>
                <div className="timer-presets">
                  {[20,30,60].map(n=><button className={focus.length===n*60?"chosen":""} key={n} onClick={()=>update(d=>({...d,focus:{taskId:null,length:n*60,elapsed:0,startedAt:null,status:"idle"}}))}>{n}m</button>)}
                  <button className="custom" onClick={()=>{const raw=window.prompt("Focus length in minutes (1–180)",String(Math.round(focus.length/60)));const n=Number(raw);if(Number.isInteger(n)&&n>=1&&n<=180)update(d=>({...d,focus:{taskId:null,length:n*60,elapsed:0,startedAt:null,status:"idle"}}));}}>Custom</button>
                </div>

                {/* Feature 4: Soundscape Selector inside Focus Space */}
                <div className="ambient-sound-row" style={{ justifyContent: "center", marginTop: "14px" }}>
                  <span className="ambient-sound-label"><Volume2 size={12} /> Ambient:</span>
                  {(["none", "rain", "breeze", "calm"] as const).map(snd => (
                    <button
                      key={snd}
                      type="button"
                      className={`ambient-btn ${soundscape === snd ? "active" : ""}`}
                      onClick={() => handleSoundscapeChange(snd)}
                    >
                      {snd === "none" ? "Off" : snd === "rain" ? "🌧️ Rain" : snd === "breeze" ? "🍃 Breeze" : "✨ Calm"}
                    </button>
                  ))}
                </div>

                <div className="timer-actions">
                  {focus.status==="running"?<button className="primary" onClick={()=>focusAction("pause")}><Pause size={16}/> Pause</button>:focus.status==="paused"?<button className="primary" onClick={()=>focusAction("start")}><Play size={16}/> Resume</button>:<button className="primary" onClick={()=>startFocus(null,focus.length/60)}><Play size={16}/> Start focus</button>}
                  {focus.status!=="idle"&&<button className="icon-button" onClick={()=>focusAction("cancel")} aria-label="Cancel timer"><X size={18}/></button>}
                </div>
                {focus.status==="finished"&&<div className="timer-finish">Time well spent. {focus.taskId&&<button onClick={()=>{setStatus(focus.taskId!,activeDay,"completed");focusAction("cancel")}}>Mark task complete</button>}</div>}
              </div>
            )}

            {(()=>{
              const u=data.usage[activeDay]||0;
              const a=data.profile.allowance;
              const rem=Math.max(0,a-u);
              const exc=Math.max(0,u-a);
              const st=u>a?"exceeded":u>=a*0.8?"warning":"ok";
              const pct=a>0?Math.min(100,Math.round((u/a)*100)):0;
              return <div className="social-card">
                <div className="small-round cream" style={{flex:"none"}}><Clock3 size={19}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><SmallLabel>YOUR CHOICE</SmallLabel><small style={{color:"#839384",fontWeight:600}}>{pct}% used</small></div>
                  <h3>Social media allowance</h3>
                  <div className="budget-bar"><div className={`budget-fill ${st}`} style={{width:`${pct}%`}}/></div>
                  <div className="budget-meta"><span><strong>{u}</strong> of {a} min</span>{exc>0?<span style={{color:"#ad5247",fontWeight:600}}>+{exc}m over</span>:<span><strong>{rem}m</strong> left</span>}</div>
                  <div className="quick-log-row">
                    <span style={{fontSize:"11px",color:"#8a988b",marginRight:"2px"}}>Quick log:</span>
                    {[5,10,15,30].map(m=><button key={m} className="quick-log-btn" onClick={()=>update(d=>{d.usage[activeDay]=Math.max(0,Math.min(1440,(d.usage[activeDay]||0)+m));return d;})} title={`Add ${m} minutes`}>+{m}m</button>)}
                    {u>0&&<button className="quick-log-btn clear" onClick={()=>update(d=>{d.usage[activeDay]=0;return d;})} title="Reset today's usage">Reset</button>}
                  </div>
                  <label className="usage-label">Or exact minutes <input type="number" min="0" max="1440" value={data.usage[activeDay]??""} placeholder="0" onChange={e=>update(d=>{d.usage[activeDay]=Math.max(0,Math.min(1440,Number(e.target.value)||0));return d;})}/></label>
                  <p className={`budget-status-note ${st}`}>{exc>0?"🌾 Over planned buffer — tomorrow is a fresh start.":rem===0?"🌿 Planned allowance reached for today.":`🌿 ${rem} minutes of mindful check-in buffer left.`}</p>
                  <small>Bloom cannot read or limit other apps.</small>
                </div>
              </div>;
            })()}
          </div>
        </div>
      </>}

      {view==="week"&&<>
        <PageHead eyebrow="YOUR RHYTHM" title="The week ahead" description="A flexible plan for real life. Edit any routine in Settings."/>
        <div className="week-toolbar">
          <div className="day-switch">
            <button onClick={()=>setWeekStart(addDays(activeWeek,-7))} aria-label="Previous week"><ChevronLeft size={18}/></button>
            <span>{niceDate(activeWeek,{month:"short",day:"numeric"})} – {niceDate(addDays(activeWeek,6),{month:"short",day:"numeric",year:"numeric"})}</span>
            <button onClick={()=>setWeekStart(addDays(activeWeek,7))} aria-label="Next week"><ChevronRight size={18}/></button>
          </div>
          <button className="text-button" onClick={()=>setWeekStart(monday(today))}>This week</button>
        </div>
        <div className="week-summary">
          <div><strong>{weekCounts.done}<span> / {weekCounts.total}</span></strong><small>sessions completed</small></div>
          <div className="week-bar"><div style={{width:`${progressPercent}%`}}/></div>
          <span>{progressPercent}%</span>
        </div>
        <div className="week-grid">
          {Array.from({length:7},(_,i)=>{
            const key=addDays(activeWeek,i);
            const rs=data.routines.filter(r=>scheduled(r,key));
            return <div className={`week-day ${key===today?"is-today":""}`} key={key}>
              <div className="week-day-head"><span>{days[weekday(key)]}</span><strong>{Number(key.slice(-2))}</strong></div>
              <div className="week-day-list">
                {rs.map(r=>{
                  const o=getOccurrence(data,r.id,key);
                  return <button key={r.id} className={`week-pill ${o?.status||""}`} onClick={()=>{setSelected(key);setView("today")}} title={`${r.title}${o?.status?` — ${o.status}`:""}`}><span className="pill-dot"/>{r.title}</button>;
                })}
                {!rs.length&&<small>Open day</small>}
              </div>
            </div>;
          })}
        </div>
        <p className="gentle-note"><Sparkles size={16}/> Missed routines do not carry over. Continue with the next scheduled day.</p>
      </>}

      {view==="goals"&&<>
        <PageHead eyebrow="THINGS YOU’RE GROWING" title="Goals & courses" description="Big dreams are made of small, ordinary steps."/>
        <div className="goals-grid">
          <div>
            <div className="section-title-row"><h2>Personal goals</h2><button className="add-button" onClick={()=>setModal("goal")}><Plus size={16}/> Add goal</button></div>
            {data.goals.map(g=>{
              const done=g.milestones.filter(x=>x.doneAt).length;
              return <div className="goal-card" key={g.id}>
                <div className="goal-card-head"><div className="goal-icon"><Target size={22}/></div><div><SmallLabel>TARGET · {niceDate(g.targetDate,{month:"long",day:"numeric",year:"numeric"})}</SmallLabel><h3>{g.title}</h3></div></div>
                <div className="slim-progress"><div style={{width:`${g.milestones.length?done/g.milestones.length*100:0}%`}}/></div>
                <p className="count-text">{done} of {g.milestones.length} milestones complete</p>
                {g.id==="driving"&&<p className="goal-help">As a new driver in Abu Dhabi, enrol at an approved school and follow the standard licensing steps via <a href="https://www.tamm.abudhabi/en/life-events/individual/DriveTransport/Obtain%20Driving%20Licence" target="_blank" rel="noopener noreferrer">TAMM</a>. Steady practice builds confident driving.</p>}
                <div className="checklist">
                  {g.milestones.map(m=><button key={m.id} className="check-row" onClick={()=>update(d=>{const x=d.goals.find(x=>x.id===g.id)?.milestones.find(x=>x.id===m.id);if(x)x.doneAt=x.doneAt?undefined:new Date().toISOString();return d;})}><span className={`checkbox ${m.doneAt?"checked":""}`}>{m.doneAt&&<Check size={13}/>}</span><span className={m.doneAt?"done-text":""}>{m.title}</span></button>)}
                </div>
                <button className="quiet-add" onClick={()=>{const title=window.prompt("New milestone");if(title?.trim())update(d=>{d.goals.find(x=>x.id===g.id)?.milestones.push({id:uid(),title:title.trim()});return d;});}}><Plus size={15}/> Add milestone</button>
              </div>;
            })}
          </div>
          <div>
            <div className="section-title-row"><h2>Learning paths</h2><button className="add-button" onClick={()=>setModal("course")}><Plus size={16}/> Add course</button></div>
            {data.courses.map(c=>{
              const done=c.lessons.filter(x=>x.doneAt).length;
              return <div className="course-card" key={c.id}>
                <div className="course-top"><span className="course-icon">{c.kind==="makeup"?<Sparkles size={23}/>:<Layers3 size={23}/>}</span><span className="course-count">{done}/{c.lessons.length} lessons</span></div>
                <h3>{c.title}</h3>
                <div className="slim-progress"><div style={{width:`${c.lessons.length?done/c.lessons.length*100:0}%`}}/></div>
                <div className="checklist">
                  {c.lessons.map((l,i)=><button className="check-row" key={l.id} onClick={()=>update(d=>{const x=d.courses.find(x=>x.id===c.id)?.lessons.find(x=>x.id===l.id);if(x)x.doneAt=x.doneAt?undefined:new Date().toISOString();return d;})}><span className={`checkbox ${l.doneAt?"checked":""}`}>{l.doneAt&&<Check size={13}/>}</span><span className={l.doneAt?"done-text":""}>{i+1}. {l.title}</span></button>)}
                </div>
                <button className="quiet-add" onClick={()=>{const title=window.prompt("Lesson name");if(title?.trim())update(d=>{d.courses.find(x=>x.id===c.id)?.lessons.push({id:uid(),title:title.trim()});return d;});}}><Plus size={15}/> Add lesson</button>
                <button className="quiet-add" onClick={()=>{const index=Number(window.prompt("Which lesson number would you like to rename?"));const item=c.lessons[index-1];if(!item)return;const title=window.prompt("Lesson name",item.title);if(title?.trim())update(d=>{const lesson=d.courses.find(x=>x.id===c.id)?.lessons[index-1];if(lesson)lesson.title=title.trim();return d;});}}><Pencil size={14}/> Rename lesson</button>
              </div>;
            })}
          </div>
        </div>
      </>}

      {view==="progress"&&<>
        <PageHead eyebrow="LOOK HOW FAR YOU’VE COME" title="Your progress" description="Every completed step counts, even on a quiet week."/>
        <div className="progress-top">
          <div className="stat-card accent"><SmallLabel>THIS WEEK</SmallLabel><strong>{progressPercent}%</strong><span>{weekCounts.done} of {weekCounts.total} planned sessions</span></div>
          <div className="stat-card"><SmallLabel>READING</SmallLabel><strong>{Array.from({length:7},(_,i)=>addDays(monday(today),i)).filter(k=>getOccurrence(data,"reading",k)?.status==="completed").length}<small>/ 7</small></strong><span>days this week</span></div>
          <div className="stat-card"><SmallLabel>HAIR TREATMENTS</SmallLabel><strong>{Array.from({length:7},(_,i)=>addDays(monday(today),i)).filter(k=>getOccurrence(data,"hair",k)?.status==="completed").length}<small>/ 3</small></strong><span>weekly target</span></div>
          <div className="stat-card"><SmallLabel>READING STREAK</SmallLabel><strong>{scheduledStreak(data,"reading",today)}</strong><span>scheduled days in a row</span></div>
        </div>

        <div className="progress-panel">
          <div className="section-title-row"><div><SmallLabel>WEEKLY OVERVIEW</SmallLabel><h2>By activity</h2></div><span className="muted">Monday – Sunday</span></div>
          {data.routines.map(r=>{
            let total=0,done=0;
            for(let i=0;i<7;i++){
              const k=addDays(monday(today),i);
              if(scheduled(r,k)){ total++; if(getOccurrence(data,r.id,k)?.status==="completed")done++; }
            }
            return <div className="activity-row" key={r.id}>
              <span>{r.title}</span>
              <div className="slim-progress"><div style={{width:`${total?done/total*100:0}%`}}/></div>
              <strong>{done}/{total}</strong>
            </div>;
          })}
        </div>

        {/* Feature 1: 7-Day Hydration Insights on Progress */}
        {(()=>{
          const wDays = Array.from({length:7},(_,i)=>addDays(monday(today),i));
          const wTotalGlasses = wDays.reduce((acc,k)=>acc+(data.water?.[k]||0),0);
          const wTotalMl = wTotalGlasses * 250;
          const daysAtGoal = wDays.filter(k=>(data.water?.[k]||0)>=8).length;
          const avgGlasses = (wTotalGlasses/7).toFixed(1);
          const maxGlasses = Math.max(8,...wDays.map(k=>data.water?.[k]||0));

          return <div className="water-chart-panel">
            <div className="section-title-row">
              <div><SmallLabel>DAILY HYDRATION</SmallLabel><h2>7-day water intake</h2><p>Target: 8 glasses (2,000 ml) every day.</p></div>
              <span className="muted">Monday – Sunday</span>
            </div>
            <div className="water-chart-stats">
              <div><small>WEEKLY VOLUME</small><strong>{(wTotalMl/1000).toFixed(1)} L</strong><small>{wTotalGlasses} glasses total</small></div>
              <div><small>DAYS AT 2L GOAL</small><strong>{daysAtGoal} / 7</strong><small>{daysAtGoal>=5?"💧 Hydration champion!":"Keep a bottle nearby"}</small></div>
              <div><small>DAILY AVERAGE</small><strong>{avgGlasses} glasses</strong><small>{Math.round(wTotalMl/7)} ml / day</small></div>
            </div>
            <div className="water-chart-bars">
              {wDays.map(k=>{
                const g = data.water?.[k]||0;
                const hPct = Math.min(100,Math.max(6,Math.round((g/maxGlasses)*100)));
                const isGoal = g>=8;
                return <div className="water-bar-col" key={k}>
                  <strong>{g}/8</strong>
                  <div className={`water-bar-stem ${isGoal?"goal":""}`} style={{height:`${hPct}%`}} title={`${niceDate(k,{weekday:"short"})}: ${g} glasses (${g*250} ml)`}/>
                  <span style={{fontWeight:600}}>{days[weekday(k)]}</span>
                  <span>{Number(k.slice(-2))}</span>
                </div>;
              })}
            </div>
            <div className="social-chart-legend">
              <div className="legend-pills">
                <div className="legend-pill"><span style={{background:"#0d9488"}}/> 8+ glasses (2L goal reached)</div>
                <div className="legend-pill"><span style={{background:"#5eead4"}}/> Under 8 glasses</div>
              </div>
              <span>Goal: 2,000 ml / day</span>
            </div>
          </div>;
        })()}

        {(()=>{
          const wDays=Array.from({length:7},(_,i)=>addDays(monday(today),i));
          const wTotal=wDays.reduce((acc,k)=>acc+(data.usage[k]||0),0);
          const wPlan=7*data.profile.allowance;
          const under=wDays.filter(k=>(data.usage[k]||0)<=data.profile.allowance).length;
          const maxU=Math.max(data.profile.allowance,...wDays.map(k=>data.usage[k]||0),60);
          return <div className="social-chart-panel">
            <div className="section-title-row"><div><SmallLabel>MINDFUL SCREEN HABITS</SmallLabel><h2>Social media balance</h2><p>Tracked daily against your {data.profile.allowance} min goal.</p></div><span className="muted">Monday – Sunday</span></div>
            <div className="social-chart-stats">
              <div><small>TOTAL LOGGED</small><strong>{Math.floor(wTotal/60)}h {wTotal%60}m</strong><small>of {Math.floor(wPlan/60)}h {wPlan%60}m planned</small></div>
              <div><small>DAYS IN BUDGET</small><strong>{under} / 7</strong><small>{under>=5?"🌿 Mindful momentum":"A gentle rhythm"}</small></div>
              <div><small>DAILY AVERAGE</small><strong>{Math.round(wTotal/7)} min</strong><small>allowance: {data.profile.allowance}m / day</small></div>
            </div>
            <div className="social-chart-bars">
              {wDays.map(k=>{
                const u=data.usage[k]||0;
                const hPct=Math.min(100,Math.max(5,Math.round((u/maxU)*100)));
                const st=u>data.profile.allowance?"exceeded":u>=data.profile.allowance*0.8?"warning":"ok";
                return <div className="social-bar-col" key={k}>
                  <strong>{u}m</strong>
                  <div className={`social-bar-stem ${st}`} style={{height:`${hPct}%`}} title={`${niceDate(k,{weekday:"short"})}: ${u} min logged`}/>
                  <span style={{fontWeight:600}}>{days[weekday(k)]}</span>
                  <span>{Number(k.slice(-2))}</span>
                </div>;
              })}
            </div>
            <div className="social-chart-legend">
              <div className="legend-pills">
                <div className="legend-pill"><span style={{background:"var(--sage)"}}/> ≤{data.profile.allowance}m budget</div>
                <div className="legend-pill"><span style={{background:"#dca354"}}/> Near limit</div>
                <div className="legend-pill"><span style={{background:"#d07469"}}/> Exceeded</div>
              </div>
              <span>Goal: {data.profile.allowance} min / day</span>
            </div>
          </div>;
        })()}

        <div className="course-progress-row">
          {data.courses.map(c=><div className="mini-progress" key={c.id}>
            <span className="small-round"><BookOpen size={19}/></span>
            <div><SmallLabel>LEARNING PATH</SmallLabel><h3>{c.title}</h3><p>{c.lessons.filter(x=>x.doneAt).length} of {c.lessons.length} lessons complete</p></div>
          </div>)}
        </div>
      </>}

      {view==="settings"&&<>
        <PageHead eyebrow="MAKE IT YOURS" title="Settings" description="Your routines can change whenever life does."/>
        <div className="settings-grid">
          <div>
            <div className="settings-card">
              <h2>Your details</h2>
              <label>Your name<input value={data.profile.name} placeholder="What should we call you?" onChange={e=>update(d=>{d.profile.name=e.target.value;return d;})}/></label>
              <label>Timezone
                <select value={data.profile.timezone} onChange={e=>update(d=>{d.profile.timezone=e.target.value;return d;})}>
                  {[...new Set([data.profile.timezone,"Africa/Addis_Ababa","Europe/London","Europe/Paris","America/New_York","America/Los_Angeles","Asia/Dubai","Asia/Kolkata","Australia/Sydney","UTC"])].map(t=><option key={t}>{t}</option>)}
                </select>
              </label>
              <p className="help-text">Dates and weekly totals use this timezone. Enter another IANA timezone below.</p>
              <input aria-label="Custom timezone" placeholder="e.g. Africa/Nairobi" onBlur={e=>{if(!e.target.value.trim())return;try{new Intl.DateTimeFormat("en",{timeZone:e.target.value.trim()});update(d=>{d.profile.timezone=e.target.value.trim();return d;});e.target.value="";}catch{setMessage("Please enter a valid IANA timezone.");}}}/>
              <label>Daily social media allowance <span className="inline-field"><input type="number" min="0" max="1440" value={data.profile.allowance} onChange={e=>update(d=>{d.profile.allowance=Math.max(0,Math.min(1440,Number(e.target.value)||0));return d;})}/> minutes</span></label>
            </div>

            {/* Feature 2: Browser Notifications & Reminders in Settings */}
            <div className="settings-card">
              <h2>Gentle reminders</h2>
              <p className="settings-subnote">Browser notifications keep gentle reminders on your screen for sips and rhythm throughout the day.</p>
              <div className="notification-toggle-box">
                <div>
                  <strong>Hydration sip reminder</strong>
                  <small>Gentle check-in every {data.profile.waterReminderInterval||2} hours between 9am – 9pm</small>
                </div>
                <input
                  type="checkbox"
                  checked={!!data.profile.notificationsEnabled}
                  onChange={e=>{
                    if(e.target.checked) requestNotificationPermission();
                    else update(d=>{ d.profile.notificationsEnabled=false; return d; });
                  }}
                  aria-label="Toggle hydration notifications"
                />
              </div>
              <label>Reminder frequency
                <select
                  value={data.profile.waterReminderInterval||2}
                  onChange={e=>{
                    const val=Number(e.target.value)||2;
                    update(d=>{ d.profile.waterReminderInterval=val; return d; });
                  }}
                >
                  <option value={1}>Every 1 hour</option>
                  <option value={2}>Every 2 hours (Recommended)</option>
                  <option value={3}>Every 3 hours</option>
                </select>
              </label>
              <div style={{marginTop:"14px"}}>
                <button type="button" className="outlined" onClick={sendTestNotification}>
                  <Bell size={15}/> Send test reminder
                </button>
              </div>
            </div>

            <div className="settings-card">
              <h2>Your data</h2>
              <p>Bloom saves only in this browser on this device. It does not sync with your iPhone. Export a backup before clearing browser data.</p>
              <div className="setting-actions">
                <button className="outlined" onClick={exportData}><Download size={17}/> Export JSON</button>
                <button className="outlined" onClick={()=>fileRef.current?.click()}><Upload size={17}/> Import JSON</button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importData(f);e.target.value="";}}/>
              </div>
              <button className="danger-link" onClick={()=>{if(window.confirm("Reset Bloom? This removes all routines and progress from this browser. Export a backup first if you want to keep it.")){setData(cloneSeed());setMessage("Bloom has been reset.");}}}><Trash2 size={16}/> Reset all data</button>
            </div>
          </div>

          <div className="settings-card routine-settings">
            <div className="section-title-row"><div><h2>Weekly routines</h2><p>Changes start tomorrow; earlier completion records remain.</p></div><button className="add-button" onClick={()=>setModal("routine")}><Plus size={16}/> Add routine</button></div>
            {data.routines.map(r=>{
              const v=currentVersion(r,editDate);
              if(!v)return null;
              return <div className="routine-setting" key={r.id}>
                <div className="routine-info"><span className="routine-icon"><Icon name={r.icon}/></span><div><strong>{r.title}</strong><small>{r.category} · {v.duration} min{v.time?` · ${v.time}`:""}</small></div></div>
                <button className="edit-button" onClick={()=>setEditing(editing===r.id?null:r.id)}>{editing===r.id?"Close":"Edit"}</button>
                {editing===r.id&&<div className="edit-area">
                  <div className="weekday-picker">{[1,2,3,4,5,6,0].map(day=><button key={day} className={v.weekdays.includes(day)?"selected":""} onClick={()=>setVersion(r.id,{weekdays:v.weekdays.includes(day)?v.weekdays.filter(x=>x!==day):[...v.weekdays,day]})}>{days[day]}</button>)}</div>
                  <label>Duration <input type="number" min="1" max="240" value={v.duration} onChange={e=>setVersion(r.id,{duration:Math.max(1,Math.min(240,Number(e.target.value)||1))})}/> min</label>
                  <label>Optional time <input type="time" value={v.time} onChange={e=>setVersion(r.id,{time:e.target.value})}/></label>
                  <label className="toggle-row"><input type="checkbox" checked={v.active} onChange={e=>setVersion(r.id,{active:e.target.checked})}/> Active</label>
                </div>}
              </div>;
            })}
          </div>
        </div>
      </>}
    </main>

    <nav className="bottom-nav" aria-label="Main navigation">{nav.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>setView(item.id)}><item.icon size={21} strokeWidth={1.9}/><span>{item.label}</span></button>)}</nav>

    {modal&&<CreateModal kind={modal} onClose={()=>setModal(null)} onCreate={(title,extra)=>{update(d=>{if(modal==="routine")d.routines.push({id:uid(),title,category:"Personal",icon:"sparkle",versions:[{from:today,weekdays:[1,2,3,4,5],duration:Number(extra)||20,time:"",active:true}]});if(modal==="goal")d.goals.push({id:uid(),title,targetDate:extra||today,milestones:[]});if(modal==="course")d.courses.push({id:uid(),title,kind:"custom",lessons:[]});return d;});setModal(null);}}/>}
    <label id="bloom-ios-haptic-label" htmlFor="bloom-ios-haptic-switch" style={{position:"fixed",opacity:0.001,pointerEvents:"none",width:"1px",height:"1px",overflow:"hidden",top:0,left:0,zIndex:-999}} aria-hidden="true">
      <input type="checkbox" id="bloom-ios-haptic-switch" {...({ switch: "" } as any)} style={{appearance:"auto"}} readOnly tabIndex={-1} />
    </label>
  </div>;
}

function Icon({name}:{name:string}){ const C=icons[name]||Sparkles; return <C size={19} strokeWidth={1.8}/>; }
function PageHead({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){ return <div className="page-head"><SmallLabel>{eyebrow}</SmallLabel><h1>{title}<span className="hero-period">.</span></h1><p>{description}</p></div>; }

function TaskCard({
  routine,
  data,
  date,
  onStatus,
  focus,
  focusElapsed,
  focusLeft,
  onFocusAction,
  onStartFocus,
  onLogWater,
  soundscape,
  onSoundscapeChange,
}:{
  routine:Routine;
  data:BloomData;
  date:string;
  onStatus:(id:string,date:string,status:"completed"|"skipped"|null)=>void;
  focus:BloomData["focus"];
  focusElapsed:number;
  focusLeft:number;
  onFocusAction:(action:"start"|"pause"|"cancel")=>void;
  onStartFocus:(id:string,len:number)=>void;
  onLogWater:(date:string,count:number)=>void;
  soundscape:SoundscapeType;
  onSoundscapeChange:(snd:SoundscapeType)=>void;
}){
  const o=getOccurrence(data,routine.id,date);
  const v=currentVersion(routine,date);
  const isWater=routine.id==="water";
  const waterCount=data.water?.[date]||0;
  const isFocused=focus.taskId===routine.id&&focus.status!=="idle";
  const duration=routine.id==="social"?data.profile.allowance:(v?.duration||20);
  const mm=Math.floor(focusLeft/60).toString().padStart(2,"0");
  const ss=(focusLeft%60).toString().padStart(2,"0");
  const progressPct=focus.length>0?Math.min(100,Math.round((focusElapsed/focus.length)*100)):0;

  return <div className={`task-card-wrap ${isFocused?"focused":""}`}>
    <div className={`task-card ${o?.status||""}`}>
      <button className="task-check" aria-label={o?.status==="completed"?`Undo ${routine.title}`:`Complete ${routine.title}`} onClick={()=>onStatus(routine.id,date,o?.status==="completed"?null:"completed")}>
        {o?.status==="completed"?<Check size={20}/>:<Circle size={22}/>}
      </button>
      <span className="task-icon"><Icon name={routine.icon}/></span>
      <div className="task-copy">
        <strong>{routine.title}</strong>
        <span>{isWater?`Wellbeing · ${waterCount} of 8 glasses (${waterCount*250} ml)`:`${routine.category} · ${minutes(duration)}${v?.time?` · ${v.time}`:""}`}</span>
      </div>
      <div className="task-actions">
        {o?.status==="skipped"?<button onClick={()=>onStatus(routine.id,date,null)} title="Undo skip"><RotateCcw size={17}/></button>:<button onClick={()=>onStatus(routine.id,date,"skipped")} title="Skip task" aria-label={`Skip ${routine.title}`}><SkipForward size={17}/></button>}
        {isFocused?(focus.status==="running"?<button onClick={()=>onFocusAction("pause")} title="Pause timer" aria-label={`Pause ${routine.title}`}><Pause size={16}/></button>:<button onClick={()=>onFocusAction("start")} title="Resume timer" aria-label={`Resume ${routine.title}`}><Play size={16}/></button>):<button onClick={()=>onStartFocus(routine.id,duration)} title="Start activity timer" aria-label={`Start timer for ${routine.title}`}><Play size={16}/></button>}
      </div>
      {o?.status==="skipped"&&<span className="status-tag">Skipped</span>}
    </div>

    {/* Inline timer drawer with Soundscapes */}
    {isFocused&&<div className="activity-timer-drawer">
      <div className="activity-timer-header">
        <span className="activity-timer-title"><Clock3 size={13}/> {focus.status==="finished"?"Time Completed":focus.status==="paused"?"Timer Paused":"Activity in progress"}</span>
        <span className="activity-timer-digits">{mm}:{ss}</span>
      </div>
      <div className="activity-timer-bar"><div style={{width:`${progressPct}%`}}/></div>

      {/* Feature 4: Soundscape Selector inside Drawer */}
      <div className="ambient-sound-row">
        <span className="ambient-sound-label"><Volume2 size={12}/> Soundscape:</span>
        {(["none", "rain", "breeze", "calm"] as const).map(snd => (
          <button
            key={snd}
            type="button"
            className={`ambient-btn ${soundscape === snd ? "active" : ""}`}
            onClick={() => onSoundscapeChange(snd)}
          >
            {snd === "none" ? "Off" : snd === "rain" ? "🌧️ Rain" : snd === "breeze" ? "🍃 Breeze" : "✨ Calm"}
          </button>
        ))}
      </div>

      {focus.status==="finished"?<div className="activity-timer-finished">
        <span>✨ Great session! Ready to complete?</span>
        <button className="timer-btn success" onClick={()=>{onStatus(routine.id,date,"completed");onFocusAction("cancel")}}><Check size={14}/> Mark complete</button>
      </div>:<div className="activity-timer-actions">
        {focus.status==="running"?<button className="timer-btn primary" onClick={()=>onFocusAction("pause")}><Pause size={14}/> Pause</button>:<button className="timer-btn primary" onClick={()=>onFocusAction("start")}><Play size={14}/> Resume</button>}
        <button className="timer-btn success" onClick={()=>{onStatus(routine.id,date,"completed");onFocusAction("cancel")}}><Check size={14}/> Done</button>
        <button className="timer-btn ghost" onClick={()=>onFocusAction("cancel")}><X size={14}/> Cancel</button>
      </div>}
    </div>}

    {isWater&&<div className="water-tracker-card">
      <div className="water-tracker-header">
        <div className="water-tracker-stats">
          <Droplets size={16} color="#0d9488"/>
          <span><strong>{waterCount}</strong> of 8 glasses logged</span>
          <span className="water-ml">({waterCount*250} ml / 2,000 ml)</span>
        </div>
        <div className="water-tracker-btns">
          <button type="button" className="water-add-btn" onClick={()=>onLogWater(date,waterCount+1)} title="Log 1 glass (250 ml)"><Plus size={13}/> Glass</button>
          {waterCount>0&&<button type="button" className="water-sub-btn" onClick={()=>onLogWater(date,waterCount-1)} title="Remove 1 glass">-1</button>}
        </div>
      </div>
      <div className="water-droplets-row">
        {Array.from({length:8},(_,i)=>{
          const isFilled=i<waterCount;
          return <button key={i} type="button" className={`water-drop-cup ${isFilled?"filled":""}`} onClick={()=>onLogWater(date,isFilled&&i===waterCount-1?i:i+1)} title={`Glass ${i+1} (250 ml)${isFilled?" - logged":""}`} aria-label={`Glass ${i+1}`}><Droplets size={16}/></button>;
        })}
      </div>
      <p className="water-note">{waterCount>=8?"✨ Beautifully hydrated today! 2 litres achieved.":waterCount===0?"💧 Tap a glass whenever you take a sip throughout your day.":`💧 Keep sipping gently — ${8-waterCount} ${8-waterCount===1?"glass":"glasses"} left to reach 2L.`}</p>
    </div>}
  </div>;
}

function CreateModal({kind,onClose,onCreate}:{kind:"routine"|"goal"|"course";onClose:()=>void;onCreate:(title:string,extra:string)=>void}){
  const [title,setTitle]=useState("");
  const [extra,setExtra]=useState(kind==="routine"?"20":kind==="goal"?"2026-12-31":"");
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(title.trim())onCreate(title.trim(),extra)}}><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19}/></button><SmallLabel>MAKE SPACE FOR MORE</SmallLabel><h2>New {kind}</h2><label>Name<input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==="routine"?"e.g. Morning walk":"Give it a name"}/></label>{kind==="routine"&&<label>Minutes<input type="number" min="1" max="240" value={extra} onChange={e=>setExtra(e.target.value)}/></label>}{kind==="goal"&&<label>Target date<input type="date" value={extra} onChange={e=>setExtra(e.target.value)}/></label>}<button className="primary" type="submit"><Plus size={16}/> Create {kind}</button></form></div>;
}

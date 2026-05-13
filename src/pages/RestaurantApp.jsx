import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue, push, set, update, remove, get } from "firebase/database";

// ── Helpers ───────────────────────────────────────────────────────────────────
const toArr    = (obj)  => obj ? Object.entries(obj).map(([fbKey, val]) => ({ ...val, fbKey })) : [];
const tabTotal = (items)=> items.reduce((s, i) => s + i.price * i.qty, 0);
const fmtTime  = (iso)  => iso ? new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "—";
const fmtDate  = (iso)  => iso ? new Date(iso).toLocaleDateString() : "—";
const fmtDur   = (ms)   => { const h=Math.floor(ms/3.6e6); const m=Math.floor((ms%3.6e6)/6e4); return `${h}h ${m}m`; };

function playBell(times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = i === 1 ? 1100 : 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.5, ctx.currentTime + i*.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*.22 + .4);
      osc.start(ctx.currentTime + i*.22); osc.stop(ctx.currentTime + i*.22 + .5);
    }
  } catch(_) {}
}

function printTicket(order, restaurantName = "Restaurant") {
  const win = window.open("", "_blank", "width=400,height=620");
  if (!win) { alert("Allow pop-ups to print tickets"); return; }
  const tax = order.total * 0.1;
  win.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
    <style>@media print{@page{margin:0;size:80mm auto;}body{margin:8px;}}
    body{font-family:monospace;font-size:13px;padding:14px;width:280px;}
    h1{text-align:center;font-size:16px;margin:0 0 4px;}.sep{border:none;border-top:1px dashed #999;margin:8px 0;}
    .row{display:flex;justify-content:space-between;padding:3px 0;}.bold{font-weight:bold;}
    .tag{font-size:11px;background:#f0f0f0;padding:3px 7px;border-radius:4px;margin-bottom:8px;display:inline-block;}
    </style></head><body>
    <h1>${restaurantName}</h1>
    <div style="text-align:center;font-size:10px;color:#888;margin-bottom:10px">${new Date(order.time).toLocaleString()}</div>
    <div class="tag">${order.source==="customer"?"📱 Customer QR":`👨‍🍳 Waiter: ${order.waiterName}`}</div>
    <div class="row bold"><span>TABLE: ${order.tableName}</span></div>
    <hr class="sep"/>
    ${order.items.map(i=>`<div class="row"><span>${i.emoji} ${i.name} ×${i.qty}</span><span>$${(i.price*i.qty).toFixed(2)}</span></div>`).join("")}
    <hr class="sep"/>
    <div class="row"><span>Subtotal</span><span>$${order.total.toFixed(2)}</span></div>
    <div class="row"><span>Tax (10%)</span><span>$${tax.toFixed(2)}</span></div>
    <div class="row bold" style="font-size:15px"><span>TOTAL</span><span>$${(order.total+tax).toFixed(2)}</span></div>
    <div style="text-align:center;font-size:10px;color:#888;margin-top:10px">Thank you!</div>
    <script>setTimeout(()=>{window.print();window.close();},500);</script></body></html>`);
  win.document.close();
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RestaurantApp({ user, restaurantId, restaurantInfo, onLogout }) {
  // Firebase state
  const [menu,    setMenu]    = useState([]);
  const [tables,  setTables]  = useState([]);
  const [orders,  setOrders]  = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [config,  setConfig]  = useState({});

  // UI mode
  const [mode, setMode] = useState("select");

  // Waiter
  const [waiterAuth, setWaiterAuth] = useState(null);
  const [waiterPin,  setWaiterPin]  = useState("");
  const [wView,      setWView]      = useState("tables");
  const [selTable,   setSelTable]   = useState(null);
  const [draft,      setDraft]      = useState([]);
  const [wMenuCat,   setWMenuCat]   = useState("All");

  // Kitchen
  const [kitchenOn, setKitchenOn] = useState(false);
  const [kitPin,    setKitPin]    = useState("");
  const prevKitLen = useRef(0);

  // Manager
  const [mgrOn,     setMgrOn]    = useState(false);
  const [mgrPwd,    setMgrPwd]   = useState("");
  const [mgrView,   setMgrView]  = useState("dashboard");
  const [newItem,   setNewItem]  = useState({ name:"", category:"Starters", price:"", emoji:"🍽", img:"", available:true });
  const [newWaiter, setNewWaiter]= useState({ name:"", pin:"" });

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Firebase ref helper
  const rRef = (path) => ref(db, `restaurants/${restaurantId}/${path}`);

  // ── Firebase listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const off = [
      onValue(rRef("menu"),    (s) => setMenu(toArr(s.val()).sort((a,b)=>a.name.localeCompare(b.name)))),
      onValue(rRef("tables"),  (s) => { const v=s.val()||{}; setTables(Object.values(v).sort((a,b)=>a.id-b.id)); }),
      onValue(rRef("orders"),  (s) => setOrders(toArr(s.val()).sort((a,b)=>new Date(b.time)-new Date(a.time)))),
      onValue(rRef("waiters"), (s) => setWaiters(toArr(s.val()))),
      onValue(rRef("config"),  (s) => { if(s.exists()) setConfig(s.val()); }),
    ];
    return () => off.forEach((u) => u());
  }, [restaurantId]);

  // Kitchen bell
  const kitchenPending = orders.filter((o) => o.status === "kitchen");
  useEffect(() => {
    if (kitchenPending.length > prevKitLen.current && kitchenOn) {
      playBell(); showToast("🔔 New order in kitchen!");
    }
    prevKitLen.current = kitchenPending.length;
  }, [kitchenPending.length, kitchenOn]);

  // ── Trial info ──────────────────────────────────────────────────────────────
  const trialEnd     = restaurantInfo?.trialEnd || 0;
  const trialDaysLeft= Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000));
  const isTrialActive= restaurantInfo?.plan === "trial" && trialDaysLeft > 0;
  const isExpired    = restaurantInfo?.plan === "trial" && trialDaysLeft === 0;

  // ── Shared logic ───────────────────────────────────────────────────────────
  const allCats = ["All", ...new Set(menu.map((i) => i.category))];

  const submitOrder = async (tableId, tableName, items, source, waiterName) => {
    const data = { tableId, tableName, waiterName:waiterName||"Customer", items:[...items],
      status:"kitchen", time:new Date().toISOString(), total:tabTotal(items), source };
    await push(rRef("orders"), data);
    await update(rRef(`tables/${tableId}`), { status:"occupied" });
    return data;
  };

  const markReady = async (order) => {
    await update(rRef(`orders/${order.fbKey}`), { status:"ready" });
    playBell(1); showToast(`✅ ${order.tableName} ready!`);
    printTicket(order, config.restaurantName);
  };

  const markPaid = async (order) => {
    await update(rRef(`orders/${order.fbKey}`), { status:"paid" });
    const stillOpen = orders.filter((o)=>o.tableId===order.tableId&&o.fbKey!==order.fbKey&&o.status!=="paid");
    if (stillOpen.length===0) await update(rRef(`tables/${order.tableId}`), { status:"available" });
    showToast("💳 Payment recorded!");
  };

  // Waiter
  const waiterLogin = () => {
    const w = waiters.find((w)=>w.pin===waiterPin);
    if (!w) { alert("Wrong PIN"); return; }
    setWaiterAuth(w);
    update(rRef(`waiters/${w.fbKey}`), { loginTime:new Date().toISOString() });
    setWaiterPin("");
  };
  const waiterLogout = async () => {
    if (waiterAuth) {
      const w = waiters.find((w)=>w.fbKey===waiterAuth.fbKey);
      if (w?.loginTime) {
        const sess = { login:w.loginTime, logout:new Date().toISOString() };
        const sessions = [...(Array.isArray(w.sessions)?w.sessions:Object.values(w.sessions||{})), sess];
        await update(rRef(`waiters/${waiterAuth.fbKey}`), { loginTime:null, sessions });
      }
    }
    setWaiterAuth(null); setSelTable(null); setDraft([]); setWView("tables");
  };
  const addToDraft = (item) => setDraft((p)=>{const ex=p.find((i)=>i.fbKey===item.fbKey);return ex?p.map((i)=>i.fbKey===item.fbKey?{...i,qty:i.qty+1}:i):[...p,{...item,qty:1}];});
  const removeFromDraft = (fbKey) => setDraft((p)=>p.map((i)=>i.fbKey===fbKey?{...i,qty:i.qty-1}:i).filter((i)=>i.qty>0));
  const submitWaiterOrder = async () => {
    if (!selTable||draft.length===0) return;
    const table=tables.find((t)=>t.id===selTable);
    const od=await submitOrder(selTable,table.name,draft,"waiter",waiterAuth.name);
    printTicket(od,config.restaurantName);
    setDraft([]); setSelTable(null); setWView("tables"); showToast("✅ Order sent to kitchen!");
  };

  // Manager
  const saveMenuItem = async () => {
    if (!newItem.name||!newItem.price) { alert("Name and price required"); return; }
    await push(rRef("menu"), {...newItem, price:parseFloat(newItem.price)});
    setNewItem({name:"",category:"Starters",price:"",emoji:"🍽",img:"",available:true});
    showToast("✅ Item added!");
  };
  const updateMenuItem = (item,field,val) => update(rRef(`menu/${item.fbKey}`), {[field]:val});
  const deleteMenuItem = async (item) => { if(!confirm(`Delete "${item.name}"?`)) return; await remove(rRef(`menu/${item.fbKey}`)); };
  const addNewWaiter = async () => {
    if (!newWaiter.name||!newWaiter.pin) { alert("Name and PIN required"); return; }
    if (waiters.find((w)=>w.pin===newWaiter.pin)) { alert("PIN already in use"); return; }
    await push(rRef("waiters"), {...newWaiter,role:"waiter",loginTime:null,sessions:[]});
    setNewWaiter({name:"",pin:""});  showToast("✅ Waiter added!");
  };
  const removeWaiter = async (w) => { if(!confirm(`Remove ${w.name}?`)) return; await remove(rRef(`waiters/${w.fbKey}`)); };
  const saveConfig   = (updates) => update(rRef("config"), updates);

  const todayPaid   = orders.filter((o)=>o.status==="paid");
  const todayRev    = todayPaid.reduce((s,o)=>s+o.total,0);
  const pendingOrds = orders.filter((o)=>o.status!=="paid");
  const custNotifs  = orders.filter((o)=>o.source==="customer"&&o.status==="kitchen");

  const rName = config.restaurantName || restaurantInfo?.name || "My Restaurant";


  // ── SUSPENDED ───────────────────────────────────────────────────────────────
  if (restaurantInfo?.status === "suspended") return (
    <div style={S.bg}><GS />
      <div style={S.loginWrap}>
        <div style={{fontSize:48}}>⛔</div>
        <div style={{...S.loginTitle, color:"#f06050"}}>Account Suspended</div>
        <div style={{color:"#706040",textAlign:"center",lineHeight:1.8,marginBottom:24}}>
          Your account <strong style={{color:"#c8922a"}}>{rName}</strong> has been suspended.<br/>
          Please contact support to resolve this.
        </div>
        <button style={{...S.backBtn, marginTop:8}} onClick={onLogout}>← Logout</button>
      </div>
    </div>
  );

  // ── EXPIRED TRIAL ───────────────────────────────────────────────────────────
  if (isExpired) return (
    <div style={S.bg}><GS />
      <div style={S.loginWrap}>
        <div style={{fontSize:48}}>⏰</div>
        <div style={{...S.loginTitle, color:"#f06050"}}>Trial Ended</div>
        <div style={{color:"#706040",textAlign:"center",lineHeight:1.8,marginBottom:24}}>
          Your 14-day free trial for <strong style={{color:"#c8922a"}}>{rName}</strong> has expired.<br/>
          Subscribe to keep using TableFlow.
        </div>
        {/* ================================================================
            💳 STRIPE SUBSCRIPTION BUTTON — ADD STRIPE HERE
            1. Create a Stripe account at stripe.com (free)
            2. Create a Price in Stripe Dashboard
            3. Replace this button's onClick with:
               window.location.href = "YOUR_STRIPE_PAYMENT_LINK"
            4. Set up a Stripe webhook to update Firebase plan to "active"
            ================================================================ */}
        <button style={{...S.btnGold, padding:"14px 32px", fontSize:16}}
          onClick={() => alert("💳 STRIPE NOT YET CONNECTED\n\nWhen you add Stripe, this button will open the payment page.")}>
          💳 Subscribe — $29/month
        </button>
        <div style={{color:"#403020",fontSize:12,marginTop:10}}>Stripe payment coming soon</div>
        <button style={{...S.backBtn,marginTop:20}} onClick={onLogout}>← Logout</button>
      </div>
    </div>
  );

  // ── MODE SELECT ─────────────────────────────────────────────────────────────
  if (mode === "select") return (
    <div style={S.bg}><GS />
      {toast && <Toast msg={toast} />}
      {/* Trial banner */}
      {isTrialActive && (
        <div style={S.trialBanner}>
          ⏳ Trial: <strong>{trialDaysLeft} day{trialDaysLeft!==1?"s":""} left</strong> · 
          {/* STRIPE PLACEHOLDER — see expired screen above */}
          <button style={{background:"#c8922a",color:"#1a0800",border:"none",padding:"3px 10px",borderRadius:12,fontSize:12,fontWeight:700,marginLeft:8,cursor:"pointer"}}
            onClick={() => alert("💳 STRIPE NOT YET CONNECTED")}>
            Subscribe Now
          </button>
        </div>
      )}
      <div style={S.modeWrap}>
        <div style={{fontSize:46}}>🍽</div>
        <div style={S.modeTitle}>{rName}</div>
        <div style={S.modeSub}>Choose your panel</div>
        <div style={S.modeBtns}>
          {[
            {icon:"👨‍🍳",label:"Waiter App",     sub:"Take orders from tables",   k:"waiter"},
            {icon:"🍳", label:"Kitchen Display", sub:"View & manage live orders",  k:"kitchen"},
            {icon:"👔", label:"Manager Panel",   sub:"Menu · Staff · Revenue",    k:"manager"},
          ].map((m) => (
            <button key={m.k} style={S.modeBtn} onClick={()=>setMode(m.k)}>
              <span style={{fontSize:26}}>{m.icon}</span>
              <div><div style={{fontWeight:700,fontSize:14}}>{m.label}</div><div style={{fontSize:11,color:"#907050"}}>{m.sub}</div></div>
            </button>
          ))}
        </div>
        <div style={{borderTop:"1px solid #2a1808",marginTop:20,paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}>
          <div style={{fontSize:11,color:"#403020"}}>🔥 Firebase · Real-time sync</div>
          <button style={{...S.backBtn,fontSize:12}} onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );

  // ── WAITER ──────────────────────────────────────────────────────────────────
  if (mode === "waiter") {
    if (!waiterAuth) return (
      <div style={S.bg}><GS />
        <div style={S.loginWrap}>
          <div style={{fontSize:44}}>👨‍🍳</div>
          <div style={S.loginTitle}>Waiter Login</div>
          <div style={{color:"#706040",fontSize:13}}>Enter your PIN</div>
          <input style={S.pinInput} type="password" maxLength={6} placeholder="••••"
            value={waiterPin} onChange={(e)=>setWaiterPin(e.target.value)}
            onKeyDown={(e)=>e.key==="Enter"&&waiterLogin()} />
          <button style={S.btnGold} onClick={waiterLogin}>Log In</button>
          <button style={S.backBtn} onClick={()=>setMode("select")}>← Back</button>
        </div>
      </div>
    );

    const tableOrds=(id)=>orders.filter((o)=>o.tableId===id&&o.status!=="paid");
    return (
      <div style={S.app}><GS />
        {toast && <Toast msg={toast} />}
        <header style={S.header}>
          <div style={S.logo}>👨‍🍳 {waiterAuth.name}</div>
          <nav style={S.nav}>
            {[{k:"tables",l:"🏠 Tables"},{k:"menu",l:"🍽 Menu"},{k:"orders",l:"📋 Orders"}].map((n)=>(
              <button key={n.k} style={{...S.navBtn,...(wView===n.k?S.navActive:{})}} onClick={()=>setWView(n.k)}>{n.l}</button>
            ))}
          </nav>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {custNotifs.length>0&&<button style={S.notifBadge} onClick={()=>setWView("orders")}>🔔 {custNotifs.length}</button>}
            <button style={S.logoutBtn} onClick={waiterLogout}>Logout</button>
          </div>
        </header>
        <main style={S.main}>
          {wView==="tables"&&(
            <div>
              <ST>Floor Plan</ST>
              {custNotifs.length>0&&<div style={S.alert}>🔔 Customer orders: {custNotifs.map((o)=>o.tableName).join(", ")}</div>}
              <div style={S.tableGrid}>
                {tables.map((t)=>{
                  const tOrds=tableOrds(t.id);
                  const ready=tOrds.some((o)=>o.status==="ready");
                  return (<div key={t.id} style={{...S.tableCard,...(t.status==="occupied"?S.tOcc:S.tAvail),...(selTable===t.id?S.tSel:{})}}
                    onClick={()=>{setSelTable(t.id);setWView("menu");}}>
                    <div style={S.tName}>{t.name}</div>
                    <div style={S.tStatus}>{t.status==="occupied"?"🟡 Occupied":"🟢 Free"}</div>
                    {ready&&<div style={{color:"#50c878",fontSize:11,marginTop:4}}>✅ Ready!</div>}
                    {tOrds.length>0&&<div style={S.tTotal}>${tOrds.reduce((s,o)=>s+o.total,0).toFixed(2)}</div>}
                  </div>);
                })}
              </div>
            </div>
          )}
          {wView==="menu"&&(
            <div>
              <div style={S.orderHeader}>
                <div style={S.orderTitle}>{selTable?`${tables.find((t)=>t.id===selTable)?.name} — New Order`:"Select a table first"}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {draft.length>0&&selTable&&<button style={S.btnGold} onClick={submitWaiterOrder}>🖨 Send to Kitchen · ${tabTotal(draft).toFixed(2)}</button>}
                  {selTable&&<button style={S.btnRed} onClick={()=>{setSelTable(null);setDraft([]);setWView("tables");}}>✕ Cancel</button>}
                </div>
              </div>
              <CatBar cats={allCats} active={wMenuCat} onChange={setWMenuCat} />
              <div style={S.menuGrid}>
                {(wMenuCat==="All"?menu:menu.filter((i)=>i.category===wMenuCat)).filter((i)=>i.available).map((item)=>{
                  const inD=draft.find((i)=>i.fbKey===item.fbKey);
                  return (<div key={item.fbKey} style={S.menuCard}>
                    <img src={item.img} alt="" style={S.menuImg} onError={(e)=>(e.target.style.display="none")} />
                    <div style={{padding:"8px 10px 0"}}>
                      <div style={S.mName}>{item.emoji} {item.name}</div>
                      <div style={S.mCat}>{item.category}</div>
                      <div style={S.mPrice}>${item.price.toFixed(2)}</div>
                    </div>
                    {inD?(<div style={{...S.qtyCtrl,margin:"0 10px 10px"}}>
                      <button style={S.qBtn} onClick={()=>removeFromDraft(item.fbKey)}>−</button>
                      <span style={S.qNum}>{inD.qty}</span>
                      <button style={S.qBtn} onClick={()=>addToDraft(item)}>+</button>
                    </div>):(<button style={{...S.addBtn,opacity:selTable?1:0.4}} onClick={()=>selTable?addToDraft(item):alert("Select a table first")}>+ Add</button>)}
                  </div>);
                })}
              </div>
            </div>
          )}
          {wView==="orders"&&(
            <div>
              <ST>Active Orders</ST>
              {pendingOrds.length===0&&<Empty>No active orders</Empty>}
              {pendingOrds.map((order)=>(
                <OCard key={order.fbKey} order={order}>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    {order.status==="ready"&&<button style={S.btnGold} onClick={()=>markPaid(order)}>💳 Mark Paid</button>}
                    <button style={S.btnOutline} onClick={()=>printTicket(order,config.restaurantName)}>🖨 Print</button>
                  </div>
                </OCard>
              ))}
            </div>
          )}
        </main>
        <BackBtn onClick={()=>setMode("select")} />
      </div>
    );
  }

  // ── KITCHEN ─────────────────────────────────────────────────────────────────
  if (mode === "kitchen") {
    if (!kitchenOn) return (
      <div style={{...S.bg,background:"#040404"}}><GS />
        <div style={S.loginWrap}>
          <div style={{fontSize:48}}>🍳</div>
          <div style={S.loginTitle}>Kitchen Access</div>
          <input style={S.pinInput} type="password" placeholder="PIN" value={kitPin} onChange={(e)=>setKitPin(e.target.value)} />
          <button style={S.btnGold} onClick={()=>{if(kitPin===(config.kitchenPin||"kitchen")){setKitchenOn(true);setKitPin("");}else alert("Wrong PIN. Default: kitchen");}}>Enter Kitchen</button>
          <div style={{color:"#503020",fontSize:11}}>Default PIN: kitchen</div>
          <button style={S.backBtn} onClick={()=>setMode("select")}>← Back</button>
        </div>
      </div>
    );
    return (
      <div style={{...S.app,background:"#060606",color:"#e8d8a0"}}><GS />
        {toast&&<Toast msg={toast} />}
        <header style={{...S.header,background:"#0d0d0d",borderColor:"#2a2010"}}>
          <div style={{...S.logo,fontSize:17}}>🍳 KITCHEN — {rName}</div>
          <div style={{fontWeight:700,color:kitchenPending.length>0?"#f06030":"#50c878"}}>{kitchenPending.length>0?`🔥 ${kitchenPending.length} pending`:"✅ All clear"}</div>
          <button style={S.backBtn} onClick={()=>setMode("select")}>← Back</button>
        </header>
        <main style={{padding:16}}>
          {kitchenPending.length===0?(
            <div style={{textAlign:"center",padding:"70px 20px",color:"#1e1e18"}}><div style={{fontSize:60}}>✅</div><div style={{fontSize:18,marginTop:12,color:"#303025"}}>All orders done!</div></div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14}}>
              {kitchenPending.map((order)=>{
                const mins=Math.floor((Date.now()-new Date(order.time))/60000);
                const urgent=mins>=10;
                return (<div key={order.fbKey} style={{background:"#0f0f0f",border:`2px solid ${urgent?"#ff3020":"#2a2010"}`,borderRadius:12,padding:16,boxShadow:urgent?"0 0 22px rgba(255,40,20,.4)":"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:"serif",fontSize:20,color:"#c8922a",fontWeight:700}}>{order.tableName}</span>
                    <span style={{color:urgent?"#ff4040":"#f0a030",fontWeight:700}}>⏱ {mins}m</span>
                  </div>
                  <div style={{fontSize:11,color:"#505040",marginBottom:10}}>{order.source==="customer"?"📱 Customer QR":`👨‍🍳 ${order.waiterName}`}</div>
                  <div style={{borderTop:"1px solid #2a2010",paddingTop:8}}>
                    {order.items.map((i,idx)=>(<div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #181808"}}>
                      <span style={{fontSize:20}}>{i.emoji}</span>
                      <span style={{flex:1,fontSize:14,color:"#ddd0a0"}}>{i.name}</span>
                      <span style={{fontSize:20,color:"#c8922a",fontWeight:700}}>×{i.qty}</span>
                    </div>))}
                  </div>
                  <div style={{textAlign:"right",color:"#c8922a",fontSize:16,fontWeight:700,margin:"8px 0"}}>${order.total.toFixed(2)}</div>
                  <button style={{...S.btnGold,width:"100%",padding:11,fontSize:14}} onClick={()=>markReady(order)}>✅ Done — Mark Ready & Print</button>
                </div>);
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── MANAGER ─────────────────────────────────────────────────────────────────
  if (mode === "manager") {
    if (!mgrOn) return (
      <div style={S.bg}><GS />
        <div style={S.loginWrap}>
          <div style={{fontSize:48}}>👔</div>
          <div style={S.loginTitle}>Manager Login</div>
          <input style={S.pinInput} type="password" placeholder="Password" value={mgrPwd} onChange={(e)=>setMgrPwd(e.target.value)}
            onKeyDown={(e)=>e.key==="Enter"&&(()=>{if(mgrPwd===(config.managerPassword||"admin")){setMgrOn(true);setMgrPwd("");}else alert("Wrong password");})()}/>
          <button style={S.btnGold} onClick={()=>{if(mgrPwd===(config.managerPassword||"admin")){setMgrOn(true);setMgrPwd("");}else alert("Wrong password. Default: admin");}}>Login</button>
          <div style={{color:"#503020",fontSize:11}}>Default: admin</div>
          <button style={S.backBtn} onClick={()=>setMode("select")}>← Back</button>
        </div>
      </div>
    );

    const appUrl = config.appUrl || window.location.origin;

    const downloadQR = (tableId, tableName) => {
      const data = `${appUrl}?r=${restaurantId}&table=${tableId}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;
      const a = document.createElement("a");
      a.href = qrUrl;
      a.download = `QR-${tableName.replace(/\s+/g,"-")}.png`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const addTable = async () => {
      const nextId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;
      const name = prompt(`Name for new table:`, `Table ${nextId}`);
      if (!name) return;
      await set(rRef(`tables/${nextId}`), { id: nextId, name, status: "available" });
      showToast("✅ Table added!");
    };

    const deleteTable = async (t) => {
      if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
      await remove(rRef(`tables/${t.id}`));
      showToast("Table removed.");
    };

    return (
      <div style={S.app}><GS />
        {toast&&<Toast msg={toast} />}
        <header style={S.header}>
          <div style={S.logo}>👔 {rName}</div>
          <nav style={S.nav}>
            {[{k:"dashboard",l:"📊 Dashboard"},{k:"menu",l:"🍽 Menu"},{k:"waiters",l:"👥 Staff"},{k:"settings",l:"⚙️ Settings"}].map((n)=>(
              <button key={n.k} style={{...S.navBtn,...(mgrView===n.k?S.navActive:{})}} onClick={()=>setMgrView(n.k)}>{n.l}</button>
            ))}
          </nav>
          <button style={S.logoutBtn} onClick={()=>{setMgrOn(false);setMode("select");}}>Logout</button>
        </header>
        <main style={S.main}>

          {/* Trial / subscription banner in manager */}
          {isTrialActive&&(
            <div style={{...S.trialBanner,borderRadius:10,marginBottom:18}}>
              ⏳ <strong>{trialDaysLeft} days</strong> left on your free trial ·
              {/* ================================================================
                  💳 STRIPE SUBSCRIBE BUTTON — ADD STRIPE HERE
                  Replace onClick with: window.location.href = "YOUR_STRIPE_LINK"
                  ================================================================ */}
              <button style={{background:"#c8922a",color:"#1a0800",border:"none",padding:"4px 12px",borderRadius:12,fontSize:12,fontWeight:700,marginLeft:8,cursor:"pointer"}}
                onClick={()=>alert("💳 STRIPE NOT YET CONNECTED\n\nAdd your Stripe payment link here.")}>
                Upgrade Now
              </button>
            </div>
          )}

          {mgrView==="dashboard"&&(
            <div>
              <div style={S.statsRow}>
                {[{v:`$${todayRev.toFixed(2)}`,l:"Revenue Today",c:"#50c878"},{v:todayPaid.length,l:"Paid Orders",c:"#c8922a"},{v:pendingOrds.length,l:"Active Orders",c:"#f06050"},{v:waiters.filter((w)=>w.loginTime).length,l:"On Duty",c:"#6090f0"}].map((s)=>(
                  <div key={s.l} style={S.statCard}><div style={{...S.statVal,color:s.c}}>{s.v}</div><div style={S.statLbl}>{s.l}</div></div>
                ))}
              </div>
              <ST>Recent Orders</ST>
              {orders.length===0&&<Empty>No orders yet</Empty>}
              {orders.slice(0,20).map((o)=>(
                <div key={o.fbKey} style={S.paidRow}>
                  <span style={{color:"#c8922a",fontWeight:700}}>{o.tableName}</span>
                  <span style={{color:"#706040",fontSize:13}}>{o.waiterName}</span>
                  <span style={{color:"#504030",fontSize:11}}>{fmtTime(o.time)}</span>
                  <SBadge status={o.status} />
                  <span style={{color:"#c8922a",fontWeight:700}}>${o.total.toFixed(2)}</span>
                  <button style={S.btnSm} onClick={()=>printTicket(o,config.restaurantName)}>🖨</button>
                </div>
              ))}
            </div>
          )}

          {mgrView==="menu"&&(
            <div>
              <ST>Menu Management</ST>
              <div style={S.formBox}>
                <div style={S.formTitle}>+ Add New Item</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:10}}>
                  <input style={S.input} placeholder="Name *" value={newItem.name} onChange={(e)=>setNewItem((p)=>({...p,name:e.target.value}))} />
                  <input style={S.input} placeholder="Price *" type="number" step="0.01" value={newItem.price} onChange={(e)=>setNewItem((p)=>({...p,price:e.target.value}))} />
                  <select style={S.input} value={newItem.category} onChange={(e)=>setNewItem((p)=>({...p,category:e.target.value}))}>
                    {["Starters","Mains","Desserts","Cocktails","Beer","Wine","Spirits","Soft Drinks"].map((c)=><option key={c}>{c}</option>)}
                  </select>
                  <input style={S.input} placeholder="Emoji 🍕" value={newItem.emoji} onChange={(e)=>setNewItem((p)=>({...p,emoji:e.target.value}))} />
                </div>
                <input style={{...S.input,marginBottom:10}} placeholder="Photo URL (paste any image link)" value={newItem.img} onChange={(e)=>setNewItem((p)=>({...p,img:e.target.value}))} />
                {newItem.img&&<img src={newItem.img} alt="" style={{height:68,borderRadius:6,objectFit:"cover",marginBottom:10}} onError={(e)=>(e.target.style.display="none")} />}
                <button style={S.btnGold} onClick={saveMenuItem}>+ Add to Menu</button>
              </div>
              {menu.map((item)=>(
                <div key={item.fbKey} style={{...S.mgrRow,opacity:item.available?1:0.5}}>
                  <img src={item.img} alt="" style={{width:48,height:48,objectFit:"cover",borderRadius:6,flexShrink:0}} onError={(e)=>(e.target.style.display="none")} />
                  <span style={{fontSize:20}}>{item.emoji}</span>
                  <div style={{flex:1,minWidth:90}}><div style={{fontWeight:600,fontSize:14}}>{item.name}</div><div style={{fontSize:11,color:"#806040"}}>{item.category}</div></div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{color:"#806040",fontSize:12}}>$</span>
                    <input type="number" step="0.01" defaultValue={item.price.toFixed(2)}
                      style={{...S.input,width:66,textAlign:"center",padding:"5px"}}
                      onBlur={(e)=>updateMenuItem(item,"price",parseFloat(e.target.value)||item.price)} />
                  </div>
                  <button style={{...S.catBtn,...(item.available?{color:"#50c878",borderColor:"#1a4020"}:{color:"#f05040",borderColor:"#4a1010"})}}
                    onClick={()=>updateMenuItem(item,"available",!item.available)}>{item.available?"✅ Live":"❌ Off"}</button>
                  <button style={{...S.btnRed,padding:"6px 10px"}} onClick={()=>deleteMenuItem(item)}>🗑</button>
                </div>
              ))}
            </div>
          )}

          {mgrView==="waiters"&&(
            <div>
              <ST>Staff Management</ST>
              <div style={S.formBox}>
                <div style={S.formTitle}>+ Add Waiter</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <input style={S.input} placeholder="Full name" value={newWaiter.name} onChange={(e)=>setNewWaiter((p)=>({...p,name:e.target.value}))} />
                  <input style={S.input} placeholder="PIN (4–6 digits)" type="password" value={newWaiter.pin} onChange={(e)=>setNewWaiter((p)=>({...p,pin:e.target.value}))} />
                </div>
                <button style={S.btnGold} onClick={addNewWaiter}>+ Add Waiter</button>
              </div>
              {waiters.map((w)=>{
                const sessions=Array.isArray(w.sessions)?w.sessions:Object.values(w.sessions||{});
                const totalMs=sessions.reduce((s,sess)=>s+(new Date(sess.logout)-new Date(sess.login)),0);
                const myOrds=orders.filter((o)=>o.waiterName===w.name&&o.status==="paid");
                return (<div key={w.fbKey} style={{background:"rgba(255,255,255,.02)",border:"1px solid #2a1808",borderRadius:12,padding:14,marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                    <div>
                      <div style={{fontFamily:"serif",fontSize:17,color:"#c8922a"}}>{w.name}</div>
                      <div style={{fontSize:11,color:"#806040"}}>PIN: {w.pin}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:w.loginTime?"#50c878":"#504030",fontWeight:600,fontSize:13}}>{w.loginTime?`🟢 On duty since ${fmtTime(w.loginTime)}`:"⚫ Off duty"}</div>
                      <div style={{fontSize:12,color:"#605040",marginTop:2}}>Served: {fmtDur(totalMs)} · {myOrds.length} orders · ${myOrds.reduce((s,o)=>s+o.total,0).toFixed(2)}</div>
                    </div>
                    <button style={{...S.btnRed,padding:"5px 10px"}} onClick={()=>removeWaiter(w)}>Remove</button>
                  </div>
                  {sessions.length>0&&(<div style={{marginTop:10,borderTop:"1px solid #2a1808",paddingTop:8}}>
                    <div style={{fontSize:10,color:"#604030",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Session Log</div>
                    {sessions.slice(-5).reverse().map((sess,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#706040",padding:"3px 0",borderBottom:"1px solid #1a1006"}}>
                        <span>🕐 {fmtDate(sess.login)} {fmtTime(sess.login)} → {fmtTime(sess.logout)}</span>
                        <span style={{color:"#c8922a"}}>{fmtDur(new Date(sess.logout)-new Date(sess.login))}</span>
                      </div>
                    ))}
                  </div>)}
                </div>);
              })}
            </div>
          )}

          {mgrView==="settings"&&(
            <div>
              <ST>Settings</ST>

              {/* Restaurant & Security */}
              <div style={S.formBox}>
                <div style={S.formTitle}>Restaurant & Security</div>
                {[{label:"Restaurant Name",key:"restaurantName",type:"text",def:config.restaurantName},{label:"Manager Password",key:"managerPassword",type:"password",def:config.managerPassword},{label:"Kitchen PIN",key:"kitchenPin",type:"password",def:config.kitchenPin},{label:"Tax Rate (%)",key:"taxRate",type:"number",def:config.taxRate}].map((f)=>(
                  <div key={f.key} style={{marginBottom:14}}>
                    <div style={{fontSize:12,color:"#806040",marginBottom:4}}>{f.label}</div>
                    <input style={S.input} type={f.type} defaultValue={f.def} onBlur={(e)=>saveConfig({[f.key]:f.type==="number"?parseFloat(e.target.value)||f.def:e.target.value})} />
                  </div>
                ))}
              </div>

              {/* App URL — critical for QR codes to work on phones */}
              <div style={S.formBox}>
                <div style={S.formTitle}>📡 Your App URL (for QR codes)</div>
                <div style={{fontSize:12,color:"#806040",marginBottom:10,lineHeight:1.7}}>
                  This URL goes inside every QR code. Right now it is: <strong style={{color:"#c8922a"}}>{appUrl}</strong><br/>
                  ⚠️ <strong>localhost</strong> does not work on phones — enter your real IP or Vercel URL below.
                </div>
                <input style={S.input}
                  placeholder={`e.g. http://172.20.10.12:5173  or  https://your-app.vercel.app`}
                  defaultValue={config.appUrl || ""}
                  onBlur={(e)=>{ if(e.target.value.trim()) saveConfig({appUrl: e.target.value.trim()}); }} />
                <div style={{fontSize:11,color:"#504030",marginTop:6}}>
                  Local testing: use your IP address (e.g. http://172.20.10.12:5173)<br/>
                  After deploying to Vercel: paste your Vercel URL here
                </div>
              </div>

              {/* Tables management */}
              <div style={S.formBox}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={S.formTitle} >🪑 Tables ({tables.length})</div>
                  <button style={S.btnGold} onClick={addTable}>+ Add Table</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                  {tables.map((t)=>(
                    <div key={t.id} style={{background:"rgba(200,146,42,.06)",border:"1px solid #2a1808",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:"#f5e6c8"}}>{t.name}</span>
                      <button style={{background:"transparent",color:"#c05030",fontSize:16,border:"none",cursor:"pointer",padding:"0 2px"}} onClick={()=>deleteTable(t)}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* QR Codes */}
              <div style={S.formBox}>
                <div style={S.formTitle}>📱 Table QR Codes</div>
                <div style={{fontSize:12,color:"#706040",marginBottom:6}}>
                  Customers scan these to order from their phone. Make sure the App URL above is set correctly first.
                </div>
                <div style={{background:"rgba(200,100,30,.1)",border:"1px solid #5a3010",borderRadius:6,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#f0a030"}}>
                  ⚠️ QR codes point to: <strong>{appUrl}</strong> — if this shows "localhost", update the App URL field above.
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:14}}>
                  {tables.map((t)=>{
                    const data = `${appUrl}?r=${restaurantId}&table=${t.id}`;
                    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
                    return (
                      <div key={t.id} style={{textAlign:"center"}}>
                        <div style={{background:"#fff",padding:8,borderRadius:8,display:"inline-block",marginBottom:6}}>
                          <img src={qrSrc} alt={t.name} style={{width:110,height:110,display:"block"}} />
                        </div>
                        <div style={{fontSize:12,color:"#c8922a",fontWeight:700,marginBottom:5}}>{t.name}</div>
                        <button style={{...S.btnGold,padding:"5px 12px",fontSize:12,width:"100%"}}
                          onClick={()=>downloadQR(t.id, t.name)}>
                          ⬇ Download
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
const GS = () => <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Crimson+Pro:wght@300;400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#c8922a;border-radius:3px;}button{cursor:pointer;border:none;font-family:'Crimson Pro',serif;transition:opacity .15s;}button:hover{opacity:.85;}input,select{font-family:'Crimson Pro',serif;outline:none;}input:focus,select:focus{border-color:#c8922a!important;}`}</style>;
const Toast   = ({msg})=><div style={{position:"fixed",top:16,right:16,background:"#c8922a",color:"#1a0800",padding:"10px 16px",borderRadius:8,fontWeight:700,fontSize:14,zIndex:9999,boxShadow:"0 4px 20px rgba(200,146,42,.5)"}}>{msg}</div>;
const ST      = ({children})=><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#c8922a",marginBottom:14}}>{children}</div>;
const Empty   = ({children})=><div style={{textAlign:"center",color:"#504030",padding:"40px 20px"}}>{children}</div>;
const BackBtn = ({onClick,label="← Back"})=><button style={{position:"fixed",bottom:14,left:14,background:"rgba(0,0,0,.8)",color:"#907030",border:"1px solid #2a1808",padding:"7px 13px",borderRadius:20,fontSize:12,backdropFilter:"blur(8px)"}} onClick={onClick}>{label}</button>;
const CatBar  = ({cats,active,onChange})=><div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>{cats.map((c)=><button key={c} style={{...S.catBtn,...(active===c?S.catActive:{})}} onClick={()=>onChange(c)}>{c}</button>)}</div>;
const SBadge  = ({status})=>{const m={kitchen:["#2a1808","#f0a030","🔥 Kitchen"],ready:["#1a3010","#50c878","✅ Ready"],paid:["#1a2a3a","#6090f0","💳 Paid"]};const[bg,color,label]=m[status]||["#1a1a1a","#808080",status];return <span style={{background:bg,color,padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:600}}>{label}</span>;};
const OCard   = ({order,children})=><div style={{background:"rgba(255,255,255,.025)",border:"1px solid #2a1808",borderRadius:10,padding:"12px 14px",marginBottom:10}}><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:7}}><span style={{fontFamily:"serif",fontSize:15,color:"#c8922a",fontWeight:700}}>{order.tableName}</span><span style={{color:"#706040",fontSize:12}}>{order.waiterName}</span><SBadge status={order.status}/><span style={{color:"#504030",fontSize:11}}>{fmtTime(order.time)}</span><span style={{color:"#c8922a",fontWeight:700,marginLeft:"auto"}}>${order.total.toFixed(2)}</span></div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{order.items.map((i,idx)=><span key={idx} style={{background:"rgba(200,146,42,.1)",border:"1px solid #3a2010",color:"#c8a060",padding:"2px 7px",borderRadius:12,fontSize:11}}>{i.emoji} {i.name} ×{i.qty}</span>)}</div><div style={{fontSize:10,color:"#504030",marginTop:5}}>{order.source==="customer"?"📱 Customer QR":"👨‍🍳 Waiter"}</div>{children}</div>;

const S={bg:{minHeight:"100vh",background:"linear-gradient(150deg,#100804,#1c1108,#0d0603)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Crimson Pro',serif"},app:{minHeight:"100vh",background:"linear-gradient(150deg,#100804,#1c1108,#0d0603)",fontFamily:"'Crimson Pro',serif",color:"#f5e6c8"},header:{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",background:"rgba(0,0,0,.65)",borderBottom:"1px solid #3a2010",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100,flexWrap:"wrap"},logo:{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#c8922a",letterSpacing:2,textTransform:"uppercase",flexShrink:0},nav:{display:"flex",gap:7,flex:1,flexWrap:"wrap"},navBtn:{background:"transparent",color:"#907030",border:"1px solid #2a1808",padding:"6px 12px",borderRadius:6,fontSize:13},navActive:{background:"#c8922a",color:"#1a0800",border:"1px solid #c8922a",fontWeight:700},main:{padding:"18px",maxWidth:1100,margin:"0 auto"},modeWrap:{textAlign:"center",padding:"34px 24px",background:"rgba(255,255,255,.04)",border:"1px solid #3a2010",borderRadius:16,maxWidth:380,width:"100%",color:"#f5e6c8",display:"flex",flexDirection:"column",alignItems:"center",gap:10},modeTitle:{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#c8922a",letterSpacing:2,textTransform:"uppercase"},modeSub:{color:"#706040",fontSize:12},modeBtns:{display:"flex",flexDirection:"column",gap:10,width:"100%"},modeBtn:{background:"rgba(200,146,42,.08)",color:"#f5e6c8",border:"1px solid #3a2010",padding:"12px 14px",borderRadius:10,textAlign:"left",display:"flex",alignItems:"center",gap:12,width:"100%"},trialBanner:{background:"rgba(200,100,30,.15)",border:"1px solid #6a3010",color:"#f0a030",padding:"10px 14px",fontSize:13,display:"flex",alignItems:"center",flexWrap:"wrap"},loginWrap:{textAlign:"center",padding:"34px 24px",background:"rgba(255,255,255,.04)",border:"1px solid #3a2010",borderRadius:16,maxWidth:310,width:"100%",color:"#f5e6c8",display:"flex",flexDirection:"column",alignItems:"center",gap:10},loginTitle:{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#c8922a"},pinInput:{background:"#0f0803",border:"1px solid #3a2010",color:"#f5e6c8",padding:"11px 14px",borderRadius:8,fontSize:20,width:"100%",textAlign:"center",letterSpacing:8},backBtn:{background:"transparent",color:"#907030",border:"1px solid #2a1808",padding:"7px 14px",borderRadius:6,fontSize:13},logoutBtn:{background:"transparent",color:"#c05030",border:"1px solid #602010",padding:"6px 12px",borderRadius:6,fontSize:12,flexShrink:0},notifBadge:{background:"#c8922a",color:"#1a0800",padding:"5px 11px",borderRadius:20,fontSize:13,fontWeight:700},btnGold:{background:"#c8922a",color:"#1a0800",padding:"8px 15px",borderRadius:6,fontSize:14,fontWeight:700},btnRed:{background:"transparent",color:"#d05535",border:"1px solid #6a2010",padding:"8px 14px",borderRadius:6,fontSize:13},btnOutline:{background:"transparent",color:"#c8922a",border:"1px solid #c8922a44",padding:"7px 13px",borderRadius:6,fontSize:13},btnSm:{background:"transparent",color:"#c8922a",border:"1px solid #c8922a44",padding:"3px 8px",borderRadius:20,fontSize:12},alert:{background:"rgba(200,100,40,.15)",border:"1px solid #6a3010",color:"#f0a030",padding:"9px 13px",borderRadius:8,marginBottom:13,fontSize:14},catBtn:{background:"transparent",color:"#907030",border:"1px solid #2a1808",padding:"6px 12px",borderRadius:20,fontSize:12},catActive:{background:"#c8922a",color:"#1a0800",border:"1px solid #c8922a",fontWeight:700},addBtn:{background:"#c8922a",color:"#1a0800",padding:"8px 0",fontSize:13,fontWeight:700,width:"100%",border:"none",cursor:"pointer"},statsRow:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:20},statCard:{background:"rgba(200,146,42,.07)",border:"1px solid #2a1808",borderRadius:12,padding:"14px",textAlign:"center"},statVal:{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700},statLbl:{color:"#806030",fontSize:10,marginTop:3,textTransform:"uppercase",letterSpacing:1},tableGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(128px,1fr))",gap:10},tableCard:{borderRadius:12,padding:"14px 11px",cursor:"pointer",textAlign:"center",transition:"all .2s",border:"2px solid transparent"},tAvail:{background:"rgba(30,50,20,.35)",border:"2px solid #1e3814"},tOcc:{background:"rgba(70,40,8,.5)",border:"2px solid #5a3808"},tSel:{border:"2px solid #c8922a",boxShadow:"0 0 14px rgba(200,146,42,.3)"},tName:{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,marginBottom:5},tStatus:{fontSize:11,color:"#907050"},tTotal:{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#c8922a",fontWeight:700,marginTop:5},menuGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:10},menuCard:{background:"rgba(255,255,255,.025)",border:"1px solid #221408",borderRadius:12,overflow:"hidden"},menuImg:{width:"100%",height:85,objectFit:"cover"},mName:{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700},mCat:{fontSize:9,color:"#704820",textTransform:"uppercase",letterSpacing:1,margin:"2px 0 3px"},mPrice:{fontSize:15,color:"#c8922a",fontWeight:700,marginBottom:7},qtyCtrl:{display:"flex",alignItems:"center",gap:8,background:"#180e05",padding:"6px 10px"},qBtn:{background:"transparent",color:"#c8922a",fontSize:18,fontWeight:700,lineHeight:1,cursor:"pointer"},qNum:{flex:1,textAlign:"center",fontWeight:700},orderHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:10},orderTitle:{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#c8922a"},paidRow:{display:"flex",justifyContent:"space-between",padding:"8px 12px",borderBottom:"1px solid #1a1006",fontSize:13,gap:8,flexWrap:"wrap",alignItems:"center",background:"rgba(255,255,255,.02)"},formBox:{background:"rgba(255,255,255,.025)",border:"1px solid #2a1808",borderRadius:12,padding:16,marginBottom:16},formTitle:{color:"#c8922a",fontWeight:700,marginBottom:12},input:{background:"#0f0803",border:"1px solid #3a2010",color:"#f5e6c8",padding:"8px 11px",borderRadius:6,fontSize:13,width:"100%"},mgrRow:{display:"flex",alignItems:"center",gap:10,padding:"9px 4px",borderBottom:"1px solid #1a1006",flexWrap:"wrap"}};

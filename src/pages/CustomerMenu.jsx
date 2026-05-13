import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, push, update } from "firebase/database";

const toArr = (obj) => obj ? Object.entries(obj).map(([fbKey, val]) => ({ ...val, fbKey })) : [];
const tabTotal = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);

export default function CustomerMenu({ restaurantId, tableId }) {
  const [menu,       setMenu]       = useState([]);
  const [config,     setConfig]     = useState({});
  const [custOrder,  setCustOrder]  = useState([]);
  const [custCat,    setCustCat]    = useState("All");
  const [view,       setView]       = useState("menu"); // menu | done
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);

  const rRef = (path) => ref(db, `restaurants/${restaurantId}/${path}`);

  useEffect(() => {
    let timeout = setTimeout(() => setNotFound(true), 8000);
    const offs = [
      onValue(rRef("menu"), (s) => {
        clearTimeout(timeout);
        setLoading(false);
        setMenu(toArr(s.val()).filter((i) => i.available).sort((a, b) => a.name.localeCompare(b.name)));
      }),
      onValue(rRef("config"), (s) => { if (s.exists()) setConfig(s.val()); }),
    ];
    return () => { offs.forEach((u) => u()); clearTimeout(timeout); };
  }, [restaurantId]);

  const addItem = (item) =>
    setCustOrder((p) => {
      const ex = p.find((i) => i.fbKey === item.fbKey);
      return ex ? p.map((i) => i.fbKey === item.fbKey ? { ...i, qty: i.qty + 1 } : i) : [...p, { ...item, qty: 1 }];
    });

  const removeItem = (fbKey) =>
    setCustOrder((p) => p.map((i) => i.fbKey === fbKey ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0));

  const submitOrder = async () => {
    await push(rRef("orders"), {
      tableId,
      tableName:   `Table ${tableId}`,
      waiterName:  "Customer",
      items:       [...custOrder],
      status:      "kitchen",
      time:        new Date().toISOString(),
      total:       tabTotal(custOrder),
      source:      "customer",
    });
    await update(rRef(`tables/${tableId}`), { status: "occupied" });
    setCustOrder([]);
    setView("done");
  };

  const cats  = ["All", ...new Set(menu.map((i) => i.category))];
  const shown = custCat === "All" ? menu : menu.filter((i) => i.category === custCat);
  const total = tabTotal(custOrder);
  const rName = config.restaurantName || "Our Restaurant";

  if (loading) return (
    <div style={cS.loadWrap}>
      <style>{GSS}</style>
      <div style={{ fontSize:40 }}>🍽</div>
      <div style={{ color:"#c8922a", marginTop:12 }}>Loading menu…</div>
    </div>
  );

  if (notFound) return (
    <div style={cS.loadWrap}>
      <style>{GSS}</style>
      <div style={{ fontSize:40 }}>❌</div>
      <div style={{ color:"#f05050", marginTop:12, fontWeight:700 }}>Menu not found</div>
      <div style={{ color:"#606060", fontSize:14, marginTop:8 }}>This QR code may be invalid. Ask your waiter for help.</div>
    </div>
  );

  if (view === "done") return (
    <div style={cS.loadWrap}>
      <style>{GSS}</style>
      <div style={{ fontSize:56 }}>✅</div>
      <div style={{ color:"#50c878", fontSize:22, fontWeight:700, marginTop:12 }}>Order Sent!</div>
      <div style={{ color:"#707070", marginTop:8, textAlign:"center", lineHeight:1.8 }}>
        Your waiter has been notified.<br />Your food is on its way!
      </div>
      <button style={cS.goldBtn} onClick={() => setView("menu")}>+ Order More</button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f9f3e8", fontFamily:"'Inter',sans-serif", color:"#1a0d04" }}>
      <style>{GSS}</style>
      <header style={cS.header}>
        <div>
          <div style={cS.headerTitle}>{rName}</div>
          <div style={cS.headerSub}>Table {tableId} · Menu</div>
        </div>
        {custOrder.length > 0 && (
          <button onClick={submitOrder} style={cS.orderBtn}>
            🛒 {custOrder.reduce((s,i)=>s+i.qty,0)} · ${total.toFixed(2)}
          </button>
        )}
      </header>

      {/* Category bar */}
      <div style={cS.catBar}>
        {cats.map((c) => (
          <button key={c} onClick={() => setCustCat(c)}
            style={{ ...cS.catChip, ...(custCat===c ? cS.catChipActive : {}) }}>{c}</button>
        ))}
      </div>

      {/* Menu items */}
      <div style={{ padding:"8px 14px 100px" }}>
        {shown.map((item) => {
          const inOrd = custOrder.find((i) => i.fbKey === item.fbKey);
          return (
            <div key={item.fbKey} style={cS.itemRow}>
              <img src={item.img} alt="" style={cS.itemImg} onError={(e) => (e.target.style.display="none")} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={cS.itemName}>{item.emoji} {item.name}</div>
                <div style={cS.itemCat}>{item.category}</div>
                <div style={cS.itemPrice}>${item.price.toFixed(2)}</div>
                {inOrd ? (
                  <div style={cS.qtyRow}>
                    <button style={cS.qBtn} onClick={() => removeItem(item.fbKey)}>−</button>
                    <span style={cS.qNum}>{inOrd.qty}</span>
                    <button style={cS.qBtn} onClick={() => addItem(item)}>+</button>
                  </div>
                ) : (
                  <button style={cS.addBtn} onClick={() => addItem(item)}>+ Add</button>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div style={{ textAlign:"center", color:"#b0a090", padding:"40px 20px" }}>No items in this category</div>
        )}
      </div>

      {/* Floating order button */}
      {custOrder.length > 0 && (
        <div style={cS.floatBar}>
          <div style={{ fontSize:13, color:"#907050" }}>{custOrder.reduce((s,i)=>s+i.qty,0)} items selected</div>
          <button style={cS.floatBtn} onClick={submitOrder}>
            Place Order · ${total.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}

const GSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}button{cursor:pointer;font-family:'Inter',sans-serif;border:none;transition:opacity .15s;}button:hover{opacity:.85;}`;

const cS = {
  loadWrap:   { minHeight:"100vh", background:"#f9f3e8", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, fontFamily:"'Inter',sans-serif", padding:24 },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", background:"#1a0d04", position:"sticky", top:0, zIndex:100 },
  headerTitle:{ fontWeight:700, fontSize:17, color:"#c8922a" },
  headerSub:  { fontSize:12, color:"#605040", marginTop:2 },
  orderBtn:   { background:"#c8922a", color:"#1a0800", padding:"9px 16px", borderRadius:20, fontSize:14, fontWeight:700 },
  catBar:     { display:"flex", gap:8, padding:"10px 14px", background:"#f3ede0", borderBottom:"1px solid #e0d4b8", overflowX:"auto" },
  catChip:    { background:"transparent", color:"#9a7040", border:"1px solid #d0b880", padding:"5px 13px", borderRadius:20, fontSize:13, whiteSpace:"nowrap" },
  catChipActive:{ background:"#1a0d04", color:"#c8922a", borderColor:"#1a0d04" },
  itemRow:    { display:"flex", gap:14, padding:"14px 2px", borderBottom:"1px solid #e8dfc0" },
  itemImg:    { width:82, height:82, objectFit:"cover", borderRadius:10, flexShrink:0 },
  itemName:   { fontWeight:700, fontSize:15, marginBottom:2 },
  itemCat:    { fontSize:10, color:"#9a7040", textTransform:"uppercase", letterSpacing:1, marginBottom:4 },
  itemPrice:  { fontSize:16, color:"#8a5020", fontWeight:700, marginBottom:8 },
  qtyRow:     { display:"flex", alignItems:"center", gap:10, background:"#1a0d04", borderRadius:20, padding:"5px 12px", width:"fit-content" },
  qBtn:       { background:"transparent", color:"#c8922a", fontSize:20, fontWeight:700, lineHeight:1 },
  qNum:       { color:"#f5e6c8", minWidth:20, textAlign:"center", fontWeight:700 },
  addBtn:     { background:"#1a0d04", color:"#c8922a", padding:"7px 18px", borderRadius:20, fontSize:13, fontWeight:700 },
  floatBar:   { position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #e0d0b8", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" },
  floatBtn:   { background:"#c8922a", color:"#1a0800", padding:"11px 24px", borderRadius:24, fontSize:15, fontWeight:700 },
  goldBtn:    { background:"#c8922a", color:"#1a0800", padding:"12px 28px", borderRadius:8, fontSize:15, fontWeight:700, marginTop:20 },
};

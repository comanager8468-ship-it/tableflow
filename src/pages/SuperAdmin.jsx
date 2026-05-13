import { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, update, remove } from "firebase/database";

const toArr = (obj) => obj ? Object.entries(obj).map(([fbKey, val]) => ({ ...val, fbKey })) : [];
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "—";
const daysLeft = (trialEnd) => Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000));

export default function SuperAdmin({ user, onLogout }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("all"); // all | trial | active | expired

  useEffect(() => {
    return onValue(ref(db, "allRestaurants"), (snap) => {
      setRestaurants(toArr(snap.val()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setLoading(false);
    });
  }, []);

  const extendTrial = (r, days = 7) => {
    const newEnd = Math.max(r.trialEnd, Date.now()) + days * 86400000;
    update(ref(db, `allRestaurants/${r.fbKey}`), { trialEnd: newEnd });
    update(ref(db, `restaurants/${r.fbKey}/info`), { trialEnd: newEnd });
  };

  const setPlan = (r, plan) => {
    update(ref(db, `allRestaurants/${r.fbKey}`), { plan });
    update(ref(db, `restaurants/${r.fbKey}/info`), { plan });
  };

  const suspendRestaurant = (r) => {
    if (!confirm(`Suspend ${r.name}?`)) return;
    update(ref(db, `allRestaurants/${r.fbKey}`), { status: "suspended" });
    update(ref(db, `restaurants/${r.fbKey}/info`), { status: "suspended" });
  };

  const unsuspend = (r) => {
    update(ref(db, `allRestaurants/${r.fbKey}`), { status: "active" });
    update(ref(db, `restaurants/${r.fbKey}/info`), { status: "active" });
  };

  const filtered = restaurants.filter((r) => {
    if (filter === "trial")   return r.plan === "trial" && daysLeft(r.trialEnd) > 0;
    if (filter === "active")  return r.plan === "active";
    if (filter === "expired") return r.plan === "trial" && daysLeft(r.trialEnd) === 0;
    return true;
  });

  const totalRev = restaurants.filter((r) => r.plan === "active").length * 29; // estimate
  const trialCount   = restaurants.filter((r) => r.plan === "trial" && daysLeft(r.trialEnd) > 0).length;
  const paidCount    = restaurants.filter((r) => r.plan === "active").length;
  const expiredCount = restaurants.filter((r) => r.plan === "trial" && daysLeft(r.trialEnd) === 0).length;

  return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}button{cursor:pointer;font-family:'Inter',sans-serif;border:none;transition:opacity .15s;}button:hover{opacity:.85;}`}</style>

      <header style={S.header}>
        <div style={S.logo}>🍽 TableFlow <span style={{ color:"#ff4040", fontSize:12, background:"rgba(255,60,60,.15)", padding:"2px 8px", borderRadius:20, marginLeft:8 }}>SUPER ADMIN</span></div>
        <div style={{ color:"#505060", fontSize:13 }}>Logged in as {user.email}</div>
        <button style={S.logoutBtn} onClick={onLogout}>Logout</button>
      </header>

      <main style={S.main}>
        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { v: restaurants.length, l: "Total Restaurants", c: "#c8922a" },
            { v: trialCount,          l: "On Trial",          c: "#6090f0" },
            { v: paidCount,           l: "Paying",            c: "#50c878" },
            { v: expiredCount,        l: "Expired",           c: "#f06050" },
            { v: `$${totalRev}`,      l: "Est. MRR",          c: "#50c878" },
          ].map((s) => (
            <div key={s.l} style={S.statCard}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "#404050", marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ================================================================
            💳 STRIPE REVENUE DASHBOARD — ADD STRIPE HERE
            When you connect Stripe, replace the estimated MRR above with
            real revenue from the Stripe API:
            - GET /v1/subscriptions?status=active
            - Sum up all subscription amounts
            Also add webhook endpoint to update Firebase when:
            - Payment succeeds → set plan to "active"
            - Payment fails → set plan to "trial" or notify user
            - Subscription cancelled → set plan to "trial"
            ================================================================ */}
        <div style={S.stripePlaceholder}>
          💳 <strong>Stripe Dashboard</strong> — Connect Stripe to see real revenue, subscription status, and failed payments here.
          <span style={{ color: "#c8922a", marginLeft: 8, fontSize: 12 }}>[Stripe integration pending]</span>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["all","All"],["trial","On Trial"],["active","Paying"],["expired","Expired"]].map(([k,l]) => (
            <button key={k} style={{ ...S.filterBtn, ...(filter===k?S.filterActive:{}) }} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>

        {/* Restaurant list */}
        {loading && <div style={{ color: "#404050", padding: "40px 0", textAlign: "center" }}>Loading…</div>}
        {!loading && filtered.length === 0 && <div style={{ color: "#404050", padding: "40px 0", textAlign: "center" }}>No restaurants in this filter</div>}

        {filtered.map((r) => {
          const days     = daysLeft(r.trialEnd);
          const isExpired= r.plan === "trial" && days === 0;
          const isPaid   = r.plan === "active";
          const isSusp   = r.status === "suspended";
          return (
            <div key={r.fbKey} style={{ ...S.rCard, ...(isSusp ? { opacity: 0.5 } : {}) }}>
              <div style={S.rTop}>
                <div>
                  <div style={S.rName}>{r.name}</div>
                  <div style={S.rEmail}>{r.email}</div>
                  <div style={{ fontSize: 12, color: "#404050", marginTop: 2 }}>Joined: {fmtDate(r.createdAt)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {isSusp   && <span style={S.badgeSusp}>⛔ Suspended</span>}
                  {isPaid   && !isSusp && <span style={S.badgePaid}>💳 Paying</span>}
                  {isExpired && !isSusp && <span style={S.badgeExp}>❌ Expired</span>}
                  {r.plan==="trial" && !isExpired && !isSusp && (
                    <span style={S.badgeTrial}>⏳ Trial — {days}d left</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={S.rActions}>
                {!isPaid && (
                  <button style={S.actGold} onClick={() => setPlan(r, "active")}>
                    ✅ Mark as Paying
                  </button>
                )}
                {isPaid && (
                  <button style={S.actOutline} onClick={() => setPlan(r, "trial")}>
                    Revert to Trial
                  </button>
                )}
                <button style={S.actBlue} onClick={() => extendTrial(r, 7)}>
                  +7 days trial
                </button>
                <button style={S.actBlue} onClick={() => extendTrial(r, 30)}>
                  +30 days
                </button>
                {!isSusp ? (
                  <button style={S.actRed} onClick={() => suspendRestaurant(r)}>Suspend</button>
                ) : (
                  <button style={S.actGold} onClick={() => unsuspend(r)}>Restore</button>
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

const S = {
  app:         { minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Inter',sans-serif", color: "#e0e0f0" },
  header:      { display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", background: "#0d0d18", borderBottom: "1px solid #1a1a2e", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap" },
  logo:        { fontSize: 18, fontWeight: 800, color: "#c8922a", flex: 1 },
  logoutBtn:   { background: "transparent", color: "#606070", border: "1px solid #2a2a3e", padding: "6px 14px", borderRadius: 6, fontSize: 13 },
  main:        { padding: "24px", maxWidth: 1000, margin: "0 auto" },
  statsRow:    { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 20 },
  statCard:    { background: "#0f0f1a", border: "1px solid #1a1a2e", borderRadius: 12, padding: "16px", textAlign: "center" },
  stripePlaceholder: { background: "rgba(200,146,42,.06)", border: "1px solid #3a2a10", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#807060" },
  filterBtn:   { background: "transparent", color: "#505060", border: "1px solid #1a1a2e", padding: "7px 14px", borderRadius: 20, fontSize: 13 },
  filterActive:{ background: "#c8922a", color: "#1a0800", borderColor: "#c8922a", fontWeight: 700 },
  rCard:       { background: "#0f0f1a", border: "1px solid #1a1a2e", borderRadius: 12, padding: "16px", marginBottom: 12 },
  rTop:        { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  rName:       { fontSize: 17, fontWeight: 700, color: "#ffffff" },
  rEmail:      { fontSize: 13, color: "#505060", marginTop: 2 },
  rActions:    { display: "flex", gap: 8, flexWrap: "wrap" },
  actGold:     { background: "#c8922a", color: "#1a0800", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600 },
  actOutline:  { background: "transparent", color: "#c8922a", border: "1px solid #c8922a44", padding: "6px 14px", borderRadius: 6, fontSize: 13 },
  actBlue:     { background: "rgba(100,144,240,.15)", color: "#6090f0", border: "1px solid #2a3a5e", padding: "6px 14px", borderRadius: 6, fontSize: 13 },
  actRed:      { background: "transparent", color: "#d05535", border: "1px solid #6a2010", padding: "6px 14px", borderRadius: 6, fontSize: 13 },
  badgeTrial:  { background: "rgba(100,144,240,.15)", color: "#6090f0", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgePaid:   { background: "rgba(80,200,120,.15)", color: "#50c878", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeExp:    { background: "rgba(220,80,60,.15)", color: "#f06050", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeSusp:   { background: "rgba(100,100,100,.2)", color: "#808090", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 },
};

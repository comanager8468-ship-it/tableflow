const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Inter',sans-serif; }
    button { cursor:pointer; font-family:'Inter',sans-serif; border:none; transition:all .2s; }
    a { text-decoration:none; }
  `}</style>
);

const PLANS = [
  {
    name: "Starter",
    price: 29,
    period: "month",
    color: "#4a90d9",
    features: ["Up to 3 waiters", "1 location", "QR customer ordering", "Kitchen display", "Basic analytics"],
    cta: "Start 14-day free trial",
  },
  {
    name: "Pro",
    price: 59,
    period: "month",
    color: "#c8922a",
    badge: "Most Popular",
    features: ["Unlimited waiters", "1 location", "QR customer ordering", "Kitchen display", "Full analytics", "Custom restaurant branding", "Priority support"],
    cta: "Start 14-day free trial",
  },
  {
    name: "Multi-Location",
    price: 99,
    period: "month",
    color: "#50c878",
    features: ["Unlimited waiters", "Up to 5 locations", "Everything in Pro", "Central dashboard", "Dedicated support", "Custom onboarding"],
    cta: "Contact us",
  },
];

const FEATURES = [
  { icon: "👨‍🍳", title: "Waiter App", desc: "Waiters tap the table, select items, and send orders to the kitchen instantly. Works on any phone." },
  { icon: "📱", title: "Customer QR Menu", desc: "Customers scan a QR on the table, browse the menu, and place orders directly — no app download needed." },
  { icon: "🍳", title: "Kitchen Display", desc: "Kitchen sees live orders with timers. An alert bell rings on every new order. Mark ready with one tap." },
  { icon: "👔", title: "Manager Dashboard", desc: "Edit the menu, manage staff, set prices, view revenue, and print QR codes — all from one panel." },
];

const STEPS = [
  { num: "01", title: "Sign up in 2 minutes", desc: "Create your account, enter your restaurant name, and your system is live immediately with sample data." },
  { num: "02", title: "Customize your menu", desc: "Add your dishes, set prices, upload photos. Turn items on/off during service with one click." },
  { num: "03", title: "Go live today", desc: "Print the QR codes, give waiters their PINs, open the kitchen screen. You're operational." },
];

export default function Landing({ onLogin, onSignup }) {
  return (
    <div style={{ background:"#0a0a0f", minHeight:"100vh", color:"#f0f0f0", fontFamily:"'Inter',sans-serif" }}>
      <GS />

      {/* ── NAV ── */}
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 40px", borderBottom:"1px solid #1a1a2e", position:"sticky", top:0, background:"rgba(10,10,15,.95)", backdropFilter:"blur(12px)", zIndex:100 }}>
        <div style={{ fontSize:20, fontWeight:800, color:"#c8922a", letterSpacing:1 }}>🍽 TableFlow</div>
        <div style={{ display:"flex", gap:14, alignItems:"center" }}>
          <button onClick={onLogin} style={{ background:"transparent", color:"#a0a0b0", padding:"8px 18px", borderRadius:6, fontSize:14 }}>
            Log In
          </button>
          <button onClick={onSignup} style={{ background:"#c8922a", color:"#1a0800", padding:"9px 20px", borderRadius:8, fontSize:14, fontWeight:700 }}>
            Start Free Trial
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ textAlign:"center", padding:"90px 24px 70px", maxWidth:800, margin:"0 auto" }}>
        <div style={{ display:"inline-block", background:"rgba(200,146,42,.12)", border:"1px solid rgba(200,146,42,.3)", color:"#c8922a", padding:"6px 16px", borderRadius:20, fontSize:13, fontWeight:600, marginBottom:24 }}>
          14-day free trial · No credit card required
        </div>
        <h1 style={{ fontSize:"clamp(36px,6vw,62px)", fontWeight:800, lineHeight:1.1, marginBottom:22, color:"#ffffff" }}>
          Restaurant management<br />
          <span style={{ color:"#c8922a" }}>that just works</span>
        </h1>
        <p style={{ fontSize:19, color:"#808090", lineHeight:1.7, maxWidth:560, margin:"0 auto 36px" }}>
          Waiter app, kitchen display, customer QR menu, and manager dashboard — one system, any device, zero setup headaches.
        </p>
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={onSignup} style={{ background:"#c8922a", color:"#1a0800", padding:"14px 32px", borderRadius:10, fontSize:17, fontWeight:700 }}>
            Start Free Trial →
          </button>
          <button onClick={onLogin} style={{ background:"rgba(255,255,255,.06)", color:"#c0c0d0", padding:"14px 28px", borderRadius:10, fontSize:16, border:"1px solid #2a2a3a" }}>
            Sign In
          </button>
        </div>
        <div style={{ marginTop:18, fontSize:13, color:"#404050" }}>
          Trusted by 200+ restaurants · Setup in under 10 minutes
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div style={{ background:"rgba(200,146,42,.06)", borderTop:"1px solid #2a2010", borderBottom:"1px solid #2a2010", padding:"28px 40px" }}>
        <div style={{ maxWidth:900, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:20, textAlign:"center" }}>
          {[["200+","Restaurants"], ["$0","Setup cost"], ["< 10min","Time to launch"], ["24/7","Real-time sync"]].map(([v,l]) => (
            <div key={l}>
              <div style={{ fontSize:28, fontWeight:800, color:"#c8922a" }}>{v}</div>
              <div style={{ fontSize:13, color:"#605040", marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section style={{ padding:"80px 24px", maxWidth:1000, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontSize:36, fontWeight:800, color:"#ffffff", marginBottom:10 }}>Everything in one system</h2>
          <p style={{ color:"#606070", fontSize:16 }}>Four tools that talk to each other in real-time, across any device.</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:16, padding:"28px 24px" }}>
              <div style={{ fontSize:40, marginBottom:14 }}>{f.icon}</div>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:10, color:"#ffffff" }}>{f.title}</div>
              <div style={{ fontSize:14, color:"#606070", lineHeight:1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding:"60px 24px 80px", background:"#0d0d18" }}>
        <div style={{ maxWidth:800, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ fontSize:34, fontWeight:800, color:"#ffffff", marginBottom:14 }}>Up and running today</h2>
          <p style={{ color:"#606070", fontSize:15, marginBottom:52 }}>No IT team needed. No hardware to install. Just sign up and go.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:24, textAlign:"left" }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{ background:"#0a0a0f", border:"1px solid #1a1a2e", borderRadius:14, padding:"24px" }}>
                <div style={{ fontSize:32, fontWeight:800, color:"#c8922a", opacity:.4, marginBottom:14 }}>{s.num}</div>
                <div style={{ fontSize:17, fontWeight:700, color:"#ffffff", marginBottom:8 }}>{s.title}</div>
                <div style={{ fontSize:13, color:"#606070", lineHeight:1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding:"80px 24px", maxWidth:1000, margin:"0 auto" }} id="pricing">
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <h2 style={{ fontSize:36, fontWeight:800, color:"#ffffff", marginBottom:10 }}>Simple, honest pricing</h2>
          <p style={{ color:"#606070", fontSize:16 }}>14-day free trial on all plans. Cancel anytime.</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20 }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{ background:"#0f0f1a", border:`2px solid ${plan.badge ? plan.color : "#1a1a2e"}`, borderRadius:18, padding:"32px 26px", position:"relative", boxShadow:plan.badge?`0 0 40px ${plan.color}22`:"none" }}>
              {plan.badge && (
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:plan.color, color:"#1a0800", padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ fontSize:20, fontWeight:700, color:plan.color, marginBottom:6 }}>{plan.name}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:20 }}>
                <span style={{ fontSize:42, fontWeight:800, color:"#ffffff" }}>${plan.price}</span>
                <span style={{ fontSize:14, color:"#505060" }}>/{plan.period}</span>
              </div>
              <ul style={{ listStyle:"none", marginBottom:28 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize:14, color:"#909090", padding:"6px 0", borderBottom:"1px solid #1a1a2e", display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:plan.color }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onSignup}
                style={{ background:plan.badge?plan.color:"transparent", color:plan.badge?"#1a0800":plan.color, border:`1px solid ${plan.color}`, padding:"12px", borderRadius:8, fontSize:14, fontWeight:700, width:"100%" }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section style={{ textAlign:"center", padding:"80px 24px", background:"linear-gradient(180deg,#0d0d18 0%,#0a0a0f 100%)" }}>
        <h2 style={{ fontSize:36, fontWeight:800, color:"#ffffff", marginBottom:12 }}>Ready to modernize your restaurant?</h2>
        <p style={{ color:"#606070", fontSize:16, marginBottom:32 }}>Join 200+ restaurants already using TableFlow.</p>
        <button onClick={onSignup} style={{ background:"#c8922a", color:"#1a0800", padding:"16px 40px", borderRadius:10, fontSize:18, fontWeight:700 }}>
          Start Your Free Trial →
        </button>
        <div style={{ marginTop:14, fontSize:12, color:"#303040" }}>No credit card · Cancel anytime · Setup in 10 minutes</div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:"1px solid #1a1a2e", padding:"28px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#c8922a" }}>🍽 TableFlow</div>
        <div style={{ fontSize:13, color:"#303040" }}>© {new Date().getFullYear()} TableFlow. All rights reserved.</div>
        <button onClick={onLogin} style={{ background:"transparent", color:"#505060", fontSize:13 }}>Sign In</button>
      </footer>
    </div>
  );
}

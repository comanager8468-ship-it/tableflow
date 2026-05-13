import { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ref, set, push } from "firebase/database";

// ── Seed data for a new restaurant ───────────────────────────────────────────
const SEED_MENU = [
  { name:"Bruschetta",      category:"Starters",   price:8.50,  emoji:"🍞", img:"https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=300&q=80", available:true },
  { name:"Calamari",        category:"Starters",   price:12.00, emoji:"🦑", img:"https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300&q=80", available:true },
  { name:"Ribeye Steak",    category:"Mains",      price:38.00, emoji:"🥩", img:"https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80", available:true },
  { name:"Grilled Salmon",  category:"Mains",      price:28.00, emoji:"🐟", img:"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=300&q=80", available:true },
  { name:"Truffle Pasta",   category:"Mains",      price:22.00, emoji:"🍝", img:"https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&q=80", available:true },
  { name:"Burger & Fries",  category:"Mains",      price:18.00, emoji:"🍔", img:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80", available:true },
  { name:"Crème Brûlée",    category:"Desserts",   price:9.00,  emoji:"🍮", img:"https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=300&q=80", available:true },
  { name:"Old Fashioned",   category:"Cocktails",  price:14.00, emoji:"🥃", img:"https://images.unsplash.com/photo-1527761939622-933c072b70f5?w=300&q=80", available:true },
  { name:"Mojito",          category:"Cocktails",  price:12.00, emoji:"🌿", img:"https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=300&q=80", available:true },
  { name:"Draft Lager",     category:"Beer",       price:6.00,  emoji:"🍺", img:"https://images.unsplash.com/photo-1608270586620-248524c67de9?w=300&q=80", available:true },
  { name:"House Red",       category:"Wine",       price:8.00,  emoji:"🍷", img:"https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=300&q=80", available:true },
  { name:"Sparkling Water", category:"Soft Drinks",price:3.00,  emoji:"💧", img:"https://images.unsplash.com/photo-1560023907-5f339617ea30?w=300&q=80", available:true },
];

const SEED_TABLES = [
  ...Array.from({ length:6 }, (_,i) => ({ id:i+1, name:`Table ${i+1}`, status:"available" })),
  { id:7, name:"Bar Seat 1", status:"available" },
  { id:8, name:"Bar Seat 2", status:"available" },
];

async function seedRestaurant(restaurantId, restaurantName, email) {
  const rRef = (path) => ref(db, `restaurants/${restaurantId}/${path}`);

  // Restaurant info
  await set(rRef("info"), {
    name:        restaurantName,
    ownerEmail:  email,
    plan:        "trial",
    trialEnd:    Date.now() + 14 * 24 * 60 * 60 * 1000,
    status:      "active",
    createdAt:   new Date().toISOString(),
  });

  // Config
  await set(rRef("config"), {
    restaurantName,
    managerPassword: "admin",
    kitchenPin:      "kitchen",
    taxRate:         10,
  });

  // Tables
  for (const t of SEED_TABLES) await set(ref(db, `restaurants/${restaurantId}/tables/${t.id}`), t);

  // Menu
  for (const item of SEED_MENU) await push(rRef("menu"), item);

  // Sample waiter
  await push(rRef("waiters"), { name:"Your Waiter", pin:"1234", role:"waiter", loginTime:null, sessions:[] });

  // Register in master list (for super admin)
  await set(ref(db, `allRestaurants/${restaurantId}`), {
    name:      restaurantName,
    email,
    plan:      "trial",
    trialEnd:  Date.now() + 14 * 24 * 60 * 60 * 1000,
    status:    "active",
    createdAt: new Date().toISOString(),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AuthPage({ mode, onBack }) {
  const isSignup = mode === "signup";
  const [restaurantName, setRestaurantName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (isSignup) {
        if (!restaurantName.trim()) { setError("Enter your restaurant name"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await seedRestaurant(cred.user.uid, restaurantName.trim(), email);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use":    "This email is already registered. Try logging in.",
        "auth/weak-password":           "Password must be at least 6 characters.",
        "auth/invalid-email":           "Enter a valid email address.",
        "auth/user-not-found":          "No account found with this email.",
        "auth/wrong-password":          "Wrong password. Try again.",
        "auth/invalid-credential":      "Wrong email or password.",
      };
      setError(msgs[e.code] || e.message);
    }
    setLoading(false);
  };

  return (
    <div style={S.bg}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}button{cursor:pointer;font-family:'Inter',sans-serif;}input{font-family:'Inter',sans-serif;outline:none;}`}</style>
      <div style={S.card}>
        <div style={S.logo}>🍽 TableFlow</div>
        <div style={S.title}>{isSignup ? "Start your free trial" : "Welcome back"}</div>
        <div style={S.sub}>{isSignup ? "14 days free · No credit card" : "Sign in to your restaurant"}</div>

        {isSignup && (
          <Field label="Restaurant Name" placeholder="e.g. The Golden Fork" value={restaurantName} onChange={setRestaurantName} />
        )}
        <Field label="Email address" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
        <Field label="Password" type="password" placeholder={isSignup ? "Min. 6 characters" : "••••••••"} value={password} onChange={setPassword}
          onEnter={handleSubmit} />

        {error && <div style={S.error}>{error}</div>}

        <button style={{ ...S.submitBtn, opacity:loading?0.6:1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? "Please wait…" : isSignup ? "Create Account & Start Trial →" : "Sign In →"}
        </button>

        {isSignup && (
          <div style={S.terms}>
            By signing up you agree to our Terms of Service and Privacy Policy.
          </div>
        )}

        <div style={S.switchRow}>
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <a href="#" style={{ color:"#c8922a" }}
            onClick={(e) => { e.preventDefault(); window.location.search = isSignup ? "?auth=login" : "?auth=signup"; }}>
            {isSignup ? "Sign in" : "Start free trial"}
          </a>
        </div>

        <button style={S.backBtn} onClick={onBack}>← Back to home</button>
      </div>
    </div>
  );
}

const Field = ({ label, type="text", placeholder, value, onChange, onEnter }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:"block", fontSize:13, color:"#707080", marginBottom:6, fontWeight:500 }}>{label}</label>
    <input
      type={type} placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      style={{ background:"#0d0d1a", border:"1px solid #2a2a3e", color:"#f0f0f0", padding:"11px 14px", borderRadius:8, fontSize:15, width:"100%" }}
    />
  </div>
);

const S = {
  bg:        { minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'Inter',sans-serif" },
  card:      { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:18, padding:"36px 32px", maxWidth:420, width:"100%" },
  logo:      { fontSize:20, fontWeight:800, color:"#c8922a", marginBottom:24, letterSpacing:1 },
  title:     { fontSize:26, fontWeight:800, color:"#ffffff", marginBottom:6 },
  sub:       { fontSize:14, color:"#505060", marginBottom:28 },
  error:     { background:"rgba(220,60,60,.12)", border:"1px solid #6a2020", color:"#f08080", padding:"10px 14px", borderRadius:8, fontSize:13, marginBottom:16 },
  submitBtn: { background:"#c8922a", color:"#1a0800", padding:"13px", borderRadius:8, fontSize:16, fontWeight:700, width:"100%", marginBottom:14 },
  terms:     { fontSize:11, color:"#303040", textAlign:"center", marginBottom:16, lineHeight:1.6 },
  switchRow: { fontSize:14, color:"#505060", textAlign:"center", marginBottom:14 },
  backBtn:   { background:"transparent", color:"#404050", fontSize:13, padding:"6px 0", width:"100%", textAlign:"center" },
};

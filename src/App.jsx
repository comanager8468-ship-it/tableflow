import { useState, useEffect } from "react";
import { auth, db, SUPER_ADMIN_EMAIL } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import Landing    from "./pages/Landing";
import AuthPage   from "./pages/AuthPage";
import RestaurantApp from "./pages/RestaurantApp";
import SuperAdmin from "./pages/SuperAdmin";
import CustomerMenu from "./pages/CustomerMenu";

export default function App() {
  const [user,           setUser]           = useState(undefined); // undefined = loading
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [authView,       setAuthView]       = useState(null); // null | "login" | "signup"

  // Check URL for customer QR params: ?r=restaurantId&table=3
  const params      = new URLSearchParams(window.location.search);
  const qrRestId    = params.get("r");
  const qrTableId   = parseInt(params.get("table"));

  // Listen to Firebase auth state
  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await get(ref(db, `restaurants/${firebaseUser.uid}/info`));
          if (snap.exists()) setRestaurantInfo(snap.val());
        } catch (_) {}
      } else {
        setUser(null);
        setRestaurantInfo(null);
      }
    });
  }, []);

  // ── Loading spinner ──
  if (user === undefined) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:48 }}>🍽</div>
      <div style={{ color:"#c8922a", fontFamily:"sans-serif", fontSize:18 }}>TableFlow</div>
      <div style={{ color:"#403030", fontSize:13, fontFamily:"sans-serif" }}>Loading…</div>
    </div>
  );

  // ── Customer QR menu (no login needed) ──
  if (qrRestId && qrTableId) {
    return <CustomerMenu restaurantId={qrRestId} tableId={qrTableId} />;
  }

  // ── Super admin ──
  if (user?.email === SUPER_ADMIN_EMAIL) {
    return <SuperAdmin user={user} onLogout={() => auth.signOut()} />;
  }

  // ── Not logged in → Landing or Auth ──
  if (!user) {
    if (authView === "login")  return <AuthPage mode="login"  onBack={() => setAuthView(null)} />;
    if (authView === "signup") return <AuthPage mode="signup" onBack={() => setAuthView(null)} />;
    return <Landing onLogin={() => setAuthView("login")} onSignup={() => setAuthView("signup")} />;
  }

  // ── Restaurant app ──
  return (
    <RestaurantApp
      user={user}
      restaurantId={user.uid}
      restaurantInfo={restaurantInfo}
      onLogout={() => auth.signOut()}
    />
  );
}

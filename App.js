import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// ── Firebase config ──────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDn1jtpOGXkTT_lR_9_bL6mkAp4oM6bX9I",
  authDomain: "my-restaurant-12ef0.firebaseapp.com",
  projectId: "my-restaurant-12ef0",
  storageBucket: "my-restaurant-12ef0.firebasestorage.app",
  messagingSenderId: "701174556122",
  appId: "1:701174556122:web:a34076153ac37a3e340ce3"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DATA_DOC = doc(db, "pos", "main");
const PINS_DOC = doc(db, "pos", "pins");

const STORAGE_KEY = "rpos_v2";

const defaultData = {
  restaurantName: "My Restaurant",
  logo: "",
  categories: ["Starters", "Mains", "Desserts", "Drinks"],
  items: [
    { id: 1, name: "Veg Spring Rolls", category: "Starters", price: 120, description: "Crispy golden rolls with spiced vegetable filling", available: true },
    { id: 2, name: "Paneer Tikka", category: "Starters", price: 180, description: "Grilled cottage cheese with tandoori spices", available: true },
    { id: 3, name: "Butter Chicken", category: "Mains", price: 280, description: "Tender chicken in rich tomato-butter gravy", available: true },
    { id: 4, name: "Dal Makhani", category: "Mains", price: 220, description: "Slow-cooked black lentils in creamy sauce", available: true },
    { id: 5, name: "Gulab Jamun", category: "Desserts", price: 80, description: "Soft milk dumplings in rose sugar syrup", available: true },
    { id: 6, name: "Mango Lassi", category: "Drinks", price: 90, description: "Chilled yogurt drink blended with Alphonso mango", available: true },
    { id: 7, name: "Masala Chai", category: "Drinks", price: 40, description: "Spiced Indian tea with ginger and cardamom", available: false },
  ],
  bills: []
};
const defaultPins = { admin: "123456", cashier: "567890" };

// LocalStorage fallback helpers (used as cache)
function loadLocal() {
  try { const d = localStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : defaultData; }
  catch { return defaultData; }
}
function saveLocal(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

const PIN_KEY = "rpos_pins";
// Force migrate old 4-digit PINs to 6-digit defaults
function loadPinsLocal() {
  try {
    const d = localStorage.getItem(PIN_KEY);
    if (!d) return defaultPins;
    const p = JSON.parse(d);
    // If old 4-digit PINs found, reset to new 6-digit defaults
    if (p.admin?.length !== 6 || p.cashier?.length !== 6) {
      localStorage.removeItem(PIN_KEY);
      return defaultPins;
    }
    return p;
  } catch { return defaultPins; }
}
function savePinsLocal(p) { try { localStorage.setItem(PIN_KEY, JSON.stringify(p)); } catch {} }

// Pre-load from localStorage to avoid flicker while Firebase loads
const preloadedData = loadLocal();
const preloadedPins = loadPinsLocal();

const VIEWS = { ADMIN: "admin", CUSTOMER: "customer", CASHIER: "cashier" };

function PinModal({ title, subtitle, icon, onSuccess, onCancel, correctPin }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState("");

  const handleKey = (k) => {
    if (k === "del") { setPin(p => p.slice(0, -1)); setError(""); return; }
    if (pin.length >= 6) return;
    const newPin = pin + k;
    setPin(newPin);
    if (newPin.length === 6) {
      if (newPin === correctPin) { onSuccess(); }
      else { setShake(true); setError("Wrong PIN, try again"); setPin(""); setTimeout(() => setShake(false), 500); }
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, backdropFilter: "blur(8px)", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 22, padding: "32px 28px", width: "100%", maxWidth: 340, textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", animation: shake ? "shake 0.4s ease" : "su 0.22s ease" }}>
        <style>{`
          @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
          @keyframes su { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#999", marginBottom: 24 }}>{subtitle}</div>
        {/* 6 PIN dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: pin.length > i ? "#1a1612" : "#f0ebe0", border: "2px solid", borderColor: pin.length > i ? "#1a1612" : "#e8e0d0", transition: "all 0.15s" }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#dc2626", minHeight: 18, marginBottom: 16 }}>{error}</div>
        {/* Keypad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) => (
            k === "" ? <div key={i} /> :
            <button key={i} onClick={() => handleKey(k)} style={{ padding: "14px 0", borderRadius: 12, border: "1.5px solid #f0ebe0", background: k === "del" ? "#faf8f4" : "#fff", fontSize: k === "del" ? 16 : 20, fontWeight: 600, cursor: "pointer", color: "#1a1612", fontFamily: "'Outfit', sans-serif", transition: "background 0.15s" }}
              onMouseDown={e => e.currentTarget.style.background = "#f5f0e8"} onMouseUp={e => e.currentTarget.style.background = k === "del" ? "#faf8f4" : "#fff"}>
              {k === "del" ? "⌫" : k}
            </button>
          ))}
        </div>
        {onCancel && <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "#bbb", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Cancel</button>}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(preloadedData);
  const [view, setView] = useState(VIEWS.CUSTOMER);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [cashierUnlocked, setCashierUnlocked] = useState(false);
  const [pinTarget, setPinTarget] = useState(null);
  const [pins, setPins] = useState(preloadedPins);
  const [showQR, setShowQR] = useState(false);
  const [dbStatus, setDbStatus] = useState("connecting");
  const saveTimer = useRef(null);

  // Firebase real-time listener for data
  useEffect(() => {
    const unsub = onSnapshot(DATA_DOC, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setData(d); saveLocal(d); setDbStatus("online");
      } else {
        setDoc(DATA_DOC, defaultData).then(() => setDbStatus("online"));
      }
    }, () => setDbStatus("offline"));
    return () => unsub();
  }, []);

  // Firebase real-time listener for pins
  useEffect(() => {
    const unsub = onSnapshot(PINS_DOC, (snap) => {
      if (snap.exists()) { const p = snap.data(); setPins(p); savePinsLocal(p); }
      else { setDoc(PINS_DOC, defaultPins); }
    }, () => {});
    return () => unsub();
  }, []);

  const updateData = (fn) => {
    setData(d => {
      const nd = fn(d);
      saveLocal(nd);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setDoc(DATA_DOC, nd).catch(() => setDbStatus("offline"));
      }, 600);
      return nd;
    });
  };

  const updatePins = (newPins) => {
    setPins(newPins); savePinsLocal(newPins);
    setDoc(PINS_DOC, newPins).catch(() => {});
  };

  const handleTabClick = (key) => {
    if (key === VIEWS.ADMIN && !adminUnlocked) { setPinTarget(VIEWS.ADMIN); return; }
    if (key === VIEWS.CASHIER && !cashierUnlocked) { setPinTarget(VIEWS.CASHIER); return; }
    setView(key);
  };

  const handlePinSuccess = () => {
    if (pinTarget === VIEWS.ADMIN) setAdminUnlocked(true);
    if (pinTarget === VIEWS.CASHIER) setCashierUnlocked(true);
    setView(pinTarget);
    setPinTarget(null);
  };

  const handleLogout = (v) => {
    if (v === VIEWS.ADMIN) { setAdminUnlocked(false); setView(VIEWS.CUSTOMER); }
    if (v === VIEWS.CASHIER) { setCashierUnlocked(false); setView(VIEWS.CUSTOMER); }
  };

  // Tabs visible to customer: only Menu. Staff tabs appear as small subtle icons in corner.
  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'Outfit', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:ital,wght@0,700;0,900;1,700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #d4a853; border-radius: 4px; }
        input, textarea, select {
          background: #fff; border: 1.5px solid #e8e0d0; color: #1a1612;
          border-radius: 10px; padding: 10px 14px;
          font-family: 'Outfit', sans-serif; font-size: 14px; outline: none; width: 100%;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus, select:focus { border-color: #d4a853; }
        .btn-primary { background: #1a1612; color: #faf8f4; border: none; padding: 11px 22px; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s, transform 0.1s; font-family: 'Outfit', sans-serif; }
        .btn-primary:hover { background: #2d2620; transform: translateY(-1px); }
        .btn-gold { background: #d4a853; color: #1a1612; border: none; padding: 11px 22px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.2s; font-family: 'Outfit', sans-serif; }
        .btn-gold:hover { opacity: 0.88; }
        .btn-outline { background: transparent; border: 1.5px solid #e8e0d0; color: #666; padding: 10px 20px; border-radius: 10px; font-size: 14px; cursor: pointer; transition: all 0.2s; font-family: 'Outfit', sans-serif; }
        .btn-outline:hover { border-color: #1a1612; color: #1a1612; }
        .modal-bg { position: fixed; inset: 0; background: rgba(26,22,18,0.55); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; backdrop-filter: blur(6px); }
        .modal { background: #fff; border-radius: 18px; padding: 28px; width: 100%; max-width: 460px; box-shadow: 0 24px 60px rgba(0,0,0,0.18); animation: su 0.22s ease; }
        @keyframes su { from { opacity:0; transform: translateY(18px); } to { opacity:1; transform: translateY(0); } }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 50px; font-size: 13px; font-weight: 600; z-index: 300; white-space: nowrap; animation: su 0.2s ease; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .toggle { width: 42px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background 0.2s; }
        .toggle-thumb { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; transition: left 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        .nav-tab { padding: 8px 14px; border-radius: 50px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; font-family: 'Outfit', sans-serif; }
        .pill { padding: 6px 14px; border-radius: 50px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid #e8e0d0; background: transparent; color: #888; transition: all 0.2s; white-space: nowrap; font-family: 'Outfit', sans-serif; }
        .pill.active { background: #1a1612; color: #faf8f4; border-color: #1a1612; }
        .pill:not(.active):hover { border-color: #1a1612; color: #1a1612; }
        .card { background: #fff; border-radius: 14px; border: 1.5px solid #f0ebe0; transition: box-shadow 0.2s, transform 0.2s; }
        .card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07); transform: translateY(-2px); }
        .oos-badge { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        @media (max-width: 640px) { .modal { padding: 20px; } .g2 { grid-template-columns: 1fr !important; } }
        @media print { .no-print { display: none !important; } body { background: white; } }
      `}</style>

      {/* Top Nav — customers only see the restaurant name & Menu tab */}
      <div className="no-print" style={{ background: "#1a1612", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: "#d4a853", fontWeight: 900, letterSpacing: "-0.3px", display: "flex", alignItems: "center", gap: 8 }}>
          {data.logo ? <img src={data.logo} alt="logo" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", background: "#fff" }} /> : "🍽"}
          {data.restaurantName}
        </div>

        {/* If staff tab is active, show staff nav; else show only Menu for customer */}
        {(view === VIEWS.ADMIN || view === VIEWS.CASHIER) ? (
          <div style={{ display: "flex", gap: 3, background: "#2d2620", borderRadius: 50, padding: 3 }}>
            {[
              { key: VIEWS.CUSTOMER, label: "📋 Menu" },
              { key: VIEWS.CASHIER, label: "🧾 Billing" },
              { key: VIEWS.ADMIN, label: "⚙️ Admin" },
            ].map(v => (
              <button key={v.key} className="nav-tab"
                style={{ background: view === v.key ? "#d4a853" : "transparent", color: view === v.key ? "#1a1612" : "#aaa" }}
                onClick={() => handleTabClick(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#d4a853", fontWeight: 600 }}>📋 Our Menu</div>
        )}

        {/* Staff access: subtle lock icons bottom-right for staff; lock button when unlocked */}
        {(view === VIEWS.ADMIN || view === VIEWS.CASHIER) ? (
          <button onClick={() => handleLogout(view)} style={{ background: "transparent", border: "1px solid #3d3530", color: "#888", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dbStatus === "online" ? "#22c55e" : dbStatus === "offline" ? "#ef4444" : "#f59e0b", display: "inline-block" }} />
            🔓 Lock
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span title={dbStatus === "online" ? "Database connected" : dbStatus === "offline" ? "Offline - using local data" : "Connecting..."} style={{ width: 7, height: 7, borderRadius: "50%", background: dbStatus === "online" ? "#22c55e" : dbStatus === "offline" ? "#ef4444" : "#f59e0b", display: "inline-block" }} />
            <button onClick={() => handleTabClick(VIEWS.CASHIER)} title="Cashier Login" style={{ background: "transparent", border: "1px solid #3d3530", color: "#555", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 12 }}>🧾</button>
            <button onClick={() => handleTabClick(VIEWS.ADMIN)} title="Admin Login" style={{ background: "transparent", border: "1px solid #3d3530", color: "#555", borderRadius: 8, padding: "5px 8px", cursor: "pointer", fontSize: 12 }}>⚙️</button>
          </div>
        )}
      </div>

      {view === VIEWS.ADMIN && <AdminView data={data} updateData={updateData} pins={pins} updatePins={updatePins} onShowQR={() => setShowQR(true)} />}
      {view === VIEWS.CUSTOMER && <CustomerView data={data} />}
      {view === VIEWS.CASHIER && <CashierView data={data} updateData={updateData} restaurantName={data.restaurantName} />}

      {pinTarget && (
        <PinModal
          icon={pinTarget === VIEWS.ADMIN ? "⚙️" : "🧾"}
          title={pinTarget === VIEWS.ADMIN ? "Admin Access" : "Cashier Access"}
          subtitle={pinTarget === VIEWS.ADMIN ? "Enter Admin PIN to continue" : "Enter Cashier PIN to continue"}
          correctPin={pinTarget === VIEWS.ADMIN ? pins.admin : pins.cashier}
          onSuccess={handlePinSuccess}
          onCancel={() => setPinTarget(null)}
        />
      )}
      {showQR && <QRModal onClose={() => setShowQR(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────
function AdminView({ data, updateData, pins, updatePins, onShowQR }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", price: "", description: "", available: true });
  const [pinForm, setPinForm] = useState({ admin: "", cashier: "" });
  const [settingsForm, setSettingsForm] = useState({ restaurantName: data.restaurantName, logo: data.logo || "" });

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2400); };

  const filtered = data.items.filter(i => {
    const mc = activeCategory === "All" || i.category === activeCategory;
    const ms = i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const openAdd = () => { setEditingItem(null); setForm({ name: "", category: data.categories[0] || "", price: "", description: "", available: true }); setShowItemModal(true); };
  const openEdit = (item) => { setEditingItem(item); setForm({ name: item.name, category: item.category, price: item.price, description: item.description, available: item.available }); setShowItemModal(true); };

  const saveItem = () => {
    if (!form.name.trim() || !form.price || !form.category) { showToast("Fill all required fields", "err"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) { showToast("Enter valid price", "err"); return; }
    if (editingItem) {
      updateData(d => ({ ...d, items: d.items.map(i => i.id === editingItem.id ? { ...i, ...form, price } : i) }));
      showToast("Item updated ✓");
    } else {
      updateData(d => ({ ...d, items: [...d.items, { id: Date.now(), ...form, price }] }));
      showToast("Item added ✓");
    }
    setShowItemModal(false);
  };

  const [confirmDelete, setConfirmDelete] = useState(null); // holds item to delete

  const deleteItem = (id) => { updateData(d => ({ ...d, items: d.items.filter(i => i.id !== id) })); showToast("Item deleted", "err"); setConfirmDelete(null); };
  const toggleAvail = (id) => { updateData(d => ({ ...d, items: d.items.map(i => i.id === id ? { ...i, available: !i.available } : i) })); };
  const addCat = () => {
    const c = newCat.trim();
    if (!c) { showToast("Enter category name", "err"); return; }
    if (data.categories.includes(c)) { showToast("Already exists", "err"); return; }
    updateData(d => ({ ...d, categories: [...d.categories, c] }));
    setNewCat(""); showToast(`"${c}" added ✓`);
  };
  const delCat = (c) => {
    if (data.items.some(i => i.category === c)) { showToast("Move items out first", "err"); return; }
    updateData(d => ({ ...d, categories: d.categories.filter(x => x !== c) }));
    showToast(`"${c}" removed`);
  };

  return (
    <div style={{ padding: "20px 16px", maxWidth: 860, margin: "0 auto" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Total Items", val: data.items.length, icon: "🍴" },
          { label: "Available", val: data.items.filter(i => i.available).length, icon: "✅" },
          { label: "Out of Stock", val: data.items.filter(i => !i.available).length, icon: "🚫" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#1a1612", marginTop: 2 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* QR Button */}
      <button className="btn-outline" style={{ width: "100%", marginBottom: 14, padding: "11px", fontSize: 14, fontWeight: 600, borderColor: "#d4a853", color: "#d4a853" }} onClick={onShowQR}>
        📱 Show Customer Menu QR Code
      </button>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input placeholder="🔍 Search items..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
        <button className="btn-outline" style={{ whiteSpace: "nowrap", padding: "10px 14px" }} onClick={() => { setSettingsForm({ restaurantName: data.restaurantName, logo: data.logo || "" }); setShowSettingsModal(true); }}>🏪 Settings</button>
        <button className="btn-outline" style={{ whiteSpace: "nowrap", padding: "10px 14px" }} onClick={() => setShowCatModal(true)}>📂 Categories</button>
        <button className="btn-outline" style={{ whiteSpace: "nowrap", padding: "10px 14px" }} onClick={() => { setPinForm({ admin: "", cashier: "" }); setShowPinModal(true); }}>🔑 PINs</button>
        <button className="btn-gold" style={{ whiteSpace: "nowrap", padding: "10px 14px" }} onClick={openAdd}>+ Add Item</button>
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {["All", ...data.categories].map(c => (
          <button key={c} className={`pill ${activeCategory === c ? "active" : ""}`} onClick={() => setActiveCategory(c)}>
            {c} <span style={{ opacity: 0.6, fontSize: 11 }}>({c === "All" ? data.items.length : data.items.filter(i => i.category === c).length})</span>
          </button>
        ))}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#bbb" }}>
          <div style={{ fontSize: 36 }}>🍴</div>
          <div style={{ marginTop: 10, fontSize: 15 }}>No items found</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: 12 }}>
          {filtered.map(item => (
            <div key={item.id} className="card" style={{ padding: 16, opacity: item.available ? 1 : 0.65 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#1a1612" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 3, lineHeight: 1.5 }}>{item.description}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: "#d4a853" }}>₹{item.price}</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{item.category}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: item.available ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {item.available ? "Available" : "Out of Stock"}
                    </span>
                    <button className="toggle" style={{ background: item.available ? "#16a34a" : "#e5e7eb" }} onClick={() => toggleAvail(item.id)}>
                      <span className="toggle-thumb" style={{ left: item.available ? 21 : 3 }} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(item)} style={{ background: "#f5f0e8", border: "none", color: "#666", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Outfit', sans-serif" }}>Edit</button>
                    <button onClick={() => setConfirmDelete(item)} style={{ background: "#fef2f2", border: "none", color: "#dc2626", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Outfit', sans-serif" }}>Del</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowItemModal(false)}>
          <div className="modal">
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612", marginBottom: 20 }}>
              {editingItem ? "Edit Item" : "Add New Item"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>Item Name *</label>
                <input placeholder="e.g. Paneer Butter Masala" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {data.categories.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div><label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>Price (₹) *</label>
                  <input type="number" placeholder="0" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              </div>
              <div><label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>Description</label>
                <textarea rows={3} placeholder="Short description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "none" }} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button className="toggle" style={{ background: form.available ? "#16a34a" : "#e5e7eb" }} onClick={() => setForm(f => ({ ...f, available: !f.available }))}>
                  <span className="toggle-thumb" style={{ left: form.available ? 21 : 3 }} />
                </button>
                <span style={{ fontSize: 13, color: "#666" }}>Available for ordering</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowItemModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={saveItem}>{editingItem ? "Update" : "Add Item"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal">
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612", marginBottom: 18 }}>Manage Categories</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input placeholder="New category..." value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} />
              <button className="btn-gold" style={{ whiteSpace: "nowrap" }} onClick={addCat}>Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {data.categories.map(c => (
                <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#faf8f4", borderRadius: 10, padding: "10px 14px", border: "1.5px solid #f0ebe0" }}>
                  <span style={{ fontWeight: 500 }}>{c} <span style={{ fontSize: 11, color: "#bbb" }}>({data.items.filter(i => i.category === c).length} items)</span></span>
                  <button onClick={() => delCat(c)} style={{ background: "#fef2f2", border: "none", color: "#dc2626", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Outfit', sans-serif" }}>Remove</button>
                </div>
              ))}
            </div>
            <button className="btn-outline" style={{ width: "100%", marginTop: 16 }} onClick={() => setShowCatModal(false)}>Done</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1612", marginBottom: 8 }}>Delete Item?</div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 6 }}>
              Are you sure you want to delete
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1612", background: "#faf8f4", border: "1.5px solid #f0ebe0", borderRadius: 10, padding: "10px 16px", marginBottom: 20 }}>
              {confirmDelete.name} — ₹{confirmDelete.price}
            </div>
            <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 20 }}>⚠️ This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-outline" style={{ flex: 1, fontSize: 14 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={{ flex: 2, background: "#dc2626", color: "#fff", border: "none", padding: "11px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }} onClick={() => deleteItem(confirmDelete.id)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Settings Modal */}
      {showSettingsModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowSettingsModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612", marginBottom: 6 }}>🏪 Restaurant Settings</div>
            <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>Update your restaurant name and logo.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>Restaurant Name</label>
                <input placeholder="e.g. Spice Garden" value={settingsForm.restaurantName} onChange={e => setSettingsForm(f => ({ ...f, restaurantName: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>Logo (upload image)</label>
                <div style={{ border: "1.5px dashed #e8e0d0", borderRadius: 10, padding: "16px", textAlign: "center", background: "#faf8f4" }}>
                  {settingsForm.logo ? (
                    <div>
                      <img src={settingsForm.logo} alt="Logo" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 10, marginBottom: 8 }} />
                      <div><button onClick={() => setSettingsForm(f => ({ ...f, logo: "" }))} style={{ background: "#fef2f2", border: "none", color: "#dc2626", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Outfit', sans-serif" }}>Remove Logo</button></div>
                    </div>
                  ) : (
                    <label style={{ cursor: "pointer" }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
                      <div style={{ fontSize: 13, color: "#999" }}>Tap to upload logo</div>
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>JPG, PNG — max 2MB</div>
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { showToast("Image too large, max 2MB", "err"); return; }
                        const reader = new FileReader();
                        reader.onload = ev => setSettingsForm(f => ({ ...f, logo: ev.target.result }));
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => {
                if (!settingsForm.restaurantName.trim()) { showToast("Enter restaurant name", "err"); return; }
                updateData(d => ({ ...d, restaurantName: settingsForm.restaurantName.trim(), logo: settingsForm.logo }));
                setShowSettingsModal(false);
                showToast("Settings saved ✓");
              }}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Change Modal */}
      {showPinModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowPinModal(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612", marginBottom: 6 }}>Change PINs 🔑</div>
            <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>Leave blank to keep current PIN. Must be 6 digits.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>⚙️ Admin PIN <span style={{ color: "#bbb" }}>(current: {pins.admin})</span></label>
                <input type="number" placeholder="Enter new 6-digit PIN" maxLength={6} value={pinForm.admin} onChange={e => setPinForm(f => ({ ...f, admin: e.target.value.slice(0,6) }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#999", display: "block", marginBottom: 5, fontWeight: 600 }}>🧾 Cashier PIN <span style={{ color: "#bbb" }}>(current: {pins.cashier})</span></label>
                <input type="number" placeholder="Enter new 6-digit PIN" maxLength={6} value={pinForm.cashier} onChange={e => setPinForm(f => ({ ...f, cashier: e.target.value.slice(0,6) }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowPinModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={() => {
                const newPins = { ...pins };
                if (pinForm.admin) {
                  if (pinForm.admin.length !== 6) { showToast("Admin PIN must be 6 digits", "err"); return; }
                  newPins.admin = pinForm.admin;
                }
                if (pinForm.cashier) {
                  if (pinForm.cashier.length !== 6) { showToast("Cashier PIN must be 6 digits", "err"); return; }
                  newPins.cashier = pinForm.cashier;
                }
                updatePins(newPins);
                setShowPinModal(false);
                showToast("PINs updated ✓");
              }}>Save PINs</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" style={{ background: toast.type === "err" ? "#fef2f2" : "#f0fdf4", color: toast.type === "err" ? "#dc2626" : "#16a34a", border: `1px solid ${toast.type === "err" ? "#fecaca" : "#bbf7d0"}` }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────
function CustomerView({ data }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState([]); // [{item, qty}]
  const [showCart, setShowCart] = useState(false);

  const availableItems = data.items.filter(i => i.available);
  const filtered = availableItems.filter(i => activeCategory === "All" || i.category === activeCategory);

  const getQty = (id) => { const f = cart.find(x => x.item.id === id); return f ? f.qty : 0; };
  const totalItems = cart.reduce((s, x) => s + x.qty, 0);
  const totalPrice = cart.reduce((s, x) => s + x.item.price * x.qty, 0);

  const tapItem = (item) => {
    if (!item.available) return;
    setCart(c => {
      const ex = c.find(x => x.item.id === item.id);
      if (ex) {
        // already in cart — remove it
        return c.filter(x => x.item.id !== item.id);
      }
      return [...c, { item, qty: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setCart(c => c.map(x => x.item.id === id ? { ...x, qty: x.qty + delta } : x).filter(x => x.qty > 0));
  };

  return (
    <div style={{ background: "#faf8f4", minHeight: "calc(100vh - 60px)", paddingBottom: totalItems > 0 ? 90 : 0 }}>
      <style>{`
        .item-card-sel { border-color: #d4a853 !important; background: #fffbf2 !important; }
        @keyframes cartBounce { 0%,100%{transform:scale(1)} 40%{transform:scale(1.18)} }
        .cart-bounce { animation: cartBounce 0.3s ease; }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes slideDown { from{transform:translateY(0);opacity:1} to{transform:translateY(100%);opacity:0} }
      `}</style>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a1612 0%, #2d2018 100%)", padding: "28px 20px 24px", textAlign: "center" }}>
        {data.logo && <img src={data.logo} alt="logo" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "contain", background: "rgba(255,255,255,0.08)", padding: 6, marginBottom: 10 }} />}
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#d4a853" }}>{data.restaurantName}</div>
        <div style={{ color: "#a08060", fontSize: 12, marginTop: 4 }}>Tap items to add to your selection</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 16, paddingBottom: 4, justifyContent: "center", flexWrap: "wrap" }}>
          {["All", ...data.categories].map(c => (
            <button key={c} className={`pill ${activeCategory === c ? "active" : ""}`}
              style={{ background: activeCategory === c ? "#d4a853" : "rgba(255,255,255,0.08)", color: activeCategory === c ? "#1a1612" : "#ccc", borderColor: activeCategory === c ? "#d4a853" : "rgba(255,255,255,0.15)" }}
              onClick={() => setActiveCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div style={{ padding: "18px 16px", maxWidth: 700, margin: "0 auto" }}>
        {data.categories.filter(c => activeCategory === "All" || c === activeCategory).map(cat => {
          const items = filtered.filter(i => i.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 700, color: "#1a1612", marginBottom: 10, paddingBottom: 7, borderBottom: "2px solid #f0ebe0" }}>{cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {items.map(item => {
                  const qty = getQty(item.id);
                  const selected = qty > 0;
                  return (
                    <div key={item.id} className={`card${selected ? " item-card-sel" : ""}`}
                      style={{ padding: "13px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: item.available ? "pointer" : "default" }}
                      onClick={() => { if (!selected && item.available) tapItem(item); }}>

                      {/* Tick on left */}
                      <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selected ? "#d4a853" : "#e8e0d0"}`, background: selected ? "#d4a853" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#1a1612", fontWeight: 900, flexShrink: 0, transition: "all 0.2s" }}>
                        {selected ? "✓" : ""}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: "#1a1612" }}>{item.name}</span>
                          {!item.available && <span className="oos-badge">Out of Stock</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#999", marginTop: 3, lineHeight: 1.5 }}>{item.description}</div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: "#d4a853" }}>₹{item.price}</div>
                        {selected && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => changeQty(item.id, -1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #e8e0d0", background: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 18, textAlign: "center", color: "#1a1612" }}>{qty}</span>
                            <button onClick={() => changeQty(item.id, 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#1a1612", color: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "#bbb" }}>
            <div style={{ fontSize: 36 }}>🍽</div>
            <div style={{ marginTop: 10 }}>No items in this category</div>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && !showCart && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 150, animation: "slideUp 0.3s ease" }}>
          <button onClick={() => setShowCart(true)} style={{
            background: "#1a1612", color: "#fff", border: "none", borderRadius: 50, padding: "14px 28px",
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer", boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700
          }}>
            <span style={{ background: "#d4a853", color: "#1a1612", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>{totalItems}</span>
            View Selection
            <span style={{ color: "#d4a853", fontFamily: "'Fraunces', serif", fontSize: 16 }}>₹{totalPrice}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div style={{ position: "fixed", inset: 0, zIndex: 250 }}>
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(26,22,18,0.5)", backdropFilter: "blur(4px)" }} onClick={() => setShowCart(false)} />
          {/* Drawer */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "22px 22px 0 0", padding: "20px 20px 32px", maxHeight: "80vh", display: "flex", flexDirection: "column", animation: "slideUp 0.3s ease", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: "#e8e0d0", borderRadius: 2, margin: "0 auto 18px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1612" }}>
                🛒 Your Selection
              </div>
              <button onClick={() => setShowCart(false)} style={{ background: "#faf8f4", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Cart Items */}
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {cart.map(x => (
                <div key={x.item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#faf8f4", borderRadius: 12, padding: "12px 14px", border: "1.5px solid #f0ebe0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1612" }}>{x.item.name}</div>
                    <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>₹{x.item.price} each</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => changeQty(x.item.id, -1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #e8e0d0", background: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: "center" }}>{x.qty}</span>
                    <button onClick={() => changeQty(x.item.id, 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#1a1612", color: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: "#d4a853", minWidth: 50, textAlign: "right" }}>₹{x.item.price * x.qty}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total + clear */}
            <div style={{ borderTop: "1.5px dashed #f0ebe0", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "#999" }}>{totalItems} item{totalItems !== 1 ? "s" : ""} selected</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: "#1a1612" }}>₹{totalPrice}</div>
              </div>
              <button onClick={() => { setCart([]); setShowCart(false); }} style={{ background: "#fef2f2", border: "none", color: "#dc2626", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>
                Clear All
              </button>
            </div>
            <div style={{ background: "#faf8f4", border: "1.5px solid #f0ebe0", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#888" }}>
              📢 Share this list with your waiter to place the order
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// QR CODE MODAL
// ─────────────────────────────────────────
function QRModal({ onClose }) {
  const url = window.location.href;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1612&margin=10`;

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 340, textAlign: "center" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612", marginBottom: 4 }}>📱 Customer Menu QR</div>
        <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>Print this QR and place it on tables. Customers scan to view the menu.</div>
        <div style={{ background: "#faf8f4", borderRadius: 16, padding: 16, display: "inline-block", marginBottom: 16, border: "1.5px solid #f0ebe0" }}>
          <img src={qrUrl} alt="QR Code" style={{ width: 220, height: 220, display: "block", borderRadius: 8 }} />
        </div>
        <div style={{ fontSize: 11, color: "#bbb", marginBottom: 6, wordBreak: "break-all", padding: "0 8px" }}>{url}</div>
        <div style={{ fontSize: 12, color: "#d4a853", fontWeight: 600, marginBottom: 20 }}>🍽 {url.includes("localhost") ? "⚠️ Use a public URL for customers to scan" : "Ready to share!"}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" style={{ flex: 1 }} onClick={onClose}>Close</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={() => {
            const w = window.open("", "_blank");
            w.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding:40px">
              <h2 style="color:#1a1612">Scan to View Our Menu</h2>
              <img src="${qrUrl}" style="width:280px;height:280px;margin:20px auto;display:block" />
              <p style="color:#999;font-size:13px">${url}</p>
            </body></html>`);
            w.document.close(); w.print();
          }}>🖨️ Print QR</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CASHIER / BILLING VIEW
// ─────────────────────────────────────────
function CashierView({ data, updateData, restaurantName }) {
  const [order, setOrder] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [tableNo, setTableNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [showBill, setShowBill] = useState(false);
  const [toast, setToast] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2200); };

  const availableItems = data.items.filter(i => i.available);
  const filtered = availableItems.filter(i => {
    const mc = activeCategory === "All" || i.category === activeCategory;
    const ms = i.name.toLowerCase().includes(search.toLowerCase());
    return mc && ms;
  });

  const addToOrder = (item) => {
    setOrder(o => {
      const ex = o.find(x => x.item.id === item.id);
      if (ex) return o.map(x => x.item.id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...o, { item, qty: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setOrder(o => {
      const updated = o.map(x => x.item.id === id ? { ...x, qty: x.qty + delta } : x).filter(x => x.qty > 0);
      return updated;
    });
  };

  const getQty = (id) => { const f = order.find(x => x.item.id === id); return f ? f.qty : 0; };
  const total = order.reduce((s, x) => s + x.item.price * x.qty, 0);
  const itemCount = order.reduce((s, x) => s + x.qty, 0);

  const generateBill = () => {
    if (!order.length) { showToast("Add items to the order first", "err"); return; }
    setShowBill(true);
  };

  const confirmPayment = () => {
    const bill = {
      id: Date.now(),
      tableNo, customerName,
      items: order.map(x => ({ name: x.item.name, price: x.item.price, qty: x.qty })),
      total,
      time: new Date().toLocaleString("en-IN"),
    };
    updateData(d => ({ ...d, bills: [bill, ...d.bills] }));
    setOrder([]); setTableNo(""); setCustomerName(""); setShowBill(false);
    showToast("Payment confirmed ✓ Bill saved!");
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1612" }}>New Order</div>
        <button className="btn-outline" style={{ fontSize: 12, padding: "7px 14px" }} onClick={() => setShowHistory(true)}>
          📋 Bill History ({data.bills.length})
        </button>
      </div>

      {/* Table & customer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }} className="g2">
        <input placeholder="Table No. (e.g. T-4)" value={tableNo} onChange={e => setTableNo(e.target.value)} />
        <input placeholder="Customer Name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} />
      </div>

      {/* Category pills + search */}
      <div style={{ marginBottom: 14 }}>
        <input placeholder="🔍 Search item by name..." value={search} onChange={e => { setSearch(e.target.value); setActiveCategory("All"); }} style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {["All", ...data.categories].map(c => (
            <button key={c} className={`pill ${activeCategory === c ? "active" : ""}`} onClick={() => { setActiveCategory(c); setSearch(""); }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="g2">
        {/* Menu items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
          {filtered.length === 0 && <div style={{ color: "#bbb", textAlign: "center", padding: 30 }}>No available items</div>}
          {filtered.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} className="card" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1612" }}>{item.name}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: "#d4a853", fontWeight: 700 }}>₹{item.price}</div>
                </div>
                {qty === 0 ? (
                  <button className="btn-gold" style={{ padding: "6px 16px", fontSize: 13 }} onClick={() => addToOrder(item)}>Add</button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => changeQty(item.id, -1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #e8e0d0", background: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: "center" }}>{qty}</span>
                    <button onClick={() => changeQty(item.id, 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "#1a1612", color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", height: "fit-content", position: "sticky", top: 70 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700, marginBottom: 14, color: "#1a1612" }}>
            Order Summary {tableNo && <span style={{ fontSize: 13, color: "#bbb", fontFamily: "'Outfit', sans-serif" }}>· {tableNo}</span>}
          </div>
          {order.length === 0 ? (
            <div style={{ color: "#ccc", fontSize: 13, textAlign: "center", padding: "30px 0" }}>No items added yet</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
                {order.map(x => (
                  <div key={x.item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span style={{ color: "#444", flex: 1 }}>{x.item.name} × {x.qty}</span>
                    <span style={{ fontWeight: 600, color: "#1a1612" }}>₹{(x.item.price * x.qty).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1.5px dashed #f0ebe0", paddingTop: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#888" }}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612" }}>₹{total.toFixed(0)}</span>
                </div>
              </div>
              <button className="btn-gold" style={{ width: "100%", padding: "12px" }} onClick={generateBill}>Generate Bill</button>
              <button className="btn-outline" style={{ width: "100%", marginTop: 8, padding: "10px" }} onClick={() => setOrder([])}>Clear Order</button>
            </>
          )}
        </div>
      </div>

      {/* Bill Modal */}
      {showBill && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowBill(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1612" }}>{data.restaurantName}</div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{new Date().toLocaleString("en-IN")}</div>
              {tableNo && <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Table: {tableNo}{customerName ? ` · ${customerName}` : ""}</div>}
            </div>
            <div style={{ borderTop: "1.5px dashed #e8e0d0", borderBottom: "1.5px dashed #e8e0d0", padding: "14px 0", marginBottom: 14 }}>
              {order.map(x => (
                <div key={x.item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
                  <span style={{ color: "#444" }}>{x.item.name} <span style={{ color: "#bbb" }}>× {x.qty}</span></span>
                  <span style={{ fontWeight: 600 }}>₹{(x.item.price * x.qty).toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#d4a853" }}>₹{total.toFixed(0)}</span>
            </div>
            <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginBottom: 18 }}>Thank you for dining with us! 🙏</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowBill(false)}>Back</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={confirmPayment}>✓ Confirm Payment</button>
            </div>
            <button onClick={() => {
              const printContent = `
                <html><head><title>Bill</title>
                <style>
                  body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
                  h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
                  .sub { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; }
                  .row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
                  .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
                  .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 8px; }
                  .footer { text-align: center; font-size: 11px; color: #999; margin-top: 16px; }
                </style></head><body>
                <h2>${restaurantName}</h2>
                <div class="sub">${new Date().toLocaleString("en-IN")}${tableNo ? `<br>Table: ${tableNo}` : ""}${customerName ? ` · ${customerName}` : ""}</div>
                <div class="divider"></div>
                ${order.map(x => `<div class="row"><span>${x.item.name} × ${x.qty}</span><span>₹${(x.item.price * x.qty).toFixed(0)}</span></div>`).join("")}
                <div class="divider"></div>
                <div class="total"><span>Total</span><span>₹${total.toFixed(0)}</span></div>
                <div class="footer">Thank you for dining with us! 🙏</div>
                </body></html>`;
              const w = window.open("", "_blank");
              w.document.write(printContent);
              w.document.close();
              w.print();
            }} style={{ width: "100%", background: "#faf8f4", border: "1.5px solid #e8e0d0", color: "#666", padding: "10px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
              🖨️ Print Bill
            </button>
          </div>
        </div>
      )}

      {/* Bill History Modal */}
      {showHistory && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, marginBottom: 18 }}>Bill History</div>
            {data.bills.length === 0 ? (
              <div style={{ color: "#bbb", textAlign: "center", padding: 40 }}>No bills yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
                {data.bills.map(b => (
                  <div key={b.id} style={{ background: "#faf8f4", borderRadius: 12, padding: "12px 14px", border: "1.5px solid #f0ebe0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{b.tableNo || "No Table"}{b.customerName ? ` · ${b.customerName}` : ""}</div>
                        <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{b.time}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{b.items.map(i => `${i.name}×${i.qty}`).join(", ")}</div>
                      </div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#d4a853", whiteSpace: "nowrap" }}>₹{b.total.toFixed(0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-outline" style={{ width: "100%", marginTop: 16 }} onClick={() => setShowHistory(false)}>Close</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" style={{ background: toast.type === "err" ? "#fef2f2" : "#f0fdf4", color: toast.type === "err" ? "#dc2626" : "#16a34a", border: `1px solid ${toast.type === "err" ? "#fecaca" : "#bbf7d0"}` }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

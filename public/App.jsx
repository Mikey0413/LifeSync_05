import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Hospital, LogOut, MapPin, Shield, Menu, X, 
  Navigation, Ambulance, HeartPulse, CheckCircle2, Sparkles 
} from 'lucide-react';
import { ref, push, set, onValue, update, serverTimestamp } from "firebase/database";
import { db } from "./Firebase";

export default function LifeSyncApp() {
  // --- STATE ---
  const [userRole, setUserRole] = useState(localStorage.getItem('lifeSync_role') || null);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [myEmergencyStatus, setMyEmergencyStatus] = useState(null);
  
  // AI States
  const [aiAdvice, setAiAdvice] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- AI LOGIC (Step 4) ---
  const fetchAiFirstAid = async () => {
    setIsAiLoading(true);
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: "You are a first-aid assistant. Provide 4 short, life-saving bullet points for a medical emergency. Start with 'Help is on the way.' End with 'Disclaimer: Not a substitute for professional help.'" 
            },
            { role: 'user', content: "General medical emergency at my location." }
          ]
        },
        {
          headers: { 
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setAiAdvice(response.data.choices[0].message.content);
    } catch (err) {
      setAiAdvice("Stay calm. Keep the patient comfortable and monitor breathing until help arrives.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- CITIZEN ACTIONS ---
  const triggerSOS = () => {
    setIsSOSActive(true);
    fetchAiFirstAid(); // Start AI generation immediately

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        
        const alertsRef = ref(db, 'emergencies');
        const newAlertRef = push(alertsRef);
        const incidentId = newAlertRef.key;
        
        set(newAlertRef, {
          patientName: "John Doe",
          bloodType: "O+",
          location: coords,
          status: "pending",
          createdAt: serverTimestamp()
        });

        const statusRef = ref(db, `emergencies/${incidentId}`);
        onValue(statusRef, (snapshot) => {
          const data = snapshot.val();
          if (data?.status === 'accepted') setMyEmergencyStatus('accepted');
        });

      }, null, { enableHighAccuracy: true });
    }
  };

  // --- STAFF ACTIONS ---
  useEffect(() => {
    if (userRole === 'hospital') {
      const unsubscribe = onValue(ref(db, 'emergencies'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setActiveEmergencies(list.reverse());
        }
      });
      return () => unsubscribe();
    }
  }, [userRole]);

  const acceptEmergency = (id) => {
    update(ref(db, `emergencies/${id}`), { status: "accepted", acceptedAt: serverTimestamp() });
  };

  // --- RENDER HELPERS ---
  const handleLogin = (role) => { localStorage.setItem('lifeSync_role', role); setUserRole(role); };
  const handleLogout = () => { localStorage.removeItem('lifeSync_role'); setUserRole(null); setAiAdvice(""); };

  if (!userRole) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-4xl shadow-2xl p-10 border border-slate-100">
        <Shield className="text-red-600 w-16 h-16 mx-auto mb-6 animate-pulse" />
        <h1 className="text-4xl font-black text-center text-slate-900 mb-10 tracking-tighter">LifeSync</h1>
        <div className="space-y-4">
          <button onClick={() => handleLogin('user')} className="w-full p-6 bg-slate-50 hover:bg-red-50 rounded-3xl flex items-center gap-4 border-2 border-transparent hover:border-red-200 transition-all font-bold">
            <User className="text-red-600" /> Citizen Portal
          </button>
          <button onClick={() => handleLogin('hospital')} className="w-full p-6 bg-slate-50 hover:bg-blue-50 rounded-3xl flex items-center gap-4 border-2 border-transparent hover:border-blue-200 transition-all font-bold">
            <Hospital className="text-blue-600" /> Staff Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${userRole === 'hospital' ? 'bg-[#0a0a0b] text-white' : 'bg-white text-slate-900'} p-6`}>
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-black uppercase italic tracking-tighter">{userRole === 'hospital' ? 'Staff Control' : 'LifeSync'}</h2>
        <button onClick={handleLogout} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl"><LogOut size={20}/></button>
      </header>

      {userRole === 'user' ? (
        <main className="flex flex-col items-center pt-8 text-center">
          {myEmergencyStatus === 'accepted' ? (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-green-50 p-10 rounded-4xl border border-green-200">
              <CheckCircle2 size={60} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-green-800 uppercase italic">Help is on the way</h2>
              <p className="text-green-600 font-bold mt-2 text-xs uppercase underline">Ambulance Dispatched</p>
            </motion.div>
          ) : (
            <>
              <div className="relative mb-12">
                {isSOSActive && <motion.div animate={{ scale: [1, 2.5], opacity: [0.8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 bg-red-500 rounded-full" />}
                <button onClick={triggerSOS} className={`relative z-10 w-64 h-64 rounded-full text-white text-6xl font-black shadow-2xl transition-all ${isSOSActive ? 'bg-orange-500' : 'bg-red-600'}`}>
                  {isSOSActive ? <Navigation className="animate-pulse mx-auto" size={60} /> : 'SOS'}
                </button>
              </div>

              <AnimatePresence>
                {(isAiLoading || aiAdvice) && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-slate-900 text-white p-8 rounded-4xl shadow-xl text-left border border-white/10">
                    <div className="flex items-center gap-2 mb-4 text-blue-400">
                      <Sparkles size={18} /> <span className="text-[10px] font-black uppercase tracking-[0.2em]">AI First-Aid Protocol</span>
                    </div>
                    {isAiLoading ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-3 bg-slate-800 rounded w-3/4" />
                        <div className="h-3 bg-slate-800 rounded w-full" />
                        <div className="h-3 bg-slate-800 rounded w-1/2" />
                      </div>
                    ) : (
                      <p className="text-sm font-medium leading-relaxed text-slate-300 whitespace-pre-line">{aiAdvice}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
      ) : (
        <div className="space-y-6">
          {activeEmergencies.map((item) => (
            <div key={item.id} className={`p-8 rounded-4xl border transition-all ${item.status === 'accepted' ? 'bg-green-500/5 border-green-500/20 opacity-50' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex justify-between mb-6">
                <div>
                  <h3 className="font-black text-xl uppercase italic">{item.patientName}</h3>
                  <p className="text-[10px] text-blue-400 font-mono mt-1">{item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}</p>
                </div>
                {item.status === 'accepted' && <CheckCircle2 className="text-green-500" />}
              </div>
              {item.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => acceptEmergency(item.id)} className="flex-1 bg-red-600 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-900/30 active:scale-95">Accept Case</button>
                  <button className="p-4 bg-slate-800 rounded-3xl border border-white/10" onClick={() => window.open(`https://www.google.com/maps?q=${item.location.lat},${item.location.lng}`)}><MapPin size={24}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
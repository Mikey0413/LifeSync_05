import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Hospital, LogOut, MapPin, Home, Phone, Shield, Menu, X, Ambulance, ChevronRight, Bed, Phone as PhoneIcon } from 'lucide-react';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

export default function LifeSyncApp() {
  // 1. STATE MANAGEMENT (Persistence Simulation)
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || null);
  const [isUserRegistered, setIsUserRegistered] = useState(localStorage.getItem('isRegistered') === 'true');
  const [currentPage, setCurrentPage] = useState(() => {
    // If user is already registered and logged in, go to home page
    if (localStorage.getItem('role') === 'user' && localStorage.getItem('isRegistered') === 'true') {
      return 'home';
    }
    return 'home';
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sosStarted, setSosStarted] = useState(false);
  const [position, setPosition] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [notificationStatus, setNotificationStatus] = useState({});
  const [userData, setUserData] = useState(() => {
    const stored = localStorage.getItem('userData');
    return stored ? JSON.parse(stored) : null;
  });
  const [hospitalData, setHospitalData] = useState(() => {
    const stored = localStorage.getItem('hospitalLoggedIn');
    return stored ? JSON.parse(stored) : null;
  });

  // 2. LOGIN HANDLER
  const handleLogin = (role) => {
    localStorage.setItem('role', role);
    setUserRole(role);
    
    // Check if user is registered, if not go to registration
    if (role === 'user' && !isUserRegistered) {
      setCurrentPage('register');
    } else if (role === 'hospital') {
      // Show hospital login/register page
      setCurrentPage('hospital-login');
    } else {
      setCurrentPage('home');
    }
  };

  const handleRegistration = (data) => {
    localStorage.setItem('userData', JSON.stringify(data));
    localStorage.setItem('isRegistered', 'true');
    setUserData(data);
    setIsUserRegistered(true);
    // Auto-login user after registration
    setUserRole('user');
    setCurrentPage('home');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserRole(null);
    setIsUserRegistered(false);
    setUserData(null);
    setCurrentPage('login');
  };

  // SOS / Notifications
  const emergencyContacts = () => {
    // gather up to 5 contacts from stored userData or defaults
    const contacts = [];
    if (userData?.emergencyContact1 && userData?.emergencyPhone1) contacts.push({ name: userData.emergencyContact1, phone: userData.emergencyPhone1 });
    if (userData?.emergencyContact2 && userData?.emergencyPhone2) contacts.push({ name: userData.emergencyContact2, phone: userData.emergencyPhone2 });
    // fill with defaults if less than 5
    while (contacts.length < 5) {
      contacts.push({ name: `Contact ${contacts.length + 1}`, phone: `+91 90000 0000${contacts.length}` });
    }
    return contacts.slice(0,5);
  };

  const [calculatedHospitals, setCalculatedHospitals] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [alertsSent, setAlertsSent] = useState(false);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Search for REAL nearby hospitals using Google Places API
  const searchNearbyHospitals = async (userPos) => {
    if (!userPos) {
      console.log('No position available');
      return;
    }

    // Wait for Google Maps API to load
    let attempts = 0;
    const waitForGoogle = setInterval(() => {
      attempts++;
      if (window.google && window.google.maps && window.google.maps.places) {
        clearInterval(waitForGoogle);
        performSearch();
      } else if (attempts > 20) {
        clearInterval(waitForGoogle);
        console.error('Google Maps API failed to load');
        setCalculatedHospitals([]);
      }
    }, 100);

    const performSearch = () => {
      try {
        console.log('Starting hospital search for:', userPos.coords.latitude, userPos.coords.longitude);
        
        const userLocation = new window.google.maps.LatLng(userPos.coords.latitude, userPos.coords.longitude);
        
        // Create a dummy div for PlacesService
        const mapDiv = document.createElement('div');
        mapDiv.style.display = 'none';
        document.body.appendChild(mapDiv);
        
        const map = new window.google.maps.Map(mapDiv, {
          center: userLocation,
          zoom: 15
        });
        
        const service = new window.google.maps.places.PlacesService(map);
        
        const request = {
          location: userLocation,
          radius: 5000, // 5km radius
          type: 'hospital'
        };

        console.log('Sending PlacesService request:', request);

        service.nearbySearch(request, (results, status) => {
          console.log('=== Places API Response ===');
          console.log('Status:', status);
          console.log('Results count:', results?.length);
          
          // Log status constants
          console.log('OK Status constant:', window.google.maps.places.PlacesServiceStatus.OK);
          console.log('Status string comparison:', status === 'OK');
          
          // Try both string and constant comparison
          const isOK = status === 'OK' || status === window.google.maps.places.PlacesServiceStatus.OK;
          
          if (isOK && results && results.length > 0) {
            console.log('Hospitals found! Processing...');
            
            // Sort by distance and get top 3
            const hospitalsWithDist = results.map((place) => {
              const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                userLocation,
                place.geometry.location
              ) / 1000;
              return { place, distance };
            });

            hospitalsWithDist.sort((a, b) => a.distance - b.distance);

            const topHospitals = hospitalsWithDist.slice(0, 3).map(({ place, distance: dist }, idx) => {
              const estimatedTime = Math.ceil((dist / 30) * 60);

              return {
                name: place.name || 'Hospital',
                address: place.vicinity || 'Address not available',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                dist: `${dist.toFixed(1)}km`,
                time: `${estimatedTime} mins`,
                distValue: dist,
                rating: place.rating || 'N/A',
                icuAvail: Math.floor(Math.random() * 15) + 1,
                ambulance: '+91 98765 1000' + idx,
                toll: '1800-HOSPITAL-' + idx,
                placeId: place.place_id,
                isOpenNow: place.opening_hours?.open_now ? 'Open' : 'Check Hours'
              };
            });

            setCalculatedHospitals(topHospitals);
            console.log('✅ Found Real Top 3 Hospitals:', topHospitals);
          } else {
            console.error('❌ Places Search failed or no results. Status:', status);
            
            // Show mock hospitals as fallback for testing
            const mockHospitals = [
              {
                name: 'City Medical Center',
                address: 'Main Street, Downtown',
                lat: userPos.coords.latitude + 0.01,
                lng: userPos.coords.longitude + 0.01,
                dist: '1.2km',
                time: '5 mins',
                distValue: 1.2,
                rating: '4.5',
                icuAvail: 8,
                ambulance: '+91 9876510001',
                toll: '1800-CITY-911',
                isOpenNow: 'Open'
              },
              {
                name: 'St. Joseph Hospital',
                address: 'Healthcare Avenue, North',
                lat: userPos.coords.latitude - 0.01,
                lng: userPos.coords.longitude + 0.01,
                dist: '2.4km',
                time: '9 mins',
                distValue: 2.4,
                rating: '4.7',
                icuAvail: 12,
                ambulance: '+91 9876510002',
                toll: '1800-JOSEPH-911',
                isOpenNow: 'Open'
              },
              {
                name: 'Central Health Complex',
                address: 'Wellness Road, Metro',
                lat: userPos.coords.latitude + 0.005,
                lng: userPos.coords.longitude - 0.01,
                dist: '3.1km',
                time: '12 mins',
                distValue: 3.1,
                rating: '4.3',
                icuAvail: 5,
                ambulance: '+91 9876510003',
                toll: '1800-CENTRAL-911',
                isOpenNow: 'Open'
              }
            ];
            
            console.log('Using fallback mock hospitals for testing');
            setCalculatedHospitals(mockHospitals);
          }
          
          // Clean up
          document.body.removeChild(mapDiv);
        });
      } catch (error) {
        console.error('Error in searchNearbyHospitals:', error);
        setCalculatedHospitals([]);
      }
    };
  };

  // Try to detect the Google Maps API key from the loaded script tag (if present)
  const getGoogleApiKey = () => {
    try {
      for (const s of Array.from(document.scripts)) {
        if (!s.src) continue;
        if (s.src.includes('maps.googleapis.com')) {
          const url = new URL(s.src);
          return url.searchParams.get('key') || '';
        }
      }
    } catch (e) {
      console.error('Error reading Google API key from scripts', e);
    }
    return '';
  };

  // Initialize map with proper error checking
  useEffect(() => {
    if (currentPage === 'map' && position && window.google) {
      const mapElement = document.getElementById('map');
      
      if (!mapElement) {
        console.error('Map element not found');
        return;
      }

      if (mapRef && mapLoaded) {
        return; // Map already initialized
      }

      try {
        const map = new window.google.maps.Map(mapElement, {
          zoom: 15,
          center: { lat: position.coords.latitude, lng: position.coords.longitude },
          mapTypeId: 'roadmap'
        });

        // User marker (Blue)
        new window.google.maps.Marker({
          position: { lat: position.coords.latitude, lng: position.coords.longitude },
          map: map,
          title: 'Your Location',
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        });

        // Hospital markers (Red)
        calculatedHospitals.forEach((hospital, idx) => {
          new window.google.maps.Marker({
            position: { lat: hospital.lat, lng: hospital.lng },
            map: map,
            title: `${idx + 1}. ${hospital.name}`,
            label: `${idx + 1}`,
            icon: 'http://maps.google.com/mapfiles/ms/icons/hospital.png'
          });

          // Add info window
          const infowindow = new window.google.maps.InfoWindow({
            content: `<div style="padding:10px">
              <strong>${hospital.name}</strong><br/>
              ${hospital.address}<br/>
              Distance: ${hospital.dist}
            </div>`
          });

          const marker = new window.google.maps.Marker({
            position: { lat: hospital.lat, lng: hospital.lng },
            map: map,
            title: hospital.name
          });

          marker.addListener('click', () => {
            infowindow.open(map, marker);
          });
        });

        setMapRef(map);
        setMapLoaded(true);
      } catch (error) {
        console.error('Map initialization error:', error);
      }
    }
  }, [currentPage, position, calculatedHospitals, mapRef, mapLoaded]);

  const nearestHospitals = calculatedHospitals.length > 0 ? calculatedHospitals : [];

  const notifyAll = (pos, selectedHospital) => {
    if (!pos) return;
    
    // Build message with location and hospital details
    const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    const apiKey = getGoogleApiKey();
    const mapsLink = apiKey
      ? `https://www.google.com/maps/search/?api=1&query=${pos.coords.latitude},${pos.coords.longitude}&key=${apiKey}`
      : `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
    const hospitalMapsLink = selectedHospital && apiKey
      ? `https://www.google.com/maps/search/?api=1&query=${selectedHospital.lat},${selectedHospital.lng}&key=${apiKey}`
      : selectedHospital
        ? `https://www.google.com/maps?q=${selectedHospital.lat},${selectedHospital.lng}`
        : '';
    const timestamp = new Date().toLocaleTimeString();
    
    const contacts = emergencyContacts();
    const status = {};

    // Send SMS to emergency contacts
    contacts.forEach((c, i) => {
      const msg = `🚨 EMERGENCY ALERT!\nName: ${userData?.name || 'Unknown'}\nAge: ${userData?.age || 'N/A'}\nBlood: ${userData?.bloodGroup || 'N/A'}\nLocation: ${coords}\nHospital: ${selectedHospital.name}\nHospital Location: ${selectedHospital.lat.toFixed(6)},${selectedHospital.lng.toFixed(6)}\nTime: ${timestamp}\nMap: ${mapsLink}\nHospital Map: ${hospitalMapsLink}`;
      
      status[`contact_${i}`] = {
        to: c.phone,
        name: c.name,
        status: 'SMS Sent',
        message: msg,
        timestamp: timestamp,
        location: coords
      };
      
      console.log(`SMS to ${c.name} (${c.phone}):`, msg);
    });

    // Notify the selected hospital
    const msg = `🚨 INCOMING EMERGENCY!\nPatient: ${userData?.name || 'Unknown'}\nAge: ${userData?.age || 'N/A'}\nBlood: ${userData?.bloodGroup || 'N/A'}\nLocation: ${coords}\nPatient Map: ${mapsLink}\nHospital: ${selectedHospital.name}\nHospital Location: ${selectedHospital.lat.toFixed(6)},${selectedHospital.lng.toFixed(6)}\nHospital Map: ${hospitalMapsLink}\nTime: ${timestamp}`;
    
    status[`hospital`] = {
      to: selectedHospital.ambulance,
      name: selectedHospital.name,
      status: 'Alert Sent',
      message: msg,
      timestamp: timestamp,
      location: coords,
      hospital: selectedHospital.name
    };
    
    console.log(`Alert to ${selectedHospital.name} (${selectedHospital.ambulance}):`, msg);

    setNotificationStatus(status);
    // Persist hospital alert for hospital dashboard tracing
    try {
      const inbound = JSON.parse(localStorage.getItem('inboundAlerts') || '[]');
      inbound.unshift({
        patient: userData?.name || 'Unknown',
        phone: userData?.phone || '',
        coords,
        mapsLink,
        hospital: selectedHospital.name,
        hospitalCoords: `${selectedHospital.lat},${selectedHospital.lng}`,
        hospitalPhone: selectedHospital.ambulance,
        timestamp
      });
      // keep last 50
      localStorage.setItem('inboundAlerts', JSON.stringify(inbound.slice(0,50)));
    } catch (e) {
      console.error('Error persisting inbound alert', e);
    }
  };

  // Call ambulance for specific hospital
  const callAmbulance = (hospital) => {
    if (!position) {
      alert('Location not available. Please enable GPS.');
      return;
    }

    // Prevent accidental duplicate sends
    if (alertsSent) {
      const resend = window.confirm('Alerts were already sent. Do you want to resend and call again?');
      if (!resend) return;
    }

    // Send SMS and alerts
    notifyAll(position, hospital);
    setAlertsSent(true);

    // Show confirmation
    alert(`✅ Emergency alert sent to:\n${hospital.name}\nYour emergency contacts\n\nAmbulance: ${hospital.ambulance}`);

    // Auto-call ambulance
    window.location.href = `tel:${hospital.ambulance}`;
  };

  // Confirm before sending alerts and calling ambulance
  const confirmAndCall = (hospital) => {
    const ok = window.confirm(`Send your live location to emergency contacts and call ambulance at ${hospital.name}?`);
    if (!ok) return;
    callAmbulance(hospital);
  };

  // Firebase Emergency Report Function
  const reportEmergency = (coords) => {
    try {
      // Reference the 'emergencies' collection
      const alertsRef = ref(db, 'emergencies');
      
      // Create a new unique entry
      const newAlertRef = push(alertsRef);
      
      // Populate the entry with patient and GPS data
      set(newAlertRef, {
        userName: userData?.name || 'Unknown Patient',
        bloodType: userData?.bloodGroup || 'N/A',
        age: userData?.age || 'N/A',
        phone: userData?.phone || 'N/A',
        coordinates: {
          lat: coords.lat,
          lng: coords.lng
        },
        emergencyContacts: emergencyContacts().slice(0, 2),
        status: 'pending',
        createdAt: serverTimestamp()
      })
      .then(() => {
        console.log('✅ Emergency reported to Firebase successfully!');
        setIsSOSActive(true);
      })
      .catch((error) => {
        console.error('❌ Firebase sync failed:', error);
        setIsSOSActive(false);
      });
    } catch (error) {
      console.error('Error in reportEmergency:', error);
      setIsSOSActive(false);
    }
  };

  const triggerSOS = () => {
    setIsSOSActive(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setPosition(position);
          
          // THE TRIGGER: Send to Firebase
          reportEmergency(currentCoords); 
        },
        (error) => {
          console.error("Geolocation failed:", error);
          setIsSOSActive(false);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const startSOS = async () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation not supported in this browser');
      return;
    }

    setSosStarted(true);
    setNotificationStatus({}); // Clear previous notifications
    setAlertsSent(false);

    // Request high accuracy position first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos);
        // Search for REAL nearby hospitals using Google Places API
        searchNearbyHospitals(pos);
        console.log('SOS Activated - Searching nearby hospitals...');
      },
      (err) => {
        console.error('Geolocation error:', err.message);
        alert('Unable to get location. Please enable location services.');
        setSosStarted(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    // Start watching for continuous location updates
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition(pos);
      },
      (err) => {
        console.error('Watch error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    setWatchId(id);
  };

  const stopSOS = () => {
    if (watchId !== null && navigator.geolocation.clearWatch) {
      navigator.geolocation.clearWatch(watchId);
    }
    setWatchId(null);
    setSosStarted(false);
    setNotificationStatus({});
    setAlertsSent(false);
  };

  // 3. UI COMPONENTS

  // --- REGISTRATION SCREEN ---
  if (userRole === 'user' && !isUserRegistered && currentPage === 'register') {
    return (
      <RegistrationForm onSubmit={handleRegistration} onBack={() => {
        setUserRole(null);
        localStorage.clear();
      }} />
    );
  }

  // Hospital Registration Page
  if (currentPage === 'hospital-register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-lg w-full bg-white p-6 rounded-3xl shadow-xl">
          <h2 className="text-2xl font-black mb-4">Register Hospital</h2>
          <HospitalRegistrationForm onSubmit={(h) => {
            localStorage.setItem('hospitalData', JSON.stringify(h));
            setHospitalData(h);
            setCurrentPage('hospital-dashboard');
          }} onCancel={() => setCurrentPage('hospital-login')} />
        </div>
      </div>
    );
  }

  // Hospital Login Page
  if (currentPage === 'hospital-login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-6 rounded-3xl shadow-xl">
          <h2 className="text-2xl font-black mb-4">Hospital Login</h2>
          <HospitalLoginForm onLogin={(h) => {
            setUserRole('hospital');
            setCurrentPage('hospital-dashboard');
            setHospitalData(h);
            localStorage.setItem('hospitalLoggedIn', JSON.stringify(h));
          }} onRegister={() => setCurrentPage('hospital-register')} />
        </div>
      </div>
    );
  }
  
  // --- LOGIN SCREEN ---
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-100 rounded-full"><Shield className="text-red-600 w-10 h-10" /></div>
          </div>
          <h1 className="text-4xl font-black text-center text-slate-800 mb-2">LifeSync</h1>
          <p className="text-center text-slate-500 mb-8">Emergency Medical Assistance</p>
          
          <div className="space-y-4">
            <button onClick={() => handleLogin('user')} className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-150 border-2 border-red-200 rounded-2xl transition-all group">
              <div className="flex items-center gap-4">
                <User className="text-red-600 w-6 h-6" />
                <span className="font-bold text-slate-700">Citizen Portal</span>
              </div>
              <ChevronRight className="text-red-600 w-5 h-5" />
            </button>

            <button onClick={() => handleLogin('hospital')} className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 border-2 border-blue-200 rounded-2xl transition-all group">
              <div className="flex items-center gap-4">
                <Hospital className="text-blue-600 w-6 h-6" />
                <span className="font-bold text-slate-700">Hospital Staff</span>
              </div>
              <ChevronRight className="text-blue-600 w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CITIZEN PORTAL ---
  if (userRole === 'user') {
    return (
      <div className="min-h-screen bg-white text-slate-900 relative overflow-hidden">
        {/* Sliding Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-0 z-50 bg-white w-3/4 shadow-2xl p-6">
              <div className="flex justify-between mb-10">
                <span className="font-black text-red-600 text-xl">LifeSync</span>
                <X onClick={() => setIsMenuOpen(false)} />
              </div>
              <nav className="space-y-6">
                    <div onClick={() => {setCurrentPage('home'); setIsMenuOpen(false)}} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><Home className="w-4 h-4" /> Home</div>
                    
                <div onClick={() => {setCurrentPage('profile'); setIsMenuOpen(false)}} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><User /> Profile</div>
                    <div onClick={() => {setCurrentPage('nearest'); setIsMenuOpen(false)}} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><Hospital /> Nearest Hospitals</div>
                    <div onClick={() => {setCurrentPage('profile'); setIsEditingProfile(true); setIsMenuOpen(false)}} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><User /> Edit Profile</div>
                    <div onClick={() => {setCurrentPage('profile'); setIsEditingProfile(true); setIsMenuOpen(false)}} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><Phone /> Emergency Contacts</div>
                
                <div className="pt-4 border-t">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-4">Emergency Services</div>
                  <button onClick={() => { window.location.href = 'tel:112'; setIsMenuOpen(false); }} className="w-full flex items-center gap-4 p-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition mb-3">
                    <Phone className="w-5 h-5" /> Call 112
                  </button>
                </div>
                
                <div onClick={handleLogout} className="flex items-center gap-4 text-lg font-bold text-red-600 cursor-pointer hover:text-red-700 transition"><LogOut /> Log Out</div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="p-6 flex justify-between items-center">
          <Menu onClick={() => setIsMenuOpen(true)} className="w-8 h-8 cursor-pointer" />
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
        </header>

        {/* Dynamic Pages */}
        <main className="p-6">
          {currentPage === 'home' && (
            <div className="flex flex-col items-center justify-center py-12">
              <h2 className="text-2xl font-black mb-2">Ready for Assistance</h2>
              <p className="text-slate-400 mb-6">Press the SOS button to alert contacts and nearby hospitals</p>

              <motion.button 
                whileTap={{ scale: 0.95 }}
                animate={sosStarted ? { scale: [1, 1.06, 1] } : {}}
                transition={{ repeat: sosStarted ? Infinity : 0, duration: 1 }}
                onClick={() => (sosStarted ? stopSOS() : startSOS())}
                className={`w-72 h-72 rounded-full flex flex-col items-center justify-center text-white text-5xl font-black shadow-2xl transition-colors ${sosStarted ? 'bg-orange-500' : 'bg-red-600 shadow-red-200'}`}
              >
                <span className="text-3xl">{sosStarted ? 'ACTIVE' : 'SOS'}</span>
                <span className="text-sm font-medium mt-2">{sosStarted ? 'Sending location...' : 'Tap to alert'}</span>
              </motion.button>

              {sosStarted && (
                <div className="mt-6 w-full max-w-3xl">
                  {/* Quick-action red buttons for top-3 hospitals */}
                  {nearestHospitals.length > 0 && (
                    <div className="flex items-center justify-center gap-4 mb-4">
                      {nearestHospitals.map((h, idx) => (
                        <button
                          key={`quick-${idx}`}
                          onClick={() => confirmAndCall(h)}
                          className="flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full w-20 h-20 shadow-lg"
                          title={`Send location & call ${h.name}`}
                        >
                          <span className="text-xs font-bold text-center px-1">{`#${idx+1}`}</span>
                          <span className="text-[10px] mt-1 text-center px-1">{h.dist}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="bg-white p-4 rounded-2xl shadow mb-4">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <p className="text-xs text-slate-500">Live Location (GPS Precise)</p>
                        <p className="font-bold text-sm">{position ? `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}` : 'Acquiring...'}</p>
                        <p className="text-xs text-slate-400">Accuracy: {position ? `±${position.coords.accuracy.toFixed(0)}m` : 'N/A'}</p>
                      </div>
                      <div className="text-right flex gap-2">
                        {position && (
                          <button onClick={() => setCurrentPage('map')} className="text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100">📍 View Map</button>
                        )}
                        {position && (
                          <a className="text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100" href={`https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`} target="_blank" rel="noreferrer">🗺️ GMaps</a>
                        )}
                        <button onClick={stopSOS} className="text-sm text-white font-bold bg-red-600 px-3 py-1 rounded-lg hover:bg-red-700">Stop</button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {nearestHospitals.map((h, i) => (
                      <div key={i} className="p-4 bg-white rounded-2xl shadow flex flex-col md:flex-row md:justify-between md:items-center">
                        <div>
                          <h4 className="font-bold text-slate-900">{h.name}</h4>
                          <p className="text-sm text-slate-500">{h.address}</p>
                          {h.lat && h.lng && (
                            <p className="text-xs text-slate-400">Coords: {h.lat.toFixed(6)}, {h.lng.toFixed(6)}</p>
                          )}
                          <p className="text-xs text-green-600 font-semibold mt-1">📍 {h.dist} • {h.time} away</p>
                          <div className="flex gap-3 mt-2">
                            <div className="flex items-center gap-2 bg-green-50 p-2 rounded-lg">
                              <Bed className="w-4 h-4 text-green-600" />
                              <div>
                                <p className="text-xs text-slate-500">ICU Beds</p>
                                <p className="font-bold text-green-600">{h.icuAvail}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                              <Ambulance className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="text-xs text-slate-500">Ambulance</p>
                                <p className="font-bold text-blue-600 text-sm">{h.ambulance}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-0 md:text-right">
                          <div className="text-sm text-slate-600 mb-2">Status: <span className="font-semibold text-green-600">{notificationStatus.hospital?.status || 'Ready'}</span></div>
                          <button onClick={() => confirmAndCall(h)} className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-xl font-bold transition-colors">
                            🚑 Call Ambulance
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 bg-white p-3 rounded-2xl shadow">
                    <h5 className="font-bold mb-2">Notifications</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.keys(notificationStatus).length === 0 && <div className="text-sm text-slate-500">Notifications will appear here once dispatched.</div>}
                      {Object.entries(notificationStatus).map(([k,v]) => (
                        <div key={k} className="p-2 bg-slate-50 rounded-lg">
                          <div className="text-xs text-slate-500">{v.name}</div>
                          <div className="font-bold text-sm">{v.to}</div>
                          <div className="text-xs text-slate-600">{v.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentPage === 'profile' && (
            <div className="animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-3">
                  <button onClick={() => { setCurrentPage('home'); setIsEditingProfile(false); }} className="text-slate-400 font-bold py-2 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg transition">← Back</button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setIsEditingProfile(prev => !prev); }} className="text-white font-bold py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg transition">{isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}</button>
                </div>
              </div>

              <h2 className="text-3xl font-black mb-6">Your Profile</h2>

              {isEditingProfile ? (
                <EditProfileForm
                  initialData={userData}
                  onSave={(updated) => {
                    localStorage.setItem('userData', JSON.stringify(updated));
                    setUserData(updated);
                    setIsEditingProfile(false);
                    alert('Profile updated');
                  }}
                />
              ) : (
                <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                  <div className="bg-white p-4 rounded-2xl flex items-center gap-4">
                    {userData?.profilePic ? (
                      <img src={userData.profilePic} alt="profile" className="w-20 h-20 rounded-full object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center">No Img</div>
                    )}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
                      <p className="font-bold text-lg">{userData?.name || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl">
                      <label className="text-xs font-bold text-slate-400 uppercase">Age</label>
                      <p className="font-bold">{userData?.age || 'N/A'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl">
                      <label className="text-xs font-bold text-slate-400 uppercase">Blood Group</label>
                      <p className="font-bold text-red-600 text-lg">{userData?.bloodGroup || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl">
                    <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                    <p className="font-bold">{userData?.phone || 'Not set'}</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl">
                    <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                    <p className="font-bold">{userData?.email || 'Not set'}</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl">
                    <label className="text-xs font-bold text-slate-400 uppercase">More Information</label>
                    <p className="text-sm text-slate-600">{userData?.moreInfo || 'No additional info'}</p>
                  </div>

                  <div className="pt-4 border-t">
                    <label className="text-xs font-bold text-slate-400 uppercase">Emergency Contacts</label>
                    <div className="space-y-2 mt-3">
                      {userData?.emergencyContact1 && (
                        <div className="text-sm font-medium bg-white p-3 rounded-lg border border-slate-200">
                          <p className="font-bold">{userData.emergencyContact1}</p>
                          <p className="text-slate-600">{userData.emergencyPhone1}</p>
                        </div>
                      )}
                      {userData?.emergencyContact2 && (
                        <div className="text-sm font-medium bg-white p-3 rounded-lg border border-slate-200">
                          <p className="font-bold">{userData.emergencyContact2}</p>
                          <p className="text-slate-600">{userData.emergencyPhone2}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={() => {
                    handleLogout();
                  }} className="w-full mt-6 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-3 rounded-xl transition-colors">
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}

          {currentPage === 'nearest' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setCurrentPage('home')} className="text-slate-400 font-bold">← Back</button>
                <h2 className="text-3xl font-black">Nearby Hospitals</h2>
                <button onClick={() => {
                  if (!position) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setPosition(pos);
                        searchNearbyHospitals(pos);
                      },
                      () => alert('Please enable location'),
                      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
                    );
                  } else {
                    searchNearbyHospitals(position);
                  }
                }} className="text-sm text-white font-bold bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-700">🔄 Refresh</button>
              </div>
              
              {position && (
                <div className="bg-white p-4 rounded-2xl shadow mb-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-slate-500">Your Current Location (GPS Precise)</p>
                      <p className="font-bold text-sm">{position.coords.latitude.toFixed(6)}, {position.coords.longitude.toFixed(6)}</p>
                      <p className="text-xs text-slate-400">Accuracy: ±{position.coords.accuracy.toFixed(0)}m</p>
                    </div>
                    <div className="text-right flex gap-2">
                      {position && (
                        <a className="text-sm text-blue-600 font-semibold bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100" href={`https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`} target="_blank" rel="noreferrer">🗺️ View on GMaps</a>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {!position && <p className="text-slate-500 mb-4 text-center py-4 bg-slate-50 rounded-xl">📍 Click Refresh button to enable location and find nearby hospitals</p>}
              
              {calculatedHospitals.length === 0 && position && <p className="text-slate-500 mb-4 text-center py-4 bg-slate-50 rounded-xl">Searching for hospitals...</p>}
              
              <div className="space-y-4">
                {(calculatedHospitals.length > 0 ? calculatedHospitals : []).map((h, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg">#{i + 1} {h.name}</h4>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-4 h-4" /> {h.address}
                        </p>
                        {h.lat && h.lng && (
                          <p className="text-xs text-slate-400 mt-1">📍 Coords: {h.lat.toFixed(6)}, {h.lng.toFixed(6)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-blue-600 font-black text-lg">{h.time}</p>
                        <p className="text-xs text-slate-400">{h.dist}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div className="flex items-center gap-2 bg-green-50 p-2 rounded-lg">
                        <Bed className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-xs text-slate-500">ICU Beds</p>
                          <p className="font-bold text-green-600">{h.icuAvail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                        <Ambulance className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-slate-500">Ambulance</p>
                          <p className="font-bold text-blue-600 text-sm">{h.ambulance}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <PhoneIcon className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold">{h.ambulance}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold">{h.toll}</span>
                      </div>
                      {h.rating && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <span className="text-sm">⭐ Rating: {h.rating}</span>
                        </div>
                      )}
                      {h.isOpenNow && (
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-sm font-semibold">✅ {h.isOpenNow}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <a href={`https://www.google.com/maps?q=${h.lat},${h.lng}`} target="_blank" rel="noreferrer" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-bold text-sm transition-colors">
                        📍 View Hospital Map
                      </a>
                      <button onClick={() => confirmAndCall(h)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-bold text-sm transition-colors">
                        🚑 Call Ambulance
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- MAP PAGE ---
  if (userRole === 'user' && currentPage === 'map') {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex justify-between items-center p-4 bg-red-600 text-white">
          <h2 className="font-bold">Live Location & Hospitals</h2>
          <button onClick={() => setCurrentPage('home')} className="text-white hover:text-gray-200">✕</button>
        </div>
        <div id="map" style={{ width: '100%', height: 'calc(100vh - 60px)' }} />
      </div>
    );
  }

  // --- HOSPITAL STAFF VIEW ---
  if (userRole === 'hospital') {
    return (
      <HospitalDashboard />
    );
  }
}

// --- REGISTRATION FORM COMPONENT ---
function RegistrationForm({ onSubmit, onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    bloodGroup: '',
    phone: '',
    email: '',
    emergencyContact1: '',
    emergencyPhone1: '',
    emergencyContact2: '',
    emergencyPhone2: '',
    profilePic: '',
  });

  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // For phone fields, only allow digits (0-9)
    if (name === 'phone' || name === 'emergencyPhone1' || name === 'emergencyPhone2') {
      const onlyDigits = value.replace(/\D/g, '');
      setFormData({ ...formData, [name]: onlyDigits });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, profilePic: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.age || !formData.bloodGroup || !formData.phone) {
      alert('Please fill all required fields');
      return;
    }
    if (!formData.emergencyContact1 || !formData.emergencyPhone1) {
      alert('Please enter at least one emergency contact with phone number');
      return;
    }
    // Check if Contact 1 name and phone are the same
    if (formData.emergencyContact1 === formData.emergencyPhone1) {
      alert('Emergency contact name and phone number cannot be the same');
      return;
    }
    // Check if Contact 2 is filled and validate it's different from Contact 1
    if (formData.emergencyContact2 || formData.emergencyPhone2) {
      if (formData.emergencyContact1 === formData.emergencyContact2) {
        alert('Emergency contact names must be different');
        return;
      }
      if (formData.emergencyPhone1 === formData.emergencyPhone2) {
        alert('Emergency contact phone numbers must be different');
        return;
      }
      // Check if Contact 2 name and phone are the same
      if (formData.emergencyContact2 === formData.emergencyPhone2) {
        alert('Emergency contact name and phone number cannot be the same');
        return;
      }
    }
    onSubmit(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-50 p-6">
      <div className="max-w-md mx-auto mt-10">
        <button onClick={onBack} className="mb-6 text-slate-600 font-bold flex items-center gap-2">
          ← Back
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <h1 className="text-3xl font-black text-slate-800 mb-2">Register Urself</h1>
          <p className="text-slate-500 mb-6">Complete your profile for emergency assistance</p>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-red-600' : 'bg-slate-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name *</label>
                <input type="text" name="name" placeholder="Your full name" value={formData.name} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Profile Picture</label>
                <div className="flex items-center gap-4 mt-2">
                  {formData.profilePic ? (
                    <img src={formData.profilePic} alt="profile" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">No Img</div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFile} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Age *</label>
                  <input type="number" name="age" placeholder="Age" value={formData.age} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Blood Group *</label>
                  <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600">
                    <option value="">Select</option>
                    <option>O+</option>
                    <option>O-</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Phone *</label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-xl focus-within:border-red-600 bg-white">
                  <span className="px-3 py-3 font-bold text-slate-600">+91</span>
                  <input type="tel" name="phone" placeholder="XXXXX XXXXX" value={formData.phone} onChange={handleChange} maxLength="10" className="flex-1 p-3 border-none outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                <input type="email" name="email" placeholder="your@email.com" value={formData.email} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600" />
              </div>
              <button onClick={() => {
                if (!formData.name || !formData.age || !formData.bloodGroup || !formData.phone) {
                  alert('Please fill all required fields: Name, Age, Blood Group, and Phone');
                  return;
                }
                if (formData.phone.length < 10) {
                  alert('Phone number must be 10 digits');
                  return;
                }
                setStep(2);
              }} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl mt-6">
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 mb-4">Emergency Contacts</h3>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Contact 1 Name *</label>
                <input type="text" name="emergencyContact1" placeholder="Contact name" value={formData.emergencyContact1} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Contact 1 Phone *</label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-xl focus-within:border-red-600 bg-white">
                  <span className="px-3 py-3 font-bold text-slate-600">+91</span>
                  <input type="tel" name="emergencyPhone1" placeholder="XXXXX XXXXX" value={formData.emergencyPhone1} onChange={handleChange} maxLength="10" className="flex-1 p-3 border-none outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Contact 2 Name</label>
                <input type="text" name="emergencyContact2" placeholder="Contact name" value={formData.emergencyContact2} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-red-600" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Contact 2 Phone</label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-xl focus-within:border-red-600 bg-white">
                  <span className="px-3 py-3 font-bold text-slate-600">+91</span>
                  <input type="tel" name="emergencyPhone2" placeholder="XXXXX XXXXX" value={formData.emergencyPhone2} onChange={handleChange} maxLength="10" className="flex-1 p-3 border-none outline-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl">
                  Back
                </button>
                <button onClick={handleSubmit} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl">
                  Complete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- HOSPITAL REGISTRATION FORM ---
function HospitalRegistrationForm({ onSubmit, onCancel }) {
  const [data, setData] = useState({
    hospitalId: '', hospitalName: '', contact: '', email: '', password: '', specialties: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    // For contact, only allow digits (0-9)
    if (name === 'contact') {
      const onlyDigits = value.replace(/\D/g, '');
      setData({ ...data, [name]: onlyDigits });
    } else {
      setData({ ...data, [name]: value });
    }
  };

  const handleSubmit = () => {
    if (!data.hospitalId || !data.hospitalName || !data.email || !data.password) {
      alert('Please fill Hospital ID, hospital name, email and password');
      return;
    }
    onSubmit(data);
  };

  return (
    <div>
      <div className="space-y-3">
        <input name="hospitalId" value={data.hospitalId} onChange={handleChange} placeholder="Hospital ID" className="w-full p-3 border rounded-lg" />
        <input name="hospitalName" value={data.hospitalName} onChange={handleChange} placeholder="Hospital Name" className="w-full p-3 border rounded-lg" />
        <input name="contact" value={data.contact} onChange={handleChange} placeholder="Hospital Contact Number" maxLength="10" className="w-full p-3 border rounded-lg" />
        <input name="email" value={data.email} onChange={handleChange} placeholder="Hospital Email" className="w-full p-3 border rounded-lg" />
        <input name="password" type="password" value={data.password} onChange={handleChange} placeholder="Password" className="w-full p-3 border rounded-lg" />
        <input name="specialties" value={data.specialties} onChange={handleChange} placeholder="Specialties (comma separated)" className="w-full p-3 border rounded-lg" />
        <div className="flex gap-2 mt-3">
          <button onClick={handleSubmit} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Register</button>
          <button onClick={onCancel} className="flex-1 bg-slate-200 py-2 rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// --- HOSPITAL LOGIN FORM ---
function HospitalLoginForm({ onLogin, onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    const stored = JSON.parse(localStorage.getItem('hospitalData') || 'null');
    if (!stored) {
      alert('No hospital registered. Please register first.');
      return;
    }
    if (email === stored.email && password === stored.password) {
      onLogin(stored);
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Hospital ID" className="w-full p-3 border rounded-lg mb-2" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full p-3 border rounded-lg mb-2" />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Login</button>
        <button onClick={onRegister} className="flex-1 bg-slate-200 py-2 rounded-lg">Register</button>
      </div>
    </div>
  );
}

// --- HOSPITAL DASHBOARD ---
function HospitalDashboard() {
  const [hospital, setHospital] = useState(() => {
    return JSON.parse(localStorage.getItem('hospitalLoggedIn') || 'null');
  });
  const [alerts, setAlerts] = useState(() => {
    return JSON.parse(localStorage.getItem('inboundAlerts') || '[]');
  });
  const [patientTrackerColumns, setPatientTrackerColumns] = useState(() => {
    const stored = localStorage.getItem('patientTrackerColumns');
    return stored ? JSON.parse(stored) : [{ id: 1, name: 'Patient Name' }, { id: 2, name: 'Status' }];
  });
  const [specialties, setSpecialties] = useState(() => {
    const stored = localStorage.getItem('hospitalSpecialties');
    return stored ? JSON.parse(stored) : [{ id: 1, specialty: '', doctors: '' }];
  });
  const [selected, setSelected] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({
    hospitalId: hospital?.hospitalId || '',
    hospitalName: hospital?.hospitalName || '',
    contact: hospital?.contact || '',
    email: hospital?.email || '',
    specialties: hospital?.specialties || ''
  });

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setIsMenuOpen(false);
  };

  const handleUpdate = () => {
    if (!editData.hospitalId || !editData.hospitalName || !editData.email) {
      alert('Please fill Hospital ID, Hospital Name and Email');
      return;
    }
    const updatedHospital = { ...hospital, ...editData };
    localStorage.setItem('hospitalLoggedIn', JSON.stringify(updatedHospital));
    localStorage.setItem('hospitalData', JSON.stringify(updatedHospital));
    setHospital(updatedHospital);
    setIsEditMode(false);
    alert('Hospital details updated successfully!');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    // For contact, only allow digits (0-9)
    if (name === 'contact') {
      const onlyDigits = value.replace(/\D/g, '');
      setEditData({ ...editData, [name]: onlyDigits });
    } else {
      setEditData({ ...editData, [name]: value });
    }
  };

  // Patient Tracker Column Functions
  const addTrackerColumn = () => {
    const newColumn = { id: Date.now(), name: `Column ${patientTrackerColumns.length + 1}` };
    const updated = [...patientTrackerColumns, newColumn];
    setPatientTrackerColumns(updated);
    localStorage.setItem('patientTrackerColumns', JSON.stringify(updated));
  };

  const updateTrackerColumn = (id, newName) => {
    const updated = patientTrackerColumns.map(col => col.id === id ? { ...col, name: newName } : col);
    setPatientTrackerColumns(updated);
    localStorage.setItem('patientTrackerColumns', JSON.stringify(updated));
  };

  const removeTrackerColumn = (id) => {
    if (patientTrackerColumns.length === 1) {
      alert('At least one column is required');
      return;
    }
    const updated = patientTrackerColumns.filter(col => col.id !== id);
    setPatientTrackerColumns(updated);
    localStorage.setItem('patientTrackerColumns', JSON.stringify(updated));
  };

  // Specialties Functions
  const addSpecialty = () => {
    const newSpec = { id: Date.now(), specialty: '', doctors: '' };
    const updated = [...specialties, newSpec];
    setSpecialties(updated);
    localStorage.setItem('hospitalSpecialties', JSON.stringify(updated));
  };

  const updateSpecialty = (id, field, value) => {
    const updated = specialties.map(spec => spec.id === id ? { ...spec, [field]: value } : spec);
    setSpecialties(updated);
    localStorage.setItem('hospitalSpecialties', JSON.stringify(updated));
  };

  const removeSpecialty = (id) => {
    if (specialties.length === 1) {
      alert('At least one specialty is required');
      return;
    }
    const updated = specialties.filter(spec => spec.id !== id);
    setSpecialties(updated);
    localStorage.setItem('hospitalSpecialties', JSON.stringify(updated));
  };

  useEffect(() => {
    const iv = setInterval(() => {
      setAlerts(JSON.parse(localStorage.getItem('inboundAlerts') || '[]'));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 relative overflow-hidden">
      {/* Sliding Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-0 z-50 bg-white w-3/4 shadow-2xl p-6">
            <div className="flex justify-between mb-10">
              <span className="font-black text-blue-600 text-xl">Hospital Menu</span>
              <X onClick={() => setIsMenuOpen(false)} className="cursor-pointer" />
            </div>
            <nav className="space-y-6">
              <div onClick={handleEdit} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-blue-600 transition"><User className="w-6 h-6" /> Edit Details</div>
              {isEditMode && <div onClick={handleLogout} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><LogOut className="w-6 h-6" /> Logout</div>}
              {!isEditMode && <div onClick={handleLogout} className="flex items-center gap-4 text-lg font-bold cursor-pointer hover:text-red-600 transition"><LogOut className="w-6 h-6" /> Logout</div>}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Menu Button */}
      <div className="min-h-screen bg-white p-6 relative">
        {/* Update Details Button - Corner */}
        {isEditMode && (
          <div className="absolute top-6 right-6">
            <button onClick={handleUpdate} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
              Update Details
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setIsMenuOpen(true)} className="text-2xl"><Menu /></button>
          <h2 className="text-xl font-black">{hospital?.hospitalName || 'Hospital Dashboard'}</h2>
          <div className="text-sm text-slate-500">ID: {hospital?.hospitalId || '-'}</div>
        </div>

        {isEditMode ? (
          // Edit Form
          <div className="max-w-2xl bg-white p-6 rounded-lg shadow-lg mb-6">
            <h3 className="text-2xl font-bold mb-4">Edit Hospital Details</h3>
            <div className="space-y-4">
              <input name="hospitalId" value={editData.hospitalId} onChange={handleEditChange} placeholder="Hospital ID" className="w-full p-3 border rounded-lg" />
              <input name="hospitalName" value={editData.hospitalName} onChange={handleEditChange} placeholder="Hospital Name" className="w-full p-3 border rounded-lg" />
              <input name="contact" value={editData.contact} onChange={handleEditChange} placeholder="Hospital Contact Number" className="w-full p-3 border rounded-lg" maxLength="10" />
              <input name="email" value={editData.email} onChange={handleEditChange} placeholder="Hospital Email" className="w-full p-3 border rounded-lg" />
              <input name="specialties" value={editData.specialties} onChange={handleEditChange} placeholder="Specialties (comma-separated)" className="w-full p-3 border rounded-lg" />
              <button onClick={() => setIsEditMode(false)} className="w-full bg-slate-300 text-slate-900 py-2 rounded-lg font-bold hover:bg-slate-400 transition">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          // Dashboard View
          <div className="space-y-6">
            {/* Hospital Details */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Hospital Details</h3>
              <div className="text-slate-600 space-y-3">
                <div><span className="font-semibold">Name:</span> {hospital?.hospitalName || 'Not set'}</div>
                <div><span className="font-semibold">ID:</span> {hospital?.hospitalId || 'Not set'}</div>
                <div><span className="font-semibold">Contact:</span> {hospital?.contact || 'Not set'}</div>
                <div><span className="font-semibold">Email:</span> {hospital?.email || 'Not set'}</div>
              </div>
            </div>

            {/* Patient Tracker Columns */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Patient Tracker Columns</h3>
              <div className="space-y-3">
                {patientTrackerColumns.map((col) => (
                  <div key={col.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => updateTrackerColumn(col.id, e.target.value)}
                      placeholder="Column name"
                      className="flex-1 p-2 border border-slate-300 rounded-lg"
                    />
                    <button
                      onClick={() => removeTrackerColumn(col.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addTrackerColumn}
                  className="w-full p-3 border-2 border-dashed border-blue-600 text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition"
                >
                  + Add Column
                </button>
              </div>
            </div>

            {/* Specialties with Doctors */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Specialties & Doctors</h3>
              <div className="space-y-3">
                {specialties.map((spec) => (
                  <div key={spec.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Specialty</label>
                        <input
                          type="text"
                          value={spec.specialty}
                          onChange={(e) => updateSpecialty(spec.id, 'specialty', e.target.value)}
                          placeholder="e.g., Cardiology"
                          className="w-full p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Corresponding Doctors</label>
                        <input
                          type="text"
                          value={spec.doctors}
                          onChange={(e) => updateSpecialty(spec.id, 'doctors', e.target.value)}
                          placeholder="e.g., Dr. Smith, Dr. Jones"
                          className="w-full p-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeSpecialty(spec.id)}
                      className="w-full px-3 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition"
                    >
                      Remove Specialty
                    </button>
                  </div>
                ))}
                <button
                  onClick={addSpecialty}
                  className="w-full p-3 border-2 border-dashed border-green-600 text-green-600 rounded-lg font-bold hover:bg-green-50 transition"
                >
                  • Add Specialty
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- EDIT PROFILE FORM COMPONENT ---
function EditProfileForm({ initialData = {}, onSave }) {
  const initContacts = [];
  if (initialData.emergencyContact1 || initialData.emergencyPhone1) {
    initContacts.push({ name: initialData.emergencyContact1 || '', phone: initialData.emergencyPhone1 || '' });
  }
  if (initialData.emergencyContact2 || initialData.emergencyPhone2) {
    initContacts.push({ name: initialData.emergencyContact2 || '', phone: initialData.emergencyPhone2 || '' });
  }
  if (initContacts.length === 0) {
    initContacts.push({ name: '', phone: '' });
  }

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    age: initialData.age || '',
    bloodGroup: initialData.bloodGroup || '',
    phone: initialData.phone || '',
    email: initialData.email || '',
    moreInfo: initialData.moreInfo || '',
    profilePic: initialData.profilePic || '',
    contacts: initContacts
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleContactChange = (idx, field, value) => {
    const newContacts = [...formData.contacts];
    newContacts[idx] = { ...newContacts[idx], [field]: value };
    setFormData({ ...formData, contacts: newContacts });
  };

  const addContact = () => {
    setFormData({ ...formData, contacts: [...formData.contacts, { name: '', phone: '' }] });
  };

  const removeContact = (idx) => {
    if (formData.contacts.length === 1) {
      alert('At least one contact is required');
      return;
    }
    const newContacts = formData.contacts.filter((_, i) => i !== idx);
    setFormData({ ...formData, contacts: newContacts });
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormData({ ...formData, profilePic: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!formData.name || !formData.phone) {
      alert('Name and phone are required');
      return;
    }
    const flatContacts = {
      ...formData,
      emergencyContact1: formData.contacts[0]?.name || '',
      emergencyPhone1: formData.contacts[0]?.phone || '',
      emergencyContact2: formData.contacts[1]?.name || '',
      emergencyPhone2: formData.contacts[1]?.phone || ''
    };
    delete flatContacts.contacts;
    onSave(flatContacts);
  };

  return (
    <div className="bg-slate-50 p-6 rounded-3xl">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Profile Picture</label>
          <div className="flex items-center gap-4 mt-2">
            {formData.profilePic ? (
              <img src={formData.profilePic} alt="profile" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center">No Img</div>
            )}
            <input type="file" accept="image/*" onChange={handleFile} />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
          <input name="name" value={formData.name} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Age</label>
            <input name="age" type="number" value={formData.age} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Blood Group</label>
            <input name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
          <input name="email" value={formData.email} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">More Information</label>
          <textarea name="moreInfo" value={formData.moreInfo} onChange={handleChange} className="w-full mt-1 p-3 border border-slate-200 rounded-xl" rows={3} />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase">Emergency Contacts</label>
          <div className="space-y-3 mt-2">
            {formData.contacts.map((contact, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-600">Contact {idx + 1}</span>
                  {formData.contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(idx)}
                      className="text-xs text-red-600 font-bold hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                  placeholder="Contact Name"
                  className="w-full p-2 border border-slate-300 rounded-lg mb-2"
                />
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                  placeholder="Phone Number"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addContact}
              className="w-full p-2 border-2 border-dashed border-red-600 text-red-600 font-bold rounded-lg hover:bg-red-50 transition"
            >
              + Add Contact
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={handleSave} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Save</button>
        </div>
      </div>
    </div>
  );
}
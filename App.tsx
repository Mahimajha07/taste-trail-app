import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TasteForm } from './components/TasteForm';
import { RestaurantCard } from './components/RestaurantCard';
import { TasteGame } from './components/TasteGame';
import { MapView } from './components/MapView';
import { Login } from './components/Login';
import { ChefGully } from './components/ChefGully';
import { HealthBot } from './components/HealthBot';
import { TutorialOverlay } from './components/TutorialOverlay';
import { FoodieRules } from './components/FoodieRules';
import { findRestaurants, analyzeTastePersonality, generateSpeech, getCityName } from './services/geminiService';
import { Restaurant, TasteProfile, PalateProfile, Booking, User } from './types';

const WELLNESS_LOADING = [
  "Calculating nutritional DNA...",
  "Scouting keto-friendly spots...",
  "Chef Gully is auditing menus...",
  "Matching your health goals..."
];

const FLAVOR_LOADING = [
  "Scouting secret spices...",
  "Hunting for the perfect crunch...",
  "Gully is checking the vibe...",
  "Matching your flavor profile...",
  "Finding top-rated regional gems..."
];

const SearchLoading: React.FC<{ isHealthyMode?: boolean }> = ({ isHealthyMode }) => {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = isHealthyMode ? WELLNESS_LOADING : FLAVOR_LOADING;

  useEffect(() => {
    const interval = setInterval(() => setMsgIndex((prev) => (prev + 1) % messages.length), 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in zoom-in duration-500 min-h-[60vh]">
      <div className="relative mb-10">
        <div className={`absolute inset-0 scale-[2.5] rounded-full animate-ping ${isHealthyMode ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}></div>
        <div className={`relative w-28 h-28 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border-4 flex items-center justify-center ${isHealthyMode ? 'border-emerald-600' : 'border-rose-600'}`}> 
          <span className={`google-symbols text-5xl animate-spin ${isHealthyMode ? 'text-emerald-600' : 'text-rose-600'}`}> 
            {isHealthyMode ? 'health_and_safety' : 'restaurant'}
          </span>
        </div>
      </div>
      <h2 className="text-xl font-serif font-black dark:text-white mb-2">
        {isHealthyMode ? 'Analyzing Wellness Profile' : 'Scouting Perfect Flavors'}
      </h2>
      <p className={`font-black text-[10px] uppercase tracking-[0.2em] animate-pulse ${isHealthyMode ? 'text-emerald-600' : 'text-rose-600'}`}> 
        {messages[msgIndex]}
      </p>
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeProfile, setActiveProfile] = useState<TasteProfile | null>(null);
  const [showGame, setShowGame] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [palate, setPalate] = useState<PalateProfile | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'bookings'>('list');
  const [selectedRestaurantIndex, setSelectedRestaurantIndex] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [deliveryOnlyFilter, setDeliveryOnlyFilter] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('tastetrail_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
      const storedPalate = localStorage.getItem('tastetrail_palate');
      if (!storedPalate) setShowRules(true);
      else {
        setPalate(JSON.parse(storedPalate));
        if (!localStorage.getItem('tastetrail_tour')) setShowGuidedTour(true);
      }
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        try { const city = await getCityName(coords.lat, coords.lng); setCityName(city); } catch (e) {}
      });
    }
  }, []);

  const handleSearch = async (profile: TasteProfile, photoBase64?: string) => {
    if (!currentUser) return;
    setIsLoading(true);
    setHasSearched(true);
    setActiveProfile(profile);
    setRestaurants([]);
    setViewMode('list');
    setDeliveryOnlyFilter(profile.onlineOrderingOnly || false);
    
    try {
      const result = await findRestaurants(profile, palate, location, photoBase64, currentUser);
      setRestaurants(result.restaurants);
      if (result.restaurants.length > 0) {
        const msg = profile.isHealthyScout 
          ? `Success! I found ${result.restaurants.length} wellness-focused spots for you.`
          : `Ooh ooh! I found ${result.restaurants.length} delicious spots matching your vibe!`;
        generateSpeech(msg);
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleVoiceSearch = (query: string) => {
    const isDeliveryRequest = query.toLowerCase().includes('order') || query.toLowerCase().includes('delivery') || query.toLowerCase().includes('online');
    
    // Fix: Capitalized "Adult" and added missing mandatory "comfortPreference" property to match TasteProfile interface.
    const voiceProfile: TasteProfile = {
      dietaryPreferences: [],
      favoriteFlavors: [],
      preferredTextures: [],
      preferredCuisines: [],
      features: [],
      atmosphere: "Lively",
      diningTheme: "Casual",
      budget: "₹₹",
      customNotes: query,
      occasion: "Solo",
      maxDistance: "5km",
      ageGroup: "Adult",
      comfortPreference: "Casual",
      healthGoal: 'Balanced',
      spiceTolerance: 'Medium',
      isHealthyScout: false,
      onlineOrderingOnly: isDeliveryRequest
    };
    handleSearch(voiceProfile);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('tastetrail_user', JSON.stringify(user));
    setShowRules(true);
  };

  const handleBack = () => {
    if (hasSearched) { setHasSearched(false); setViewMode('list'); }
    else if (showGame) { setShowGame(false); setShowTutorial(true); }
    else if (showTutorial) { setShowTutorial(false); setShowRules(true); }
    else if (showRules) { setShowRules(false); setCurrentUser(null); localStorage.removeItem('tastetrail_user'); }
    else setShowGame(true);
  };

  const finishGame = async (results: { likes: string[], dislikes: string[] }) => {
    setShowGame(false);
    const profile = await analyzeTastePersonality(results.likes, results.dislikes);
    setPalate(profile);
    localStorage.setItem('tastetrail_palate', JSON.stringify(profile));
    if (!localStorage.getItem('tastetrail_tour')) setShowGuidedTour(true);
  };

  const filteredRestaurants = deliveryOnlyFilter 
    ? restaurants.filter(r => r.swiggyUrl || r.zomatoUrl || r.orderUrl || r.eatsureUrl || r.magicpinUrl)
    : restaurants;

  if (!currentUser) return <Login onLogin={handleLogin} />;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-gray-950 text-white' : 'bg-rose-50'}`} style={{ paddingBottom: '7.5rem' }}>
      <ChefGully context={hasSearched ? 'results' : (isLoading ? 'analyzing' : 'form')} userName={currentUser.name} onVoiceSearch={handleVoiceSearch} />
      <HealthBot />
      {showGuidedTour && <TutorialOverlay onComplete={() => { setShowGuidedTour(false); localStorage.setItem('tastetrail_tour', 'true'); }} />}

      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {(showRules || showTutorial || showGame || hasSearched || palate !== null) && (
            <button onClick={handleBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-50 dark:bg-gray-800 text-rose-600 dark:text-rose-400 active:scale-90 transition-transform">
              <span className="google-symbols text-xl">arrow_back</span>
            </button>
          )}
          <h1 className="font-serif font-black text-xl text-red-700 dark:text-red-500">TasteTrail</h1>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center active:scale-90 transition-all">
             <span className="google-symbols text-xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
           </button>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-4">
        {showRules ? <FoodieRules userName={currentUser.name} onAccept={() => { setShowRules(false); setShowTutorial(true); }} /> : 
         showTutorial ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in slide-in-from-bottom-10">
            <div className="relative w-28 h-28 mx-auto"><div className="absolute inset-0 bg-rose-500 rounded-full blur-2xl opacity-20"></div><div className="relative bg-white dark:bg-gray-800 w-full h-full rounded-full flex items-center justify-center border-4 border-rose-600 shadow-2xl text-5xl">🍌</div></div>
            <div><h2 className="text-3xl font-serif font-black text-rose-700 dark:text-red-500">Hey, {currentUser.name.split(' ')[0]}!</h2><p className="text-sm font-bold text-gray-500 max-w-[240px] mx-auto mt-2">Let's find meals that love you back.</p></div>
            <button onClick={() => { setShowTutorial(false); setShowGame(true); }} className="bg-rose-600 text-white px-12 py-5 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all">Start Swipe Game</button>
          </div>
        ) : showGame ? (
          <TasteGame onComplete={finishGame} />
        ) : isLoading ? <SearchLoading isHealthyMode={activeProfile?.isHealthyScout} /> : !hasSearched ? <TasteForm onSearch={handleSearch} isLoading={isLoading} /> : (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-[2.5rem] shadow-sm border border-rose-100 dark:border-gray-800">
               <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-black uppercase dark:text-white">
                      {activeProfile?.isHealthyScout ? 'Top Wellness Spots' : 'Top Flavor Matches'}
                    </h2>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${activeProfile?.isHealthyScout ? 'text-emerald-600' : 'text-rose-600'}`}> 
                      {filteredRestaurants.length} {activeProfile?.isHealthyScout ? 'Nutritional Matches' : 'Soul Food Found'}
                    </p>
                  </div>
                  <button onClick={handleBack} className="bg-rose-50 dark:bg-gray-800 px-4 py-2 rounded-xl text-[9px] font-black text-rose-600 uppercase active:scale-95">Refine</button>
               </div>
               
               <div className="flex gap-2 border-t pt-4 dark:border-gray-800">
                  <button 
                    onClick={() => setDeliveryOnlyFilter(!deliveryOnlyFilter)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all border-2 ${deliveryOnlyFilter ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500'}`}
                  >
                    <span className="google-symbols text-sm">moped</span>
                    Online Delivery
                  </button>
                  {activeProfile?.isHealthyScout && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-full text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2">
                       <span className="google-symbols text-sm">health_and_safety</span>
                       Health Mode Active
                    </div>
                  )}
               </div>
            </div>

            {viewMode === 'map' ? <MapView restaurants={filteredRestaurants} userLocation={location} onSelectRestaurant={setSelectedRestaurantIndex} selectedId={selectedRestaurantIndex} /> : 
              <div className="grid grid-cols-1 gap-8">
                {filteredRestaurants.length === 0 ? (
                  <div className="py-20 text-center opacity-40">
                    <span className="google-symbols text-6xl mb-4">no_food</span>
                    <p className="text-[10px] font-black uppercase tracking-widest">No spots match the filter.</p>
                  </div>
                ) : (
                  filteredRestaurants.map((r, i) => (
                    <RestaurantCard 
                      key={i} 
                      restaurant={r} 
                      isHighlighted={selectedRestaurantIndex === i} 
                      onBook={(b) => setBookings([b, ...bookings])}
                      showNutritionalInfo={activeProfile?.isHealthyScout}
                    />
                  ))
                )}
              </div>
            }
          </div>
        )}
      </main>

      {/* Persistent Bottom Nav */}
      {!showRules && !showTutorial && !showGame && (
        <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 dark:bg-gray-900/95 border-t border-rose-100 dark:border-gray-800 px-6 pt-3 pb-safe flex justify-between items-center backdrop-blur-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <button onClick={() => setViewMode('list')} className={`flex flex-col items-center gap-1 transition-all ${viewMode === 'list' ? 'text-rose-600' : 'text-gray-400'}`}> 
            <span className="google-symbols text-3xl font-variation-fill">list_alt</span><span className="text-[9px] font-black uppercase tracking-tighter">Matches</span>
          </button>
          <button onClick={() => setViewMode('map')} className={`flex flex-col items-center gap-1 transition-all ${viewMode === 'map' ? 'text-rose-600' : 'text-gray-400'}`}> 
            <span className="google-symbols text-3xl font-variation-fill">explore</span><span className="text-[9px] font-black uppercase tracking-tighter">Explore Map</span>
          </button>
          <button onClick={() => setViewMode('bookings')} className={`flex flex-col items-center gap-1 transition-all relative ${viewMode === 'bookings' ? 'text-rose-600' : 'text-gray-400'}`}> 
            <span className="google-symbols text-3xl font-variation-fill">book_online</span>{bookings.length > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-white flex items-center justify-center text-[7px] text-white font-bold">{bookings.length}</span>}
            <span className="text-[9px] font-black uppercase tracking-tighter">Booked</span>
          </button>
        </nav>
      )}

      {/* Bookings View */}
      {viewMode === 'bookings' && (
        <div className="fixed inset-0 z-[150] bg-rose-50 dark:bg-gray-950 p-6 pt-safe overflow-y-auto animate-in slide-in-from-bottom-20 duration-500"> 
           <div className="max-w-md mx-auto space-y-6">
              <div className="flex justify-between items-center py-4"><h2 className="text-2xl font-serif font-black dark:text-white">Reservations</h2><button onClick={() => setViewMode('list')} className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-all"><span className="google-symbols">close</span></button></div>
              {bookings.length === 0 ? <div className="flex flex-col items-center justify-center py-20 opacity-40"><span className="google-symbols text-6xl mb-4">event_busy</span><p className="text-[10px] font-black uppercase tracking-widest">No plans yet.</p></div> : 
                <div className="space-y-4">{bookings.map(b => (
                  <div key={b.id} className="bg-white dark:bg-gray-900 p-5 rounded-[2rem] shadow-sm border border-rose-100 dark:border-gray-800 flex justify-between items-center animate-in slide-in-from-left-4">
                    <div><h4 className="font-bold dark:text-white text-base">{b.restaurantName}</h4><div className="flex gap-2 mt-1"><span className="text-[9px] font-black text-rose-600 uppercase bg-rose-50 dark:bg-red-900/10 px-2 py-0.5 rounded-lg">{b.date}</span><span className="text-[9px] font-black text-gray-500 uppercase">{b.time} • {b.guests}p</span></div></div>
                    <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase shadow-lg shadow-emerald-200/50">Confirmed</div>
                  </div>
                ))}</div>
              }
           </div>
        </div>
      )}
    </div>
  );
};
export default App;
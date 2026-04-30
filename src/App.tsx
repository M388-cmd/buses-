import React, { useState, useEffect } from 'react';
import { Bus, RefreshCcw, Search, AlertCircle, WifiOff, Heart, Trash2, ChevronRight, Route, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { BusArrival, BusLine, BusStop, StopConnection } from './types';

type Tab = 'paradas' | 'favoritos' | 'lineas';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('paradas');
  const [stopCode, setStopCode] = useState<string>('2775');
  const [activeStopCode, setActiveStopCode] = useState<string>('2775');
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [connections, setConnections] = useState<StopConnection[]>([]);
  
  const [lines, setLines] = useState<BusLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<BusLine | null>(null);
  const [lineStops, setLineStops] = useState<{ idaar: BusStop[], vuelta: BusStop[] } | null>(null);
  const [isLoadingLines, setIsLoadingLines] = useState<boolean>(false);
  const [isLoadingStops, setIsLoadingStops] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingStops, setIsSearchingStops] = useState(false);
  const searchTimeout = React.useRef<number | undefined>();
  
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tmb_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('tmb_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (code: string) => {
    setFavorites(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchLines = async () => {
    if (isOffline) return;
    setIsLoadingLines(true);
    try {
      const response = await fetch('/api/bus/lines');
      if (!response.ok) throw new Error('Error al obtener líneas');
      const data = await response.json();
      setLines(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingLines(false);
    }
  };

  const fetchLineStops = async (line: BusLine) => {
    if (isOffline) return;
    setSelectedLine(line);
    setIsLoadingStops(true);
    setLineStops(null);
    try {
      const response = await fetch(`/api/bus/lines/${line.CODI_LINIA}/stops`);
      if (!response.ok) throw new Error('Error al obtener paradas');
      const data: BusStop[] = await response.json();
      
      const idaar = data.filter(s => s.SENTIT === 'A').sort((a, b) => a.ORDRE - b.ORDRE);
      const vuelta = data.filter(s => s.SENTIT === 'T').sort((a, b) => a.ORDRE - b.ORDRE);
      
      setLineStops({ idaar, vuelta });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingStops(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'lineas' && lines.length === 0) {
      fetchLines();
    }
  }, [activeTab]);

  const fetchArrivals = async (code: string) => {
    if (!code.trim() || isOffline) return;

    setActiveStopCode(code);
    setIsLoading(true);
    setError(null);
    setConnections([]);
    
    try {
      const [response, infoResponse] = await Promise.all([
        fetch(`/api/bus/parada/${code}`),
        fetch(`/api/bus/parada/${code}/info`)
      ]);
      const data = await response.json();
      
      let infoData = { connections: [] };
      if (infoResponse.ok) {
        try {
          infoData = await infoResponse.json();
        } catch (e) {}
      }
      setConnections(infoData.connections || []);

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener los datos');
      }

      setArrivals(data);
    } catch (err: any) {
      setError(err.message || 'Error de red o de servidor');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (!isOffline) {
      fetchArrivals('2775');
    }
  }, [isOffline]);

  const handleStopCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStopCode(value);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    // If empty, don't search API just clear
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearchingStops(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/bus/stops/search?q=${encodeURIComponent(value)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearchingStops(false);
      }
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArrivals(stopCode);
  };

  return (
    <div className="w-full max-w-[375px] mx-auto min-h-[100dvh] bg-[#F4F4F7] flex flex-col shadow-2xl overflow-hidden relative">
      <header className="bg-[#E21918] text-white pt-5 pb-4 px-5 border-b-[4px] border-black/10 flex items-center justify-between z-10 font-sans">
        <h1 className="text-[18px] font-bold tracking-tight m-0 leading-none">Miguel y Han Wu Bus Times</h1>
      </header>

      <div className="bg-white p-4 border-b border-[#DDD] z-10">
        {activeTab === 'paradas' ? (
          <div className="relative">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={stopCode}
                onChange={handleStopCodeChange}
                placeholder="Codi o nombre parada..."
                className="flex-1 w-full border-2 border-[#EEE] rounded-[8px] py-2.5 px-3 text-[16px] font-semibold bg-[#F9F9F9] focus:outline-none focus:border-[#CCC] focus:ring-0 text-[#1A1A1A] placeholder-[#999]"
              />
              <button 
                type="submit"
                disabled={isLoading || isOffline}
                className="bg-[#E21918] text-white border-none rounded-[8px] px-3 font-bold text-[14px] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed hover:bg-[#D32F2F] transition-colors flex items-center justify-center min-w-[100px]"
              >
                {isLoading || isSearchingStops ? <RefreshCcw size={16} className="animate-spin" /> : 'BUSCAR'}
              </button>
            </form>
            
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-xl border border-gray-200 rounded-lg max-h-60 overflow-y-auto z-50">
                {searchResults.map((stop) => (
                  <div
                    key={stop.CODI_PARADA}
                    onClick={() => {
                      setStopCode(stop.CODI_PARADA.toString());
                      setSearchResults([]);
                      fetchArrivals(stop.CODI_PARADA.toString());
                    }}
                    className="p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer text-left flex flex-col"
                  >
                    <div className="font-bold text-[14px] text-gray-800">{stop.NOM_PARADA}</div>
                    <div className="text-[12px] text-gray-500">Codi: {stop.CODI_PARADA}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'lineas' ? (
           <div className="text-[16px] font-bold text-[#1A1A1A] py-1 text-center">Líneas de Autobús</div>
        ) : (
          <div className="text-[16px] font-bold text-[#1A1A1A] py-1 text-center">Mis Paradas Favoritas</div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
        {activeTab === 'paradas' ? (
          <>
            {/* Stop Info Header */}
            {!isLoading && !error && !isOffline && (
              <div className="p-3 px-4 bg-[#FFF9F9] border border-[#FEE] rounded-[12px] flex items-center justify-between z-10 mx-2 mt-2">
                <div className="flex items-center gap-3">
                  <div className="bg-[#E21918] text-white w-8 h-8 rounded flex items-center justify-center text-[14px] font-bold shadow-sm">P</div>
                  <div>
                    <div className="text-[14px] font-bold text-[#1A1A1A] leading-tight">Parada {activeStopCode}</div>
                    <div className="text-[11px] text-[#888] leading-tight mt-0.5">Codi: {activeStopCode} &bull; Barcelona</div>
                  </div>
                </div>
                <button 
                  onClick={() => toggleFavorite(activeStopCode)}
                  className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-all border border-gray-100"
                >
                  <Heart 
                    size={22} 
                    className={favorites.includes(activeStopCode) ? 'text-[#E21918] fill-[#E21918]' : 'text-gray-300'} 
                  />
                </button>
              </div>
            )}
            
            {!isLoading && !error && !isOffline && connections.length > 0 && (
              <div className="mx-2 mt-1 px-1">
                <div className="text-[12px] font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                  <Route size={12} />
                  Otras líneas en esta parada (Conexiones):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {connections.map((conn, idx) => (
                     <div key={`${conn.line}-${idx}`} className="text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: `#${conn.color || 'E21918'}` }}>
                       {conn.line}
                     </div>
                  ))}
                </div>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              {isOffline ? (
                <motion.div 
                  key="offline"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-500 mt-10"
                >
                  <WifiOff size={48} className="mb-4 text-gray-300" />
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">Sin Conexión</h2>
                  <p className="text-[14px]">Revisa tu conexión a internet e inténtalo de nuevo.</p>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center flex-1 text-center p-6 text-red-500 mt-10"
                >
                  <AlertCircle size={48} className="mb-4 text-red-300" />
                  <h2 className="text-xl font-semibold text-red-600 mb-2">Error de Parada</h2>
                  <p className="text-red-500 text-[14px]">{error}</p>
                </motion.div>
              ) : isLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3 font-sans mt-2 px-2"
                >
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex items-center h-[76px] animate-pulse">
                       <div className="w-10 h-8 bg-gray-200 rounded flex-shrink-0" />
                       <div className="flex-1 space-y-2 ml-3">
                         <div className="h-3 bg-gray-200 rounded w-1/3" />
                         <div className="h-2 bg-gray-200 rounded w-1/2" />
                       </div>
                       <div className="w-10 h-10 rounded bg-gray-200 ml-4 flex-shrink-0" />
                    </div>
                  ))}
                </motion.div>
              ) : arrivals.length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-500 mt-10"
                >
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                     <Bus size={32} className="text-gray-400" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-700 mb-2">Sin Próximas Llegadas</h2>
                  <p className="text-[14px]">No se encontraron autobuses cercanos para la parada {activeStopCode}.</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2 mt-3 pb-6 flex flex-col"
                >
                  <div className="bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
                    <div className="bg-[#FFF5CD] text-[#7A6B3D] text-[12px] font-medium p-3 flex items-start justify-between">
                      <span>CONSEJO: Para que una línea aparezca siempre arriba, usa su botón "Fijar línea arriba"</span>
                      <button className="text-[#B0A376] hover:text-[#7A6B3D] shrink-0 ml-2">&times;</button>
                    </div>
                    
                    <AnimatePresence mode="popLayout">
                      {arrivals.map((arrival, index) => {
                        const line = arrival.line;
                        const isLineL = line.startsWith('L');
                        const isNitbus = line.startsWith('N');
                        const isLineV = line.startsWith('V');
                        const isLineH = line.startsWith('H');
                        const isLineD = line.startsWith('D');
                        
                        let bgColor = '#E21918';
                        let textColor = '#FFFFFF';
                        
                        if (isNitbus) {
                          bgColor = '#3B5998'; 
                        } else if (isLineL) {
                          bgColor = '#FCCD32'; 
                          textColor = '#1A1A1A';
                        } else if (isLineV) {
                          bgColor = '#5BBF21';
                        } else if (isLineH) {
                          bgColor = '#1A5ABF';
                        } else if (isLineD) {
                          bgColor = '#7B1FA2';
                        }

                        // Generate a unique key fallback
                        const uniqueKey = `${line}-${arrival.destination}-${arrival.minutes}-${index}`;

                        return (
                          <motion.div 
                            layout
                            key={uniqueKey}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.2 }}
                            className="flex items-center p-4 border-b border-[#F0F0F0] last:border-b-0 bg-white"
                          >
                            <div 
                              className="px-2 py-1 flex items-center justify-center rounded-[6px] font-bold text-[13px] min-w-[55px] shrink-0 gap-1 shadow-sm uppercase tracking-wide" 
                              style={{ backgroundColor: bgColor, color: textColor }}
                            >
                              <Bus size={13} strokeWidth={2.5} />
                              {line}
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                              <div className="text-[14px] text-[#222] truncate cursor-pointer font-medium hover:text-black">
                                A {arrival.destination}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              {arrival.minutes !== null && arrival.minutes > 0 ? (
                                <div className="text-[15px] font-medium text-[#222]">
                                  {arrival.minutes} <span className="text-gray-500 font-normal text-[14px]">min</span>
                                </div>
                              ) : arrival.minutes === 0 ? (
                                <div className="text-[14.5px] text-[#E21918] font-bold">
                                  inminente
                                </div>
                              ) : (
                                <div className="text-[13px] text-gray-400">
                                  sin datos
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    
                    <div className="bg-white p-3 text-center text-[12px] text-gray-400 border-t border-gray-100 hover:text-gray-500 cursor-pointer transition-colors">
                      Cómo obtenemos los datos
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : activeTab === 'favoritos' ? (
          <div className="space-y-3 p-2 h-full">
            {favorites.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-center p-6 mt-10">
                 <div className="bg-gray-100 p-4 rounded-full mb-4">
                   <Heart size={32} className="text-gray-300 fill-gray-300" />
                 </div>
                 <div className="text-lg font-bold text-gray-700">Sin Favoritos</div>
                 <div className="text-[14px] text-gray-500 mt-1">Busca una parada y dale al corazón para guardarla aquí.</div>
               </div>
            ) : (
              <AnimatePresence>
                {favorites.map(favCode => (
                  <motion.div
                    key={favCode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50, scale: 0.95 }}
                    className="bg-white rounded-[12px] p-3 pl-4 flex items-center justify-between shadow-[0_2px_4px_rgba(0,0,0,0.08)] border border-gray-100 group"
                  >
                     <div 
                       className="flex items-center gap-4 flex-1 cursor-pointer"
                       onClick={() => {
                         setStopCode(favCode);
                         setActiveTab('paradas');
                         fetchArrivals(favCode);
                       }}
                     >
                       <div className="bg-[#E21918] text-white w-8 h-8 rounded flex items-center justify-center text-[14px] font-bold">P</div>
                       <div>
                         <div className="font-bold text-[#1A1A1A] text-[15px]">Parada {favCode}</div>
                         <div className="text-[#888] text-[12px]">Barcelona</div>
                       </div>
                     </div>
                     
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={() => toggleFavorite(favCode)}
                         className="p-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity active:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                       >
                         <Trash2 size={18} />
                       </button>
                       <div className="text-gray-300">
                         <ChevronRight size={20} />
                       </div>
                     </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden m-2">
            {!selectedLine ? (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-gray-100 bg-gray-50 font-bold text-gray-700 text-center">
                  Líneas de Bus
                </div>
                {isLoadingLines ? (
                  <div className="flex justify-center items-center h-full">
                    <RefreshCcw className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {lines.map(line => (
                      <div 
                        key={line.CODI_LINIA}
                        onClick={() => fetchLineStops(line)}
                        className="p-4 border border-gray-100 rounded-[12px] hover:bg-gray-50 cursor-pointer flex items-center gap-4 transition-all group"
                      >
                        <div 
                          className="text-white px-3 py-1 flex items-center justify-center rounded-[6px] font-extrabold text-[15px] min-w-[45px] text-center"
                          style={{ backgroundColor: `#${line.COLOR_LINIA || 'E21918'}` }}
                        >
                          {line.NOM_LINIA}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-bold text-[#1A1A1A] leading-tight truncate">{line.DESC_LINIA}</div>
                          <div className="text-[12px] text-gray-500 truncate mt-1 flex items-center gap-1">
                             <MapPin size={12} className="opacity-50" />
                             {line.ORIGEN_LINIA} <span className="text-gray-400 font-normal">→</span> {line.DESTI_LINIA}
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex gap-3 items-center sticky top-0 bg-white z-20">
                   <button onClick={() => setSelectedLine(null)} className="p-1 active:scale-95 text-gray-400 hover:text-black">
                     <ChevronRight size={22} className="rotate-180" />
                   </button>
                   <div 
                     className="text-white px-3 py-1 rounded-[6px] font-extrabold text-[15px] min-w-[50px] text-center shadow-sm"
                     style={{ backgroundColor: `#${selectedLine.COLOR_LINIA || 'E21918'}` }}
                   >
                     {selectedLine.NOM_LINIA}
                   </div>
                   <div className="flex-1 min-w-0 text-[14px] font-bold text-gray-900 truncate tracking-tight">
                     {selectedLine.DESC_LINIA}
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0 bg-white">
                  {isLoadingStops ? (
                    <div className="flex justify-center p-8"><RefreshCcw className="animate-spin text-gray-400" /></div>
                  ) : lineStops && (
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                      <div className="p-4 flex-1">
                         <div className="text-[13px] font-bold text-gray-900 mb-4 sticky top-0 bg-white z-10 py-2 border-b border-gray-100">
                           Ida: <span className="font-normal text-gray-600">Hacia {selectedLine.DESTI_LINIA}</span>
                         </div>
                         <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
                            {lineStops.idaar.map((stop, i) => (
                               <div key={`${stop.CODI_PARADA}-${i}`} className="relative flex items-center gap-4 group">
                                 <div 
                                   className="w-6 h-6 rounded-full border-4 border-white shadow-sm shrink-0 z-10 transition-all duration-300 group-hover:scale-110"
                                   style={{ backgroundColor: `#${selectedLine.COLOR_LINIA || 'E21918'}` }}
                                 ></div>
                                 <div 
                                   className="text-[14px] font-medium text-gray-700 cursor-pointer hover:text-[#E21918] transition-colors"
                                   onClick={() => {
                                     setStopCode(stop.CODI_PARADA.toString());
                                     setActiveTab('paradas');
                                     fetchArrivals(stop.CODI_PARADA.toString());
                                   }}
                                 >
                                   {stop.NOM_PARADA}
                                 </div>
                               </div>
                            ))}
                         </div>
                      </div>
                      
                      <div className="p-4 flex-1 bg-gray-50/30">
                         <div className="text-[13px] font-bold text-gray-900 mb-4 sticky top-0 bg-gray-50/80 backdrop-blur z-10 py-2 border-b border-gray-100">
                           Vuelta: <span className="font-normal text-gray-600">Hacia {selectedLine.ORIGEN_LINIA}</span>
                         </div>
                          <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
                            {lineStops.vuelta.map((stop, i) => (
                               <div key={`${stop.CODI_PARADA}-${i}`} className="relative flex items-center gap-4 group">
                                 <div 
                                   className="w-6 h-6 rounded-full border-4 border-white shadow-sm shrink-0 z-10 transition-all duration-300 group-hover:scale-110"
                                   style={{ backgroundColor: `#${selectedLine.COLOR_LINIA || 'E21918'}` }}
                                 ></div>
                                 <div 
                                   className="text-[14px] font-medium text-gray-700 cursor-pointer hover:text-[#E21918] transition-colors"
                                   onClick={() => {
                                     setStopCode(stop.CODI_PARADA.toString());
                                     setActiveTab('paradas');
                                     fetchArrivals(stop.CODI_PARADA.toString());
                                   }}
                                 >
                                   {stop.NOM_PARADA}
                                 </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="h-[65px] bg-white border-t border-[#EEE] flex justify-around items-center pb-2 px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-20">
        <div 
          onClick={() => setActiveTab('paradas')} 
          className={cn(
            "flex flex-col items-center gap-1 w-20 py-2 cursor-pointer transition-colors",
            activeTab === 'paradas' ? "text-[#E21918]" : "text-[#999] hover:text-[#666]"
          )}
        >
          <Search size={24} strokeWidth={activeTab === 'paradas' ? 3 : 2} />
          <div className="text-[10px] font-bold tracking-wide">Paradas</div>
        </div>
        
        <div 
          onClick={() => setActiveTab('lineas')} 
          className={cn(
            "flex flex-col items-center gap-1 w-20 py-2 cursor-pointer transition-colors",
            activeTab === 'lineas' ? "text-[#E21918]" : "text-[#999] hover:text-[#666]"
          )}
        >
          <Route size={24} strokeWidth={activeTab === 'lineas' ? 3 : 2} />
          <div className="text-[10px] font-bold tracking-wide">Líneas</div>
        </div>
        
        <div 
          onClick={() => setActiveTab('favoritos')} 
          className={cn(
            "flex flex-col items-center gap-1 w-20 py-2 cursor-pointer transition-colors relative",
            activeTab === 'favoritos' ? "text-[#E21918]" : "text-[#999] hover:text-[#666]"
          )}
        >
          <Heart size={24} strokeWidth={activeTab === 'favoritos' ? 3 : 2} className={cn(activeTab === 'favoritos' && "fill-[#E21918]")} />
          {favorites.length > 0 && activeTab !== 'favoritos' && (
             <div className="absolute top-1 right-5 w-2 h-2 bg-[#E21918] rounded-full border border-white" />
          )}
          <div className="text-[10px] font-bold tracking-wide">Favoritos</div>
        </div>
      </nav>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  AlertCircle, 
  CalendarDays, 
  Copy, 
  Check, 
  Trash2, 
  Cpu, 
  Activity, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  Unlock, 
  Search, 
  Info,
  Clock,
  ChevronRight,
  RefreshCw,
  Eye,
  Settings,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LicenseKeyData, StoredLicense, LicenseType } from './types';

// Helper for generating standard randomly structured MachineID
function generateRandomMachineId(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789';
  const segment = (len: number) => 
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MCH-$${segment(4)}-$${segment(4)}`;
}

// Unicode-Safe Base64 Encoding
function encodeLicense(machineId: string, expirationDate: string, type: LicenseType): string {
  const data: LicenseKeyData = { id: machineId, exp: expirationDate, type };
  const jsonStr = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(jsonStr)));
}

// Unicode-Safe Base64 Decoding
function decodeLicense(base64Str: string): LicenseKeyData | null {
  try {
    const sanitized = base64Str.trim();
    if (!sanitized) return null;
    const decodedStr = decodeURIComponent(escape(atob(sanitized)));
    const parsed = JSON.parse(decodedStr);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.exp === 'string') {
      return {
        id: parsed.id,
        exp: parsed.exp,
        type: parsed.type || 'OZEL'
      };
    }
  } catch (e) {
    // Fails silently if not standard base64 or invalid structure
  }
  return null;
}

const TURKISH_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

function formatTurkishDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(day, 10)} ${TURKISH_MONTHS[mIdx]} ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export default function App() {
  // States – Generator
  const [machineId, setMachineId] = useState<string>('');
  const [presetDuration, setPresetDuration] = useState<string>('30'); // '30', '365', 'custom_days', 'custom_date'
  const [customDays, setCustomDays] = useState<number>(90);
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split('T')[0];
  });
  
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  // Custom configuration modes (fully reliable inside secure iframes/sandboxes)
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // States – Decoder / Analyzer
  const [decodeInput, setDecodeInput] = useState<string>('');
  const [decodedSuccessMsg, setDecodedSuccessMsg] = useState<string | null>(null);

  // States – History Search
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Local storage history of generated keys
  const [licenses, setLicenses] = useState<StoredLicense[]>(() => {
    try {
      const stored = localStorage.getItem('lisans_uretec_gecmis');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Calculate Expiration Date dynamically for live UI preview
  const liveExpirationDateStr = useMemo(() => {
    const today = new Date();
    if (presetDuration === '30') {
      today.setDate(today.getDate() + 30);
      return today.toISOString().split('T')[0];
    } else if (presetDuration === '365') {
      today.setDate(today.getDate() + 365);
      return today.toISOString().split('T')[0];
    } else if (presetDuration === 'custom_days') {
      today.setDate(today.getDate() + (customDays || 1));
      return today.toISOString().split('T')[0];
    } else {
      return customDate;
    }
  }, [presetDuration, customDays, customDate]);

  // Decode live analyzer content
  const decodedResult = useMemo(() => {
    return decodeLicense(decodeInput);
  }, [decodeInput]);

  // Analyze remaining days for the decoded license
  const decodedAnalysis = useMemo(() => {
    if (!decodedResult) return null;
    try {
      const expDate = new Date(decodedResult.exp);
      const today = new Date();
      // Reset hours to evaluate clear days comparison
      expDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let status: 'valid' | 'warning' | 'expired' = 'valid';
      let message = '';
      
      if (diffDays < 0) {
        status = 'expired';
        message = `Bu lisansın süresi ${Math.abs(diffDays)} gün önce doldu!`;
      } else if (diffDays === 0) {
        status = 'warning';
        message = 'Kritik Durum: Lisans süresi bugün doluyor!';
      } else if (diffDays <= 7) {
        status = 'warning';
        message = `Sürenin dolmasına son ${diffDays} gün kaldı.`;
      } else {
        status = 'valid';
        message = `Lisans aktif durumda. Kalan gün sayısı: ${diffDays}`;
      }

      return {
        diffDays,
        status,
        message
      };
    } catch {
      return null;
    }
  }, [decodedResult]);

  // Handle Generating License Key
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineId.trim()) {
      setValidationError("Lütfen geçerli bir Machine ID (Esnaf Bilgisayar ID'si) girin!");
      triggerToast("Hata: Machine ID boş bırakılamaz!");
      return;
    }
    setValidationError(null);

    const mId = machineId.trim();
    let type: LicenseType = 'OZEL';
    if (presetDuration === '30') type = 'AYLIK';
    else if (presetDuration === '365') type = 'YILLIK';

    const expireDate = liveExpirationDateStr;
    const newLicenseKey = encodeLicense(mId, expireDate, type);
    
    setGeneratedKey(newLicenseKey);

    // Save to local storage history
    const newStoredRecord: StoredLicense = {
      id: Math.random().toString(36).substring(2, 9),
      machineId: mId,
      expiresAt: expireDate,
      type,
      licenseKey: newLicenseKey,
      createdAt: new Date().toISOString()
    };

    const updatedList = [newStoredRecord, ...licenses];
    setLicenses(updatedList);
    localStorage.setItem('lisans_uretec_gecmis', JSON.stringify(updatedList));

    // Smooth feedback trigger
    triggerToast("Lisans anahtarı başarıyla üretildi!");
  };

  // Toast/Feedback helper
  const triggerToast = (msg: string) => {
    setCopySuccessMsg(msg);
    setTimeout(() => {
      setCopySuccessMsg(null);
    }, 2500);
  };

  const triggerDecoderToast = (msg: string) => {
    setDecodedSuccessMsg(msg);
    setTimeout(() => {
      setDecodedSuccessMsg(null);
    }, 2500);
  };

  // Copy text helper
  const copyToClipboard = (text: string, message: string = "Panoya kopyalandı!") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      triggerToast(message);
    }).catch(() => {
      // Fallback
    });
  };

  const copyToClipboardDecoder = (text: string, message: string = "Panoya kopyalandı!") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      triggerDecoderToast(message);
    });
  };

  // Delete a single historical record
  const handleDeleteLicense = (id: string) => {
    const updated = licenses.filter(l => l.id !== id);
    setLicenses(updated);
    localStorage.setItem('lisans_uretec_gecmis', JSON.stringify(updated));
    triggerToast("Kayıt geçmişten silindi.");
  };

  // Clear entire history (actual action execution)
  const confirmClearHistory = () => {
    setLicenses([]);
    localStorage.removeItem('lisans_uretec_gecmis');
    setShowClearConfirm(false);
    triggerToast("Tüm geçmiş başarıyla temizlendi.");
  };

  // Triggering confirm modal
  const handleClearHistory = () => {
    setShowClearConfirm(true);
  };

  // Load old key to the analyzer
  const handleLoadToAnalyzer = (key: string) => {
    setDecodeInput(key);
    // Smooth scroll down to analyzer if on mobile
    const element = document.getElementById('analyzer-panel');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    triggerDecoderToast("Lisans anahtarı doğrulamak için yüklendi!");
  };

  // Preset quick Machine ID configurations
  const handleRandomMachineId = () => {
    setMachineId(generateRandomMachineId());
    setValidationError(null);
  };

  // Filter history
  const filteredLicenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return licenses;
    return licenses.filter(
      l => l.machineId.toLowerCase().includes(q) || l.licenseKey.includes(q)
    );
  }, [licenses, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Decorative Blur Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {copySuccessMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-slate-800 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg shadow-xl shadow-emerald-950/25"
          >
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">{copySuccessMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {decodedSuccessMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-6 z-50 flex items-center gap-2 bg-slate-800 border border-blue-500/30 text-blue-400 px-4 py-3 rounded-lg shadow-xl shadow-blue-950/25"
          >
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">{decodedSuccessMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Structural Container */}
      <div className="w-full max-w-7xl mx-auto px-4 py-8 flex-1 flex flex-col gap-8 relative z-10">
        
        {/* Header - Brand Visual Layout */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-inner shadow-emerald-500/5">
              <KeyRound className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white font-sans sm:text-3xl">
                  Lisans Anahtarı Üreticisi
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-full border border-emerald-400/20">
                  Secure v2.0
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                Esnaflar ve yazılımlar için MachineID tabanlı hızlı, güvenli base64 lisans anahtarı yönetim portalı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-xl text-slate-400 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Çevrimdışı Çalışma Modu
            </span>
            <div className="w-px h-4 bg-slate-800"></div>
            <span>Base64 Güvenliği</span>
          </div>
        </header>

        {/* Dashboard Grid Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL - Generator Form (8 cols on big, 1 on small) */}
          <section id="generator-panel" className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-slate-900/45 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
              
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Lisans Anahtarı Oluştur</h2>
              </div>

              <form onSubmit={handleGenerate} className="flex flex-col gap-5">
                
                {/* MachineID Input Row */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="machineIdInput" className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      Esnaf Machine ID (Makine Adresi)
                    </label>
                    <button 
                      type="button"
                      onClick={handleRandomMachineId}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition duration-150 py-1 px-2 rounded hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 font-medium"
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin-hover" />
                      Rastgele Üret
                    </button>
                  </div>
                  
                  <div className="relative">
                    <input 
                      id="machineIdInput"
                      type="text" 
                      required
                      placeholder="Örn: MCH-W8R2-3KPL veya Esnaf bilgisayar ID'si"
                      value={machineId}
                      onChange={(e) => {
                        setMachineId(e.target.value);
                        if (validationError && e.target.value.trim()) {
                          setValidationError(null);
                        }
                      }}
                      className={`w-full bg-slate-950/80 border focus:ring-2 focus:ring-emerald-950 focus:outline-none rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 text-sm transition duration-150 font-mono ${
                        validationError ? 'border-rose-500/60 focus:border-rose-500' : 'border-slate-800'
                      }`}
                    />
                  </div>
                  <AnimatePresence>
                    {validationError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-rose-400 text-xs font-semibold flex items-center gap-1 mt-1 pl-1 ml-0.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        {validationError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Duration Picker Type */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    Lisans Paket Süresi
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPresetDuration('30')}
                      className={`py-3 px-2 text-center rounded-xl border text-sm font-medium transition duration-150 ${
                        presetDuration === '30' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/20' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-300">Aylık Paket</div>
                      <div className="text-lg font-bold mt-0.5">30 Gün</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPresetDuration('365')}
                      className={`py-3 px-2 text-center rounded-xl border text-sm font-medium transition duration-150 ${
                        presetDuration === '365' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/20' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-300">Yıllık Paket</div>
                      <div className="text-lg font-bold mt-0.5 text-emerald-400">365 Gün</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPresetDuration('custom_days')}
                      className={`py-3 px-2 text-center rounded-xl border text-sm font-medium transition duration-150 ${
                        presetDuration === 'custom_days' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/20' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-300">Gün Belirt</div>
                      <div className="text-lg font-bold mt-0.5">Özel Gün</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPresetDuration('custom_date')}
                      className={`py-3 px-2 text-center rounded-xl border text-sm font-medium transition duration-150 ${
                        presetDuration === 'custom_date' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/20' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-300">Tarih Seç</div>
                      <div className="text-lg font-bold mt-0.5">Bitiş Günü</div>
                    </button>
                  </div>
                </div>

                {/* Additional Inputs for Custom Settings */}
                <AnimatePresence mode="wait">
                  {presetDuration === 'custom_days' && (
                    <motion.div 
                      key="custom_days"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden flex flex-col gap-2 p-3 bg-slate-950/50 border border-slate-800 rounded-xl"
                    >
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Lisans Süresi (Gün olarak)</span>
                        <span className="font-mono text-emerald-400 font-semibold">{customDays} Gün</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="1" 
                          max="1000" 
                          value={customDays} 
                          onChange={(e) => setCustomDays(parseInt(e.target.value))}
                          className="w-full accent-emerald-500 h-2 bg-slate-900 rounded-lg cursor-pointer"
                        />
                        <input 
                          type="number"
                          min="1"
                          max="9999"
                          value={customDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCustomDays(isNaN(val) ? 1 : val);
                          }}
                          className="w-20 bg-slate-950 text-slate-100 border border-slate-800 text-center text-xs py-1 rounded focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </motion.div>
                  )}

                  {presetDuration === 'custom_date' && (
                    <motion.div 
                      key="custom_date"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden flex flex-col gap-2 p-3 bg-slate-950/50 border border-slate-800 rounded-xl"
                    >
                      <label className="text-xs text-slate-400">Net Bitiş Tarihini Takvimden Seçin</label>
                      <input 
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono w-full"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Expiry calculation preview */}
                <div className="bg-slate-950/40 border border-slate-800/40 p-4 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Tahmini Bitiş Günü:</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-emerald-400">
                    {formatTurkishDate(liveExpirationDateStr)}
                  </span>
                </div>

                {/* Form Action Button */}
                <button
                  type="submit"
                  id="uretButton"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-md cursor-pointer"
                >
                  <KeyRound className="w-5 h-5 text-slate-950" />
                  Lisans Anahtarı Üret
                </button>

              </form>

              {/* Generator Result Area */}
              <AnimatePresence>
                {generatedKey && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 pt-6 border-t border-slate-800"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Üretilen Lisans Anahtarı
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-mono">
                        Base64 Encoded Key
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex gap-3 relative group">
                      <div className="flex-1 overflow-x-auto select-all">
                        <p className="text-xs sm:text-sm text-emerald-400 font-mono break-all leading-relaxed whitespace-pre-wrap">
                          {generatedKey}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 justify-center">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(generatedKey, "Lisans anahtarı panoya kopyalandı!")}
                          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 rounded-lg transition duration-150 shadow-sm"
                          title="Panoya Kopyala"
                          id="panoyaKopyalaBtn"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadToAnalyzer(generatedKey)}
                          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-blue-400 rounded-lg transition duration-150 shadow-sm"
                          title="Doğrulayıcıya Aktar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-1.5 text-slate-500 text-[11px] leading-relaxed">
                      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      Yazılımınız, esnaf bilgisayarındaki ID'yi bu anahtarla karşılaştırıp Base64 çözümü yaptıktan sonra bitiş tarihini kontrol etmelidir.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* RIGHT PANEL - Live Analyzer & Decoder (5 cols on big) */}
          <section id="analyzer-panel" className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-slate-900/45 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Lisans Çözücü & Doğrulama</h2>
                </div>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded-full font-mono">
                  Gerçek Zamanlı
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="decodeInputText" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    İncelemek İstediğiniz Lisans Anahtarı
                  </label>
                  <textarea 
                    id="decodeInputText"
                    rows={3}
                    placeholder="Base64 kodlanmış lisans anahtarını buraya yapıştırın..."
                    value={decodeInput}
                    onChange={(e) => setDecodeInput(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-950 focus:outline-none rounded-xl px-3 py-2.5 text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm font-mono transition duration-150 resize-none"
                  />
                </div>

                {/* Analysis Result State */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 min-h-[220px] flex flex-col justify-start">
                  
                  {!decodeInput.trim() && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <HelpCircle className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs text-slate-400 font-medium">Analiz edilecek lisans girilmedi</p>
                      <p className="text-[11px] text-slate-600 mt-1 max-w-[240px]">
                        Yukarıdaki kutuya bir anahtar yapıştırın ya da geçmişten bir kayıt seçin.
                      </p>
                    </div>
                  )}

                  {decodeInput.trim() && !decodedResult && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <AlertCircle className="w-8 h-8 text-rose-500/80 mb-2 animate-pulse" />
                      <p className="text-xs text-rose-400 font-bold">Geçersiz Lisans Anahtarı Formatı</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-[240px]">
                        Karakterler geçerli bir Base64 formatına veya lisans veri yapısına uymuyor.
                      </p>
                    </div>
                  )}

                  {decodeInput.trim() && decodedResult && decodedAnalysis && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col gap-4"
                    >
                      {/* Status Badges Header */}
                      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                        <span className="text-xs font-semibold text-slate-400">Lisans Durumu</span>
                        
                        {decodedAnalysis.status === 'valid' && (
                          <span className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Aktif / Saniyenlik
                          </span>
                        )}

                        {decodedAnalysis.status === 'warning' && (
                          <span className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                            Sınırlı Zaman
                          </span>
                        )}

                        {decodedAnalysis.status === 'expired' && (
                          <span className="flex items-center gap-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Süresi Doldu
                          </span>
                        )}
                      </div>

                      {/* Decoded details list */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        
                        <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40 flex flex-col gap-0.5">
                          <span className="text-[11px] text-slate-500 font-medium">Machine ID</span>
                          <div className="flex items-center justify-between font-mono font-bold text-white tracking-wide">
                            <span className="truncate max-w-[120px]" title={decodedResult.id}>
                              {decodedResult.id}
                            </span>
                            <button 
                              type="button"
                              onClick={() => copyToClipboardDecoder(decodedResult.id, "MachineID panoya kopyalandı!")}
                              className="text-slate-500 hover:text-blue-400 transition ml-1"
                              title="MachineID Kopyala"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40 flex flex-col gap-0.5">
                          <span className="text-[11px] text-slate-500 font-medium">Paket İndisi</span>
                          <span className="font-mono font-bold text-blue-300">
                            {decodedResult.type === 'AYLIK' && 'AYLIK (30 Gün)'}
                            {decodedResult.type === 'YILLIK' && 'YILLIK (365 Gün)'}
                            {decodedResult.type === 'OZEL' && 'ÖZEL SÜRE'}
                          </span>
                        </div>

                        <div className="col-span-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40 flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span className="text-[11px] text-slate-500 font-medium">Bitiş Tarihi</span>
                            <span className="text-[11px] text-slate-400 font-mono font-semibold">{decodedResult.exp}</span>
                          </div>
                          <span className="font-sans font-bold text-slate-200">
                            {formatTurkishDate(decodedResult.exp)}
                          </span>
                        </div>

                      </div>

                      {/* Evaluator statement message block */}
                      <div className={`p-3 rounded-lg border flex items-start gap-2 text-[11px] ${
                        decodedAnalysis.status === 'valid' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300' :
                        decodedAnalysis.status === 'warning' ? 'bg-amber-500/5 border-amber-500/10 text-amber-300' :
                        'bg-rose-500/5 border-rose-500/10 text-rose-300'
                      }`}>
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{decodedAnalysis.message}</p>
                          <p className="opacity-70 mt-0.5">
                            {decodedAnalysis.status === 'expired' 
                              ? 'Esnaf cihazındaki yazılımın bu lisansı reddetmesi gerekiyor.' 
                              : 'Esnaf cihazında sorunsuzca doğrulanabilir.'}
                          </p>
                        </div>
                      </div>

                    </motion.div>
                  )}

                </div>
              </div>

            </div>
          </section>

        </div>

        {/* BOTTOM SECTION - Stored Keys History (Full-width) */}
        <section className="bg-slate-900/45 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Lisans Üretim Geçmişi</h2>
                <p className="text-slate-400 text-xs">Tarayıcı belleğinde (localStorage) saklanan lisans anahtarı listeleri</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Machine ID ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 focus:outline-none rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 font-mono w-48 sm:w-60 transition duration-150"
                />
              </div>

              {licenses.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 bg-slate-950/40 px-3 py-1.5 rounded-xl transition duration-150 flex items-center gap-1.5 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Geçmişi Temizle
                </button>
              )}
            </div>
          </div>

          {/* History Empty State */}
          {filteredLicenses.length === 0 ? (
            <div className="border border-dashed border-slate-800 bg-slate-950/20 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <Clock className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-slate-400 text-sm font-medium">
                {searchQuery ? 'Aramayla eşleşen lisans bulunamadı' : 'Henüz üretilmiş lisans anahtarı geçmişi bulunmuyor'}
              </p>
              <p className="text-slate-600 text-xs mt-1 max-w-sm">
                {searchQuery ? 'Arama teriminizi kontrol edebilir ya da yeni bir tane üretebilirsiniz.' : 'Yukarıdaki formu doldurup "Lisans Anahtarı Üret" butonuna basarak ilk anahtarınızı oluşturun.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3.5 px-4">Makine (Machine ID)</th>
                    <th className="py-3.5 px-4">Paket Türü</th>
                    <th className="py-3.5 px-4">Bitiş Tarihi</th>
                    <th className="py-3.5 px-4 max-w-[200px]">Lisans Anahtarı</th>
                    <th className="py-3.5 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredLicenses.map((item) => (
                    <motion.tr 
                      key={item.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-900/30 transition group"
                    >
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{item.machineId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {item.type === 'AYLIK' && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-400/20 rounded-full font-sans font-bold text-[10px]">
                            AYLIK (30G)
                          </span>
                        )}
                        {item.type === 'YILLIK' && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 rounded-full font-sans font-bold text-[10px]">
                            YILLIK (365G)
                          </span>
                        )}
                        {item.type === 'OZEL' && (
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-400/20 rounded-full font-sans font-bold text-[10px]">
                            ÖZEL SÜRE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-300">
                        {formatTurkishDate(item.expiresAt)}
                      </td>
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="truncate text-slate-500 select-all font-mono text-[11px]" title={item.licenseKey}>
                          {item.licenseKey}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadToAnalyzer(item.licenseKey)}
                            className="bg-slate-900 hover:bg-blue-500/10 border border-slate-800 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 p-1.5 rounded-lg transition"
                            title="Çözuçüye Gönder ve Analiz Et"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.licenseKey, "Anahtar kopyalandı!")}
                            className="bg-slate-900 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg transition"
                            title="Anahtarı Kopyala"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLicense(item.id)}
                            className="bg-slate-900 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg transition"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>

      {/* Footer Info Statement */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 relative z-10 text-center text-xs text-slate-600 font-medium">
        <div className="w-full max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Lisans Anahtarı Üretim Kontrol Merkezi</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              AES & Base64 Endekslidir
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-850"></span>
            <span>Geliştirici Sürümü</span>
          </div>
        </div>
      </footer>

      {/* Sleek Custom Confirmation Modal (Guarantees functionality inside secure iframes) */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>

              {/* Warning Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-sans">Geçmişi Temizle?</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Bu işlem geri alınamaz!</p>
                </div>
              </div>

              {/* Body */}
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
                Üretilmiş olan bütün lisans anahtarı kayıt geçmişi tarayıcı yerel depolama alanından (localStorage) <strong className="text-rose-400 font-semibold">kalıcı olarak silinecektir</strong>. Devam etmek istediğinize emin misiniz?
              </p>

              {/* Button Actions */}
              <div className="flex items-center justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold select-none cursor-pointer border border-slate-700/50 transition duration-150"
                >
                  İptal Et
                </button>
                <button
                  type="button"
                  onClick={confirmClearHistory}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-xl text-xs select-none cursor-pointer shadow-lg shadow-rose-950/20 transition duration-150"
                >
                  Evet, Tümünü Sil
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

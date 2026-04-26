/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  Baby, 
  Palette, 
  BookOpen, 
  CheckCircle2,
  Image as ImageIcon,
  LogIn,
  LogOut,
  User,
  History,
  ArrowRight,
  X,
  Trash2,
  Loader2
} from "lucide-react";
import { jsPDF } from "jspdf";
import confetti from "canvas-confetti";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp
} from "firebase/firestore";
import { auth, db, googleProvider } from "./lib/firebase";

// --- Types ---
interface ColoringImage {
  id: number;
  url: string;
  prompt: string;
}

interface SavedBook {
  id: string;
  childName: string;
  theme: string;
  thumbnail: string;
  createdAt: Timestamp;
}

const CATEGORIES = [
  { id: "animals", label: "동물", icon: "🦁" },
  { id: "plants", label: "식물", icon: "🌻" },
  { id: "space", label: "우주", icon: "🚀" },
  { id: "fantasy", label: "판타지", icon: "🧙" },
  { id: "vehicles", label: "탈것", icon: "🏎️" },
];

const PRESET_IDEAS = [
  "태권도 하는 호랑이",
  "스케이트보드 타는 판다",
  "우주에서 춤추는 공룡",
  "케이크를 든 고양이 공주",
  "하늘을 나는 고래",
  "마법 지팡이를 든 토끼",
];

// --- Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [childName, setChildName] = useState("");
  const [theme, setTheme] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<ColoringImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "gallery">("create");
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [isDownloadingGallery, setIsDownloadingGallery] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setShowLoginModal(false);
        fetchGallery(currentUser.uid);
      }
    });
    return unsubscribe;
  }, []);

  // --- Handlers ---
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed", err);
      setError("로그인에 실패했습니다.");
    }
  };

  const handleLogout = () => signOut(auth);

  const fetchGallery = async (uid: string) => {
    setIsLoadingGallery(true);
    try {
      const q = query(
        collection(db, "books"),
        where("userId", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      const books: SavedBook[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedBook[];
      
      const sortedBooks = books.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setSavedBooks(sortedBooks);
    } catch (err) {
      console.error("Fetching gallery failed", err);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const deleteBook = async (bookId: string) => {
    if (!confirm("이 도안을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "books", bookId));
      setSavedBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (err) {
      console.error("Delete failed", err);
      setError("삭제에 실패했습니다.");
    }
  };

  const handleGenerate = async () => {
    if (!theme.trim()) {
      setError("색칠하고 싶은 주제를 입력해주세요!");
      return;
    }
    if (!childName.trim()) {
      setError("아이의 이름을 입력해주세요!");
      return;
    }

    setError(null);
    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      // Duplicate check (Client-side filtering to avoid complex indexes)
      if (user) {
        const q = query(collection(db, "books"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        const existing = snap.docs.find(d => {
          const data = d.data();
          return data.theme === theme.trim() && data.childName === childName.trim();
        });

        if (existing) {
          const existingData = existing.data();
          const cachedImages = (existingData.imageUrls as string[]).map((url, idx) => ({
            id: idx,
            url,
            prompt: ""
          }));
          setGeneratedImages(cachedImages);
          setIsGenerating(false);
          confetti({ particleCount: 150, spread: 70 });
          return;
        }
      }

      const promptRefiner = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create 4 specific, single-sentence image generation prompts for children's coloring pages based on the theme: "${theme}". 
        The theme should be adapted for a child. 
        Each prompt MUST include: "black and white outline, coloring book style, minimal detail, thick lines, pure white background, no shading, no grayscale".
        Return as a JSON array of strings.`,
        config: { responseMimeType: "application/json" }
      });

      const prompts: string[] = JSON.parse(promptRefiner.text);

      const imagePromises = prompts.map(async (p, idx) => {
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: p,
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        const part = result.candidates[0].content.parts.find(p => p.inlineData);
        if (part?.inlineData) {
          return {
            id: idx,
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            prompt: p
          };
        }
        throw new Error("Failed to generate image " + idx);
      });

      const images = await Promise.all(imagePromises);
      setGeneratedImages(images);

      // Save to Firebase if logged in
      if (user) {
        try {
          const bookRef = await addDoc(collection(db, "books"), {
            userId: user.uid,
            childName,
            theme,
            thumbnail: images[0].url,
            createdAt: serverTimestamp()
          });

          // Save images to subcollection in parallel
          const imagePromises = images.map((img, idx) => 
            addDoc(collection(db, "books", bookRef.id, "images"), {
              url: img.url,
              index: idx
            })
          );
          await Promise.all(imagePromises);
          
          fetchGallery(user.uid);
        } catch (saveErr: any) {
          console.error("Save to DB failed", saveErr);
          setError("데이터베이스 저장에 실패했습니다.");
        }
      } else {
        setShowLoginModal(true);
      }

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#A084E8', '#6AD4DD', '#F9E8D9', '#E84545']
      });
    } catch (err) {
      console.error(err);
      setError("이미지를 만드는 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async (bookId?: string, name = childName, bookTheme = theme, providedImages?: string[]) => {
    let images = providedImages;
    
    // Case 1: Downloading from current generation (Create Tab)
    if (!images && !bookId) {
      images = generatedImages.map(img => img.url);
    }
    
    // Case 2: Downloading from gallery (Gallery Tab) - Image data is stored in subcollection
    if (!images && bookId) {
      setIsDownloadingGallery(bookId);
      try {
        const querySnapshot = await getDocs(query(collection(db, "books", bookId, "images"), orderBy("index", "asc")));
        images = querySnapshot.docs.map(doc => doc.data().url);
      } catch (err) {
        console.error("Failed to fetch images for PDF", err);
        setError("이미지를 불러오지 못했습니다.");
        setIsDownloadingGallery(null);
        return;
      }
    }

    if (!images || images.length === 0) {
      setIsDownloadingGallery(null);
      return;
    }

    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Utility: Draw Korean text to a canvas and return DataURL to avoid font issues
    const drawTextToImage = (text: string, fontSize: number, color: string, isBold = false) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      
      const scale = 4; // High resolution
      ctx.font = `${isBold ? "bold " : ""}${fontSize * scale}px sans-serif`;
      const metrics = ctx.measureText(text);
      
      canvas.width = metrics.width + 20;
      canvas.height = (fontSize * scale) * 1.5;
      
      ctx.font = `${isBold ? "bold " : ""}${fontSize * scale}px sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, canvas.height / 2);
      
      return canvas.toDataURL("image/png");
    };

    // 1. Cover Page
    doc.setFillColor(15, 15, 26); // Match app background
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Draw Korean titles via images
    const subTitleImg = drawTextToImage(`${name}(을)를 위한`, 24, "#CCCCCC");
    const mainTitleImg = drawTextToImage("꿈꾸는 색칠공부", 40, "#A084E8", true);
    const themeImg = drawTextToImage(`주제: ${bookTheme}`, 18, "#777777");

    if (subTitleImg) {
      const sw = 100; const sh = 10;
      doc.addImage(subTitleImg, "PNG", (pageWidth - sw) / 2, 80, sw, sh);
    }
    if (mainTitleImg) {
      const mw = 140; const mh = 20;
      doc.addImage(mainTitleImg, "PNG", (pageWidth - mw) / 2, 95, mw, mh);
    }
    if (themeImg) {
      const tw = 80; const th = 8;
      doc.addImage(themeImg, "PNG", (pageWidth - tw) / 2, 120, tw, th);
    }

    if (images.length > 0) {
      doc.addImage(images[0], "PNG", (pageWidth - 120) / 2, 140, 120, 120);
    }
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Created by Magic Sketch AI", pageWidth / 2, pageHeight - 20, { align: "center" });

    // 2. Coloring Pages
    images.forEach((img, idx) => {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      const pageHeaderImg = drawTextToImage(`${name}의 마법 도안`, 12, "#333333", true);
      const appNameImg = drawTextToImage("Magic Sketch AI", 10, "#999999");
      const footerImg = drawTextToImage(`Designed by ${name}`, 10, "#666666");

      if (pageHeaderImg) doc.addImage(pageHeaderImg, "PNG", 20, 10, 40, 6);
      if (appNameImg) doc.addImage(appNameImg, "PNG", pageWidth - 50, 10, 30, 5);
      
      doc.addImage(img, "PNG", (pageWidth - 180) / 2, 35, 180, 180);
      
      if (footerImg) doc.addImage(footerImg, "PNG", (pageWidth - 40) / 2, pageHeight - 15, 40, 5);
    });

    doc.save(`${name}_MagicSketch_${bookTheme}.pdf`);
    setIsDownloadingGallery(null);
  };

  const handleRandomTheme = () => {
    const random = PRESET_IDEAS[Math.floor(Math.random() * PRESET_IDEAS.length)];
    setTheme(random);
  };

  const navItemClass = (tab: string) => `
    flex items-center gap-2 px-6 py-2 rounded-full transition-all font-bold text-sm
    ${activeTab === tab 
      ? "bg-[#6C5DD3] text-white shadow-[0_4px_12px_rgba(108,93,211,0.3)]" 
      : "text-slate-400 hover:text-white"}
  `;

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-slate-100 font-sans p-4 md:p-8 selection:bg-purple-500/30">
      {/* Dark Stars Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[10%] left-[20%] w-1 h-1 bg-white rounded-full animate-pulse" />
        <div className="absolute top-[40%] right-[15%] w-1 h-1 bg-white rounded-full animate-pulse delay-700" />
        <div className="absolute bottom-[20%] left-[40%] w-1 h-1 bg-white rounded-full animate-pulse delay-300" />
        <div className="absolute top-[30%] left-[5%] w-[400px] h-[400px] bg-purple-900/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[350px] h-[350px] bg-blue-900/30 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation / Header */}
        <nav className="flex items-center justify-between mb-12 bg-white/5 backdrop-blur-xl border border-white/10 p-3 rounded-full">
          <div className="flex items-center gap-1">
            <button onClick={() => setActiveTab("create")} className={navItemClass("create")}>
              <Palette className="w-4 h-4" /> 만들기
            </button>
            <button onClick={() => setActiveTab("gallery")} className={navItemClass("gallery")}>
              <History className="w-4 h-4" /> 갤러리
            </button>
          </div>
          
          <div className="flex items-center gap-3 pr-2">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-[#6C5DD3]">Hello!</p>
                  <p className="text-sm font-bold truncate max-w-[100px]">{user.displayName}</p>
                </div>
                <img src={user.photoURL || ""} alt="User" className="w-9 h-9 rounded-full border-2 border-[#6C5DD3] shadow-lg" />
                <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <LogOut className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full font-bold text-sm hover:bg-slate-200 transition-all">
                <LogIn className="w-4 h-4" /> 로그인
              </button>
            )}
          </div>
        </nav>

        {activeTab === "create" ? (
          <>
            {/* Hero */}
            <header className="text-center mb-12 py-6">
              <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <div className="inline-block p-4 bg-gradient-to-br from-[#6C5DD3] to-[#8E8FFA] rounded-3xl shadow-2xl shadow-purple-900/40 mb-6">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black mb-3 tracking-tighter">
                  Magic <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-300">Sketch</span>
                </h1>
                <p className="text-slate-400 font-medium">상상하는 모든 것이 AI 색칠공부가 돼요 🧚</p>
              </motion.div>
            </header>

            {!isGenerating && generatedImages.length === 0 && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white/5 backdrop-blur-2xl rounded-[40px] p-8 md:p-12 shadow-2xl border border-white/10 relative overflow-hidden group"
              >
                <div className="grid gap-8 relative z-10">
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs font-black text-purple-400 uppercase tracking-[0.2em] ml-1">
                      <Baby className="w-4 h-4" /> Who is drawing?
                    </label>
                    <input 
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="우리 아이의 이름을 알려주세요"
                      className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-3xl focus:border-purple-500/50 outline-none transition-all placeholder:text-slate-600 text-xl font-bold"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-[0.2em] ml-1">
                      <Palette className="w-4 h-4" /> What to draw?
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="예: 닌자 거북이와 피자 파티"
                        className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-3xl focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600 text-xl font-bold"
                      />
                      <button onClick={handleRandomTheme} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-2xl">
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setTheme(cat.label)}
                          className="px-5 py-2.5 bg-white/5 border border-white/5 border-b-white/10 rounded-2xl hover:bg-white/10 hover:translate-y-[-2px] transition-all flex items-center gap-2 text-sm font-bold"
                        >
                          <span className="text-lg">{cat.icon}</span> {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-red-400 bg-red-400/10 px-4 py-2 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2 animate-shake"><X className="w-4 h-4" /> {error}</p>}

                  <button 
                    onClick={handleGenerate}
                    disabled={!theme || !childName}
                    className="mt-4 w-full py-6 bg-gradient-to-r from-[#6C5DD3] to-[#A084E8] text-white rounded-[28px] font-black text-2xl shadow-xl shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-3"
                  >
                    🎨 도안 그리기 시작!
                  </button>
                </div>
              </motion.div>
            )}

            {/* Generating State */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 space-y-10">
                  <div className="relative">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="w-32 h-32 border-[6px] border-white/5 border-t-purple-500 rounded-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="text-purple-400 w-10 h-10 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-4">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500 animate-pulse">마법 도안을 그리는 중...</h2>
                    <p className="text-slate-500 font-bold px-6 py-2 bg-white/5 rounded-full inline-block">잠시만 기다려주세요, 우리 아이를 위한 선물이 곧 완성돼요!</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results View */}
            {generatedImages.length > 0 && !isGenerating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/5 p-6 rounded-[32px] border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/20 rounded-2xl text-green-400">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black italic">TADA! 완성이에요!</h2>
                      <p className="text-slate-400 font-medium font-mono text-sm">Theme: {theme}</p>
                    </div>
                  </div>
                  <button onClick={() => { setGeneratedImages([]); setTheme(""); }} className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all font-bold text-slate-300">
                    <RefreshCw className="w-5 h-5" /> 다시 그리기
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-8">
                  {generatedImages.map((img, i) => (
                    <motion.div 
                      key={img.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white/5 p-4 rounded-[40px] border border-white/10 group relative"
                    >
                      <img src={img.url} className="w-full aspect-square object-cover rounded-[30px] bg-white" alt="Coloring Page" />
                      <div className="absolute top-8 right-8 flex gap-2">
                        <div className="bg-purple-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg">#{i+1}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="bg-[#6C5DD3] p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 group">
                  <div className="flex items-center gap-4 text-white">
                    <div className="p-4 bg-black/20 rounded-3xl group-hover:rotate-12 transition-transform">
                      <Download className="w-8 h-8" />
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-3xl font-black">PDF 다운받기</p>
                      <p className="text-purple-200 font-medium">A4용지에 인쇄하기 가장 좋은 크기에요!</p>
                    </div>
                  </div>
                  <button onClick={() => downloadPDF()} className="w-full md:w-auto px-12 py-5 bg-white text-black rounded-[24px] font-black text-xl hover:scale-105 transition-all shadow-xl shadow-black/20">
                    지금 받기!
                  </button>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          /* Gallery View */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h1 className="text-3xl font-extrabold flex items-center gap-3">
                <History className="text-purple-400" /> My Gallery
              </h1>
              {!user && (
                <button onClick={handleLogin} className="text-sm font-bold text-purple-400 hover:underline">
                  로그인하고 저자 보관하기
                </button>
              )}
            </div>

            {isLoadingGallery ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                <p className="font-bold text-slate-500">불러오는 중...</p>
              </div>
            ) : user ? (
              savedBooks.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/20 rounded-[40px] py-32 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="p-6 bg-white/5 rounded-full mb-4">
                    <ImageIcon className="w-12 h-12 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold">아직 저장된 도안이 없어요</h3>
                  <p className="text-slate-500">첫 번째 마법 색칠공부를 지금 바로 만들어보세요!</p>
                  <button onClick={() => setActiveTab("create")} className="mt-4 px-8 py-3 bg-[#6C5DD3] rounded-2xl font-bold flex items-center gap-2">
                    도안 그리러 가기 <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {savedBooks.map((book, idx) => (
                    <motion.div 
                      key={book.id}
                      initial={{ rotate: idx % 2 === 0 ? -2 : 2, y: 20, opacity: 0 }}
                      animate={{ rotate: idx % 2 === 0 ? -1 : 1, y: 0, opacity: 1 }}
                      whileHover={{ rotate: 0, scale: 1.05, zIndex: 20 }}
                      className="relative group transition-all"
                    >
                      {/* Polaroid Frame */}
                      <div className="bg-white p-4 pb-12 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-sm rotate-1 group-hover:rotate-0 transition-transform duration-300">
                        <div className="aspect-square bg-slate-100 rounded-sm overflow-hidden mb-4 border border-slate-200">
                          <img src={book.thumbnail} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt="Polaroid Preview" />
                        </div>
                        <div className="space-y-1 px-1">
                          <h3 className="text-slate-800 font-handwriting text-xl font-bold truncate">{book.childName}</h3>
                          <p className="text-slate-500 font-handwriting text-sm truncate">{book.theme}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-2">
                            {new Date(book.createdAt?.seconds * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-x-4 bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300 z-30">
                        <button 
                          onClick={() => downloadPDF(book.id, book.childName, book.theme)}
                          disabled={isDownloadingGallery === book.id}
                          className="flex-grow py-2.5 bg-[#6C5DD3] text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-[#5a4cb1] disabled:opacity-50"
                        >
                          {isDownloadingGallery === book.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isDownloadingGallery === book.id ? "준비 중..." : "다운받기"}
                        </button>
                        <button 
                          onClick={() => deleteBook(book.id)}
                          className="p-2.5 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtle Paper Texture Overlay (optional but nice) */}
                      <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] rounded-sm" />
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-[40px] py-32 flex flex-col items-center justify-center gap-6 text-center px-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-bounce">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black mb-2">갤러리를 이용하려면 로그인해 주세요!</h3>
                  <p className="text-slate-500">로그인하면 지금까지 만든 도안들을 모두 저장하고<br/>언제든지 다시 다운로드할 수 있어요.</p>
                </div>
                <button onClick={handleLogin} className="px-12 py-4 bg-white text-black rounded-2xl font-black text-lg shadow-xl shadow-black/20 hover:scale-105 transition-all">
                  구글로 1초만에 시작하기
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Login Suggestion Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1A1A2E] w-full max-w-md p-10 rounded-[40px] border border-white/10 relative z-10 text-center shadow-2xl"
            >
              <button 
                onClick={() => setShowLoginModal(false)}
                className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="inline-block p-5 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full mb-6">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black mb-4">성공적으로 그렸어요!</h2>
              <p className="text-slate-400 font-medium mb-8 leading-relaxed">
                로그인하면 이 도안들을 자동으로 **마이 갤러리**에 저장할 수 있어요. 계정을 만드실래요?
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={handleLogin} className="w-full py-5 bg-white text-black rounded-2xl font-black text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                  <LogIn className="w-5 h-5" /> 구글 로그인하고 저장
                </button>
                <button onClick={() => setShowLoginModal(false)} className="w-full py-4 text-slate-500 font-bold hover:text-slate-300">
                  나중에 할게요 (로그인 안 함)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { UploadZone } from "@/components/UploadZone";
import { AnalysisResult, type AnalysisData } from "@/components/AnalysisResult";
import { AppSidebar } from "@/components/AppSidebar";
import type { HistoryItem } from "@/components/HistoryPanel";
import { toast } from "sonner";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TrendingUp, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  fileUrl?: string | null;
  result?: AnalysisData | null;
};

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [trendingNews, setTrendingNews] = useState<{title: string, description: string, source: string, link?: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/news")
      .then(res => res.json())
      .then(data => {
        if (data.news) setTrendingNews(data.news);
      })
      .catch(console.error);
  }, []);

  const handleSendMessage = async (file: File | null, text: string) => {
    setIsAnalyzing(true);
    
    let fileUrl = null;
    if (file) {
        fileUrl = URL.createObjectURL(file);
    }
    
    const userMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", text, fileUrl }]);

    toast("Processing...", { description: "Thinking..." });

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (text) formData.append("text", text);
      
      // Send chat history (excluding file URLs to save bandwidth)
      const historyContext = messages.map(m => ({ role: m.role, text: m.text }));
      formData.append("history", JSON.stringify(historyContext));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      const assistantMsgId = crypto.randomUUID();
      const analysisResult: AnalysisData | null = data.result || null;
      
      setMessages(prev => [...prev, { 
        id: assistantMsgId, 
        role: "assistant", 
        text: data.text || "Here are the results of the analysis.", 
        result: analysisResult 
      }]);

      if (analysisResult && analysisResult.verdict !== "Unknown") {
          const historyItem: HistoryItem = {
            ...analysisResult,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          };
          
          const existingStr = localStorage.getItem("ai_detector_history");
          const existing = existingStr ? JSON.parse(existingStr) : [];
          localStorage.setItem("ai_detector_history", JSON.stringify([historyItem, ...existing]));
          setHistoryTrigger(prev => prev + 1);
      }
      
    } catch (error: unknown) {
      console.error(error);
      toast.error("Request Failed", { description: (error as Error).message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if ((messages.length > 0 || isAnalyzing) && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isAnalyzing]);

  return (
    <>
      <AppSidebar 
        onSelectHistory={(item) => setMessages([{ id: item.id, role: "assistant", text: item.explanation, result: item }])} 
        onNewAnalysis={() => setMessages([])}
        refreshTrigger={historyTrigger} 
      />
      <SidebarInset className="flex flex-col h-full bg-background overflow-hidden relative">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b-0 px-4 absolute top-0 w-full z-10 bg-gradient-to-b from-background to-transparent">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        </header>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto w-full scroll-smooth pt-14">
          <div className="mx-auto max-w-4xl px-4 py-8 pb-6 flex flex-col min-h-full">
            {messages.length > 0 ? (
              <div className="flex flex-col gap-8 w-full pb-8">
                  {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === "user" ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-500 border border-blue-500/20"}`}>
                              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          </div>
                          <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                              {msg.fileUrl && (
                                  <div className="mb-3 rounded-2xl overflow-hidden border border-border/50 max-w-xs">
                                      <img src={msg.fileUrl} alt="uploaded" className="w-full h-auto object-cover" />
                                  </div>
                              )}
                              {msg.text && (
                                  <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed prose prose-invert prose-p:leading-relaxed prose-pre:bg-secondary prose-pre:p-4 prose-pre:rounded-xl prose-p:first-of-type:mt-0 prose-p:last-of-type:mb-0 max-w-none ${msg.role === "user" ? "bg-secondary text-secondary-foreground rounded-tr-sm" : "bg-secondary/30 border border-border/50 text-foreground/90 rounded-tl-sm"}`}>
                                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                                  </div>
                              )}
                              {msg.result && (
                                  <div className="mt-4 w-full">
                                      <AnalysisResult data={msg.result} />
                                  </div>
                              )}
                          </div>
                      </div>
                  ))}
                  
                  {isAnalyzing && (
                      <div className="flex gap-4 flex-row animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-blue-500/20 text-blue-500 border border-blue-500/20">
                              <Bot className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col items-start max-w-[85%]">
                              <div className="px-5 py-4 rounded-2xl bg-secondary/30 border border-border/50 rounded-tl-sm flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                                  <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                                  <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            ) : (
              <div className="m-auto flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-700 w-full">
                 <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-6 rounded-full mb-4 ring-1 ring-border/50 shadow-2xl shadow-primary/10">
                   <h1 className="text-5xl md:text-6xl font-semibold bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent tracking-tight">
                     Hello, User
                   </h1>
                 </div>
                 <h2 className="text-2xl md:text-3xl font-medium text-muted-foreground">
                   Chat, verify news, or upload media
                 </h2>
                 <p className="text-muted-foreground/80 max-w-lg mt-2 mb-4 text-sm md:text-base">
                   You can talk to me naturally, ask me to fetch the latest global news, or upload an image to instantly detect AI generation and digital manipulation.
                 </p>

                 {trendingNews.length > 0 && (
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-8">
                     {trendingNews.map((news, i) => (
                       <a 
                         key={i} 
                         href={news.link || "#"} 
                         target={news.link ? "_blank" : "_self"} 
                         rel="noreferrer"
                         className="flex flex-col text-left p-4 rounded-2xl bg-secondary/20 hover:bg-secondary/40 border border-border/40 transition-colors duration-200 cursor-pointer h-36"
                       >
                         <div className="flex items-center gap-2 text-primary mb-2 opacity-80">
                           <TrendingUp className="w-4 h-4" />
                           <span className="text-xs font-semibold uppercase tracking-wider truncate">{news.source}</span>
                         </div>
                         <h3 className="text-sm font-medium line-clamp-3 text-foreground/90">
                           {news.title}
                         </h3>
                       </a>
                     ))}
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full bg-background/80 backdrop-blur-xl shrink-0 pt-2 pb-6 px-4">
          <div className="max-w-4xl mx-auto w-full">
            <UploadZone onImageSelect={handleSendMessage} isAnalyzing={isAnalyzing} />
          </div>
        </div>
      </SidebarInset>
    </>
  );
}

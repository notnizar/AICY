"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, ShieldCheck, Image as ImageIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { HistoryItem } from "./HistoryPanel";

interface AppSidebarProps {
  onSelectHistory?: (item: HistoryItem) => void;
  onNewAnalysis?: () => void;
  refreshTrigger?: number;
}

export function AppSidebar({ onSelectHistory, onNewAnalysis, refreshTrigger = 0 }: AppSidebarProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("ai_detector_history");
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [refreshTrigger]);

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
      localStorage.removeItem("ai_detector_history");
      setHistory([]);
      if (onNewAnalysis) onNewAnalysis();
    }
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-6 py-4 flex flex-row items-center gap-2 font-medium text-xl">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <span className="font-outfit">DeepScan</span>
      </SidebarHeader>
      
      <SidebarContent className="px-3 gap-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={onNewAnalysis} 
                  className="cursor-pointer bg-secondary/50 hover:bg-secondary rounded-full px-4 py-6 font-medium transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  New Analysis
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {history.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Recent
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {history.sort((a, b) => b.timestamp - a.timestamp).map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton 
                      onClick={() => onSelectHistory?.(item)} 
                      className="cursor-pointer rounded-full hover:bg-secondary/80 px-4 py-2 h-auto"
                    >
                      <ImageIcon className="w-4 h-4 mr-2 shrink-0 opacity-70" />
                      <div className="flex flex-col truncate">
                        <span className="truncate text-sm font-medium">
                          {item.verdict === "Real" ? "Authentic Media" : "AI Generated"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {item.confidence}% confidence
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {history.length > 0 && (
        <SidebarFooter className="p-4">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" 
            onClick={clearHistory}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Activity
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

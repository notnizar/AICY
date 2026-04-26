"use client";

import React, { useEffect, useState } from "react";
import { History, Trash2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { AnalysisData } from "./AnalysisResult";

export interface HistoryItem extends AnalysisData {
  id: string;
  timestamp: number;
}

interface HistoryPanelProps {
  onSelectHistory?: (item: HistoryItem) => void;
  refreshTrigger?: number; // Used to trigger a re-fetch when new item is added
}

export function HistoryPanel({ onSelectHistory, refreshTrigger = 0 }: HistoryPanelProps) {
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
    localStorage.removeItem("ai_detector_history");
    setHistory([]);
  };

  if (history.length === 0) {
    return null; // Don't show if empty
  }

  return (
    <div className="w-full lg:w-[400px] shrink-0 sticky top-8">
      <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Past Analyses
          </CardTitle>
          <AlertDialog>
            <AlertDialogTrigger 
              render={
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </Button>
              } 
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear History</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to clear all your past analyses? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] md:h-[600px]">
            <div className="flex flex-col">
              {history.sort((a, b) => b.timestamp - a.timestamp).map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <Separator className="opacity-50" />}
                  <div
                    className="group flex flex-col gap-2 p-5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onSelectHistory?.(item)}
                  >
                    <div className="flex justify-between items-start">
                      <Badge variant={item.verdict === "AI-Generated" ? "destructive" : "default"} className={item.verdict === "Real" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                        {item.verdict}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-semibold">{item.confidence}% Confidence</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {item.explanation}
                    </p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

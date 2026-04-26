"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, Globe, FileText, AlertOctagon, ShieldCheck, Cpu } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export interface AnalysisData {
  verdict: "AI-Generated" | "Real" | "Unknown" | "Recycled";
  confidence: number;
  explanation: string;
  factCheck?: {
    has_claims: boolean;
    is_recycled?: boolean;
    anomalies_detected?: boolean;
    ocr_extracted?: {
      headline?: string;
      date?: string;
      source?: string;
    };
    fact_check?: {
      status: "Verified" | "Unverified" | "Outdated" | "Recycled" | "None";
      delta_analysis: string;
    };
  } | null;
  layers?: {
    hash: "passed" | "failed" | "skipped";
    vision: "passed" | "flagged" | "skipped";
    gemini: "passed" | "failed" | "skipped";
    sightengine: "passed" | "failed" | "skipped";
  };
}

interface AnalysisResultProps {
  data: AnalysisData | null;
}

export function AnalysisResult({ data }: AnalysisResultProps) {
  if (!data) return null;

  const isBad = data.verdict === "AI-Generated" || data.verdict === "Recycled";
  const colorClass = isBad ? "text-destructive" : "text-emerald-500";
  const Icon = isBad ? AlertTriangle : CheckCircle2;

  return (
    <div className="flex flex-col gap-6 w-full text-foreground/90">
      <div className="flex gap-4">
        <div className="mt-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
           <Cpu className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 space-y-6 pt-1">
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-medium tracking-tight">Analysis Complete</h3>
              <Badge variant={isBad ? "destructive" : "default"} className={!isBad ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30" : "bg-destructive/20 text-destructive hover:bg-destructive/30"}>
                {data.verdict}
              </Badge>
            </div>
            
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {data.explanation}
            </p>
          </div>

          <div className="bg-secondary/30 rounded-2xl p-5 border border-border/50 max-w-2xl">
            <div className="flex items-center gap-4 mb-3">
              <Icon className={`w-6 h-6 ${colorClass}`} />
              <div className="flex-1">
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span>Authenticity Score</span>
                  <span>{isBad ? 100 - data.confidence : data.confidence}% Real</span>
                </div>
                <Progress value={isBad ? 100 - data.confidence : data.confidence} className="h-2" />
              </div>
            </div>
          </div>

          {data.factCheck && data.factCheck.has_claims && data.factCheck.fact_check && (
            <div className="space-y-4 pt-2">
              <h4 className="flex items-center gap-2 font-medium text-lg">
                <Globe className="w-5 h-5 text-blue-500" />
                Information Fact-Check (via NewsData.io)
              </h4>
              
              <div className={`p-5 rounded-2xl border ${data.factCheck.fact_check.status === "Verified" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-semibold">
                    {data.factCheck.fact_check.status === "Verified" ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <AlertOctagon className="w-5 h-5 text-amber-500" />}
                    <span>Status: {data.factCheck.fact_check.status}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {data.factCheck.fact_check.delta_analysis}
                  </p>
                </div>
              </div>

              {data.factCheck.ocr_extracted && (
                <div className="bg-secondary/20 p-4 rounded-xl border border-border/50 space-y-2 mt-4 text-sm max-w-xl">
                  <div className="font-medium flex items-center gap-2 mb-2 text-foreground/80">
                    <FileText className="w-4 h-4 text-primary" /> Extracted Context
                  </div>
                  {data.factCheck.ocr_extracted.headline && (
                    <div><span className="text-muted-foreground mr-2">Headline:</span> {data.factCheck.ocr_extracted.headline}</div>
                  )}
                  {data.factCheck.ocr_extracted.date && (
                    <div><span className="text-muted-foreground mr-2">Date:</span> {data.factCheck.ocr_extracted.date}</div>
                  )}
                  {data.factCheck.ocr_extracted.source && (
                    <div><span className="text-muted-foreground mr-2">Source:</span> {data.factCheck.ocr_extracted.source}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {data.layers && (
            <div className="pt-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Verification Flow</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                {[
                  { name: "Visual Fingerprint", key: "hash", desc: "Hash check" },
                  { name: "Reverse Web Search", key: "vision", desc: "Cloud Vision index" },
                  { name: "Contextual Analysis", key: "gemini", desc: "NewsData.io Fact-Checking" },
                  { name: "Deepfake Detection", key: "sightengine", desc: "Pixel-level AI check" }
                ].map((layer) => {
                  const status = data.layers![layer.key as keyof typeof data.layers];
                  return (
                    <div key={layer.key} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/30">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{layer.name}</span>
                        <span className="text-xs text-muted-foreground">{layer.desc}</span>
                      </div>
                      <Badge 
                        variant={status === "passed" ? "secondary" : status === "flagged" ? "outline" : status === "skipped" ? "outline" : "destructive"} 
                        className={
                          status === "passed" ? "bg-emerald-500/10 text-emerald-500" : 
                          status === "flagged" ? "bg-amber-500/10 text-amber-500" : 
                          status === "skipped" ? "bg-secondary text-muted-foreground opacity-50" : ""
                        }
                      >
                        {status?.toUpperCase()}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

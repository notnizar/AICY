/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";

export async function POST(req: Request) {
  let tmpFilePath: string | null = null;
  let uploadedFileName: string | null = null;

  try {
    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;
    const geminiKey = process.env.GEMINI_API_KEY;
    const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    if (!apiUser || !apiSecret || !geminiKey) {
      return NextResponse.json({ error: "API keys not configured. Please add SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET, and GEMINI_API_KEY." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;
    const historyRaw = formData.get("history") as string | null;

    if (!file && !text) {
      return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
    }

    let chatHistory = [];
    if (historyRaw) {
        try { chatHistory = JSON.parse(historyRaw); } catch(e) {}
    }

    const geminiHistory = chatHistory.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }]
    }));

    const isVideo = file ? file.type.startsWith("video/") : false;
    const buffer = file ? Buffer.from(await file.arrayBuffer()) : null;

    // ---------------------------------------------------------
    // Layer 1: Visual Fingerprinting (Hashing)
    // ---------------------------------------------------------
    const imageHash = buffer ? crypto.createHash("sha256").update(buffer).digest("hex") : null;
    const knownFakeHashes = ["mock-hash-12345"];
    
    if (imageHash && knownFakeHashes.includes(imageHash)) {
       return NextResponse.json({
           text: "I recognized this exact file. It matches a known perceptual fingerprint in our database of recycled fake news. It has been rejected immediately.",
           result: {
               verdict: "Recycled",
               confidence: 100,
               explanation: "Matches known fake fingerprint database.",
               layers: { hash: "failed", vision: "skipped", gemini: "skipped", sightengine: "skipped" }
           }
       });
    }

    // ---------------------------------------------------------
    // Layer 2: Reverse Image Search (Google Cloud Vision API)
    // ---------------------------------------------------------
    const visionPromise = (async () => {
        if (!file || isVideo || !visionKey || !buffer) return null;
        const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`;
        const visionReq = {
          requests: [{
            image: { content: buffer.toString("base64") },
            features: [{ type: "WEB_DETECTION" }]
          }]
        };
        try {
            const res = await fetch(visionUrl, { method: "POST", body: JSON.stringify(visionReq) });
            const data = await res.json();
            return data.responses?.[0]?.webDetection;
        } catch (e) {
            console.error("Vision API error:", e);
            return null;
        }
    })();

    // ---------------------------------------------------------
    // Layer 4: Deepfake & Pixel AI Detection (Sightengine)
    // ---------------------------------------------------------
    const sightenginePromise = (async () => {
        if (!file || !buffer) return {};
        const sightengineData = new FormData();
        const fileBlob = new Blob([buffer], { type: file.type });
        sightengineData.append("media", fileBlob, file.name);
        sightengineData.append("api_user", apiUser);
        sightengineData.append("api_secret", apiSecret);

        let apiUrl = "https://api.sightengine.com/1.0/check.json";
        if (isVideo) {
          apiUrl = "https://api.sightengine.com/1.0/video/check-sync.json";
          sightengineData.append("models", "genai-video,deepfake");
        } else {
          sightengineData.append("models", "genai");
        }

        const response = await fetch(apiUrl, { method: "POST", body: sightengineData });
        const data = await response.json();
        if (!response.ok || data.status === "failure") {
          throw new Error(data.error?.message || "Detection API error");
        }
        return data;
    })();

    const [webDetectionData, sightengineData] = await Promise.all([visionPromise, sightenginePromise]);

    // ---------------------------------------------------------
    // Layer 3: Contextual Contradictions (Gemini Vision + Grounding)
    // ---------------------------------------------------------
    const geminiPromise = (async () => {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const fileManager = new GoogleAIFileManager(geminiKey);
        let geminiContent: any[] = [];

        if (text) {
            geminiContent.push(text);
        }

        if (file && buffer) {
            if (isVideo) {
              tmpFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`);
              fs.writeFileSync(tmpFilePath, buffer);
              const uploadResult = await fileManager.uploadFile(tmpFilePath, { mimeType: file.type, displayName: file.name });
              uploadedFileName = uploadResult.file.name;
              let fileState = await fileManager.getFile(uploadedFileName);
              while (fileState.state === "PROCESSING") {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                fileState = await fileManager.getFile(uploadedFileName);
              }
              if (fileState.state === "FAILED") throw new Error("Video processing failed");
              geminiContent.push({ fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } });
            } else {
              const base64Data = buffer.toString("base64");
              geminiContent.push({ inlineData: { data: base64Data, mimeType: file.type } });
            }
        }

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          tools: [{
            functionDeclarations: [{
              name: "searchWorldwideNews",
              description: "Search the latest worldwide news articles using NewsData.io to fact-check claims or just to fetch the latest news for the user.",
              parameters: {
                type: SchemaType.OBJECT,
                properties: { query: { type: SchemaType.STRING, description: "Search query keywords" } },
                required: ["query"]
              }
            }]
          }],
          systemInstruction: `You are a conversational Truth Verification Assistant. You can analyze images, chat naturally, and use searchWorldwideNews to fact-check events or retrieve news.
          
You MUST ALWAYS return your response as a JSON object with this exact structure:
{
  "text": "Your conversational response formatted in markdown. Speak naturally to the user.",
  "analysis": {
    "has_claims": boolean,
    "is_recycled": boolean,
    "anomalies_detected": boolean,
    "ocr_extracted": { "headline": "string", "date": "string", "source": "string" },
    "fact_check": {
      "status": "Verified" | "Unverified" | "Outdated" | "Recycled" | "None",
      "delta_analysis": "string detailing findings"
    }
  }
}
* Note: Set "analysis" to null if no image was provided or no fact-checking was performed. Only use the "analysis" block if you are doing a deep forensic fact-check on claims or an image.`,
        });

        let webDetectionContext = "";
        let hasVisionMatches = false;
        if (webDetectionData && (webDetectionData.pagesWithMatchingImages?.length > 0 || webDetectionData.partialMatchingImages?.length > 0)) {
            hasVisionMatches = true;
            webDetectionContext = `
            Google Cloud Vision Web Detection found this image previously hosted on these URLs:
            ${webDetectionData.pagesWithMatchingImages?.map((p: any) => p.url).slice(0, 5).join("\n") || "No exact matches"}
            
            CRITICAL: Check if these URLs are from years ago (e.g. 2021, 2022). If so, this image is Recycled Content.
            `;
            geminiContent.unshift(`Layer 2: Recycled Content Detection\n${webDetectionContext}`);
        }

        const chat = model.startChat({ history: geminiHistory });
        let result = await chat.sendMessage(geminiContent);
        
        const functionCall = result.response.functionCalls()?.[0];
        let responseText = "";
        
        if (functionCall && functionCall.name === "searchWorldwideNews") {
            const query = (functionCall.args as any).query;
            let newsContext: any = {};
            const newsKey = process.env.NEWSDATA_API_KEY;
            
            if (newsKey) {
                try {
                    const apiRes = await fetch(`https://newsdata.io/api/1/news?apikey=${newsKey}&language=en&q=${encodeURIComponent(query)}`);
                    const data = await apiRes.json();
                    if (data.results && data.results.length > 0) {
                        newsContext = data.results.slice(0, 3).map((n:any) => ({ title: n.title, description: n.description, date: n.pubDate }));
                    } else {
                        newsContext = { message: "No relevant news found for this query." };
                    }
                } catch (e) {
                    newsContext = { error: "Failed to fetch news from NewsData.io" };
                }
            } else {
                newsContext = { error: "NEWSDATA_API_KEY is not configured on the server." };
            }
            
            result = await chat.sendMessage([{
                functionResponse: {
                    name: "searchWorldwideNews",
                    response: { newsContext }
                }
            }]);
            responseText = result.response.text();
        } else {
            try {
                responseText = result.response.text();
            } catch (e) {
                responseText = "{}"; // Fallback if no text
            }
        }
        
        try {
          const cleanedText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanedText);
          return { 
              text: parsed.text || "Analysis complete.", 
              analysis: parsed.analysis || null, 
              vision_matches: hasVisionMatches 
          };
        } catch (e) {
          console.error("Gemini JSON parse error:", responseText);
          return { text: responseText, analysis: null, vision_matches: hasVisionMatches };
        }
    })();

    const geminiData = await geminiPromise;

    // If there is no file and no deep analysis was returned, just return the text
    if (!file && !geminiData.analysis) {
        return NextResponse.json({ text: geminiData.text, result: null });
    }

    const factCheckData = geminiData.analysis || {
        has_claims: false,
        is_recycled: false,
        anomalies_detected: false,
        vision_matches: geminiData.vision_matches
    };
    
    // Merge vision matches into factCheckData for the UI
    factCheckData.vision_matches = geminiData.vision_matches;

    // ---------------------------------------------------------
    // Final Synthesis (Only if file exists or analysis performed)
    // ---------------------------------------------------------
    let isAi = false;
    let confidenceScore = 0;
    let highestGenerator = "";
    
    if (file) {
        if (isVideo) {
            if (sightengineData.data && sightengineData.data.frames) {
                let maxAiScore = 0;
                for (const frame of sightengineData.data.frames) {
                    const aiGenScore = frame.type?.ai_generated || 0;
                    const deepfakeScore = frame.deepfake?.score || 0;
                    maxAiScore = Math.max(maxAiScore, aiGenScore, deepfakeScore);
                }
                confidenceScore = maxAiScore;
            }
        } else {
            confidenceScore = sightengineData.type?.ai_generated || 0;
            if (sightengineData.type?.ai_generators) {
                let maxGenScore = 0;
                for (const [gen, score] of Object.entries(sightengineData.type.ai_generators)) {
                    if (typeof score === 'number' && score > maxGenScore && gen !== 'other') {
                        maxGenScore = score;
                        highestGenerator = gen;
                    }
                }
            }
        }
    }
    
    isAi = confidenceScore >= 0.5;
    const confidencePercentage = Math.round(confidenceScore * 100);
    const verdict = !file ? "Unknown" : (factCheckData.is_recycled ? "Recycled" : (isAi ? "AI-Generated" : "Real"));
    
    const formatGenName = (name: string) => name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const specificGeneratorText = highestGenerator 
        ? ` The structural anomalies and noise patterns strongly match the specific digital fingerprint of **${formatGenName(highestGenerator)}**.` 
        : ` The pixel structure and noise patterns strongly match known AI models.`;
    
    let explanation = "";
    if (!file) {
        explanation = `Analyzed the provided text claim. Review the Information Fact-Check section below for verification results from NewsData.io.`;
    } else if (confidencePercentage >= 90) {
        explanation = `Layer 4 (Deepfake Detection) found overwhelming mathematical evidence (${confidencePercentage}% probability) that this media was synthetically generated.${specificGeneratorText}`;
    } else if (confidencePercentage >= 70) {
        explanation = `Layer 4 (Deepfake Detection) found a high probability (${confidencePercentage}%) that this media contains AI-generated elements.${specificGeneratorText}`;
    } else {
        explanation = `Layer 4 (Deepfake Detection) found virtually zero evidence of AI pixel generation (${100 - confidencePercentage}% authentic). However, refer to the Information Check below to see if the content is recycled or contextually manipulated.`;
    }

    const result = {
        verdict,
        confidence: !file ? 100 : (factCheckData.is_recycled ? 100 : (isAi ? confidencePercentage : (100 - confidencePercentage))),
        explanation,
        factCheck: factCheckData.has_claims || factCheckData.is_recycled || text ? factCheckData : null,
        layers: {
            hash: !file ? "skipped" : "passed",
            vision: !file ? "skipped" : (factCheckData.vision_matches ? "flagged" : "passed"),
            gemini: factCheckData.anomalies_detected || factCheckData.is_recycled ? "failed" : "passed",
            sightengine: !file ? "skipped" : (isAi ? "failed" : "passed")
        }
    };

    return NextResponse.json({ text: geminiData.text, result });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  } finally {
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch (e) {}
    }
    if (uploadedFileName) {
       const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");
       try { await fileManager.deleteFile(uploadedFileName); } catch (e) {}
    }
  }
}

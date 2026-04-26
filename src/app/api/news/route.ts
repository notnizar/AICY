import { NextResponse } from "next/server";

export async function GET() {
  try {
    const newsKey = process.env.NEWSDATA_API_KEY;
    
    // If no key is configured, return some mock trending news so the UI still looks good
    if (!newsKey) {
      return NextResponse.json({
        news: [
          {
            title: "Global AI Summit announces new international safety standards",
            description: "Tech leaders from around the world have agreed on a new framework for artificial intelligence safety.",
            source: "Global Tech News"
          },
          {
            title: "Major breakthrough in quantum computing published",
            description: "Researchers have successfully demonstrated a scalable quantum processor capable of complex calculations.",
            source: "Science Daily"
          },
          {
            title: "International climate agreement sets ambitious new targets",
            description: "Nations pledge to significantly reduce emissions by the end of the decade in a historic global pact.",
            source: "World News Network"
          }
        ]
      });
    }

    const res = await fetch(`https://newsdata.io/api/1/news?apikey=${newsKey}&language=en&category=top`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const topNews = data.results.slice(0, 3).map((n: any) => ({
        title: n.title,
        description: n.description || "No description available.",
        source: n.source_id || "News",
        link: n.link
      }));
      return NextResponse.json({ news: topNews });
    } else {
      return NextResponse.json({ news: [] });
    }
  } catch (error) {
    console.error("News API Error:", error);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

type NewsItem = {
  title: string;
  description: string;
  source: string;
  link?: string;
};

const jordanTerms = ["الأردن", "Jordan", "عمّان", "عمان", "Amman", "الأردنية", "Jordanian"];

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function fetchRssNews(feedUrl: string, sourceName: string, terms: string[] = jordanTerms): Promise<NewsItem[]> {
  const res = await fetch(feedUrl, { cache: "no-store" });
  if (!res.ok) return [];

  const xml = await res.text();
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return itemMatches
    .map((item) => {
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] ?? item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[2] ?? "News";
    const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/)?.[1] ?? item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/)?.[2] ?? "No description available.";
    const link = item.match(/<link>(.*?)<\/link>/)?.[1];

    return {
      title: stripHtml(title),
      description: stripHtml(description),
      source: sourceName,
      link: link?.trim(),
    };
    })
    .filter((item) => terms.some((term) => `${item.title} ${item.description} ${item.source}`.toLowerCase().includes(term.toLowerCase())))
    .slice(0, 3);
}

async function fetchTechnologyFallbackNews(): Promise<NewsItem[]> {
  const fallbackFeeds = [
    {
      url: "https://news.google.com/rss/search?q=technology&hl=en&gl=US&ceid=US:en",
      source: "Google News Technology",
    },
    {
      url: "https://news.google.com/rss/search?q=artificial+intelligence&hl=en&gl=US&ceid=US:en",
      source: "Google News AI",
    },
  ];

  for (const feed of fallbackFeeds) {
      const items = await fetchRssNews(feed.url, feed.source, ["technology", "tech", "ai", "artificial intelligence", "startup", "gadgets", "software"]);
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

export async function GET() {
  try {
    const newsKey = process.env.FREENEWS_API_KEY;

    // If no key is configured, return a localized fallback so the UI still has content.
    if (newsKey) {
      try {
        const freeNewsUrl = `https://api.freenewsapi.io/v1/news?language=en&q=technology&apikey=${encodeURIComponent(newsKey)}`;
        const res = await fetch(freeNewsUrl, { cache: "no-store" });
        const data = await res.json();

        const items = data.news ?? data.articles ?? data.results ?? [];
        if (Array.isArray(items) && items.length > 0) {
          const topNews = items.slice(0, 3).map((n: { title?: string; description?: string; summary?: string; source?: string | { name?: string }; source_name?: string; url?: string; link?: string }) => ({
            title: n.title || "News",
            description: n.description || n.summary || "No description available.",
            source: typeof n.source === "string" ? n.source : n.source?.name || n.source_name || "FreeNewsAPI",
            link: n.url || n.link,
          }));

          return NextResponse.json({ news: topNews });
        }
      } catch (error) {
        console.error("FreeNewsAPI fallback error:", error);
      }
    }

    const fallbackItems = await fetchTechnologyFallbackNews();
    if (fallbackItems.length > 0) {
      return NextResponse.json({ news: fallbackItems });
    }

    return NextResponse.json({
      news: [
        {
          title: "No live news available right now",
          description: "The news provider is unavailable at the moment, so the app is showing a safe fallback message.",
          source: "AICY"
        }
      ]
    });
  } catch (error) {
    console.error("News API Error:", error);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}

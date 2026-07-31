import { NextRequest, NextResponse } from "next/server";
import { getShortsSourcesFromDB, getShortsSourceByKey } from "@/lib/shorts-sources-db";
import type { ShortDramaSource } from "@/types/shorts-source";

export interface ShortDrama {
  vod_id: number;
  vod_name: string;
  vod_pic: string;
  vod_remarks: string;
  vod_time: string;
  type_name: string;
}

export interface ShortsListResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  total: number;
  list: ShortDrama[];
  source: string;
  sources: { key: string; name: string }[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get("pg") || "1";
    const sourceKey = searchParams.get("source");

    // 从数据库获取短剧源配置
    let sources: ShortDramaSource[];
    try {
      sources = await getShortsSourcesFromDB();
    } catch {
      sources = [];
    }

    // 如果没有配置短剧源，返回错误
    if (sources.length === 0) {
      return NextResponse.json(
        { code: 404, msg: "暂未配置短剧源，请先在后台添加短剧源", data: null },
        { status: 404 }
      );
    }

    // 获取指定的资源站配置，默认使用第一个
    let source: ShortDramaSource | null = null;

    if (sourceKey) {
      try {
        source = await getShortsSourceByKey(sourceKey);
      } catch {
        source = sources.find((s) => s.key === sourceKey) || null;
      }
    }

    // 如果没有找到指定的源，使用第一个
    if (!source) {
      source = sources[0];
    }

    // 尝试当前源，失败时按顺序回退到下一个源
    let lastError: unknown = null;
    const startIndex = Math.max(0, sources.findIndex((s) => s.key === source!.key));
    for (let i = 0; i < sources.length; i++) {
      const candidate = sources[(startIndex + i) % sources.length];

      try {
        // 构建 API URL
        let apiUrl = `${candidate.api}?pg=${page}`;
        if (candidate.typeId) {
          apiUrl += `&t=${candidate.typeId}`;
        }

        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          next: { revalidate: 300 }, // 5分钟缓存
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.list || data.list.length === 0) {
          throw new Error("Empty list from source");
        }

        return NextResponse.json({
          code: 200,
          msg: "success",
          data: {
            page: data.page,
            pagecount: data.pagecount,
            total: data.total,
            list: data.list.map((item: ShortDrama) => ({
              vod_id: item.vod_id,
              vod_name: item.vod_name,
              vod_pic: item.vod_pic || "",
              vod_remarks: item.vod_remarks,
              vod_time: item.vod_time,
              type_name: item.type_name,
            })),
            source: candidate.key,
            sources: sources.map((s) => ({ key: s.key, name: s.name })),
          },
        });
      } catch (e) {
        lastError = e;
        console.error(
          `[Shorts List API] Source "${candidate.key}" failed, trying next:`,
          e
        );
      }
    }

    throw lastError || new Error("All sources failed");
  } catch (error) {
    console.error("[Shorts List API Error]", error);
    return NextResponse.json(
      { code: 500, msg: "获取短剧列表失败", data: null },
      { status: 500 }
    );
  }
}


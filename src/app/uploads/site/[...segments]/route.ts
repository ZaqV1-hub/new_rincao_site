import { extname } from "path";
import { NextResponse } from "next/server";
import { readUploadedSiteImage } from "@/lib/estancia-content-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveContentType(fileName: string) {
  switch (extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await context.params;
  const asset = readUploadedSiteImage(segments);

  if (!asset) {
    return NextResponse.json({ ok: false, error: { message: "Imagem não encontrada." } }, { status: 404 });
  }

  return new NextResponse(asset.bytes, {
    status: 200,
    headers: {
      "content-type": resolveContentType(asset.filePath),
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

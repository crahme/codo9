import { NextResponse } from "next/server";

// Server-side proxy to force a file download with proper headers.
// Usage: GET /api/download?url=https%3A%2F%2Fimages.ctfassets.net%2F...%2Ffile.pdf
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing 'url' query param" }, { status: 400 });
    }

    let parsed;
    try {
      parsed = new URL(fileUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Whitelist allowed hosts to avoid open proxy misuse
    const allowedHost = /^(?:images|assets)\.ctfassets\.net$/i;
    if (!allowedHost.test(parsed.hostname)) {
      return NextResponse.json({ error: "Forbidden host" }, { status: 403 });
    }

    const upstream = await fetch(fileUrl, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status} ${upstream.statusText}` },
        { status: upstream.status }
      );
    }

    // Derive filename from Content-Disposition or URL path
    const disposition = upstream.headers.get("content-disposition");
    let filename = parsed.pathname.split("/").pop() || "file.pdf";
    if (disposition) {
      const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (m && m[1]) {
        filename = m[1].replace(/^\"|\"$/g, "");
      }
    }
    if (!/\.[a-z0-9]+$/i.test(filename)) {
      // Default to .pdf if no extension
      filename = `${filename}.pdf`;
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/pdf");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("/api/download error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

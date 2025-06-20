"use client";

import NextError from "next/error";

export default function GlobalError({ error }) {
  return (
    <html>
      <body>
        <NextError statusCode={0} />
        {process.env.NODE_ENV !== "production" && (
          <pre style={{
            color: "red",
            background: "#fff0f0",
            padding: "1em",
            borderRadius: "4px",
            marginTop: "2em",
            maxWidth: "80vw",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all"
          }}>
            {error?.message || String(error)}
          </pre>
        )}
      </body>
    </html>
  );
}

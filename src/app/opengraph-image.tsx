import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Mississauga Drop-In logo: a map pin with the Mississauga skyline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 48,
          padding: "0 88px",
          background: "#ffffff",
          borderBottom: "16px solid #d52b1e",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse only renders plain img */}
        <img src={`data:image/svg+xml;base64,${logo}`} width={260} height={260} alt="" />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 70, color: "#111418" }}>Mississauga Drop-In</div>
          <div style={{ fontSize: 38, color: "#4a5058", marginTop: 20, lineHeight: 1.3 }}>
            Drop-in swims, skates and sports at Mississauga community centres, with live spots left.
          </div>
          <div style={{ fontSize: 30, color: "#d52b1e", marginTop: 32 }}>mississaugadropin.com</div>
        </div>
      </div>
    ),
    size,
  );
}

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ExternalLink } from "@/components/ExternalLink";
import "./globals.css";

const REPO_URL = "https://github.com/shivam183/mississauga-drop-in";
const SITE_URL = "https://mississaugadropin.com";
const DESCRIPTION =
  "Find drop-in and online-enrollable recreation programs in Mississauga, with times, centres and spots left. Unofficial; not affiliated with the City of Mississauga.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Mississauga Drop-In", template: "%s · Mississauga Drop-In" },
  description: DESCRIPTION,
  // Every filter URL (?q=, ?type=, ?collapsed=…) is the same page to Google.
  alternates: { canonical: "/" },
  // The preview shown when a link is pasted into Reddit, chats, etc.
  openGraph: {
    type: "website",
    siteName: "Mississauga Drop-In",
    title: "Mississauga Drop-In: find drop-in sports and swims near you",
    description: DESCRIPTION,
    url: "/",
    locale: "en_CA",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111418" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA">
      <body>
        <a href="#main" className="skip-link">
          Skip to results
        </a>
        <header className="site-header">
          <div className="container site-header-inner">
            <Link href="/" className="site-name">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG gains nothing from next/image */}
              <img src="/icon.svg" alt="" width={28} height={28} />
              Mississauga Drop-In
            </Link>
            <ExternalLink
              href={REPO_URL}
              className="repo-link"
              aria-label="Source code on GitHub (opens in a new tab)"
              title="Source code on GitHub"
            >
              <svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
            </ExternalLink>
          </div>
        </header>
        <main id="main" className="container">
          {children}
        </main>
        <footer className="site-footer">
          <div className="container">
            <p>
              Unofficial and not affiliated with the City of Mississauga. Schedules and spots come
              from the City&rsquo;s{" "}
              <ExternalLink href="https://anc.ca.apm.activecommunities.com/activemississauga/home">
                ActiveMississauga
              </ExternalLink>{" "}
              site, where all enrollment happens. Always check there before you go.
            </p>
            <p>
              Something wrong or missing?{" "}
              <ExternalLink href="https://github.com/shivam183/mississauga-drop-in/issues/new/choose">
                Report a problem or suggest an idea
              </ExternalLink>
              .
            </p>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

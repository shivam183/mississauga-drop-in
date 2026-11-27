import { describe, expect, it } from "vitest";
import { noticeToText, safeCityUrl } from "@/models/links";

describe("safeCityUrl", () => {
  it.each([
    "https://anc.ca.apm.activecommunities.com/activemississauga/activity/search/enroll/164373?locale=en-US",
    "https://ca.apm.activecommunities.com/activemississauga/Activity_Search/drop-in-adult-pickleball/155514",
  ])("allows the City's ActiveNet links: %s", (url) => {
    expect(safeCityUrl(url)).toBe(url);
  });

  it.each([
    ["http (not https)", "http://ca.apm.activecommunities.com/x"],
    ["another domain", "https://example.com/activemississauga"],
    ["a look-alike domain", "https://activecommunities.com.evil.example/x"],
    ["a suffix trick", "https://evilactivecommunities.com/x"],
    ["credentials", "https://user:pass@ca.apm.activecommunities.com/x"],
    ["a custom port", "https://ca.apm.activecommunities.com:8443/x"],
    ["javascript:", "javascript:alert(1)"],
    ["not a URL", "not a url"],
    ["not a string", 42],
    ["null", null],
  ])("rejects %s", (_label, url) => {
    expect(safeCityUrl(url)).toBeNull();
  });
});

describe("noticeToText", () => {
  it("strips the HTML in the City's 'full' notice", () => {
    expect(
      noticeToText(
        "<div>This activity is full and is not able to accept any more enrollments.</div><div><br></div>",
      ),
    ).toBe("This activity is full and is not able to accept any more enrollments.");
  });

  it("keeps words apart where a block opens mid-text (a registered program's note)", () => {
    expect(
      noticeToText(
        "Program runs in the MATTAMY DOME at Churchill Meadows CC<div>Program runs 7:30am - 9am     </div>",
      ),
    ).toBe("Program runs in the MATTAMY DOME at Churchill Meadows CC Program runs 7:30am - 9am");
    expect(noticeToText('One<p class="x">Two</p><li>Three')).toBe("One Two Three");
  });

  it("decodes entities and collapses whitespace", () => {
    expect(noticeToText("We&#39;re sorry &amp; <b>it&rsquo;s</b>\n over&nbsp;&#x21;")).toBe(
      "We're sorry & it’s over !",
    );
  });

  it("drops scripts and never returns markup", () => {
    const text = noticeToText(
      '<script>alert("x")</script><img src=x onerror=alert(1)>Hi &lt;b&gt;',
    );
    expect(text).toBe("Hi <b>");
    expect(text).not.toContain("alert");
  });

  it.each([
    "<scr<script>x</script>ipt>alert(1)</script>",
    "<<b>script>alert(1)<</b>/script>",
    "<scr<b>ipt>alert(1)</scr<i>ipt>",
    "<img<b> src=x onerror=alert(1)>",
    "Hi <script src=x",
    "<b>Hi</b> <scr<i>ipt",
    "Hi </script",
  ])("leaves no tag or tag start behind: %s", (html) => {
    const text = noticeToText(html);
    expect(text).not.toMatch(/<[a-z/!?]/i); // leftover words are fine: it renders as text
  });

  it("keeps a plain '<' in text", () => {
    expect(noticeToText("Ages < 12 with an adult")).toBe("Ages < 12 with an adult");
  });

  it("leaves plain text and unknown entities alone", () => {
    expect(noticeToText("Admittance is first come-first served. &bogus;")).toBe(
      "Admittance is first come-first served. &bogus;",
    );
    expect(noticeToText(undefined)).toBe("");
  });
});

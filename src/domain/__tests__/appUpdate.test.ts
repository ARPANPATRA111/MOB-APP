import { compareVersions, pendingUpdateFor, readManifest } from "../appUpdate";

describe("app update announcements", () => {
  it("compares versions numerically", () => {
    expect(compareVersions("2.10.0", "2.9.9")).toBe(1);
    expect(compareVersions("2.3.0", "2.3")).toBe(0);
    expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
  });
  it("ignores malformed manifests and insecure links", () => {
    expect(readManifest(null)).toBeNull();
    expect(readManifest({ latestVersion: "soon" })).toBeNull();
    expect(readManifest({ latestVersion: "2.4.0", url: "http://x" })?.url).toBeUndefined();
  });
  it("only reports newer versions and flags unsupported ones", () => {
    const manifest = readManifest({ latestVersion: "2.4.0", minSupportedVersion: "2.3.0" })!;
    expect(pendingUpdateFor("2.4.0", manifest)).toBeNull();
    expect(pendingUpdateFor("2.3.0", manifest)?.important).toBe(false);
    expect(pendingUpdateFor("2.2.0", manifest)?.important).toBe(true);
  });
});

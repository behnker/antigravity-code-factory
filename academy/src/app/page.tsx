import { AcademyShell } from "@/components/AcademyShell";
import { HARNESS_DIMENSIONS } from "@/data/harness-comparison";
import { getRepoManifest } from "@/lib/repository";

export default function AcademyHomePage() {
  const manifest = getRepoManifest();

  return (
    <AcademyShell
      manifest={manifest}
      harnessDimensions={HARNESS_DIMENSIONS}
    />
  );
}

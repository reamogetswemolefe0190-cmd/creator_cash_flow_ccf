import path from "node:path";
import { pathToFileURL } from "node:url";

const workspaceDir = "C:/Users/User/OneDrive/Desktop/New folder (2)";
const skillDir = "C:/Users/User/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href,
);

const result = await finalizePresentation({
  explicitTotalSlideCount: 13,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [10],
  materializeLiteralChartWorkbooks: true,
  workspaceDir,
  candidatePath: path.join(workspaceDir, ".codex-finalizer", "ccf-pitch-candidate-final.pptx"),
  finalPath: path.join(workspaceDir, ".pitch-output", "Creator_Cash_Flow_Pilot_Pitch_Final.pptx"),
  pythonExecutable: "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  fontPolicy: { basis: "design", families: [resolvePresentationFont({ fontFamily: "Arial" })] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "Creator_Cash_Flow_Pilot_Pitch_Final.validation.json"),
});

console.log(JSON.stringify(result, null, 2));

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:/Users/User/OneDrive/Desktop/New folder (2)";
const SKILL_DIR = "C:/Users/User/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const TMP_DIR = path.join(workspaceDir, ".pitch-build");
const FINAL_PPTX = path.join(workspaceDir, ".pitch-output", "Creator_Cash_Flow_Pilot_Pitch_Final.pptx");
const shots = path.join(workspaceDir, ".pitch-build", "shots");
const { resolvePresentationFont, applyPresentationChartFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href,
);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

const font = resolvePresentationFont({ fontFamily: "Arial" });
console.log("stage: initialized");
const W = 1280;
const H = 720;
const C = {
  bg: "#0B110C",
  panel: "#121A13",
  panel2: "#19251A",
  line: "#2A382C",
  white: "#F4F7EF",
  muted: "#A4B09F",
  lime: "#D4F973",
  mint: "#8FE3CF",
  sand: "#FFD09A",
  ink: "#172016",
  paper: "#F1F4E9",
  green: "#6D9738",
};

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
console.log("stage: presentation-created");

function rect(slide, x, y, w, h, fill, radius = 0, line = "none") {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: line === "none" ? { fill: "none", width: 0 } : { fill: line, width: 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function line(slide, x, y, w, h, color = C.line, width = 1) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: color, width },
  });
}

function text(slide, value, x, y, w, h, size = 24, color = C.white, bold = false, align = "left") {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: font,
    fontSize: size,
    bold,
    color,
    alignment: align,
    verticalAlignment: "middle",
    autoFit: "shrinkText",
  };
  return shape;
}

async function image(slide, file, x, y, w, h, options = {}) {
  const blob = await fs.readFile(file);
  return slide.images.add({
    blob,
    contentType: file.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png",
    alt: options.alt ?? "Creator Cash Flow product screenshot",
    position: { left: x, top: y, width: w, height: h },
    fit: options.fit ?? "cover",
    ...(options.crop ? { crop: options.crop } : {}),
    ...(options.radius ? { geometry: "roundRect", borderRadius: options.radius } : {}),
  });
}

async function logo(slide, dark = true, x = 54, y = 32, w = 124, h = 44) {
  const file = dark ? "approved-logo-paper.png" : "approved-logo-ink.png";
  await image(slide, path.join(workspaceDir, "brand", file), x, y, w, h, { fit: "contain", alt: "Creator Cash Flow logo" });
}

async function base(dark = true, page = 1) {
  const slide = presentation.slides.add();
  slide.background.fill = dark ? C.bg : C.paper;
  await logo(slide, dark);
  text(slide, String(page).padStart(2, "0"), 1170, 36, 56, 26, 13, dark ? C.muted : "#6B7667", true, "right");
  return slide;
}

function eyebrow(slide, value, x, y, w, color = C.lime) {
  text(slide, value.toUpperCase(), x, y, w, 26, 13, color, true);
}

function title(slide, value, x = 64, y = 92, w = 1120, size = 48, color = C.white) {
  text(slide, value, x, y, w, 78, size, color, true);
}

function note(slide, value) {
  slide.speakerNotes.textFrame.setText(value);
}

function statement(slide, value, x, y, w, h, accent = C.lime) {
  line(slide, x, y + 4, 4, h - 8, accent, 4);
  text(slide, value, x + 24, y, w - 24, h, 24, C.white, true);
}

async function addScreenshotFrame(slide, file, x, y, w, h, crop, alt) {
  rect(slide, x - 8, y - 8, w + 16, h + 16, C.panel, 20, C.line);
  await image(slide, file, x, y, w, h, { crop, radius: 14, alt });
}

// 1. Cover
console.log("stage: slide-1");
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  await logo(slide, true, 64, 46, 156, 54);
  eyebrow(slide, "Pilot partnership deck", 66, 174, 420);
  text(slide, "Creator Cash Flow", 62, 208, 760, 92, 74, C.white, true);
  text(slide, "Campaign operations for agencies, brands and creators", 66, 312, 690, 90, 34, C.muted, false);
  line(slide, 66, 445, 520, 0, C.line, 2);
  text(slide, "A live product, a focused pilot and a path to trusted campaign reporting", 66, 472, 650, 72, 22, C.white, false);
  rect(slide, 850, 135, 310, 420, C.panel2, 28, C.line);
  text(slide, "ONE CAMPAIGN", 886, 175, 230, 26, 13, C.lime, true);
  text(slide, "Brand", 886, 240, 230, 34, 28, C.sand, true);
  line(slide, 902, 281, 0, 44, C.line, 2);
  text(slide, "Agency", 886, 330, 230, 34, 28, C.mint, true);
  line(slide, 902, 371, 0, 44, C.line, 2);
  text(slide, "Creator", 886, 420, 230, 34, 28, C.lime, true);
  text(slide, "Brief to payment status", 886, 500, 230, 28, 16, C.muted, false);
  text(slide, "September 2026", 66, 644, 260, 28, 16, C.muted, false);
  note(slide, "Creator Cash Flow brings the campaign, the people, the proof and the payment status into one shared operating layer. This deck presents the live pilot experience and clearly labels planned capabilities.");
}

// 2. Market context
console.log("stage: slide-2");
{
  const slide = await base(true, 2);
  eyebrow(slide, "Market context", 64, 112, 300);
  title(slide, "Creator marketing is becoming an operating challenge", 64, 142, 1120, 48);
  text(slide, "$480B", 66, 276, 430, 110, 88, C.lime, true);
  text(slide, "estimated creator economy by 2027", 70, 380, 430, 50, 24, C.white, false);
  text(slide, "$250B estimated in 2023", 70, 438, 430, 34, 18, C.muted, false);
  line(slide, 566, 264, 0, 260, C.line, 2);
  text(slide, "Brand deals account for about 70% of creator revenue in the research cited by Goldman Sachs.", 628, 276, 520, 100, 30, C.white, true);
  statement(slide, "More campaign spend means more briefs, approvals, reporting requests and payment coordination.", 628, 416, 520, 98, C.mint);
  text(slide, "Source: Goldman Sachs Research, 19 April 2023", 70, 638, 640, 24, 14, C.muted, false);
  note(slide, "Goldman Sachs Research estimated that the creator economy could grow from $250 billion in 2023 to $480 billion by 2027. The same article states that brand deals account for about 70% of creator revenue. Source: https://www.goldmansachs.com/insights/articles/the-creator-economy-could-approach-half-a-trillion-dollars-by-2027");
}

// 3. Problem
console.log("stage: slide-3");
{
  const slide = await base(true, 3);
  eyebrow(slide, "The operating problem", 64, 108, 340);
  title(slide, "Campaign operations are fragmented", 64, 140, 930, 50);
  const steps = [
    ["01", "Brief", "Scope and usage rights live in documents"],
    ["02", "Creator team", "Roster decisions happen in spreadsheets"],
    ["03", "Approvals", "Feedback moves through chat and email"],
    ["04", "Proof and payment", "Performance and invoices arrive later"],
  ];
  steps.forEach((s, i) => {
    const x = 66 + i * 298;
    text(slide, s[0], x, 262, 70, 42, 30, [C.sand, C.mint, C.lime, C.white][i], true);
    line(slide, x, 320, 244, 0, C.line, 2);
    text(slide, s[1], x, 342, 245, 44, 27, C.white, true);
    text(slide, s[2], x, 398, 245, 90, 19, C.muted, false);
  });
  statement(slide, "No participant sees the same campaign state at the same time.", 66, 548, 850, 64, C.lime);
  text(slide, "The cost shows up as follow-ups, slow approvals, disputed results and delayed payment decisions.", 66, 620, 1100, 38, 19, C.muted, false);
  note(slide, "Most teams already have messaging, spreadsheets and analytics. The missing layer is a shared campaign record that connects the work across those tools.");
}

// 4. Solution architecture
console.log("stage: slide-4");
{
  const slide = await base(false, 4);
  eyebrow(slide, "The CCF model", 64, 108, 280, C.green);
  title(slide, "One campaign record with controlled views", 64, 140, 980, 48, C.ink);
  rect(slide, 458, 264, 364, 178, "#1A251A", 24, "#314333");
  text(slide, "SHARED CAMPAIGN", 500, 292, 280, 28, 13, C.lime, true, "center");
  text(slide, "Brief\nDeliverables\nMilestones\nPayment status", 500, 334, 280, 90, 25, C.white, true, "center");
  const roles = [
    { x: 74, color: C.lime, title: "Creator", body: "Own fee, tasks, content and invoice" },
    { x: 844, color: C.mint, title: "Agency", body: "Roster, review queue and campaign budget" },
    { x: 844, y: 486, color: C.sand, title: "Brand", body: "Campaign spend, approvals and performance" },
  ];
  rect(slide, 70, 292, 300, 130, "#E9F6C9", 20, "#B5D866");
  text(slide, roles[0].title, 98, 312, 250, 35, 28, C.ink, true);
  text(slide, roles[0].body, 98, 356, 240, 48, 18, "#465340", false);
  rect(slide, 910, 246, 300, 130, "#DDF4EE", 20, "#8FCFBE");
  text(slide, roles[1].title, 938, 266, 250, 35, 28, C.ink, true);
  text(slide, roles[1].body, 938, 310, 240, 48, 18, "#465340", false);
  rect(slide, 910, 438, 300, 130, "#F8E6CC", 20, "#DFB87F");
  text(slide, roles[2].title, 938, 458, 250, 35, 28, C.ink, true);
  text(slide, roles[2].body, 938, 502, 240, 48, 18, "#465340", false);
  line(slide, 370, 357, 88, 0, "#8AA05F", 2);
  line(slide, 822, 319, 88, 0, "#76AF9E", 2);
  line(slide, 822, 411, 48, 0, "#B9925F", 2);
  line(slide, 870, 411, 0, 92, "#B9925F", 2);
  text(slide, "Creator consent limits social data to the campaign. Personal income and unrelated work stay private.", 70, 612, 1120, 44, 20, "#4E5C49", false, "center");
  note(slide, "Creator Cash Flow gives each participant the information needed for the campaign without opening the creator's full business to an agency or brand. Social account access remains creator controlled. Phyllo currently runs in sandbox validation.");
}

// 5. Pilot onboarding
console.log("stage: slide-5");
{
  const slide = await base(true, 5);
  eyebrow(slide, "Pilot entry", 64, 105, 260);
  title(slide, "Creators know what they are joining", 64, 137, 430, 43);
  text(slide, "Creators enter a private workspace with a clear three-step path.", 66, 216, 440, 58, 23, C.muted, false);
  statement(slide, "Real account records stay separate from sample campaign data.", 66, 304, 420, 72, C.lime);
  statement(slide, "The pilot requires no card and keeps social access under creator consent.", 66, 405, 420, 92, C.mint);
  await addScreenshotFrame(slide, path.join(shots, "creator-signup-desktop.png"), 548, 170, 660, 470, { top: 0.05, bottom: 0.05, left: 0, right: 0 }, "Creator Cash Flow pilot signup screen");
  note(slide, "The onboarding screen sets expectations before registration. Creator accounts are free during the current release. Agency and brand participation is handled through the pilot rather than self-service onboarding.");
}

async function roleSlide(page, role, titleText, accent, screenshotName, body, outcomes) {
  const slide = await base(true, page);
  eyebrow(slide, `${role} workflow`, 64, 104, 320, accent);
  title(slide, titleText, 64, 136, 470, 45);
  text(slide, body, 66, 230, 410, 94, 22, C.muted, false);
  outcomes.forEach((item, i) => {
    text(slide, String(i + 1).padStart(2, "0"), 68, 360 + i * 76, 52, 34, 22, accent, true);
    text(slide, item, 132, 350 + i * 76, 350, 54, 20, C.white, true);
  });
  await addScreenshotFrame(slide, path.join(shots, screenshotName), 532, 128, 680, 520, { top: 0.09, bottom: 0.16, left: 0, right: 0 }, `${role} workspace screenshot`);
  return slide;
}

// 6. Creator
console.log("stage: slide-6");
{
  const slide = await roleSlide(6, "Creator", "Creators know what needs attention", C.lime, "pilot-demo-creator.png", "The creator sees the fee, deliverable deadline, campaign conversation and upcoming payment in one view.", ["Accept the scope with the fee visible", "Submit work inside the campaign", "Track approval and invoice status"]);
  note(slide, "The creator view removes the need to chase context across messages. The demo shows sample data. Live creator accounts currently support authentication and personal transaction records.");
}

// 7. Agency
console.log("stage: slide-7");
{
  const slide = await roleSlide(7, "Agency", "Agencies run the handoffs", C.mint, "pilot-demo-agency.png", "The manager sees the active portfolio, roster status and review queue before work reaches the brand.", ["Match creators to the agreed brief", "Consolidate feedback before brand review", "Monitor every campaign decision"]);
  note(slide, "The agency becomes the operational centre of the campaign without owning the creator's private data. Agency access is currently an early access pilot rather than a self-service live account.");
}

// 8. Brand
console.log("stage: slide-8");
{
  const slide = await roleSlide(8, "Brand", "Brands see progress without chasing updates", C.sand, "pilot-demo-brand.png", "The brand sees committed spend, final approvals and campaign performance inside the same record used by the agency.", ["Approve deliverables against the brief", "See campaign-scoped performance", "Confirm milestone and payment decisions"]);
  note(slide, "The brand sees campaign evidence and approval state without access to a creator's unrelated income or campaigns. Brand access is currently part of the pilot.");
}

// 9. Shared campaign
console.log("stage: slide-9");
{
  const slide = await base(true, 9);
  eyebrow(slide, "Shared workflow", 64, 104, 300);
  title(slide, "One decision trail for every role", 64, 136, 470, 46);
  text(slide, "Six handoffs connect the brief to payment status. Each role sees the same stage and owns a clear next action.", 66, 214, 500, 70, 22, C.muted, false);
  const stages = ["Brief", "Team", "Create", "Agency review", "Brand approval", "Payment status"];
  stages.forEach((s, i) => {
    const x = 66 + i * 82;
    rect(slide, x, 320, 34, 34, i === 5 ? C.lime : C.panel2, 17, i === 5 ? C.lime : C.line);
    text(slide, i === 5 ? "6" : "✓", x, 320, 34, 34, 14, i === 5 ? C.ink : C.lime, true, "center");
    if (i < 5) line(slide, x + 34, 337, 48, 0, C.line, 2);
    text(slide, s, x - 12, 366, 70, 38, 13, C.white, true, "center");
  });
  text(slide, "The workflow keeps content approval separate from invoice payment.", 66, 458, 460, 64, 24, C.white, true);
  text(slide, "That distinction gives agencies and brands a reliable decision trail without making financial claims the platform cannot verify.", 66, 536, 455, 80, 19, C.muted, false);
  await addScreenshotFrame(slide, path.join(shots, "pilot-demo-journey-clean2.png"), 562, 176, 646, 470, undefined, "Shared campaign workflow screenshot");
  note(slide, "The shared campaign demo is interactive. A user can request a revision, submit a new version, send work to the brand, approve the deliverable and mark the sample invoice as sent. These actions remain in the browser and notify nobody.");
}

// 10. Planned report
console.log("stage: slide-10");
{
  const slide = await base(false, 10);
  eyebrow(slide, "Planned capability", 64, 104, 330, C.green);
  title(slide, "Campaign reports generated from the shared record", 64, 136, 1080, 44, C.ink);
  text(slide, "Illustrative concept for pilot validation", 66, 208, 450, 32, 18, "#6B7667", false);
  const chart = slide.charts.add("bar", {
    position: { left: 66, top: 284, width: 690, height: 322 },
    categories: ["Launch", "Week 1", "Week 2", "Week 3", "Final"],
    series: [{ name: "Verified views (thousands)", values: [12, 39, 71, 101, 128.4], fill: C.green }],
    barOptions: { direction: "column", grouping: "clustered" },
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd" },
  });
  applyPresentationChartFont(chart, { fontFamily: font });
  text(slide, "128.4K", 834, 272, 320, 70, 54, C.ink, true);
  text(slide, "illustrative verified views", 838, 338, 320, 30, 17, "#6A7565", false);
  line(slide, 836, 392, 340, 0, "#CCD3C6", 1);
  const reportItems = ["Executive summary for the client", "Deliverable performance by creator", "Milestones, approvals and spend", "Export to PDF and secure share link"];
  reportItems.forEach((item, i) => {
    text(slide, String(i + 1).padStart(2, "0"), 838, 414 + i * 48, 42, 30, 16, C.green, true);
    text(slide, item, 890, 408 + i * 48, 300, 38, 18, C.ink, i === 0);
  });
  text(slide, "Data shown here is illustrative. Report generation is not live in the current pilot.", 66, 644, 1110, 24, 14, "#717B6D", false);
  note(slide, "Planned report generation would turn the campaign record into a client-ready report. The example metrics are illustrative. The pilot should validate which report sections agencies and brands need before this feature is built.");
}

// 11. Pilot design
console.log("stage: slide-11");
{
  const slide = await base(true, 11);
  eyebrow(slide, "Proposed pilot", 64, 104, 280);
  title(slide, "An eight-week test of real campaign operations", 64, 136, 1040, 46);
  const phases = [
    ["Weeks 1–2", "Set up", "Choose one agency, one brand campaign and a small creator group."],
    ["Weeks 3–6", "Run the campaign", "Use CCF for the brief, assignments, feedback, approvals and milestone status."],
    ["Weeks 7–8", "Review evidence", "Compare turnaround, follow-ups, data trust and reporting needs."],
  ];
  phases.forEach((p, i) => {
    const x = 66 + i * 398;
    text(slide, p[0], x, 274, 350, 28, 15, [C.lime, C.mint, C.sand][i], true);
    line(slide, x, 316, 330, 0, [C.lime, C.mint, C.sand][i], 3);
    text(slide, p[1], x, 344, 330, 42, 29, C.white, true);
    text(slide, p[2], x, 398, 330, 100, 19, C.muted, false);
  });
  text(slide, "Pilot measures", 66, 548, 260, 34, 24, C.white, true);
  text(slide, "Approval turnaround", 348, 548, 210, 34, 18, C.lime, true);
  text(slide, "Follow-up volume", 584, 548, 200, 34, 18, C.mint, true);
  text(slide, "Creator adoption", 806, 548, 190, 34, 18, C.sand, true);
  text(slide, "Report usefulness", 1004, 548, 200, 34, 18, C.white, true);
  text(slide, "This is a proposed pilot structure. Scope and success thresholds should be agreed with each partner.", 66, 636, 1120, 28, 14, C.muted, false);
  note(slide, "The proposed pilot starts narrow so CCF can learn from real campaign behaviour. Success thresholds should be agreed with the pilot agency and brand before launch.");
}

// 12. Business model and capital
console.log("stage: slide-12");
{
  const slide = await base(false, 12);
  eyebrow(slide, "Commercial hypotheses", 64, 104, 360, C.green);
  title(slide, "Revenue follows the teams that coordinate and report", 64, 136, 1080, 44, C.ink);
  const columns = [
    ["Agency workspace", "Subscription hypothesis", "Roster management, campaign workflow and team collaboration."],
    ["Brand participation", "Campaign or workspace hypothesis", "Approvals, performance visibility and client reporting."],
    ["Premium capabilities", "Expansion hypothesis", "Production data connections, generated reports and deeper financial operations."],
  ];
  columns.forEach((c, i) => {
    const x = 66 + i * 398;
    text(slide, c[0], x, 278, 340, 42, 28, C.ink, true);
    text(slide, c[1].toUpperCase(), x, 330, 340, 24, 12, [C.green, "#4F9B89", "#A7753C"][i], true);
    line(slide, x, 374, 332, 0, "#CDD4C8", 1);
    text(slide, c[2], x, 398, 332, 100, 19, "#596555", false);
  });
  rect(slide, 66, 542, 1142, 88, "#172217", 18, "#304130");
  text(slide, "Capital priorities", 92, 562, 210, 34, 22, C.lime, true);
  text(slide, "Phyllo production access", 330, 556, 220, 46, 17, C.white, true);
  text(slide, "Security and privacy review", 564, 556, 240, 46, 17, C.white, true);
  text(slide, "Reporting and exports", 818, 556, 190, 46, 17, C.white, true);
  text(slide, "Pilot onboarding", 1010, 556, 170, 46, 17, C.white, true);
  text(slide, "Pricing and funding requirements remain hypotheses until the pilot produces usage and cost evidence.", 66, 650, 1120, 22, 14, "#697466", false);
  note(slide, "CCF has not set public agency or brand pricing. The pilot should test willingness to pay and identify the buyer. Capital would fund production social-data access, security and privacy work, report generation and operational onboarding.");
}

// 13. Ask
console.log("stage: slide-13");
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  await logo(slide, true, 64, 44, 156, 54);
  eyebrow(slide, "Partnership ask", 66, 146, 300);
  text(slide, "Help us prove the operating layer for creator campaigns", 64, 184, 860, 132, 58, C.white, true);
  const asks = [
    [C.mint, "Agency partners", "Run a live campaign and shape the manager workflow."],
    [C.sand, "Brand partners", "Test approvals, evidence and reporting access."],
    [C.lime, "Capital partners", "Fund the move from validated pilot to production infrastructure."],
  ];
  asks.forEach((a, i) => {
    const y = 362 + i * 74;
    line(slide, 68, y + 8, 5, 54, a[0], 5);
    text(slide, a[1], 94, y, 230, 38, 22, a[0], true);
    text(slide, a[2], 342, y, 650, 48, 19, C.white, false);
  });
  rect(slide, 948, 150, 260, 164, C.paper, 22, "#C9D2C5");
  text(slide, "CURRENT STATUS", 974, 174, 210, 24, 12, C.green, true);
  text(slide, "Creator accounts live\nMulti-role pilot demo live\nPhyllo sandbox configured", 974, 214, 210, 78, 17, C.ink, true);
  text(slide, "reamogetswemolefe@creatorcashflow.co.za", 66, 638, 570, 28, 18, C.lime, true);
  text(slide, "creator-cash-flow-ccf.onrender.com", 718, 638, 490, 28, 18, C.muted, false, "right");
  note(slide, "The immediate ask is for an agency willing to run a real pilot, a brand willing to use the campaign view and capital partners who understand the infrastructure needed to move from sandbox validation to production.");
}

const requirements = {
  // Native chart ownership is validated by the finalizer.
  explicitTotalSlideCount: 13,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [10],
};
const fontPolicy = { basis: "design", families: [font] };
const expectedSlideSizeEmu = "12192000,6858000";
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "ccf-pitch-candidate-final.pptx");
console.log("stage: slides-built", presentation.slides.length);
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
console.log("stage: candidate-exported");

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", expectedSlideSizeEmu,
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  materializeLiteralChartWorkbooks: true,
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Creator_Cash_Flow_Pilot_Pitch_Final.validation.json"),
});

console.log(JSON.stringify({ finalPath: FINAL_PPTX, result }, null, 2));

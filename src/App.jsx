// v3.5: Vitamins hub (all 13 fat- and water-soluble vitamins with function, deficiency, excess and RDA; cofactor vitamins linked to the enzymes, metabolites, cofactor cards and drug targets they work with; vitamin-to-vitamin links; vitamin replacement drugs).
// v3.4: Immune hub (immunoglobulin classes IgG, IgA, IgM, IgE, IgD with schematics, functions, clinical associations and NBME serum values; immune globulins, FcRn blockers, anti-CD20, anti-BAFF, anti-IgE and targeted-release budesonide linked to them; TNF, IL-6R, IL-1R, JAK and the glucocorticoid receptor cross-linked).
// v3.3: every element card has a Toxicity section (excess, deficiency, antidotes and drug adverse effects), searchable from the table and global search.
// v3.2: periodic table extended to the elements in drugs and diagnostic agents (He, Al, Ti, Ga, Rb, Sr, Y, Zr, Tc, Ag, In, Sn, Sb, Xe, Ba, La, Sm, Gd, Lu, Pt, Au, Tl, Bi, Ra): noble-gas and lanthanide rows, period 7, an "In drugs" section on every element card, and a drug-element filter in the legend.
// v3.1: Oncology hub (cytotoxic chemotherapy by mechanism and cell-cycle phase, rescue and supportive drugs, links to the hormonal and antiemetic targets on other hubs); DNA and metabolite targets; "alters" effect for cross-linkers and cleavers.
// v2.6: NBME reference ranges on every pertinent card (molecules, targets, drugs, organ hubs); full musculoskeletal pharmacology (bone, joint and gout, muscle) in the Skeletal hub.
// v2.5: renal hub covers the whole nephron (proximal tubule to collecting duct, glomerulus, juxtaglomerular cells, interstitium), each target with its membrane side / compartment.
// v2.4: cellular locations (compartment tags + filter) and Organ Hubs (renal, cardiovascular, respiratory, skeletal, GI, CNS, hepatic, endocrine) with settings toggles.
// v2.3: drugs show skeletal structures (representative drug per class); pharmacology layer (Rx) and its legend (L) toggle independently.
// omino.jsx (v1.1: Oworld look — Inter + mono, neutral black, sky accent, tab row, round header buttons; v1.0: + clickable co-substrates with structure cards: ATP/ADP/AMP/GTP/UTP, NAD(P)(H), FADH₂, CoA, H₂O, CO₂ …)  —  Omino, a spatial, searchable metabolic atlas
// Setup:  npm install reactflow            (v11.10 or newer, for colorMode)
// Usage:  import Omino from "./omino";  <Omino />
// The root fills the window (position: fixed). Change .omino-root if you embed it.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlowProvider,
  getBezierPath,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

/* ================================================================== */
/* 1. Skeletal structures                                              */
/*    Every molecule is atoms (x, y in px) + bonds. Carbons are        */
/*    implicit: an atom with no `text` is a skeletal vertex.           */
/* ================================================================== */

const CHALK = "#e8e8ec";
const OpenCtx = React.createContext(() => {}); // open(type, id): show an explanation card
const EL_COLOR = { O: "#ff7a7a", N: "#7fb0ff", P: "#ffb454", S: "#f2d95c", X: "#c7a8ff", M: "#ff9d5c", F: "#8ee0a0", Cl: "#6fe08c" };

const S = 40; // chair unit
const pt = (x, y) => [x * S, -y * S]; // y-up chemistry coords -> svg coords
const A = (id, [x, y], text, el, extra = {}) => ({ id, x, y, text, el, ...extra });
const C = (id, [x, y]) => ({ id, x, y });

/* β-D-glucopyranose, ⁴C₁ chair, all substituents equatorial */
const chair = {
  O5: pt(0.5, 0.553),
  C1: pt(1, -0.25),
  C2: pt(0.5, -0.053),
  C3: pt(-0.5, -0.553),
  C4: pt(-1, 0.25),
  C5: pt(-0.5, 0.053),
};
const chairAtoms = () => [
  A("O5", chair.O5, "O", "O"),
  C("C1", chair.C1), C("C2", chair.C2), C("C3", chair.C3), C("C4", chair.C4), C("C5", chair.C5),
  A("O1", pt(1.85, 0.05), "OH", "O", { align: "start" }),
  A("O2", pt(0.95, -0.773), "OH", "O", { align: "start" }),
  A("O3", pt(-1.35, -0.553), "HO", "O", { align: "end" }),
  A("O4", pt(-1.85, -0.05), "HO", "O", { align: "end" }),
  C("C6", pt(-0.9, 0.673)),
];
const chairBonds = [
  ["O5", "C1"], ["C1", "C2"], ["C2", "C3"], ["C3", "C4"], ["C4", "C5"], ["C5", "O5"],
  ["C1", "O1"], ["C2", "O2"], ["C3", "O3"], ["C4", "O4"], ["C5", "C6"], ["C6", "O6"],
];

/* Shared zigzag frame for the three-carbon acids (bond length 30px) */
const acidFrame = () => [
  C("C3", [26, 15]), C("C2", [52, 0]), C("C1", [78, 15]),
  A("O1a", [78, 45], "O", "O"),
  A("O1b", [104, 0], "O", "O", { q: "−" }),
];
const phosphate = () => [
  A("O2", [52, -30], "O", "O"),
  A("P", [52, -60], "P", "P"),
  A("Op1", [52, -90], "O", "O"),
  A("Op2", [22, -60], "O", "O", { q: "−", qd: [-8, -8] }),
  A("Op3", [82, -60], "O", "O", { q: "−" }),
];
const phosphateBonds = [["C2", "O2"], ["O2", "P"], ["P", "Op1", 2], ["P", "Op2"], ["P", "Op3"]];


/* ---- builders for the acyclic / furanose glycolysis intermediates ---- */
const rot = ([x, y], deg) => { const t = (deg * Math.PI) / 180; return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]; };
const unit = ([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
// phosphate (O–P(=O)(O−)2) hanging off `from` at [ax, ay], pointing along u
function phos(atoms, bonds, id, from, [ax, ay], [ux, uy]) {
  const at = (k) => [ax + ux * k, ay + uy * k], p = at(60), n = [-uy, ux];
  atoms.push(
    A(id + "o", at(30), "O", "O"), A(id + "p", p, "P", "P"), A(id + "d", at(90), "O", "O"),
    A(id + "m", [p[0] + n[0] * 30, p[1] + n[1] * 30], "O", "O", { q: "−", qd: [n[0] < 0 ? -8 : 8, -8] }),
    A(id + "n", [p[0] - n[0] * 30, p[1] - n[1] * 30], "O", "O", { q: "−", qd: [n[0] > 0 ? -8 : 8, -8] })
  );
  bonds.push([from, id + "o"], [id + "o", id + "p"], [id + "p", id + "d", 2], [id + "p", id + "m"], [id + "p", id + "n"]);
}
// zigzag backbone; subs = [[carbonIndex, "OH" | "=O" | "OP" | "COO" | "OPE"]]
function zig(n, subs, dx = 26, dbl = [], het = {}) {
  const atoms = [], bonds = [];
  for (let i = 0; i < n; i++) atoms.push(C(`c${i}`, [i * dx, i % 2 ? 0 : 15]));
  for (const i in het) atoms[i] = A(`c${i}`, [i * dx, i % 2 ? 0 : 15], het[i], "N");
  for (let i = 1; i < n; i++) bonds.push([`c${i - 1}`, `c${i}`]);
  for (const [i, k] of subs) {
    const c = atoms[i], d = i % 2 ? -1 : 1, id = `s${i}`, nx = [(i + 1) * dx, (i + 1) % 2 ? 0 : 15];
    if (k === "OH") { atoms.push(A(id, [c.x, c.y + 30 * d], "OH", "O")); bonds.push([c.id, id]); }
    if (k === "=O" || k === "COO") { atoms.push(A(id, [c.x, c.y + 30 * d], "O", "O")); bonds.push([c.id, id, 2]); }
    if (k === "COO") { atoms.push(A(id + "b", nx, "O", "O", { q: "−" })); bonds.push([c.id, id + "b"]); }
    if (k === "OP") phos(atoms, bonds, id, c.id, [c.x, c.y], [0, d]);
    if (k === "COOL") { atoms.push(A(id, [c.x, c.y + 30 * d], "O", "O"), A(id + "b", [c.x - dx, (i - 1) % 2 ? 0 : 15], "O", "O", { q: "−", qd: [-8, -8] })); bonds.push([c.id, id, 2], [c.id, id + "b"]); }
    if (k === "NH3") { atoms.push(A(id, [c.x, c.y + 30 * d], "NH3", "N", { q: "+", qd: [14, -8] })); bonds.push([c.id, id]); }
    if (k === "NH3e" || k === "NH2e") { atoms.push(A(id, nx, k === "NH3e" ? "NH3" : "NH2", "N", k === "NH3e" ? { q: "+", qd: [14, -8] } : {})); bonds.push([c.id, id]); }
    if (k === "=NH") { atoms.push(A(id, [c.x, c.y + 30 * d], "NH", "N")); bonds.push([c.id, id, 2]); }
    if (k === "NSUC") { const x = c.x, y = c.y; atoms.push(A(id, [x, y + 30], "N", "N"), C(id + "a", [x, y + 60]), C(id + "b", [x - 26, y + 75]), C(id + "c", [x + 26, y + 75]), A(id + "d", [x - 26, y + 105], "O", "O"), A(id + "e", [x - 52, y + 60], "O", "O", { q: "−", qd: [-8, -8] }), C(id + "f", [x + 52, y + 60]), A(id + "g", [x + 52, y + 30], "O", "O"), A(id + "h", [x + 78, y + 75], "O", "O", { q: "−" })); bonds.push([c.id, id, 2], [id, id + "a"], [id + "a", id + "b"], [id + "a", id + "c"], [id + "b", id + "d", 2], [id + "b", id + "e"], [id + "c", id + "f"], [id + "f", id + "g", 2], [id + "f", id + "h"]); }
    if (k === "EST") { const y = c.y; atoms.push(A(id, [c.x, y + 30 * d], "O", "O"), C(id + "c", [c.x, y + 60 * d]), A(id + "d", [c.x - 26, y + 75 * d], "O", "O"), A(id + "r", [c.x + 26, y + 75 * d], "R", "X", { align: "start" })); bonds.push([c.id, id], [id, id + "c"], [id + "c", id + "d", 2], [id + "c", id + "r"]); }
    if (k === "OHu") { atoms.push(A(id, [c.x, c.y - 30 * d], "OH", "O")); bonds.push([c.id, id]); }
    if (k === "COOB") { const cy = c.y + 30 * d; atoms.push(C(id + "c", [c.x, cy]), A(id + "a", [c.x - 26, cy + 15 * d], "O", "O"), A(id + "b", [c.x + 26, cy + 15 * d], "O", "O", { q: "−" })); bonds.push([c.id, id + "c"], [id + "c", id + "a", 2], [id + "c", id + "b"]); }
    if (k === "SCoA") { atoms.push(A(id, [c.x, c.y + 30 * d], "O", "O"), A(id + "s", nx, "S", "S"), A(id + "x", [nx[0] + 28, nx[1] - 15], "CoA", "X", { align: "start" })); bonds.push([c.id, id, 2], [c.id, id + "s"], [id + "s", id + "x"]); }
    if (k === "OPE") phos(atoms, bonds, id, c.id, [c.x, c.y], unit([nx[0] - c.x, nx[1] - c.y]));
  }
  dbl.forEach((i) => bonds[i - 1].push(2));
  return { atoms, bonds };
}
// β-D-fructofuranose; top = what hangs off C1 ("HO" or "P")
function furanose(c1) {
  const atoms = [], bonds = [], R = 30;
  const V = { O: [0, -R], C2: [28.5, -9.3], C3: [17.6, 24.3], C4: [-17.6, 24.3], C5: [-28.5, -9.3] };
  atoms.push(A("O", V.O, "O", "O"), ...["C2", "C3", "C4", "C5"].map((k) => C(k, V[k])));
  [["O", "C2"], ["C2", "C3"], ["C3", "C4"], ["C4", "C5"], ["C5", "O"]].forEach((b) => bonds.push(b));
  const out = (k, k2 = 30, deg = 0) => { const u = rot(unit(V[k]), deg); return [V[k][0] + u[0] * k2, V[k][1] + u[1] * k2, u]; };
  const hy = (id, from, [x, y], r) => { atoms.push(A(id, [x, y], r ? "OH" : "HO", "O", { align: r ? "start" : "end" })); bonds.push([from, id]); };
  hy("O3", "C3", out("C3"), true); hy("O4", "C4", out("C4"), false);
  const [x2, y2] = out("C2", 30, 45); hy("O2", "C2", [x2, y2], true);
  const [x1, y1, u1] = out("C2", 30, -45); atoms.push(C("C1", [x1, y1])); bonds.push(["C2", "C1"]);
  c1 === "P" ? phos(atoms, bonds, "p1", "C1", [x1, y1], u1) : hy("O1", "C1", [x1 + u1[0] * 20, y1 + u1[1] * 20], true);
  const [x6, y6, u6] = out("C5"); atoms.push(C("C6", [x6, y6])); bonds.push(["C5", "C6"]);
  phos(atoms, bonds, "p6", "C6", [x6, y6], u6);
  return { atoms, bonds };
}
const g1pAtoms = chairAtoms().filter((a) => a.id !== "O1");

const MOLS = {
  g1p: (() => {
    const atoms = [...g1pAtoms, A("O6", pt(-1.65, 1.02), "HO", "O", { align: "end" })];
    const bonds = chairBonds.filter((b) => b[1] !== "O1");
    phos(atoms, bonds, "p1", "C1", pt(1, -0.25), unit([34, -12]));
    return { name: "β-D-Glucose 1-phosphate", atoms, bonds };
  })(),
  f6p: { name: "Fructose 6-phosphate", ...furanose("HO") },
  fbp: { name: "Fructose 1,6-bisphosphate", ...furanose("P") },
  gap: { name: "Glyceraldehyde 3-phosphate", ...zig(3, [[0, "=O"], [1, "OH"], [2, "OP"]]) },
  dhap: { name: "Dihydroxyacetone phosphate", ...zig(3, [[0, "OH"], [1, "=O"], [2, "OP"]]) },
  bpg13: { name: "1,3-Bisphosphoglycerate", ...zig(3, [[0, "OP"], [1, "OH"], [2, "=O"], [2, "OPE"]], 34) },
  // pentose phosphate pathway
  p6g: { name: "6-Phosphogluconate", ...zig(6, [[0, "COOL"], [1, "OH"], [2, "OH"], [3, "OH"], [4, "OH"], [5, "OP"]]) },
  ru5p: { name: "Ribulose 5-phosphate", ...zig(5, [[0, "OH"], [1, "=O"], [2, "OH"], [3, "OH"], [4, "OP"]]) },
  r5p: { name: "Ribose 5-phosphate", ...zig(5, [[0, "=O"], [1, "OH"], [2, "OH"], [3, "OH"], [4, "OP"]]) },
  // TCA cycle
  citrate: { name: "Citrate", ...zig(5, [[0, "COOL"], [2, "OHu"], [2, "COOB"], [4, "COO"]]) },
  isocitrate: { name: "Isocitrate", ...zig(5, [[0, "COOL"], [2, "COOB"], [3, "OH"], [4, "COO"]]) },
  akg: { name: "α-Ketoglutarate", ...zig(5, [[0, "COOL"], [1, "=O"], [4, "COO"]]) },
  succoa: { name: "Succinyl-CoA", ...zig(4, [[0, "COOL"], [3, "SCoA"]]) },
  succinate: { name: "Succinate", ...zig(4, [[0, "COOL"], [3, "COO"]]) },
  fumarate: { name: "Fumarate", ...zig(4, [[0, "COOL"], [3, "COO"]], 26, [2]) },
  malate: { name: "Malate", ...zig(4, [[0, "COOL"], [1, "OH"], [3, "COO"]]) },
  oaa: { name: "Oxaloacetate", ...zig(4, [[0, "COOL"], [1, "=O"], [3, "COO"]]) },
  // urea cycle, amino acids, misc
  cp: { name: "Carbamoyl phosphate", ...zig(2, [[1, "=O"], [1, "OPE"]], 26, [], { 0: "NH2" }) },
  ornithine: { name: "Ornithine", ...zig(5, [[0, "COOL"], [1, "NH3"], [4, "NH3e"]]) },
  citrulline: { name: "Citrulline", ...zig(7, [[0, "COOL"], [1, "NH3"], [6, "=O"], [6, "NH2e"]], 26, [], { 5: "NH" }) },
  argsucc: { name: "Argininosuccinate", ...zig(7, [[0, "COOL"], [1, "NH3"], [6, "NSUC"], [6, "NH2e"]], 26, [], { 5: "NH" }) },
  arginine: { name: "Arginine", ...zig(7, [[0, "COOL"], [1, "NH3"], [6, "=NH"], [6, "NH2e"]], 26, [], { 5: "NH" }) },
  urea: { name: "Urea", ...zig(3, [[1, "=O"]], 26, [], { 0: "NH2", 2: "NH2" }) },
  aspartate: { name: "Aspartate", ...zig(4, [[0, "COOL"], [1, "NH3"], [3, "COO"]]) },
  glutamate: { name: "Glutamate", ...zig(5, [[0, "COOL"], [1, "NH3"], [4, "COO"]]) },
  alanine: { name: "Alanine", ...zig(3, [[0, "COOL"], [1, "NH3"]]) },
  lactate: { name: "Lactate", ...zig(3, [[0, "COOL"], [1, "OH"]]) },
  glyc3p: { name: "Glycerol 3-phosphate", ...zig(3, [[0, "OH"], [1, "OH"], [2, "OP"]]) },
  // pentose phosphate (rest), lipids
  xu5p: { name: "Xylulose 5-phosphate", ...zig(5, [[0, "OH"], [1, "=O"], [2, "OH"], [3, "OH"], [4, "OP"]]) },
  s7p: { name: "Sedoheptulose 7-phosphate", ...zig(7, [[0, "OH"], [1, "=O"], [2, "OH"], [3, "OH"], [4, "OH"], [5, "OH"], [6, "OP"]]) },
  e4p: { name: "Erythrose 4-phosphate", ...zig(4, [[0, "=O"], [1, "OH"], [2, "OH"], [3, "OP"]]) },
  glycerol: { name: "Glycerol", ...zig(3, [[0, "OH"], [1, "OH"], [2, "OH"]]) },
  tag: { name: "Triacylglycerol", ...zig(3, [[0, "EST"], [1, "EST"], [2, "EST"]], 60) },
  fa: { name: "Fatty acid", ...zig(6, [[5, "COO"]]) },
  facyl: { name: "Fatty acyl-CoA", ...zig(5, [[4, "SCoA"]]) },
  malonyl: { name: "Malonyl-CoA", ...zig(3, [[0, "COOL"], [2, "SCoA"]]) },
  acac: { name: "Acetoacetate", ...zig(4, [[1, "=O"], [3, "COO"]]) },
  pg3: { name: "3-Phosphoglycerate", ...zig(3, [[0, "OP"], [1, "OH"], [2, "COO"]]) },

  glucose: {
    name: "β-D-Glucose",
    atoms: [...chairAtoms(), A("O6", pt(-1.65, 1.02), "HO", "O", { align: "end" })],
    bonds: chairBonds,
  },

  g6p: {
    name: "β-D-Glucose 6-phosphate",
    atoms: [
      ...chairAtoms(),
      A("O6", pt(-0.9, 1.523), "O", "O"),
      A("P", pt(-0.9, 2.373), "P", "P"),
      A("Op1", pt(-0.9, 3.223), "O", "O"),
      A("Op2", pt(-1.75, 2.373), "O", "O", { q: "−", qd: [-8, -8] }),
      A("Op3", pt(-0.05, 2.373), "O", "O", { q: "−" }),
    ],
    bonds: [...chairBonds, ["O6", "P"], ["P", "Op1", 2], ["P", "Op2"], ["P", "Op3"]],
  },

  pg2: {
    name: "2-Phosphoglycerate",
    atoms: [A("O3", [0, 0], "HO", "O", { align: "end" }), ...acidFrame(), ...phosphate()],
    bonds: [["O3", "C3"], ["C3", "C2"], ["C2", "C1"], ["C1", "O1a", 2], ["C1", "O1b"], ...phosphateBonds],
  },

  pep: {
    name: "Phosphoenolpyruvate",
    atoms: [...acidFrame(), ...phosphate()],
    bonds: [["C3", "C2", 2], ["C2", "C1"], ["C1", "O1a", 2], ["C1", "O1b"], ...phosphateBonds],
  },

  pyruvate: {
    name: "Pyruvate",
    atoms: [...acidFrame(), A("O2", [52, -30], "O", "O")],
    bonds: [["C3", "C2"], ["C2", "O2", 2], ["C2", "C1"], ["C1", "O1a", 2], ["C1", "O1b"]],
  },

  // Coenzyme A is abbreviated, as in most textbook skeletal drawings
  acetylcoa: {
    name: "Acetyl-CoA",
    atoms: [
      C("Me", [0, 15]), C("C1", [26, 0]),
      A("O", [26, -30], "O", "O"),
      A("S", [52, 15], "S", "S"),
      A("CoA", [80, 0], "CoA", "X", { align: "start" }),
    ],
    bonds: [["Me", "C1"], ["C1", "O", 2], ["C1", "S"], ["S", "CoA"]],
  },

  atp: {
    name: "ATP",
    scale: 0.8,
    atoms: [
      // adenine
      C("C6", [0, -30]),
      A("N1", [-26, -15], "N", "N"),
      C("C2", [-26, 15]),
      A("N3", [0, 30], "N", "N"),
      C("C4", [26, 15]),
      C("C5", [26, -15]),
      A("N7", [54.5, -24.3], "N", "N"),
      C("C8", [72.1, 0]),
      A("N9", [54.5, 24.3], "N", "N"),
      A("NH2", [0, -60], "NH2", "N"),
      // ribose
      C("C1p", [63.8, 52.8]),
      C("C2p", [73.1, 81.3]),
      C("C3p", [103, 81.3]),
      C("C4p", [112.3, 52.8]),
      A("O4p", [88, 35.2], "O", "O"),
      A("O2p", [73.1, 111.3], "HO", "O", { align: "end" }),
      A("O3p", [103, 111.3], "OH", "O", { align: "start" }),
      C("C5p", [138.3, 37.8]),
      A("O5p", [164.3, 52.8], "O", "O"),
      // triphosphate
      A("Pa", [190.3, 37.8], "P", "P"),
      A("Oa1", [190.3, 7.8], "O", "O"),
      A("Oa2", [190.3, 67.8], "O", "O", { q: "−" }),
      A("Ob1", [216.3, 52.8], "O", "O"),
      A("Pb", [242.3, 37.8], "P", "P"),
      A("Ob2", [242.3, 7.8], "O", "O"),
      A("Ob3", [242.3, 67.8], "O", "O", { q: "−" }),
      A("Oc1", [268.3, 52.8], "O", "O"),
      A("Pg", [294.3, 37.8], "P", "P"),
      A("Og1", [294.3, 7.8], "O", "O"),
      A("Og2", [320.3, 22.8], "O", "O", { q: "−" }),
      A("Og3", [294.3, 67.8], "O", "O", { q: "−" }),
    ],
    bonds: [
      ["C6", "N1", 2, [0, 0]], ["N1", "C2"], ["C2", "N3", 2, [0, 0]], ["N3", "C4"],
      ["C4", "C5", 2, [0, 0]], ["C5", "C6"], ["C5", "N7"], ["N7", "C8", 2, [46.6, 0]],
      ["C8", "N9"], ["N9", "C4"], ["C6", "NH2"],
      ["N9", "C1p"], ["C1p", "C2p"], ["C2p", "C3p"], ["C3p", "C4p"], ["C4p", "O4p"], ["O4p", "C1p"],
      ["C2p", "O2p"], ["C3p", "O3p"], ["C4p", "C5p"], ["C5p", "O5p"],
      ["O5p", "Pa"], ["Pa", "Oa1", 2], ["Pa", "Oa2"], ["Pa", "Ob1"], ["Ob1", "Pb"],
      ["Pb", "Ob2", 2], ["Pb", "Ob3"], ["Pb", "Oc1"], ["Oc1", "Pg"],
      ["Pg", "Og1", 2], ["Pg", "Og2"], ["Pg", "Og3"],
    ],
  },
};

MOLS.p6gl = {
  name: "6-Phosphogluconolactone",
  atoms: MOLS.g6p.atoms.map((a) => (a.id === "O1" ? A("O1", [a.x, a.y], "O", "O") : a)),
  bonds: MOLS.g6p.bonds.map((b) => (b[0] === "C1" && b[1] === "O1" ? ["C1", "O1", 2] : b)),
};

// Glycogen is drawn as one α-glucose ring with its 1- and 4-linkages running on to the chain ("Glc")
MOLS.glycogen = (() => {
  const atoms = [...g1pAtoms, A("O1", pt(1.85, 0.05), "O", "O"), A("R1", pt(2.7, 0.05), "Glc", "X", { align: "start" }),
    A("O6", pt(-1.65, 1.02), "HO", "O", { align: "end" })];
  const bonds = [...chairBonds, ["O1", "R1"]];
  const i = atoms.findIndex((a) => a.id === "O4");
  atoms[i] = A("O4", pt(-1.85, -0.05), "O", "O");
  atoms.push(A("R4", pt(-2.7, -0.05), "Glc", "X", { align: "end" }));
  bonds.push(["O4", "R4"]);
  return { name: "Glycogen", atoms, bonds };
})();

// UDP-glucose: glucose ring, diphosphate, uridine abbreviated like CoA
MOLS.udpglc = (() => {
  const atoms = [...g1pAtoms, A("O6", pt(-1.65, 1.02), "HO", "O", { align: "end" })];
  const bonds = chairBonds.filter((b) => b[1] !== "O1");
  const c1 = pt(1, -0.25), u = unit([34, -12]), n = [-u[1], u[0]];
  const at = (k, off = 0) => [c1[0] + u[0] * k + n[0] * off, c1[1] + u[1] * k + n[1] * off];
  atoms.push(
    A("o1", at(30), "O", "O"), A("pa", at(60), "P", "P"), A("pad", at(60, -30), "O", "O"), A("pam", at(60, 30), "O", "O", { q: "−" }),
    A("ob", at(90), "O", "O"), A("pb", at(120), "P", "P"), A("pbd", at(120, -30), "O", "O"), A("pbm", at(120, 30), "O", "O", { q: "−" }),
    A("oc", at(150), "O", "O"), A("U", at(185), "Uridine", "X", { align: "start" })
  );
  bonds.push(["C1", "o1"], ["o1", "pa"], ["pa", "pad", 2], ["pa", "pam"], ["pa", "ob"], ["ob", "pb"], ["pb", "pbd", 2], ["pb", "pbm"], ["pb", "oc"], ["oc", "U"]);
  return { name: "UDP-Glucose", atoms, bonds };
})();

/* ---- heme / bilirubin family ------------------------------------------
   Pyrroles are drawn as pentagons. Side chains are abbreviated the way
   porphyrin textbooks do it (X colour, like CoA): A = CH2COO-, P = CH2CH2COO-,
   M = CH3, V = CH=CH2.                                                   */
const ang = (cx, cy, r, d) => [cx + r * Math.cos((d * Math.PI) / 180), cy + r * Math.sin((d * Math.PI) / 180)];
// one pyrrole: N + alpha(1) beta(2) beta(3) alpha(4); `beta` = labels on the two beta carbons; `dbl` = ring bonds drawn double
function ring(atoms, bonds, k, cx, cy, nd, nt, beta, dbl) {
  const P = [0, 1, 2, 3, 4].map((j) => ang(cx, cy, 24, nd + 72 * j));
  atoms.push(A(k + "N", P[0], nt, "N"), ...[1, 2, 3, 4].map((j) => C(k + j, P[j])));
  ["N1", "12", "23", "34", "4N"].forEach((s) => bonds.push(dbl.includes(s) ? [k + s[0], k + s[1], 2, [cx, cy]] : [k + s[0], k + s[1]]));
  beta.forEach((t, i) => {
    const v = P[2 + i], u = unit([v[0] - cx, v[1] - cy]);
    atoms.push(A(k + "s" + i, [v[0] + u[0] * 30, v[1] + u[1] * 30], t, "X"));
    bonds.push([k + (2 + i), k + "s" + i]);
  });
  return P;
}
// closed (or, with `open`, opened) macrocycle; subs = 8 labels, clockwise from the top ring
function macro(subs, kind, open) {
  const atoms = [], bonds = [], D = 70, gen = kind === "gen";
  const cs = [[0, -D], [D, 0], [0, D], [-D, 0]], nds = [90, 180, 270, 0];
  const pyr = ["12", "34"];
  const dbl = gen ? [pyr, pyr, pyr, pyr] : [pyr, ["23", "4N"], ["23"], ["23", "N1"]];
  const nt = gen ? ["NH", "NH", "NH", "NH"] : kind === "por" ? ["NH", "N", "NH", "N"] : ["N", "N", "N", "N"];
  const md = gen ? [0, 0, 0, 0] : [2, 2, 1, 1]; // which side of each meso carbon is double
  cs.forEach(([x, y], k) => ring(atoms, bonds, "r" + k, x, y, nds[k], nt[k], [subs[2 * k], subs[2 * k + 1]], dbl[k]));
  for (let k = 0; k < 4; k++) {
    atoms.push(C("m" + k, ang(0, 0, 60.4, -45 + 90 * k)));
    bonds.push(["r" + k + "4", "m" + k, md[k] === 1 ? 2 : 1]);
    if (!(open && k === 3)) bonds.push(["m" + k, "r" + ((k + 1) % 4) + "1", md[k] === 2 ? 2 : 1]);
  }
  if (open) { atoms.push(A("oh", ang(0, 0, 90.4, 225), "OH", "O")); bonds.push(["m3", "oh"]); }
  if (kind === "heme") {
    atoms.push(A("Fe", [0, 0], "Fe", "M", { q: "2+" }));
    for (let k = 0; k < 4; k++) bonds.push(["Fe", "r" + k + "N"]);
  }
  return { atoms, bonds };
}
// open-chain tetrapyrroles: four rings in a row, lactam (C=O) rings at both ends
function linear(kind, conj) {
  const atoms = [], bonds = [], Dx = 90, bv = kind === "bv";
  const sb = [["M", "V"], ["M", "P"], ["P", "M"], ["M", "V"]];
  const dbl = [["23"], ["12", "34"], bv ? ["23", "4N"] : ["12", "34"], ["23"]];
  const nt = ["NH", "NH", bv ? "N" : "NH", "NH"];
  const Ps = [0, 1, 2, 3].map((k) => ring(atoms, bonds, "r" + k, k * Dx, 0, 90, nt[k], sb[k], dbl[k]));
  const ord = [[2, 1], [1, bv ? 2 : 1], [1, 2]];
  for (let k = 0; k < 3; k++) {
    atoms.push(C("m" + k, [k * Dx + Dx / 2, 7.4 + (k % 2 ? 17.4 : -17.4)]));
    bonds.push(["r" + k + "4", "m" + k, ord[k][0]], ["m" + k, "r" + (k + 1) + "1", ord[k][1]]);
  }
  [[0, 1], [3, 4]].forEach(([k, j]) => {
    const u = unit([Ps[k][j][0] - k * Dx, Ps[k][j][1]]);
    atoms.push(A("o" + k, [Ps[k][j][0] + u[0] * 30, Ps[k][j][1] + u[1] * 30], "O", "O"));
    bonds.push(["r" + k + j, "o" + k, 2]);
  });
  if (conj) [["r1s1", "end"], ["r2s0", "start"]].forEach(([id, al]) => {
    const p = atoms.find((a) => a.id === id);
    atoms.push(A(id + "g", [p.x, p.y - 30], "GlcA", "X", { align: al }));
    bonds.push([id, id + "g"]);
  });
  return { atoms, bonds };
}

MOLS.glycine = { name: "Glycine", ...zig(2, [[0, "COOL"], [1, "NH3"]]) };
MOLS.ala = (() => {
  const m = zig(5, [[2, "=O"], [4, "COO"]], 26, [], { 0: "NH3" });
  m.atoms[0].q = "+"; m.atoms[0].qd = [14, -8];
  return { name: "5-Aminolevulinate (ALA)", ...m };
})();
MOLS.pbg = (() => {
  const atoms = [], bonds = [];
  const P = ring(atoms, bonds, "r", 0, 0, 90, "NH", ["A", "P"], ["12", "34"]);
  const u = unit(P[1]), c = [P[1][0] + u[0] * 30, P[1][1] + u[1] * 30], v = rot(u, 40);
  atoms.push(C("cm", c), A("nm", [c[0] + v[0] * 30, c[1] + v[1] * 30], "NH3", "N", { q: "+", qd: [14, -8] }));
  bonds.push(["r1", "cm"], ["cm", "nm"]);
  return { name: "Porphobilinogen", atoms, bonds };
})();
MOLS.hmb = { name: "Hydroxymethylbilane", ...macro("APAPAPAP".split(""), "gen", true) };
MOLS.uro3 = { name: "Uroporphyrinogen III", ...macro("APAPAPPA".split(""), "gen") };
MOLS.copro3 = { name: "Coproporphyrinogen III", ...macro("MPMPMPPM".split(""), "gen") };
MOLS.protogen = { name: "Protoporphyrinogen IX", ...macro("MVMVMPPM".split(""), "gen") };
MOLS.protoporph = { name: "Protoporphyrin IX", ...macro("MVMVMPPM".split(""), "por") };
MOLS.heme = { name: "Heme", ...macro("MVMVMPPM".split(""), "heme") };
MOLS.biliverdin = { name: "Biliverdin", ...linear("bv") };
MOLS.bilirubin = { name: "Bilirubin", ...linear("br") };
MOLS.bilglu = { name: "Bilirubin diglucuronide", ...linear("br", true) };

/* ---- cofactors and small molecules (shown on cards when a co-substrate is clicked) ---- */
// Adenosine / guanosine / uridine, borrowed from the ATP drawing so every nucleotide shares one frame.
function nucleoside(kind) {
  const keepR = ["C1p", "C2p", "C3p", "C4p", "O4p", "O2p", "O3p", "C5p", "O5p"];
  const keep = new Set(kind === "U" ? keepR : [...keepR, "C6", "N1", "C2", "N3", "C4", "C5", "N7", "C8", "N9", "NH2"]);
  let atoms = MOLS.atp.atoms.filter((a) => keep.has(a.id)).map((a) => ({ ...a }));
  let bonds = MOLS.atp.bonds.filter((b) => keep.has(b[0]) && keep.has(b[1])).map((b) => [...b]);
  if (kind === "G") {
    atoms = atoms.map((a) => (a.id === "NH2" ? A("O6", [a.x, a.y], "O", "O") : a.id === "N1" ? A("N1", [a.x, a.y], "NH", "N") : a));
    atoms.push(A("N2", [-52, 30], "H2N", "N", { align: "end" }));
    bonds = bonds.map((b) => (b[0] === "C6" && b[1] === "N1" ? ["C6", "N1"] : b[0] === "C6" && b[1] === "NH2" ? ["C6", "O6", 2] : b));
    bonds.push(["C2", "N2"]);
  }
  if (kind === "U") {
    atoms.push(A("N1", [58, 24], "N", "N"), C("C2", [32, 9]), A("N3", [32, -21], "NH", "N"), C("C4", [58, -36]), C("C5", [84, -21]), C("C6", [84, 9]),
      A("O2", [6, 24], "O", "O"), A("O4", [58, -66], "O", "O"));
    bonds.push(["N1", "C2"], ["C2", "O2", 2], ["C2", "N3"], ["N3", "C4"], ["C4", "O4", 2], ["C4", "C5"], ["C5", "C6", 2, [58, -6]], ["C6", "N1"], ["N1", "C1p"]);
  }
  return { atoms, bonds };
}
// n phosphates hanging off O5′; the last one is a free phosphate, or (bridge) is joined on to the next group by an O
function tail(n, bridge) {
  const at = [], bd = [["O5p", "P0"]];
  for (let i = 0; i < n; i++) {
    const x = 190.3 + 52 * i, p = "P" + i, last = i === n - 1;
    at.push(A(p, [x, 37.8], "P", "P"), A(p + "d", [x, 7.8], "O", "O"), A(p + "m", [x, 67.8], "O", "O", { q: "−" }));
    bd.push([p, p + "d", 2], [p, p + "m"]);
    if (!last) { at.push(A(p + "b", [x + 26, 52.8], "O", "O")); bd.push([p, p + "b"], [p + "b", "P" + (i + 1)]); }
    else if (bridge) { at.push(A("Oend", [x + 26, 52.8], "O", "O")); bd.push([p, "Oend"]); }
    else { at.push(A(p + "t", [x + 26, 22.8], "O", "O", { q: "−" })); bd.push([p, p + "t"]); }
  }
  return { at, bd };
}
function nucleotide(name, kind, n) {
  const b = nucleoside(kind), t = tail(n);
  return { name, scale: 0.8, atoms: [...b.atoms, ...t.at], bonds: [...b.bonds, ...t.bd] };
}
MOLS.amp = nucleotide("AMP", "A", 1);
MOLS.adp = nucleotide("ADP", "A", 2);
MOLS.gtp = nucleotide("GTP", "G", 3);
MOLS.udp = nucleotide("UDP", "U", 2);
MOLS.utp = nucleotide("UTP", "U", 3);

// swap the 2′ or 3′ OH of the adenosine ribose for a phosphate
function ribosePhosphate(atoms, bonds, o, c, id) {
  const i = atoms.findIndex((a) => a.id === o), at = atoms[i];
  atoms.splice(i, 1);
  const j = bonds.findIndex((b) => b[0] === c && b[1] === o);
  bonds.splice(j, 1);
  const k = atoms.find((a) => a.id === c);
  phos(atoms, bonds, id, c, [k.x, k.y], [0, 1]);
}
// NAD(P)(H): adenosine – diphosphate – ribose – nicotinamide. reduced = dihydronicotinamide (carries the hydride)
function nad(name, reduced, phosphate) {
  const b = nucleoside("A"), t = tail(2, true);
  const atoms = [...b.atoms, ...t.at], bonds = [...b.bonds, ...t.bd];
  if (phosphate) ribosePhosphate(atoms, bonds, "O2p", "C2p", "p2");
  atoms.push(
    C("q5", [294.3, 37.8]), C("q4", [320.3, 52.8]), C("q3", [329.6, 81.3]), C("q2", [359.5, 81.3]), C("q1", [368.8, 52.8]), A("qO", [344.6, 35.2], "O", "O"),
    A("qo3", [329.6, 111.3], "HO", "O", { align: "end" }), A("qo2", [359.5, 111.3], "OH", "O", { align: "start" }));
  bonds.push(["Oend", "q5"], ["q5", "q4"], ["q4", "q3"], ["q3", "q2"], ["q2", "q1"], ["q1", "qO"], ["qO", "q4"], ["q3", "qo3"], ["q2", "qo2"], ["q1", "nN"]);
  const cN = [420.8, 22.8];
  atoms.push(
    reduced ? A("nN", [394.8, 37.8], "N", "N") : A("nN", [394.8, 37.8], "N", "N", { q: "+", qd: [-11, -12] }),
    C("n2", [394.8, 7.8]), C("n3", [420.8, -7.2]), C("n4", [446.8, 7.8]), C("n5", [446.8, 37.8]), C("n6", [420.8, 52.8]),
    C("n7", [420.8, -37.2]), A("n7o", [394.8, -52.2], "O", "O"), A("n7n", [446.8, -52.2], "NH2", "N"));
  bonds.push(["n3", "n7"], ["n7", "n7o", 2], ["n7", "n7n"], ["n5", "n6", 2, cN], ["n6", "nN"]);
  if (reduced) {
    atoms.push(A("nHa", [472.8, -7.2], "H", "H"), A("nHb", [472.8, 22.8], "H", "H"));
    bonds.push(["nN", "n2"], ["n2", "n3", 2, cN], ["n3", "n4"], ["n4", "n5"], ["n4", "nHa"], ["n4", "nHb"]);
  } else bonds.push(["nN", "n2", 2, cN], ["n2", "n3"], ["n3", "n4", 2, cN], ["n4", "n5"]);
  return { name, scale: 0.8, atoms, bonds };
}
MOLS.nad = nad("NAD⁺", false, false);
MOLS.nadh = nad("NADH", true, false);
MOLS.nadp = nad("NADP⁺", false, true);
MOLS.nadph = nad("NADPH", true, true);

// FAD / FADH₂: adenosine – diphosphate – ribitol – isoalloxazine (flavin) ring
function fad(name, reduced) {
  const b = nucleoside("A"), t = tail(2, true);
  const atoms = [...b.atoms, ...t.at], bonds = [...b.bonds, ...t.bd];
  const hv = (c, d) => ang(c[0], c[1], 30, d), cA = [454.3, 104.8], cB = [454.3, 52.8], cC = [454.3, 0.8];
  [["r5", 294.3, 37.8], ["r4", 320.3, 52.8], ["r3", 346.3, 37.8], ["r2", 372.3, 52.8], ["r1", 398.3, 37.8]].forEach(([id, x, y]) => atoms.push(C(id, [x, y])));
  atoms.push(A("ro4", [320.3, 82.8], "OH", "O"), A("ro3", [346.3, 7.8], "OH", "O"), A("ro2", [372.3, 82.8], "OH", "O"));
  bonds.push(["Oend", "r5"], ["r5", "r4"], ["r4", "r3"], ["r3", "r2"], ["r2", "r1"], ["r4", "ro4"], ["r3", "ro3"], ["r2", "ro2"], ["r1", "fN10"]);
  atoms.push(A("fN10", hv(cB, 180), "N", "N"), C("fC10a", hv(cB, 240)), C("fC4a", hv(cB, 300)), A("fN5", hv(cB, 0), reduced ? "NH" : "N", "N"), C("fC5a", hv(cB, 60)), C("fC9a", hv(cB, 120)),
    A("fN1", hv(cC, 180), reduced ? "NH" : "N", "N"), C("fC2", hv(cC, 240)), A("fN3", hv(cC, 300), "NH", "N"), C("fC4", hv(cC, 0)),
    A("fO2", ang(...hv(cC, 240), 30, 240).slice(0, 2), "O", "O"), A("fO4", ang(...hv(cC, 0), 30, 0).slice(0, 2), "O", "O"),
    C("fC6", hv(cA, 0)), C("fC7", hv(cA, 60)), C("fC8", hv(cA, 120)), C("fC9", hv(cA, 180)),
    C("fMe7", ang(...hv(cA, 60), 30, 60).slice(0, 2)), C("fMe8", ang(...hv(cA, 120), 30, 120).slice(0, 2)));
  bonds.push(["fC9a", "fC9", 2, cA], ["fC9", "fC8"], ["fC8", "fC7", 2, cA], ["fC7", "fC6"], ["fC6", "fC5a", 2, cA], ["fC5a", "fC9a"], ["fC7", "fMe7"], ["fC8", "fMe8"],
    ["fN10", "fC10a"], ["fC9a", "fN10"], ["fN5", "fC5a"], ["fC10a", "fN1", reduced ? 1 : 2, ...(reduced ? [] : [cC])], ["fN1", "fC2"], ["fC2", "fO2", 2], ["fC2", "fN3"], ["fN3", "fC4"], ["fC4", "fO4", 2], ["fC4", "fC4a"]);
  bonds.push(reduced ? ["fC10a", "fC4a", 2, cB] : ["fC10a", "fC4a"], reduced ? ["fC4a", "fN5"] : ["fC4a", "fN5", 2, cB]);
  return { name, scale: 0.8, atoms, bonds };
}
MOLS.fad = fad("FAD", false);
MOLS.fadh2 = fad("FADH₂", true);

// Coenzyme A: adenosine 3′-phosphate 5′-diphosphate – pantothenate – cysteamine, ending in the reactive SH
MOLS.coa = (() => {
  const b = nucleoside("A"), t = tail(2, true);
  const atoms = [...b.atoms, ...t.at], bonds = [...b.bonds, ...t.bd];
  ribosePhosphate(atoms, bonds, "O3p", "C3p", "p3");
  const chain = [["c1", "C"], ["c2", "C"], ["c3", "C"], ["c4", "C"], ["n1", "NH"], ["c5", "C"], ["c6", "C"], ["c7", "C"], ["n2", "NH"], ["c8", "C"], ["c9", "C"], ["s", "SH"]];
  chain.forEach(([id, t], i) => {
    const p = [294.3 + 26 * i, i % 2 ? 52.8 : 37.8];
    atoms.push(t === "C" ? C(id, p) : A(id, p, t, t === "SH" ? "S" : "N"));
    bonds.push([i ? chain[i - 1][0] : "Oend", id]);
  });
  atoms.push(C("me1", [305.3, 78.8]), C("me2", [335.3, 78.8]), A("oh", [346.3, 7.8], "OH", "O"), A("o4", [372.3, 82.8], "O", "O"), A("o7", [476.3, 82.8], "O", "O"));
  bonds.push(["c2", "me1"], ["c2", "me2"], ["c3", "oh"], ["c4", "o4", 2], ["c7", "o7", 2]);
  return { name: "Coenzyme A (CoA-SH)", scale: 0.8, atoms, bonds };
})();

// UDP-glucuronate: UDP-glucose with C6 oxidised to a carboxylate
MOLS.udpglcA = (() => {
  const m = MOLS.udpglc;
  const atoms = m.atoms.map((a) => (a.id === "O6" ? A("O6", [a.x, a.y], "O", "O") : a));
  atoms.push(A("O6b", pt(-0.9, 1.45), "O", "O", { q: "−" }));
  const bonds = m.bonds.map((b) => (b[0] === "C6" && b[1] === "O6" ? ["C6", "O6", 2] : b));
  bonds.push(["C6", "O6b"]);
  return { name: "UDP-glucuronate", atoms, bonds };
})();

// small molecules
const small = (name, scale, atoms, bonds) => ({ name, scale, atoms, bonds });
MOLS.h2o = small("Water", 1.7, [A("O", [0, 0], "O", "O"), A("H1", [-30, 24], "H", "H"), A("H2", [30, 24], "H", "H")], [["O", "H1"], ["O", "H2"]]);
MOLS.nh3 = small("Ammonia", 1.6, [A("N", [0, 0], "N", "N"), A("H1", [-36, 22], "H", "H"), A("H2", [36, 22], "H", "H"), A("H3", [0, -42], "H", "H")], [["N", "H1"], ["N", "H2"], ["N", "H3"]]);
MOLS.co2 = small("Carbon dioxide", 1.6, [A("O1", [-50, 0], "O", "O"), A("C", [0, 0], "C", "C"), A("O2", [50, 0], "O", "O")], [["O1", "C", 2], ["C", "O2", 2]]);
MOLS.co = small("Carbon monoxide", 1.8, [A("C", [-26, 0], "C", "C"), A("O", [26, 0], "O", "O")], [["C", "O", 3]]);
MOLS.o2 = small("Oxygen", 1.8, [A("O1", [-26, 0], "O", "O"), A("O2", [26, 0], "O", "O")], [["O1", "O2", 2]]);
MOLS.h2o2 = small("Hydrogen peroxide", 1.6, [A("H1", [-52, -24], "H", "H"), A("O1", [-22, 0], "O", "O"), A("O2", [22, 0], "O", "O"), A("H2", [52, -24], "H", "H")], [["H1", "O1"], ["O1", "O2"], ["O2", "H2"]]);
MOLS.hplus = small("Proton", 2.4, [A("H", [0, 0], "H", "H", { q: "+", qd: [14, -10] })], []);
MOLS.pi = small("Inorganic phosphate (Pᵢ)", 1.5, [A("P", [0, 0], "P", "P"), A("Od", [0, -32], "O", "O"), A("Om1", [-32, 0], "O", "O", { q: "−" }), A("Oh", [32, 0], "OH", "O", { align: "start" }), A("Om2", [0, 32], "O", "O", { q: "−" })],
  [["P", "Od", 2], ["P", "Om1"], ["P", "Oh"], ["P", "Om2"]]);
MOLS.ppi = small("Pyrophosphate (PPᵢ)", 1.3, [A("O", [0, 0], "O", "O"), A("P1", [-30, 17], "P", "P"), A("P2", [30, 17], "P", "P"),
  A("d1", [-30, -17], "O", "O"), A("m1", [-60, 34], "O", "O", { q: "−", qd: [-8, -8] }), A("n1", [-30, 51], "O", "O", { q: "−" }),
  A("d2", [30, -17], "O", "O"), A("m2", [60, 34], "O", "O", { q: "−" }), A("n2", [30, 51], "O", "O", { q: "−" })],
  [["P1", "O"], ["O", "P2"], ["P1", "d1", 2], ["P1", "m1"], ["P1", "n1"], ["P2", "d2", 2], ["P2", "m2"], ["P2", "n2"]]);

/* ---- proteinogenic amino acids: neutral form, carboxyl on the right, wedge to NH2, side chain to the left (bond length 30px, y points down) ---- */
const ringFrom = (n, P, u) => { // regular n-gon, side 30, with one vertex at P and its centre along unit vector u from P
  const R = 30 / (2 * Math.sin(Math.PI / n)), c = [P[0] + u[0] * R, P[1] + u[1] * R], a0 = Math.atan2(P[1] - c[1], P[0] - c[0]);
  return { c, R, v: Array.from({ length: n }, (_, k) => [c[0] + R * Math.cos(a0 + (2 * Math.PI * k) / n), c[1] + R * Math.sin(a0 + (2 * Math.PI * k) / n)]) };
};
function aaMol(name, build, { noN = false } = {}) {
  const atoms = [C("ca", [0, 0]), C("cc", [26, -15]), A("co", [26, -45], "O", "O"), A("oh", [52, 0], "OH", "O", { align: "start" })];
  const bonds = [["ca", "cc"], ["cc", "co", 2], ["cc", "oh"]];
  if (!noN) { atoms.push(A("n", [0, 30], "NH2", "N")); bonds.push(["ca", "n", "w"]); }
  const put = (id, x, y, text, el, extra) => atoms.push(text ? A(id, [x, y], text, el, extra) : C(id, [x, y]));
  const bond = (a, b, o, side) => bonds.push(side ? [a, b, o, side] : o ? [a, b, o] : [a, b]);
  build({ put, bond, atoms, bonds });
  return { name, atoms, bonds };
}
const CB = [-26, -15], CG = [-52, 0], UCG = [-26 / 30, 15 / 30]; // beta carbon, gamma carbon, and the direction a ring continues in
const benzene = ({ put, bond }, ids) => { // ring hanging off cg; returns the ring so a substituent can be added
  const r = ringFrom(6, CG, UCG);
  r.v.forEach(([x, y], k) => { if (k) put(ids[k], x, y); });
  [0, 2, 4].forEach((k) => bond(ids[k], ids[(k + 1) % 6], 2, r.c));
  [1, 3, 5].forEach((k) => bond(ids[k], ids[(k + 1) % 6]));
  return r;
};
const AA_RING = ["cg", "r1", "r2", "r3", "r4", "r5"];
Object.assign(MOLS, {
  valine: aaMol("Valine", ({ put, bond }) => { put("cb", ...CB); put("g1", -52, 0); put("g2", -26, -45); bond("ca", "cb"); bond("cb", "g1"); bond("cb", "g2"); }),
  leucine: aaMol("Leucine", ({ put, bond }) => { put("cb", ...CB); put("cg", -52, 0); put("d1", -78, -15); put("d2", -52, 30); bond("ca", "cb"); bond("cb", "cg"); bond("cg", "d1"); bond("cg", "d2"); }),
  isoleucine: aaMol("Isoleucine", ({ put, bond }) => { put("cb", ...CB); put("g2", -26, -45); put("g1", -52, 0); put("d1", -78, -15); bond("ca", "cb"); bond("cb", "g2"); bond("cb", "g1"); bond("g1", "d1"); }),
  methionine: aaMol("Methionine", ({ put, bond }) => { put("cb", ...CB); put("cg", -52, 0); put("sd", -78, -15, "S", "S"); put("ce", -104, 0); bond("ca", "cb"); bond("cb", "cg"); bond("cg", "sd"); bond("sd", "ce"); }),
  threonine: aaMol("Threonine", ({ put, bond }) => { put("cb", ...CB); put("og", -26, -45, "OH", "O"); put("cg", -52, 0); bond("ca", "cb"); bond("cb", "og", "w"); bond("cb", "cg"); }),
  lysine: aaMol("Lysine", ({ put, bond }) => { put("cb", ...CB); put("cg", -52, 0); put("cd", -78, -15); put("ce", -104, 0); put("nz", -130, -15, "H2N", "N", { align: "end" }); bond("ca", "cb"); bond("cb", "cg"); bond("cg", "cd"); bond("cd", "ce"); bond("ce", "nz"); }),
  histidine: aaMol("Histidine", (g) => {
    const { put, bond } = g, r = ringFrom(5, CG, UCG), [, v1, v2, v3, v4] = r.v;
    put("cb", ...CB); put("cg", ...CG); put("nd", ...v1, "NH", "N"); put("ce", ...v2); put("ne", ...v3, "N", "N"); put("cd", ...v4);
    bond("ca", "cb"); bond("cb", "cg"); bond("cg", "nd"); bond("nd", "ce"); bond("ce", "ne", 2, r.c); bond("ne", "cd"); bond("cd", "cg", 2, r.c);
  }),
  phenylalanine: aaMol("Phenylalanine", (g) => { g.put("cb", ...CB); g.put("cg", ...CG); g.bond("ca", "cb"); g.bond("cb", "cg"); benzene(g, AA_RING); }),
  tyrosine: aaMol("Tyrosine", (g) => {
    g.put("cb", ...CB); g.put("cg", ...CG); g.bond("ca", "cb"); g.bond("cb", "cg");
    const r = benzene(g, AA_RING), p = r.v[3];
    g.put("oy", p[0] + UCG[0] * 30, p[1] + UCG[1] * 30, "HO", "O", { align: "end" }); g.bond("r3", "oy");
  }),
  tryptophan: aaMol("Tryptophan", (g) => {
    const { put, bond } = g, pent = ringFrom(5, CG, UCG), [, c2, n1, c7a, c3a] = pent.v;
    const mid = [(c7a[0] + c3a[0]) / 2, (c7a[1] + c3a[1]) / 2], d = Math.hypot(mid[0] - pent.c[0], mid[1] - pent.c[1]);
    const hc = [mid[0] + ((mid[0] - pent.c[0]) / d) * 30 * Math.cos(Math.PI / 6), mid[1] + ((mid[1] - pent.c[1]) / d) * 30 * Math.cos(Math.PI / 6)];
    const a0 = Math.atan2(c3a[1] - hc[1], c3a[0] - hc[0]), a1 = Math.atan2(c7a[1] - hc[1], c7a[0] - hc[0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da <= -Math.PI) da += 2 * Math.PI;
    const step = Math.sign(da) * (Math.PI / 3), h = Array.from({ length: 6 }, (_, k) => [hc[0] + 30 * Math.cos(a0 + k * step), hc[1] + 30 * Math.sin(a0 + k * step)]);
    put("cb", ...CB); put("c3", ...CG); put("c2", ...c2); put("n1", ...n1, "NH", "N"); put("c7a", ...c7a); put("c3a", ...c3a);
    put("c7", ...h[2]); put("c6", ...h[3]); put("c5", ...h[4]); put("c4", ...h[5]);
    bond("ca", "cb"); bond("cb", "c3"); bond("c3", "c2", 2, pent.c); bond("c2", "n1"); bond("n1", "c7a"); bond("c7a", "c3a"); bond("c3a", "c3");
    bond("c3a", "c4", 2, hc); bond("c4", "c5"); bond("c5", "c6", 2, hc); bond("c6", "c7"); bond("c7", "c7a", 2, hc);
  }),
  serine: aaMol("Serine", ({ put, bond }) => { put("cb", ...CB); put("og", ...CG, "HO", "O", { align: "end" }); bond("ca", "cb"); bond("cb", "og"); }),
  cysteine: aaMol("Cysteine", ({ put, bond }) => { put("cb", ...CB); put("sg", ...CG, "HS", "S", { align: "end" }); bond("ca", "cb"); bond("cb", "sg"); }),
  asparagine: aaMol("Asparagine", ({ put, bond }) => { put("cb", ...CB); put("cg", -52, 0); put("od", -52, 30, "O", "O"); put("nd", -78, -15, "H2N", "N", { align: "end" }); bond("ca", "cb"); bond("cb", "cg"); bond("cg", "od", 2); bond("cg", "nd"); }),
  glutamine: aaMol("Glutamine", ({ put, bond }) => { put("cb", ...CB); put("cg", -52, 0); put("cd", -78, -15); put("oe", -78, -45, "O", "O"); put("ne", -104, 0, "H2N", "N", { align: "end" }); bond("ca", "cb"); bond("cb", "cg"); bond("cg", "cd"); bond("cd", "oe", 2); bond("cd", "ne"); }),
  proline: aaMol("Proline", ({ put, bond }) => { // the ring runs through the alpha carbon and the nitrogen
    const c = [-19.5, 16.4], R = 30 / (2 * Math.sin(Math.PI / 5)), a0 = Math.atan2(0 - c[1], 0 - c[0]);
    const v = Array.from({ length: 5 }, (_, k) => [c[0] + R * Math.cos(a0 + (2 * Math.PI * k) / 5), c[1] + R * Math.sin(a0 + (2 * Math.PI * k) / 5)]);
    put("n", ...v[1], "NH", "N"); put("cd", ...v[2]); put("cg", ...v[3]); put("cb", ...v[4]);
    bond("ca", "n"); bond("n", "cd"); bond("cd", "cg"); bond("cg", "cb"); bond("cb", "ca");
  }, { noN: true }),
});

/* ------------------------------ renderer ---------------------------- */

const TRIM = 9; // gap left between a bond and an atom label

function bounds(mol) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const a of mol.atoms) {
    let l = 0, r = 0, t = 0, b = 0;
    if (a.text) {
      const w = a.text.length * 10;
      l = a.align === "end" ? w - 5 : a.align === "start" ? 6 : w / 2;
      r = a.align === "end" ? 6 : a.align === "start" ? w - 5 : w / 2;
      t = b = 10;
    }
    if (a.q) { l += 8; r += 8; t += 8; }
    x0 = Math.min(x0, a.x - l); x1 = Math.max(x1, a.x + r);
    y0 = Math.min(y0, a.y - t); y1 = Math.max(y1, a.y + b);
  }
  const pad = 8;
  return { x0: x0 - pad, y0: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

function bondLines(a, b, order = 1, side) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const ta = a.text ? TRIM : 0, tb = b.text ? TRIM : 0;
  const x1 = a.x + ux * ta, y1 = a.y + uy * ta, x2 = b.x - ux * tb, y2 = b.y - uy * tb;
  if (order === 1 || order === "w") return [[x1, y1, x2, y2]]; // "w" = solid wedge, drawn as a polygon in Skeletal
  if (order === 3) {
    const o = 4.5; // triple bond (C≡O)
    return [[x1, y1, x2, y2], [x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o], [x1 - nx * o, y1 - ny * o, x2 - nx * o, y2 - ny * o]];
  }
  if (!side) {
    const o = 2.6; // symmetric double bond (C=O, P=O, C=C)
    return [
      [x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o],
      [x1 - nx * o, y1 - ny * o, x2 - nx * o, y2 - ny * o],
    ];
  }
  // ring double bond: second line sits toward the ring centre `side`
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const s = nx * (side[0] - mx) + ny * (side[1] - my) >= 0 ? 1 : -1;
  const o = 5, sh = 5;
  return [
    [x1, y1, x2, y2],
    [x1 + nx * o * s + ux * sh, y1 + ny * o * s + uy * sh, x2 + nx * o * s - ux * sh, y2 + ny * o * s - uy * sh],
  ];
}

function Label({ a }) {
  const anchor = a.align === "start" ? "start" : a.align === "end" ? "end" : "middle";
  const x = a.x + (a.align === "start" ? -5 : a.align === "end" ? 5 : 0);
  const fill = EL_COLOR[a.el] || CHALK;
  const parts = a.text.split(/(\d+)/).filter(Boolean); // NH2 -> N H <sub>2</sub>
  return (
    <>
      <text x={x} y={a.y} textAnchor={anchor} dominantBaseline="central" fill={fill} fontSize="15" fontWeight="500">
        {parts.map((p, i) =>
          /^\d+$/.test(p) ? (
            <tspan key={i} dy="4" fontSize="11">{p}</tspan>
          ) : (
            <tspan key={i}>{p}</tspan>
          )
        )}
      </text>
      {a.q && (
        <text
          x={a.x + (a.qd ? a.qd[0] : 8)}
          y={a.y + (a.qd ? a.qd[1] : -8)}
          textAnchor="middle"
          dominantBaseline="central"
          fill={fill}
          fontSize="12"
        >
          {a.q}
        </text>
      )}
    </>
  );
}

function Skeletal({ mol, hit = true }) {
  const open = React.useContext(OpenCtx);
  const kinds = useMemo(() => classify(mol), [mol]);
  const byId = useMemo(() => Object.fromEntries(mol.atoms.map((a) => [a.id, a])), [mol]);
  const { x0, y0, w, h } = useMemo(() => bounds(mol), [mol]);
  const k = mol.scale || 1;
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} width={w * k} height={h * k} role="img" aria-label={`Skeletal structure of ${mol.name}`}>
      <g stroke={CHALK} strokeWidth="1.8" strokeLinecap="round" fill="none">
        {mol.bonds.flatMap(([a, b, order, side], i) =>
          order === "w"
            ? (() => { // stereo wedge: narrow at the stereocentre, wide at the substituent
                const [x1, y1, x2, y2] = bondLines(byId[a], byId[b], order)[0], len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len * 4.2, ny = (x2 - x1) / len * 4.2;
                return [<polygon key={`${i}-w`} points={`${x1},${y1} ${x2 + nx},${y2 + ny} ${x2 - nx},${y2 - ny}`} fill={CHALK} stroke={CHALK} strokeWidth="0.8" strokeLinejoin="round" />];
              })()
            : bondLines(byId[a], byId[b], order, side).map((l, j) => (
                <line key={`${i}-${j}`} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />
              ))
        )}
      </g>
      {hit && (
        <g className="omino-bondhit" fill="none" strokeWidth="11" strokeLinecap="round">
          {mol.bonds.map(([a, b, order, side], i) => {
            const l = bondLines(byId[a], byId[b], order, side)[0];
            return (
              <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} onClick={(e) => { e.stopPropagation(); open("bond", kinds[i]); }}>
                <title>{BONDS[kinds[i]].name}</title>
              </line>
            );
          })}
        </g>
      )}
      {mol.atoms.filter((a) => a.text).map((a) => <Label key={a.id} a={a} />)}
    </svg>
  );
}

function AtomTile({ glyph, color }) {
  return (
    <svg viewBox="0 0 44 44" width="44" height="44" role="img" aria-label={glyph.symbol}>
      <circle cx="22" cy="22" r="20" fill="none" stroke={color} strokeWidth="1.8" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fill={CHALK} fontSize="15" fontWeight="500">
        {glyph.symbol}
        {glyph.charge && <tspan dy="-5" fontSize="10">{glyph.charge}</tspan>}
      </text>
    </svg>
  );
}

/* ================================================================== */
/* 2. Dataset: 10 nodes (7 molecules, 2 ions, 1 atom) + edges          */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* ART: freeform drawings are the primary way to restyle an object.   */
/* Drop an SVG/PNG in your project and register it by node id; it     */
/* replaces the procedural structure everywhere. w = display width.   */
/*   e.g.  glucose: { src: "/art/glucose.svg", w: 200 }               */
/* ------------------------------------------------------------------ */
const DRAWINGS = {};

const KIND = {
  molecule: { label: "Molecule", color: "#dfe6ee" },
  ion: { label: "Ion", color: "#8fd18a" },
  atom: { label: "Atom", color: "#6fe0b4" },
  cofactor: { label: "Cofactor", color: "#6f93ff" },
  pathway: { label: "Pathway", color: "#8e8e99" },
};

// Each pathway gets one colour: its edges, enzyme labels, title and legend chip.
const PATHWAYS = {
  glycolysis: { label: "Glycolysis", color: "#6fa8ff" },
  glycogen: { label: "Glycogen synthesis", color: "#a3e36f" },
  ppp: { label: "Pentose phosphate pathway", color: "#c7a8ff" },
  tca: { label: "TCA cycle", color: "#ff8a65" },
  urea: { label: "Urea cycle", color: "#4fd1c5" },
  amino: { label: "Amino acid exchange", color: "#ff7ab6" },
  lipid: { label: "Triacylglycerol & fatty acids", color: "#f2c94c" },
  aa: { label: "Amino acids", color: "#fb7185" },
};
const PATH_OF = {};
Object.entries({
  glycolysis: ["glucose", "g6p", "f6p", "fbp", "gap", "dhap", "bpg13", "pg3", "pg2", "pep", "pyruvate", "lactate"],
  glycogen: ["g1p", "glycogen", "udpglc"],
  ppp: ["p6gl", "p6g", "ru5p", "r5p", "xu5p", "s7p", "e4p"],
  tca: ["acetylcoa", "citrate", "isocitrate", "akg", "succoa", "succinate", "fumarate", "malate", "oaa"],
  urea: ["cp", "ornithine", "citrulline", "argsucc", "arginine", "urea"],
  amino: ["alanine", "aspartate", "glutamate"],
  lipid: ["glyc3p", "tag", "glycerol", "fa", "facyl", "malonyl", "acac"],
  aa: ["valine", "leucine", "isoleucine", "methionine", "threonine", "lysine", "histidine", "phenylalanine", "tryptophan", "serine", "cysteine", "tyrosine", "proline", "glutamine", "asparagine"],
}).forEach(([p, ids]) => ids.forEach((i) => (PATH_OF[i] = p)));

const M = (id, formula, note) => ({ id, kind: "molecule", mol: id, label: MOLS[id].name, formula, note });
const NODES = [
  M("g1p", "C6H13O9P", "Glucose 1-phosphate, from glycogen breakdown"),
  M("glucose", "C6H12O6", "Entry point of glycolysis"),
  M("g6p", "C6H13O9P", "Made by hexokinase / glucokinase"),
  M("f6p", "C6H13O9P", "Made by phosphoglucose isomerase"),
  M("fbp", "C6H14O12P2", "Committed step: phosphofructokinase-1"),
  M("gap", "C3H7O6P", "Aldolase product"),
  M("dhap", "C3H7O6P", "Aldolase product, isomerises to G3P"),
  M("bpg13", "C3H8O10P2", "First ATP-yielding intermediate"),
  M("pg3", "C3H7O7P", "Made by phosphoglycerate kinase"),
  M("pg2", "C3H7O7P", "Product of phosphoglycerate mutase"),
  M("pep", "C3H5O6P", "High-energy phosphate donor"),
  M("pyruvate", "C3H4O3", "End product of glycolysis"),
  M("acetylcoa", "C23H38N7O17P3S", "Enters the TCA cycle"),
  M("p6g", "C6H13O10P", "Oxidative branch of the pentose phosphate pathway"),
  M("ru5p", "C5H11O8P", "Releases CO₂ and a second NADPH"),
  M("r5p", "C5H11O8P", "Nucleotide precursor"),
  M("citrate", "C6H8O7", "Citrate synthase: acetyl-CoA + oxaloacetate"),
  M("isocitrate", "C6H8O7", "Aconitase isomer of citrate"),
  M("akg", "C5H6O5", "First CO₂ lost in the cycle"),
  M("succoa", "C25H40N7O19P3S", "Thioester; drives GTP formation"),
  M("succinate", "C4H6O4", "Oxidised by succinate dehydrogenase"),
  M("fumarate", "C4H4O4", "Hydrated by fumarase"),
  M("malate", "C4H6O5", "Oxidised to oxaloacetate"),
  M("oaa", "C4H4O5", "Regenerated; condenses with acetyl-CoA"),
  M("cp", "CH4NO5P", "Carbamoyl phosphate synthetase I: HCO₃⁻ + NH₃ + 2 ATP"),
  M("ornithine", "C5H12N2O2", "Regenerated each turn; carrier of the urea cycle"),
  M("citrulline", "C6H13N3O3", "Ornithine transcarbamylase product"),
  M("argsucc", "C10H18N4O6", "Citrulline + aspartate"),
  M("arginine", "C6H14N4O2", "Cleaved by arginase to urea + ornithine"),
  M("urea", "CH4N2O", "Nitrogen waste, excreted in urine"),
  M("aspartate", "C4H7NO4", "Transaminated from oxaloacetate; gives urea its second N"),
  M("glutamate", "C5H9NO4", "Amino-group hub: transamination with α-ketoglutarate"),
  M("alanine", "C3H7NO2", "Glucose–alanine cycle carrier"),
  M("lactate", "C3H6O3", "Reduced pyruvate (LDH)"),
  M("glyc3p", "C3H9O6P", "Backbone for triacylglycerol synthesis"),
  M("p6gl", "C6H11O9P", "Lactone; hydrolysed by 6-phosphogluconolactonase"),
  M("xu5p", "C5H11O8P", "Epimer of ribulose 5-phosphate; transketolase donor"),
  M("s7p", "C7H15O10P", "Transketolase product"),
  M("e4p", "C4H9O7P", "Transaldolase product; aromatic amino acid precursor"),
  M("glycerol", "C3H8O3", "Released by lipase; phosphorylated by glycerol kinase"),
  M("tag", "C3H5(OCOR)3", "Storage fat: glycerol + 3 fatty acids"),
  M("fa", "RCOO⁻", "Free fatty acid"),
  M("facyl", "RCO–SCoA", "Activated fatty acid; β-oxidation substrate"),
  M("malonyl", "C24H38N7O19P3S", "Fatty acid synthesis building block (ACC)"),
  M("acac", "C4H6O3", "Ketone body"),
  M("glycogen", "(C6H10O5)n", "Storage polymer of α-glucose; each unit is a ring"),
  M("udpglc", "C15H24N2O17P2", "Activated glucose donor for glycogen synthase"),
  M("atp", "C10H16N5O13P3", "Phosphate donor for kinases"),
  { id: "mg", kind: "ion", glyph: { symbol: "Mg", charge: "2+" }, label: "Magnesium", formula: "Mg²⁺", note: "Cofactor: kinases, enolase" },
  { id: "k", kind: "ion", glyph: { symbol: "K", charge: "+" }, label: "Potassium", formula: "K⁺", note: "Cofactor: pyruvate kinase" },
  { id: "p", kind: "atom", glyph: { symbol: "P" }, label: "Phosphorus", formula: "P", note: "The phosphorus carried through the pathway" },
];

// Co-substrates / co-products, written as in the drawing: [id, text, beside, dx, dy]
const COSUBS = [
  ["c_atp1", "+ ATP", "glucose", 240, 0], ["c_adp1", "ADP +", "g6p", -240, -70],
  ["c_atp2", "+ ATP", "f6p", 240, 0], ["c_adp2", "ADP +", "fbp", -240, -60],
  ["c_nad", "NAD⁺ + Pᵢ", "gap", -240, 40], ["c_nadh", "+ NADH", "bpg13", 240, 0],
  ["c_adp3", "ADP +", "bpg13", -240, 70], ["c_atp3", "+ ATP", "pg3", 240, 0],
  ["c_h2o", "+ H₂O", "pep", 240, -60], ["c_adp4", "ADP +", "pep", -240, 70], ["c_atp4", "+ ATP", "pyruvate", 240, 0],
].map(([id, text, , ,]) => ({ id, kind: "cofactor", label: text, formula: "", note: "Co-substrate / co-product" }));

const EDGES = [
  { id: "e0", source: "g1p", target: "g6p", label: "Phosphoglucomutase", dash: true },
  { id: "e1", source: "glucose", target: "g6p", label: "Hexokinase / Glucokinase", main: true },
  { id: "e2", source: "g6p", target: "f6p", label: "Phosphoglucose isomerase", main: true },
  { id: "e3", source: "f6p", target: "fbp", label: "Phosphofructokinase-1", main: true },
  { id: "e4", source: "fbp", target: "gap", label: "Aldolase", main: true },
  { id: "e4b", source: "fbp", target: "dhap", label: "", dash: true },
  { id: "e5", source: "gap", target: "bpg13", label: "G3P dehydrogenase", main: true },
  { id: "e6", source: "bpg13", target: "pg3", label: "Phosphoglycerate kinase", main: true },
  { id: "e7", source: "pg3", target: "pg2", label: "Phosphoglycerate mutase", main: true },
  { id: "e8", source: "pg2", target: "pep", label: "Enolase", main: true },
  { id: "e9", source: "pep", target: "pyruvate", label: "Pyruvate kinase", main: true },
  { id: "e10", source: "pyruvate", target: "acetylcoa", label: "Pyruvate dehydrogenase complex", main: true },
  { id: "q1", source: "g6p", target: "p6gl", label: "G6P dehydrogenase", main: true, auto: true },
  { id: "q1b", source: "p6gl", target: "p6g", label: "6-Phosphogluconolactonase", main: true },
  { id: "q2", source: "p6g", target: "ru5p", label: "6-PG dehydrogenase", main: true },
  { id: "q3", source: "ru5p", target: "r5p", label: "Ribose-5-P isomerase", main: true },
  { id: "t0", source: "acetylcoa", target: "citrate", label: "Citrate synthase", main: true },
  ...[["citrate", "isocitrate", "Aconitase"], ["isocitrate", "akg", "Isocitrate dehydrogenase"], ["akg", "succoa", "α-KG dehydrogenase"],
    ["succoa", "succinate", "Succinyl-CoA synthetase"], ["succinate", "fumarate", "Succinate dehydrogenase"], ["fumarate", "malate", "Fumarase"],
    ["malate", "oaa", "Malate dehydrogenase"], ["oaa", "citrate", ""]].map(([source, target, label], i) => ({ id: "t" + (i + 1), source, target, label, main: true, auto: true })),
  ...[["glycogen", "g1p", "Glycogen phosphorylase"], ["pyruvate", "alanine", "Alanine transaminase"], ["pyruvate", "lactate", "Lactate dehydrogenase"],
    ["dhap", "glyc3p", "Glycerol-3-P dehydrogenase"], ["acetylcoa", "acac", "Ketogenesis"],
    ["akg", "glutamate", "Transaminase / GDH"], ["oaa", "aspartate", "Aspartate transaminase"],
    ["ornithine", "citrulline", "Ornithine transcarbamylase"], ["cp", "citrulline", ""], ["citrulline", "argsucc", "Argininosuccinate synthetase"],
    ["aspartate", "argsucc", ""], ["argsucc", "arginine", "Argininosuccinate lyase"], ["arginine", "ornithine", "Arginase"],
    ["arginine", "urea", ""], ["argsucc", "fumarate", ""]].map(([source, target, label], i) => ({ id: "n" + i, source, target, label, main: true, auto: true })),
  ...[["ru5p", "xu5p", "Ribulose-5-P epimerase"], ["xu5p", "s7p", "Transketolase"], ["r5p", "s7p", "Transketolase"], ["s7p", "e4p", "Transaldolase"],
    ["e4p", "f6p", "Transketolase / Transaldolase"],
    ["g1p", "udpglc", "UDP-glucose pyrophosphorylase"], ["udpglc", "glycogen", "Glycogen synthase"],
    ["glyc3p", "tag", "Acyltransferases"], ["facyl", "tag", ""], ["tag", "glycerol", "Lipase"], ["tag", "fa", "Lipase"],
    ["glycerol", "glyc3p", "Glycerol kinase"], ["fa", "facyl", "Acyl-CoA synthetase"], ["acetylcoa", "malonyl", "Acetyl-CoA carboxylase"],
    ["malonyl", "facyl", "Fatty acid synthase"]].map(([source, target, label], i) => ({ id: "l" + i, source, target, label, main: true, auto: true })),
  { id: "boxid", source: "facyl", target: "acetylcoa", label: "β-oxidation", main: true, sh: "l", th: "r" },
  { id: "x1", source: "atp", target: "g6p", label: "phosphate donor", sh: "r", th: "l" },
  ...["g6p", "f6p", "bpg13", "pg2"].map((t, i) => ({ id: "m" + i, source: "mg", target: t, label: "cofactor", sh: "l", th: "r" })),
  ...["pep", "pyruvate"].map((t, i) => ({ id: "k" + i, source: "k", target: t, label: "cofactor", sh: "l", th: "r" })),
  ...["g6p", "pg2", "pep"].map((t, i) => ({ id: "p" + i, source: "p", target: t, label: "part of", sh: "r", th: "l" })),
];

/* ------------------------------ layout ------------------------------ */
// Nodes are positioned by centre (nodeOrigin = [0.5, 0.5]). The pathway runs
// top to bottom like the drawing; co-substrates sit beside their molecule.
const STEP = 330;
const SPINE = ["g1p", "glucose", "g6p", "f6p", "fbp", "gap", "bpg13", "pg3", "pg2", "pep", "pyruvate", "acetylcoa"];
const layout = { dhap: [300, 5 * STEP], atp: [-480, 2.5 * STEP], mg: [520, 3 * STEP], k: [520, 9.5 * STEP], p: [-480, 8 * STEP] };
SPINE.forEach((id, i) => (layout[id] = [0, i * STEP]));
const COSUB_AT = [
  ["glucose", 240, 0], ["g6p", -240, -70], ["f6p", 240, 0], ["fbp", -240, -60], ["gap", -240, 40],
  ["bpg13", 240, 0], ["bpg13", -240, 70], ["pg3", 240, 0], ["pep", 240, -60], ["pep", -240, 70], ["pyruvate", 240, 0],
];
COSUBS.forEach((c, i) => {
  const [at, dx, dy] = COSUB_AT[i];
  layout[c.id] = [layout[at][0] + dx, layout[at][1] + dy];
});
NODES.push(...COSUBS);

// Urea cycle (left of the TCA ring), amino-acid hubs, and links from the integrated map
const U = { x: -2300, y: RING_Y(), r: 650 };
function RING_Y() { return 11 * STEP + 2100; }
Object.assign(layout, {
  citrulline: [U.x, U.y - U.r], argsucc: [U.x + U.r, U.y], arginine: [U.x, U.y + U.r], ornithine: [U.x - U.r, U.y],
  cp: [U.x - 750, U.y - 1000], aspartate: [-1000, U.y - 900], urea: [U.x - U.r, U.y + 850],
  alanine: [-700, 10 * STEP], lactate: [900, 10 * STEP], glutamate: [1700, U.y], glyc3p: [700, 5 * STEP],
  glycogen: [0, -300], facyl: [-700, 11 * STEP], acac: [700, 11 * STEP],
});
[["c_g1", "UTP → PPᵢ"], 
  ["c_u1", "ATP → AMP + PPᵢ"], ["c_u2", "+ H₂O"]].forEach(([id, label]) =>
  NODES.push({ id, kind: "cofactor", label, formula: "", note: "Link to a pathway not drawn yet" }));
layout.c_u1 = [U.x + 360, U.y - U.r]; layout.c_u2 = [U.x, U.y + U.r + 170];

// The twenty proteinogenic amino acids: five sit in the pathways above, the other fifteen form a block to the left of the urea cycle
const AA_NEW = [
  // [id, formula, x col, row, class]
  ["valine", "C5H11NO2", 0, 0, "essential"], ["leucine", "C6H13NO2", 1, 0, "essential"], ["isoleucine", "C6H13NO2", 2, 0, "essential"], ["methionine", "C5H11NO2S", 3, 0, "essential"], ["threonine", "C4H9NO3", 4, 0, "essential"],
  ["lysine", "C6H14N2O2", 0, 1, "essential"], ["histidine", "C6H9N3O2", 1, 1, "essential"], ["phenylalanine", "C9H11NO2", 2, 1, "essential"], ["tryptophan", "C11H12N2O2", 3, 1, "essential"],
  ["serine", "C3H7NO3", 0, 2, "nonessential"], ["cysteine", "C3H7NO2S", 1, 2, "nonessential"], ["tyrosine", "C9H11NO3", 2, 2, "nonessential"], ["proline", "C5H9NO2", 3, 2, "nonessential"], ["glutamine", "C5H10N2O3", 4, 2, "nonessential"], ["asparagine", "C4H8N2O3", 5, 2, "nonessential"],
];
AA_NEW.forEach(([id, f, col, row]) => {
  NODES.push(M(id, f, ""));
  layout[id] = [-7600 + col * 520, 5300 + row * 480 + (row === 2 ? 180 : 0)];
});
EDGES.push({ id: "aa_pt", source: "phenylalanine", target: "tyrosine", label: "Phenylalanine hydroxylase", main: true, auto: true });
layout.c_atp4[1] += 60; // keep clear of the new pyruvate → lactate edge
// Pentose phosphate branch (right of G6P) and the TCA ring (below acetyl-CoA)
layout.p6gl = [1050, 2 * STEP]; layout.p6g = [1050, 3 * STEP]; layout.ru5p = [1050, 4 * STEP]; layout.r5p = [1050, 5 * STEP];
Object.assign(layout, {
  xu5p: [1500, 4 * STEP], s7p: [1500, 5 * STEP], e4p: [1500, 6 * STEP],
  udpglc: [700, -300], c_g1: [700, -150],
  tag: [700, 2300], glycerol: [1200, 2300], fa: [1200, 2900], facyl: [700, 2900], acac: [700, 3900], malonyl: [1500, 3630],
});
const TCA = ["citrate", "isocitrate", "akg", "succoa", "succinate", "fumarate", "malate", "oaa"];
const RING = { cx: 0, cy: 11 * STEP + 2100, r: 700 };
TCA.forEach((id, i) => {
  const a = ((-90 + 45 * i) * Math.PI) / 180;
  layout[id] = [RING.cx + RING.r * Math.cos(a), RING.cy + RING.r * Math.sin(a)];
});
const COSUBS2 = [
  ["c_nadp1", "+ NADPH", "p6gl", 250, 0], ["c_nadp2", "+ NADPH + CO₂", "ru5p", 0, 110],
  ["c_t1", "+ NADH + CO₂", "isocitrate", 260, -50], ["c_t2", "+ NADH + CO₂", "akg", 260, 0],
  ["c_t3", "+ GTP", "succoa", 240, 40], ["c_t4", "+ FADH₂", "succinate", 0, 150],
  ["c_t5", "+ H₂O", "fumarate", -250, 70], ["c_t6", "+ NADH", "malate", -250, 0],
];
COSUBS2.forEach(([id, text, at, dx, dy]) => {
  NODES.push({ id, kind: "cofactor", label: text, formula: "", note: "Co-substrate / co-product" });
  layout[id] = [layout[at][0] + dx, layout[at][1] + dy];
});
/* ---- ALA, heme synthesis, heme breakdown and bilirubin (below the TCA ring) ---- */
Object.assign(PATHWAYS, {
  ala: { label: "ALA synthesis", color: "#38bdf8" },
  heme: { label: "Heme synthesis", color: "#ff4d6d" },
  bili: { label: "Heme breakdown & bilirubin", color: "#e8b931" },
});
const KEY = " A = acetate, P = propionate, M = methyl, V = vinyl.";
NODES.push(
  M("glycine", "C2H5NO2", "Condenses with succinyl-CoA to start heme synthesis"),
  M("ala", "C5H9NO3", "Rate-limiting step (ALAS, mitochondria, needs vitamin B₆); ALAS1 is repressed by heme"),
  M("pbg", "C10H14N2O4", "First pyrrole; ALA dehydratase is inhibited by lead." + KEY),
  M("hmb", "C40H46N4O17", "Linear tetrapyrrole; PBG deaminase deficiency causes acute intermittent porphyria." + KEY),
  M("uro3", "C40H44N4O16", "Ring D flipped by uroporphyrinogen III synthase (deficient in congenital erythropoietic porphyria)." + KEY),
  M("copro3", "C36H44N4O8", "Four decarboxylations (A → M); uroporphyrinogen decarboxylase deficiency causes porphyria cutanea tarda." + KEY),
  M("protogen", "C34H38N4O4", "Colourless porphyrinogen; coproporphyrinogen oxidase: A → V on rings A and B." + KEY),
  M("protoporph", "C34H34N4O4", "Fully conjugated ring system, so it is coloured; protoporphyrinogen oxidase deficiency causes variegate porphyria." + KEY),
  M("heme", "C34H32FeN4O4", "Fe²⁺ inserted by ferrochelatase (inhibited by lead); feeds back on ALAS1." + KEY),
  M("biliverdin", "C33H34N4O6", "Green; heme oxygenase opens the ring at the α-meso carbon, releasing CO and Fe²⁺." + KEY),
  M("bilirubin", "C33H36N4O6", "Unconjugated and lipophilic, carried on albumin to the liver." + KEY),
  M("bilglu", "C45H52N4O18", "Water-soluble; secreted into bile. UGT1A1 is reduced in Gilbert and absent in Crigler–Najjar." + KEY + " GlcA = glucuronate."),
  { id: "fe", kind: "ion", glyph: { symbol: "Fe", charge: "2+" }, label: "Iron", formula: "Fe²⁺", note: "Inserted into protoporphyrin IX by ferrochelatase" },
);
const HCOS = [
  ["c_h1", "+ CoA + CO₂", 440, 7000, "ala"], ["c_h2", "+ 2 H₂O", 960, 7725, "heme"], ["c_h3", "+ 4 NH₃", 960, 8450, "heme"],
  ["c_h4", "+ H₂O", 960, 9250, "heme"], ["c_h5", "+ 4 CO₂", 960, 10050, "heme"], ["c_h6", "+ 2 CO₂ + 2 H₂O", 960, 10850, "heme"],
  ["c_h7", "+ 3 H₂O₂", 960, 11650, "heme"], ["c_h8", "+ 2 H⁺", 960, 12450, "heme"],
  ["c_b1", "+ O₂ + NADPH", 250, 12710, "bili"], ["c_b2", "+ CO + Fe²⁺", 250, 12990, "bili"], ["c_b3", "+ NADPH", -700, 12710, "bili"],
  ["c_b4", "+ 2 UDP-glucuronate", -1700, 12710, "bili"], ["c_b5", "→ 2 UDP", -1700, 12990, "bili"], ["c_b6", "→ bile → gut: urobilinogen", -2950, 12850, "bili"],
];
HCOS.forEach(([id, label, x, y, p]) => {
  NODES.push({ id, kind: "cofactor", label, formula: "", note: id === "c_b6" ? "Link to a pathway not drawn yet" : "Co-substrate / co-product" });
  layout[id] = [x, y];
  PATH_OF[id] = p;
});
Object.entries({
  ala: ["glycine", "ala"],
  heme: ["pbg", "hmb", "uro3", "copro3", "protogen", "protoporph", "heme", "fe"],
  bili: ["biliverdin", "bilirubin", "bilglu"],
}).forEach(([p, ids]) => ids.forEach((i) => (PATH_OF[i] = p)));
const HCHAIN = ["ala", "pbg", "hmb", "uro3", "copro3", "protogen", "protoporph", "heme"];
[7400, 8050, 8850, 9650, 10450, 11250, 12050, 12850].forEach((y, i) => (layout[HCHAIN[i]] = [700, y]));
Object.assign(layout, { glycine: [1300, 7400], fe: [1300, 12850], biliverdin: [-200, 12850], bilirubin: [-1200, 12850], bilglu: [-2200, 12850] });
EDGES.push(
  ...[["succoa", "ala", "ALA synthase (B₆)"], ["glycine", "ala", ""], ["ala", "pbg", "ALA dehydratase"], ["pbg", "hmb", "PBG deaminase"],
    ["hmb", "uro3", "Uroporphyrinogen III synthase"], ["uro3", "copro3", "Uroporphyrinogen decarboxylase"], ["copro3", "protogen", "Coproporphyrinogen oxidase"],
    ["protogen", "protoporph", "Protoporphyrinogen oxidase"], ["protoporph", "heme", "Ferrochelatase"], ["heme", "biliverdin", "Heme oxygenase"],
    ["biliverdin", "bilirubin", "Biliverdin reductase"], ["bilirubin", "bilglu", "UDP-glucuronosyltransferase"]]
    .map(([source, target, label], i) => ({ id: "hm" + i, source, target, label, main: true, auto: true })),
  { id: "hmfe", source: "fe", target: "heme", label: "cofactor", sh: "l", th: "r" },
);

// Big pathway titles sit in or beside their pathway, like the labels on a metro map
[["glycolysis", -560, 1650], ["glycogen", 350, -480], ["ppp", 1275, 430], ["tca", 0, RING.cy], ["urea", U.x, U.y],
  ["amino", -1000, 4550], ["aa", -6300, 4850], ["lipid", 950, 2600],
  ["ala", 1000, 7000], ["heme", 1500, 10050], ["bili", -1000, 12300]].forEach(([p, x, y]) => {
  NODES.push({ id: "t_" + p, kind: "pathway", title: true, label: PATHWAYS[p].label, formula: "", note: "", path: p });
  layout["t_" + p] = [x, y];
});

// Every molecule, ion, atom and co-substrate label on the canvas has the same box; structures are scaled down to fit it.
const NODE_W = 240, NODE_ART_H = 140; // drawn structures share one width and are scaled down to fit it; boxes are otherwise as tight as their content
const isCompound = (n) => !n.rx && !n.title;
const sizeOf = (n) => {
  if (isCompound(n) && n.kind !== "cofactor") return { w: NODE_W };
  if (n.w) return { w: n.w };
  if (n.title) return { w: 320 };
  if (n.kind === "cofactor") return { w: 130 };
  if (DRAWINGS[n.id]) return { w: DRAWINGS[n.id].w || 180 };
  if (n.mol) {
    const m = MOLS[n.mol];
    return { w: Math.max(100, bounds(m).w * (m.scale || 1)) };
  }
  return { w: 90 };
};

/* ------------------------------ drug structures ------------------------------ */
// Skeletal drawings for the pharmacology layer, built with a small "turtle" helper (headings in degrees, 0 = right, 90 = down).
// Stereochemistry (wedges) is not drawn, as for the rest of the atlas.
/* ---- drug structures: a tiny "turtle" builder (bond length 30px, y points down) ---- */
const BL = 30;
const dcos = (d) => Math.cos((d * Math.PI) / 180), dsin = (d) => Math.sin((d * Math.PI) / 180);
function dmol(name, scale = 1) {
  const atoms = [], bonds = [], pos = {};
  const m = {
    name, scale, atoms, bonds,
    // place an atom; text omitted = implicit carbon vertex
    at(id, x, y, text, el, extra) { pos[id] = [x, y]; atoms.push(text ? A(id, [x, y], text, el, extra) : C(id, [x, y])); return m; },
    bond(a, b, o, side) { bonds.push(side ? [a, b, o || 1, side] : o ? [a, b, o] : [a, b]); return m; },
    // step from an existing atom at heading `ang` (degrees, 0 = right, 90 = down)
    to(from, id, ang, text, el, o, extra, len = BL) {
      const [x, y] = pos[from];
      m.at(id, x + len * dcos(ang), y + len * dsin(ang), text, el, extra);
      return m.bond(from, id, o);
    },
    // zigzag chain: steps = [id, text?, el?, order?, extra?]; turn alternates ±60° from the start heading
    walk(from, ang, turn, steps) {
      let h = ang, t = turn, prev = from;
      for (const [id, text, el, o, extra] of steps) {
        m.to(prev, id, h, text, el, o, extra);
        prev = id; h += t; t = -t;
      }
      return m;
    },
    // ring whose vertex 0 is the existing atom `from`; the ring centre lies along heading `ang`.
    // dbl = indices k for a double bond between vertex k and k+1; het = { k: [text, el, extra] } for ring heteroatoms
    ring(id, from, ang, n, dbl = [], het = {}) {
      const r = BL / (2 * Math.sin(Math.PI / n)), [x0, y0] = pos[from];
      const c = [x0 + r * dcos(ang), y0 + r * dsin(ang)], ids = [];
      for (let k = 0; k < n; k++) {
        const a = ang + 180 + (360 / n) * k, vid = k === 0 ? from : id + k;
        ids.push(vid);
        if (k) { const h = het[k]; m.at(vid, c[0] + r * dcos(a), c[1] + r * dsin(a), h && h[0], h && h[1], h && h[2]); }
      }
      for (let k = 0; k < n; k++) dbl.includes(k) ? m.bond(ids[k], ids[(k + 1) % n], 2, c) : m.bond(ids[k], ids[(k + 1) % n]);
      m.ctr = m.ctr || {}; m.ctr[id] = { c, ids, ang };
      return m;
    },
    // outward heading of ring vertex k (from the ring centre)
    out(id, k) { const R = m.ctr[id]; const [x, y] = pos[R.ids[k]]; return (Math.atan2(y - R.c[1], x - R.c[0]) * 180) / Math.PI; },
    id(rid, k) { return m.ctr[rid].ids[k]; },
    pos,
  };
  return m;
}
const DRUG_MOLS = {};

/* aspirin  CC(=O)Oc1ccccc1C(=O)O */
DRUG_MOLS.aspirin = (() => {
  const m = dmol("Aspirin (acetylsalicylic acid)", 1.1);
  m.at("a0", 0, 0).ring("r", "a0", 0, 6, [1, 3, 5]);
  m.to("a0", "Oe", 180, "O", "O");
  m.to("Oe", "Ca", 120, null).to("Ca", "Oa", 60, "O", "O", 2).to("Ca", "Me", 180, null);
  const v1 = m.id("r", 1);
  m.to(v1, "Cc", m.out("r", 1), null);
  m.to("Cc", "Od", 180, "O", "O", 2).to("Cc", "Oh", 300, "OH", "O", 1, { align: "start" });
  return m;
})();

/* acetaminophen  CC(=O)Nc1ccc(O)cc1 */
DRUG_MOLS.apap = (() => {
  const m = dmol("Acetaminophen (paracetamol)", 1.15);
  m.at("a0", 0, 0).ring("r", "a0", 0, 6, [1, 3, 5]);
  m.to("a0", "N", 180, "HN", "N", 1, { align: "end" });
  m.to("N", "Ca", 240, null).to("Ca", "O", 300, "O", "O", 2).to("Ca", "Me", 180, null);
  m.to(m.id("r", 3), "Oh", 0, "OH", "O", 1, { align: "start" });
  return m;
})();

/* dichloroacetate  Cl2CH-COO- */
DRUG_MOLS.dca = (() => {
  const m = dmol("Dichloroacetate", 1.5);
  m.at("c1", 0, 0).to("c1", "Cl1", 240, "Cl", "Cl").to("c1", "Cl2", 120, "Cl", "Cl").to("c1", "c2", 0, null);
  m.to("c2", "O1", 300, "O", "O", 2).to("c2", "O2", 60, "O", "O", 1, { q: "−" });
  return m;
})();

/* carglumic acid  H2N-CO-NH-CH(COOH)-CH2-CH2-COOH */
DRUG_MOLS.carglu = (() => {
  const m = dmol("Carglumic acid", 1.1);
  m.at("n1", 0, 0, "NH2", "N", { align: "end" });
  m.walk("n1", 30, -60, [["cu"], ["n2", "NH", "N"], ["ca"], ["cb"], ["cg"], ["cd"]]);
  m.to("cu", "Ou", 90, "O", "O", 2);
  m.to("ca", "Cx", 90, null).to("Cx", "Ox1", 150, "O", "O", 2).to("Cx", "Ox2", 30, "OH", "O", 1, { align: "start" });
  m.to("cd", "Od1", 270, "O", "O", 2).to("cd", "Od2", 30, "OH", "O", 1, { align: "start" });
  return m;
})();

/* levocarnitine  (CH3)3N+ -CH2-CH(OH)-CH2-COO- */
DRUG_MOLS.carn = (() => {
  const m = dmol("Levocarnitine", 1.3);
  m.at("n", 0, 0, "N", "N", { q: "+", qd: [10, -10] });
  m.walk("n", 30, -60, [["c1"], ["c2"], ["c3"], ["c4"]]);
  m.to("n", "m1", 150, null).to("n", "m2", 210, null).to("n", "m3", 270, null);
  m.to("c2", "Oh", 270, "OH", "O");
  m.to("c4", "O1", 270, "O", "O", 2).to("c4", "O2", 30, "O", "O", 1, { q: "−" });
  return m;
})();

/* fenofibrate  CC(C)OC(=O)C(C)(C)Oc1ccc(cc1)C(=O)c1ccc(Cl)cc1 */
DRUG_MOLS.feno = (() => {
  const m = dmol("Fenofibrate", 0.9);
  m.at("a0", 0, 0).ring("r", "a0", 30, 6, [1, 3, 5]);           // phenoxy ring, tilted so the chains zigzag
  m.to("a0", "Oe", 210, "O", "O");
  m.to("Oe", "Cq", 150, null);
  m.to("Cq", "m1", 270, null).to("Cq", "m2", 90, null);
  m.to("Cq", "Ce", 210, null).to("Ce", "Oc", 270, "O", "O", 2);
  m.to("Ce", "Oi", 150, "O", "O").to("Oi", "Ci", 210, null).to("Ci", "i1", 150, null).to("Ci", "i2", 270, null);
  const v3 = m.id("r", 3);
  m.to(v3, "Ck", 30, null).to("Ck", "Ok", 270, "O", "O", 2).to("Ck", "b0", 330, null);
  m.ring("q", "b0", 330, 6, [1, 3, 5]);
  m.to(m.id("q", 3), "Cl", 330, "Cl", "Cl");
  return m;
})();

/* gemfibrozil  Cc1ccc(C)c(OCCCC(C)(C)C(=O)O)c1 */
DRUG_MOLS.gem = (() => {
  const m = dmol("Gemfibrozil", 1.0);
  m.at("a0", 0, 0).ring("r", "a0", 30, 6, [1, 3, 5]);
  // ring order from the O-bearing carbon: C1(v0) C2(v1, CH3) C3 C4 C5(v4, CH3) C6
  m.to(m.id("r", 1), "me1", m.out("r", 1), null);
  m.to(m.id("r", 4), "me2", m.out("r", 4), null);
  m.to("a0", "Oe", 210, "O", "O");
  m.walk("Oe", 150, 60, [["c1"], ["c2"], ["c3"], ["cq"]]);
  m.to("cq", "q1", 270, null).to("cq", "q2", 90, null);
  m.to("cq", "cc", 150, null).to("cc", "o1", 90, "O", "O", 2).to("cc", "o2", 210, "OH", "O", 1, { align: "end" });
  return m;
})();


/* pioglitazone  CCc1ccc(CCOc2ccc(CC3SC(=O)NC3=O)cc2)nc1 */
DRUG_MOLS.pio = (() => {
  const m = dmol("Pioglitazone", 0.82);
  m.at("p0", 0, 0).ring("py", "p0", 30, 6, [0, 2, 4], { 4: ["N", "N"] });
  m.to("p0", "e1", 210, null).to("e1", "e2", 150, null);
  m.to(m.id("py", 3), "l1", 30, null).to("l1", "l2", 330, null).to("l2", "lo", 30, "O", "O").to("lo", "b0", 330, null);
  m.ring("ph", "b0", 330, 6, [1, 3, 5]);
  m.to(m.id("ph", 3), "ch2", 330, null).to("ch2", "t0", 30, null);
  m.ring("tz", "t0", 30, 5, [], { 1: ["S", "S"], 3: ["NH", "N"] });
  m.to(m.id("tz", 2), "tO1", m.out("tz", 2), "O", "O", 2);
  m.to(m.id("tz", 4), "tO2", m.out("tz", 4), "O", "O", 2);
  return m;
})();

/* atorvastatin  CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CC[C@@H](O)C[C@@H](O)CC(=O)O */
DRUG_MOLS.atorva = (() => {
  const m = dmol("Atorvastatin", 0.85);
  m.at("n", 0, 0, "N", "N");
  m.ring("py", "n", 0, 5, [1, 3]);               // v0 N, v1 C5 (F-phenyl), v2 C4 (phenyl), v3 C3 (anilide), v4 C2 (isopropyl)
  // 4-fluorophenyl on v1 (points up)
  m.to(m.id("py", 1), "f0", 270, null);
  m.ring("fp", "f0", 270, 6, [1, 3, 5]);
  m.to(m.id("fp", 3), "F", 270, "F", "F");
  // phenyl on v2 (points up-right)
  m.to(m.id("py", 2), "p0", 330, null);
  m.ring("ph", "p0", 330, 6, [1, 3, 5]);
  // anilide on v3 (points right / down)
  m.to(m.id("py", 3), "k1", 30, null).to("k1", "ko", 330, "O", "O", 2).to("k1", "kn", 90, "NH", "N").to("kn", "an0", 30, null);
  m.ring("an", "an0", 30, 6, [1, 3, 5]);
  // isopropyl on v4 (points down)
  m.to(m.id("py", 4), "i1", 90, null).to("i1", "i2", 150, null).to("i1", "i3", 30, null);
  // heptanoic acid chain on N (points left)
  m.walk("n", 210, -60, [["h1"], ["h2"], ["h3"], ["h4"], ["h5"], ["h6"], ["h7"]]);
  m.to("h3", "h3o", 270, "OH", "O").to("h5", "h5o", 270, "OH", "O");
  m.to("h7", "ho1", 270, "O", "O", 2).to("h7", "ho2", 150, "HO", "O", 1, { align: "end" });
  return m;
})();

/* dapagliflozin  C-aryl glucoside: CCOc1ccc(Cc2cc(ccc2Cl)[C@@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)cc1 */
DRUG_MOLS.dapa = (() => {
  const m = dmol("Dapagliflozin", 0.8);
  chairAtoms().filter((a) => a.id !== "O1").forEach((a) => { m.atoms.push(a); m.pos[a.id] = [a.x, a.y]; });
  chairBonds.filter((b) => b[1] !== "O1").forEach((b) => m.bonds.push(b));
  m.at("O6", ...pt(-1.65, 1.02), "HO", "O", { align: "end" });
  m.at("b0", ...pt(1.85, 0.05)).bond("C1", "b0");
  m.ring("B", "b0", -19.4, 6, [1, 3, 5]);
  m.to(m.id("B", 3), "Cl", m.out("B", 3), "Cl", "Cl");
  m.to(m.id("B", 4), "bz", m.out("B", 4), null).to("bz", "c0", m.out("B", 4) - 60, null);
  m.ring("D", "c0", m.out("B", 4) - 60, 6, [1, 3, 5]);
  m.to(m.id("D", 3), "Oe", m.out("D", 3), "O", "O");
  m.to("Oe", "Ee1", m.out("D", 3) + 60, null).to("Ee1", "Ee2", m.out("D", 3), null);
  return m;
})();

/* orlistat  CCCCCCCCCCCC(CC1C(C(=O)O1)CCCCCC)OC(=O)C(CC(C)C)NC=O */
DRUG_MOLS.orli = (() => {
  const m = dmol("Orlistat", 0.68);
  m.at("t0", 0, 0).walk("t0", 30, -60, [["t1"], ["t2"], ["t3"], ["t4"], ["t5"], ["t6"], ["t7"], ["t8"], ["t9"], ["t10"], ["c11"], ["c12"], ["c13"]]);
  // ester down from C11 (leucine N-formyl)
  m.to("c11", "Oe", 90, "O", "O").to("Oe", "Ca", 150, null).to("Ca", "Oc", 210, "O", "O", 2).to("Ca", "Cl", 90, null);
  m.to("Cl", "Nf", 150, "NH", "N").to("Nf", "Cf", 210, null).to("Cf", "Of", 270, "O", "O", 2);
  m.to("Cl", "i1", 30, null).to("i1", "i2", 330, null).to("i2", "i3", 270, null).to("i2", "i4", 30, null);
  // beta-lactone on C13
  m.ring("lac", "c13", 45, 4, [], { 3: ["O", "O"] });
  m.to(m.id("lac", 2), "lo", m.out("lac", 2), "O", "O", 2);
  m.walk(m.id("lac", 1), 330, 60, [["h1"], ["h2"], ["h3"], ["h4"], ["h5"], ["h6"]]);
  return m;
})();

/* dorzagliatin  CC(C)C[C@@H](C(=O)NC1=NN(C=C1)C[C@H](CO)O)N2CC(=CC2=O)OC3=CC=CC=C3Cl */
DRUG_MOLS.dorza = (() => {
  const m = dmol("Dorzagliatin", 0.85);
  m.at("ca", 0, 0);
  m.to("ca", "c2", 210, null).to("c2", "c3", 270, null).to("c3", "m1", 210, null).to("c3", "m2", 330, null);
  m.to("ca", "co", 330, null).to("co", "o", 270, "O", "O", 2).to("co", "nh", 30, "NH", "N").to("nh", "z0", 330, null);
  m.ring("pz", "z0", 330, 5, [0, 3], { 1: ["N", "N"], 2: ["N", "N"] });   // C3=N2-N1(-R)-C5=C4
  m.to(m.id("pz", 2), "r1", m.out("pz", 2), null);
  m.walk("r1", m.out("pz", 2) + 60, -60, [["r2"], ["r3"]]);
  m.to("r2", "r2o", 90, "OH", "O").to("r3", "r3o", 30, "OH", "O", 1, { align: "start" });
  // lactam below
  m.to("ca", "ln", 90, "N", "N");
  m.ring("lc", "ln", 90, 5, [2]);
  m.to(m.id("lc", 4), "lo", m.out("lc", 4), "O", "O", 2);
  m.to(m.id("lc", 2), "ao", m.out("lc", 2), "O", "O").to("ao", "ar0", 0, null);
  m.ring("ar", "ar0", 0, 6, [1, 3, 5]);
  m.to(m.id("ar", 5), "Cl", m.out("ar", 5), "Cl", "Cl");
  return m;
})();

/* ------------------------------ pharmacology ------------------------------ */
// A layer on top of the metabolic map: drugs -> their targets (enzymes, transporters, receptors) -> the metabolite the target acts on.
//   drug -> target  : the effect, drawn as a coloured line (FX below)
//   target -> metabolite : a thin dotted tether showing what the target works on
const RX_COLOR = "#e879f9";
const FX = {
  inhibit: { label: "Inhibition", verb: "inhibits", color: "#ff5d5d", note: "The drug blocks the target" },
  activate: { label: "Activation", verb: "activates", color: "#4ade80", note: "The drug raises the target's activity" },
  substrate: { label: "Substrate", verb: "substrate of", color: "#38bdf8", note: "The drug is metabolised or carried by the target" },
  alter: { label: "Chemical alteration", verb: "alters", color: "#f59e0b", note: "The drug cross-links, cuts or breaks down its target" },
};
const TYPE = { enzyme: "Enzyme", transporter: "Transporter", receptor: "Receptor" };
Object.assign(KIND, {
  drug: { label: "Drug", color: RX_COLOR },
  enzyme: { label: "Enzyme", color: "#fcd34d" },
  transporter: { label: "Transporter", color: "#2dd4bf" },
  receptor: { label: "Receptor", color: "#a5b4fc" },
});
KIND.antibody = { label: "Immunoglobulin", color: "#34d399" };
KIND.vitf = { label: "Fat-soluble vitamin", color: "#fbbf24" };
KIND.vitw = { label: "Water-soluble vitamin", color: "#38bdf8" };
PATHWAYS.pharm = { label: "Pharmacology", color: RX_COLOR };

// id, name, type, gene, what it does, metabolites it acts on, the enzyme label on the map it belongs to (if any), preferred side
const TARGETS = [
  ["t_hmgcr", "HMG-CoA reductase", "enzyme", "HMGCR", "Rate-limiting enzyme of cholesterol synthesis: turns HMG-CoA into mevalonate in the cytosol. Blocking it lowers hepatic cholesterol, so liver cells make more LDL receptors and clear more LDL from blood.", ["c_mev"], null, "l"],
  ["t_sglt2", "SGLT2", "transporter", "SLC5A2", "Sodium–glucose cotransporter of the proximal tubule; reabsorbs about 90% of filtered glucose. Blocking it makes the kidney excrete glucose, lowering blood glucose without insulin.", ["glucose"], null, "l"],
  ["t_gk", "Glucokinase", "enzyme", "GCK", "Hexokinase IV of liver and pancreatic β-cells, with a high Km so it senses blood glucose. Activating it lowers the glucose level that triggers insulin release and increases hepatic glucose uptake.", ["glucose"], "Hexokinase / Glucokinase", "l"],
  ["t_pdc", "Pyruvate dehydrogenase complex", "enzyme", "PDHA1 (E1α)", "Mitochondrial complex that turns pyruvate into acetyl-CoA. Pyruvate dehydrogenase kinase (PDK) switches it off by phosphorylation, so inhibiting PDK keeps the complex active.", ["pyruvate"], "Pyruvate dehydrogenase complex", "l"],
  ["t_lipase", "Pancreatic lipase", "enzyme", "PNLIP", "Hydrolyses dietary triacylglycerol in the small intestine to monoacylglycerol and free fatty acids, which are then absorbed.", ["tag"], "Lipase", "r"],
  ["t_ppara", "PPARα", "receptor", "PPARA", "Nuclear receptor, most abundant in liver, heart and skeletal muscle. When activated it increases genes for fatty acid uptake, β-oxidation and lipoprotein lipase, which lowers plasma triacylglycerol.", ["fa"], null, "r"],
  ["t_pparg", "PPARγ", "receptor", "PPARG", "Nuclear receptor of adipose tissue. Activation promotes adipocyte differentiation, fatty acid storage as triacylglycerol and insulin sensitivity.", ["tag"], null, "r"],
  ["t_cps1", "Carbamoyl phosphate synthetase I", "enzyme", "CPS1", "First and rate-limiting step of the urea cycle (liver mitochondria): ammonia and bicarbonate become carbamoyl phosphate. It needs N-acetylglutamate as an allosteric activator.", ["cp"], null, "l"],
  ["t_ugt", "UDP-glucuronosyltransferase", "enzyme", "UGT1A1, 1A6, 1A9", "Attaches glucuronate to bilirubin (UGT1A1) and to many drugs, making them water-soluble for bile or urine. Drugs and bilirubin compete for it; low UGT1A1 activity causes Gilbert syndrome.", ["bilirubin"], "UDP-glucuronosyltransferase", "l"],
  ["t_cox", "Cyclooxygenase (COX-1, COX-2)", "enzyme", "PTGS1, PTGS2", "Converts arachidonic acid to prostaglandin H₂, the precursor of prostaglandins and thromboxane A₂. COX-1 makes platelet thromboxane; COX-2 is induced in inflammation.", ["c_pg"], null, "r"],
  ["t_cpt1", "Carnitine palmitoyltransferase I", "enzyme", "CPT1A", "Outer mitochondrial membrane enzyme that moves the acyl group of fatty acyl-CoA onto carnitine so long-chain fatty acids can enter mitochondria. It is the rate-limiting step of β-oxidation and is inhibited by malonyl-CoA.", ["facyl"], "β-oxidation", "r"],
];
// id, name, class, examples, note, effects [target, kind, detail], structure shown (key of DRUG_MOLS)
const DRUGS = [
  ["d_statin", "Statins", "HMG-CoA reductase inhibitors", "atorvastatin, simvastatin, rosuvastatin", "Structural analogues of HMG-CoA that compete for the active site. First-line to lower LDL cholesterol and cardiovascular risk. Adverse effects: myopathy, raised liver enzymes; contraindicated in pregnancy.", [["t_hmgcr", "inhibit", "Competitive with HMG-CoA, so less mevalonate and less hepatic cholesterol."]], "atorva"],
  ["d_sglt2", "SGLT2 inhibitors", "Gliflozins", "empagliflozin, dapagliflozin, canagliflozin", "Cause glucosuria and mild natriuresis. Beyond lowering glucose they reduce heart-failure admissions and slow chronic kidney disease. Risks: genital fungal infection, euglycemic ketoacidosis.", [["t_sglt2", "inhibit", "Less glucose is reabsorbed in the proximal tubule, so glucose is lost in urine."]], "dapa"],
  ["d_dorza", "Dorzagliatin", "Glucokinase activator", "dorzagliatin", "Acts in both liver and pancreas: it lowers the glucose threshold for insulin secretion and raises hepatic glucose uptake. Approved for type 2 diabetes in China in 2022.", [["t_gk", "activate", "Allosteric activation, so glucokinase works at a lower glucose concentration."]], "dorza"],
  ["d_dca", "Dichloroacetate", "PDK inhibitor", "dichloroacetate (DCA)", "Investigational; used for congenital lactic acidosis. It lowers lactate by letting pyruvate enter the TCA cycle. Main toxicity: peripheral neuropathy.", [["t_pdc", "activate", "Indirect: DCA inhibits pyruvate dehydrogenase kinase, so the complex stays dephosphorylated and active."]], "dca"],
  ["d_orlistat", "Orlistat", "Lipase inhibitor", "orlistat", "Binds the active-site serine of gastric and pancreatic lipases, so roughly a third of dietary fat is not absorbed. Adverse effects: oily stools, urgency, fat-soluble vitamin deficiency.", [["t_lipase", "inhibit", "Covalent, so dietary triacylglycerol is not hydrolysed and passes out in stool."]], "orli"],
  ["d_fibrate", "Fibrates", "PPARα agonists", "fenofibrate, gemfibrozil", "Lower triacylglycerol most and raise HDL modestly. Raise the risk of gallstones and of myopathy with statins (more so with gemfibrozil).", [["t_ppara", "activate", "Raise transcription of β-oxidation genes and lipoprotein lipase."]], "feno"],
  ["d_tzd", "Thiazolidinediones", "PPARγ agonists", "pioglitazone", "Improve insulin sensitivity in fat, muscle and liver. Adverse effects: fluid retention (avoid in heart failure), weight gain, fractures.", [["t_pparg", "activate", "Promote fat storage in adipocytes, which lowers circulating fatty acids."]], "pio"],
  ["d_carglu", "Carglumic acid", "N-acetylglutamate analogue", "carglumic acid", "A stable copy of N-acetylglutamate, the allosteric activator of CPS I. Treats hyperammonemia in NAGS deficiency and some organic acidemias.", [["t_cps1", "activate", "Mimics N-acetylglutamate, so CPS I runs and ammonia enters the urea cycle."]], "carglu"],
  ["d_apap", "Acetaminophen", "Analgesic, antipyretic", "acetaminophen (paracetamol)", "Mostly cleared by glucuronidation and sulfation; a small fraction is oxidised by CYP2E1 to NAPQI, which glutathione normally neutralises. In overdose glutathione runs out and the liver is damaged; antidote is N-acetylcysteine.", [["t_ugt", "substrate", "Glucuronidated by UGTs (mainly 1A6, 1A9 and 1A1) to an inactive, water-soluble conjugate."]], "apap"],
  ["d_asa", "Aspirin", "NSAID, antiplatelet", "acetylsalicylic acid", "Transfers its acetyl group to a serine in the COX channel, an irreversible block. Platelets cannot make new COX-1, so thromboxane A₂ stays low for their 7–10 day life. Hydrolysed in blood and liver to salicylate.", [["t_cox", "inhibit", "Irreversible acetylation of COX-1 and COX-2 (the drug itself is consumed in the reaction)."]], "aspirin"],
  ["d_carn", "Levocarnitine", "Carnitine supplement", "levocarnitine (L-carnitine)", "Replaces carnitine in primary carnitine deficiency (OCTN2 defect) and some secondary deficiencies.", [["t_cpt1", "substrate", "Carnitine is the acyl acceptor in the CPT I reaction."]], "carn"],
];

// Two link stubs for pathways the atlas does not draw (same convention as "→ bile → gut")
NODES.push(
  { id: "c_mev", kind: "cofactor", label: "HMG-CoA → mevalonate → cholesterol", formula: "", note: "Link to a pathway not drawn yet", w: 300, pharm: true },
  { id: "c_pg", kind: "cofactor", label: "Arachidonate → prostaglandins, thromboxane", formula: "", note: "Link to a pathway not drawn yet", w: 330, pharm: true },
);
layout.c_mev = [-470, 3640]; layout.c_pg = [1800, 2380];
PATH_OF.c_mev = "pharm"; PATH_OF.c_pg = "pharm";

// Auto-placement: each target sits on its preferred side of its metabolite, its drug just beyond it, and nothing overlaps
// an existing node or crosses an existing arrow.
const RX_ALL = [...NODES];
const hOfNode = (n) => (n.title ? 60 : n.kind === "cofactor" ? 44 : n.mol ? Math.min(NODE_ART_H, bounds(MOLS[n.mol]).h * (MOLS[n.mol].scale || 1)) + 64 : 130);
const boxAt = (x, y, w, h, m = 0) => ({ x0: x - w / 2 - m, x1: x + w / 2 + m, y0: y - h / 2 - m, y1: y + h / 2 + m });
const boxHit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const segHitsBox = ([ax, ay], [bx, by], b) => {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [pp, qq] of [[-dx, ax - b.x0], [dx, b.x1 - ax], [-dy, ay - b.y0], [dy, b.y1 - ay]]) {
    if (pp === 0) { if (qq < 0) return false; } else { const r = qq / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
};
const placedBoxes = RX_ALL.filter((n) => layout[n.id]).map((n) => ({ id: n.id, box: boxAt(layout[n.id][0], layout[n.id][1], sizeOf(n).w, hOfNode(n), 22) }));
const placedSegs = EDGES.filter((e) => layout[e.source] && layout[e.target]).map((e) => [layout[e.source], layout[e.target]]);
const SIDE_ANG = { l: [180, 168, 192, 156, 204, 144, 216, 132, 228, 120, 240], r: [0, 12, -12, 24, -24, 36, -36, 48, -48, 60, -60] };
function placeBeside(anchorId, w, h, side, d0) {
  const [ax, ay] = layout[anchorId];
  for (let d = d0; d < 2400; d += 40) {
    for (const a of SIDE_ANG[side]) {
      const cx = Math.round(ax + d * Math.cos((a * Math.PI) / 180)), cy = Math.round(ay + d * Math.sin((a * Math.PI) / 180));
      const box = boxAt(cx, cy, w, h);
      if (placedBoxes.some((p) => boxHit(p.box, box))) continue;
      if (placedSegs.some(([p, q]) => segHitsBox(p, q, boxAt(cx, cy, w, h, 14)))) continue;
      if (placedBoxes.some((p) => p.id !== anchorId && segHitsBox([ax, ay], [cx, cy], p.box))) continue;
      return [cx, cy];
    }
  }
  return [ax + (side === "l" ? -900 : 900), ay];
}
const RX_TARGET_W = 210, RX_TARGET_H = 96;
const RX_EFFECTS = [], RX_ACTS = [];
TARGETS.forEach(([id, label, type, gene, note, acts, enz, side]) => {
  const anchor = acts[0];
  layout[id] = placeBeside(anchor, RX_TARGET_W, RX_TARGET_H, side, 460);
  placedBoxes.push({ id, box: boxAt(layout[id][0], layout[id][1], RX_TARGET_W, RX_TARGET_H, 22) });
  acts.forEach((m) => { placedSegs.push([layout[id], layout[m]]); RX_ACTS.push({ target: id, met: m }); });
  NODES.push({ id, kind: type, rx: "target", label, formula: gene, note, enz, w: RX_TARGET_W, pharm: true });
  PATH_OF[id] = "pharm";
});
DRUGS.forEach(([id, label, cls, examples, note, fx, molKey]) => {
  // each drug node carries the skeletal structure of one (representative) drug, so its box grows with the drawing
  const mol = DRUG_MOLS[molKey], mb = bounds(mol), art = { w: Math.ceil(mb.w * mol.scale), h: Math.ceil(mb.h * mol.scale) };
  const shown = mol.name.toLowerCase().startsWith(label.toLowerCase()) ? null : mol.name; // e.g. "Statins" shows atorvastatin
  const W = NODE_W, H = Math.min(NODE_ART_H, art.h) + (shown ? 128 : 108); // drugs share the molecules' width; height hugs the drawing
  MOLS[id] = mol;
  const t0 = fx[0][0], side = TARGETS.find((t) => t[0] === t0)[7];
  layout[id] = placeBeside(t0, W, H, side, 420 + Math.max(0, (W - 210) / 2));
  placedBoxes.push({ id, box: boxAt(layout[id][0], layout[id][1], W, H, 22) });
  fx.forEach(([t, kind, detail]) => { placedSegs.push([layout[id], layout[t]]); RX_EFFECTS.push({ drug: id, target: t, fx: kind, detail }); });
  NODES.push({ id, kind: "drug", rx: "drug", label, formula: cls, note: `${note} Examples: ${examples}.`, examples, dm: id, shown, w: W, pharm: true });
  PATH_OF[id] = "pharm";
});
RX_EFFECTS.forEach((e) => EDGES.push({ id: `rx_${e.drug}_${e.target}`, source: e.drug, target: e.target, label: e.fx === "activate" && e.detail.startsWith("Indirect") ? "activates (via PDK)" : FX[e.fx].verb, fx: e.fx, auto: true, path: "pharm" }));
RX_ACTS.forEach((a) => EDGES.push({ id: `rx_${a.target}_${a.met}`, source: a.target, target: a.met, label: "", fx: "tether", auto: true, path: "pharm" }));
const RX_ANCHORS = new Set(RX_ACTS.map((a) => a.met));

/* ------------------------------ cellular locations ------------------------------ */
const LOCS = {
  cyt: { label: "Cytosol", short: "Cytosol", color: "#22d3ee", desc: "Aqueous interior of the cell. Hosts glycolysis, the pentose phosphate pathway, glycogen turnover, fatty acid synthesis and the later steps of the urea cycle and heme synthesis." },
  mit: { label: "Mitochondria", short: "Mito", color: "#fb923c", desc: "Double-membrane organelle. The matrix holds the TCA cycle, pyruvate dehydrogenase, β-oxidation, the first steps of the urea cycle, ALA synthase and ferrochelatase." },
  er: { label: "Endoplasmic reticulum", short: "ER", color: "#a3e635", desc: "Membrane network and lumen. Triacylglycerol is assembled here, UGT conjugates drugs and bilirubin, and heme oxygenase and HMG-CoA reductase sit in its membrane. In muscle its counterpart, the sarcoplasmic reticulum, stores the calcium that triggers contraction." },
  nuc: { label: "Nucleus", short: "Nucleus", color: "#c084fc", desc: "Houses DNA. Nuclear receptors such as the PPARs, the mineralocorticoid receptor and the glucocorticoid receptor change gene transcription once activated." },
  pm: { label: "Plasma membrane", short: "Membrane", color: "#94a3b8", desc: "Cell-surface membrane. Transporters, channels and G-protein-coupled receptors sit here, so most drug targets of the organ hubs live in this compartment." },
  ap: { label: "Apical membrane", short: "Apical", color: "#2dd4bf", desc: "The lumen-facing surface of a polarised epithelial cell, such as a kidney tubule or gut cell. Most diuretic targets sit here, so the drug reaches them from the tubular fluid." },
  bl: { label: "Basolateral membrane", short: "Basolateral", color: "#fcd34d", desc: "The blood-facing surface of an epithelial cell. Hormone receptors such as the vasopressin V₂ receptor and the Na⁺/K⁺-ATPase that drives reabsorption sit here." },
  ext: { label: "Extracellular / lumen", short: "Blood · lumen", color: "#f9a8d4", desc: "Blood, interstitial fluid, kidney tubule or gut lumen. Glucose, lactate, ketone bodies, urea and albumin-bound bilirubin travel here between organs." },
};
const LOC_OF = {};
Object.entries({
  cyt: "glucose g6p f6p fbp gap dhap bpg13 pg3 pg2 pep pyruvate lactate g1p glycogen udpglc p6gl p6g ru5p r5p xu5p s7p e4p alanine aspartate glutamate ornithine citrulline argsucc arginine urea glyc3p glycerol fa facyl malonyl acetylcoa glycine ala pbg hmb uro3 copro3 bilirubin biliverdin mg k p atp fe t_gk c_mev",
  mit: "pyruvate acetylcoa citrate isocitrate akg succoa succinate fumarate malate oaa cp ornithine citrulline aspartate glutamate facyl acac glycine ala copro3 protogen protoporph heme fe atp t_pdc t_cps1 t_cpt1",
  er: "tag glyc3p biliverdin bilglu t_hmgcr t_ugt t_cox c_mev c_pg",
  nuc: "t_ppara t_pparg",
  ap: "t_sglt2",
  ext: "glucose lactate alanine acac fa glycerol urea bilirubin bilglu t_lipase",
}).forEach(([l, ids]) => ids.split(" ").forEach((id) => (LOC_OF[id] = [...(LOC_OF[id] || []), l])));
const hasLoc = (id, l) => (LOC_OF[id] || []).includes(l);

/* ------------------------------ organ hubs ------------------------------ */
// Each hub groups the drug targets of one organ system. New targets and drugs sit in a cluster around their hub;
// older targets stay beside their metabolite and are linked to the hub (the line appears when the organ is selected).
const ORGANS = {
  cv: { label: "Cardiovascular", code: "CV", color: "#ff6b81", desc: "Heart rate, contractility, vascular tone and platelet function. Blood pressure is set largely by the renin–angiotensin system, the sympathetic system and calcium entry into smooth muscle." },
  rn: { label: "Renal", code: "RN", color: "#60a5fa", desc: "The nephron filters plasma, then reclaims glucose, bicarbonate, urate, salt and water segment by segment. Targets are listed in order along the nephron: proximal tubule, thick ascending limb, distal tubule, collecting duct, then the glomerular vessels, juxtaglomerular cells and interstitium." },
  rs: { label: "Respiratory", code: "RS", color: "#67e8f9", desc: "Airway smooth muscle tone and airway inflammation. Bronchodilators relax the muscle; inhaled corticosteroids damp the inflammation that drives asthma and COPD." },
  sk: { label: "Skeletal", code: "SK", color: "#e7d3a8", desc: "Bone, joints and skeletal muscle. Bone is constantly remodelled by osteoclasts (resorption) and osteoblasts (formation); inflammatory arthritis and gout damage joints; at the neuromuscular junction acetylcholine triggers calcium release and contraction. Drugs are grouped by those three tissues." },
  gi: { label: "Gastrointestinal", code: "GI", color: "#fb923c", desc: "Acid secretion by gastric parietal cells, fat digestion, nausea and vomiting, motility and secretion in the gut, and gut-homing inflammation." },
  cn: { label: "Nervous system", code: "CN", color: "#c4b5fd", desc: "Neurotransmitter reuptake and receptor signalling in the brain. Most CNS drugs act on membrane transporters and ligand-gated channels." },
  hp: { label: "Hepatic", code: "HP", color: "#a3e635", desc: "The liver makes cholesterol and urea, oxidises fatty acids, clears alcohol and conjugates bilirubin and drugs for excretion. It is also the site of hepatitis B and C infection and of the bile-acid and LDL-receptor controls. Metabolic targets are drawn beside the metabolites they act on." },
  en: { label: "Endocrine & metabolic", code: "EN", color: "#f472b6", desc: "Insulin and incretin signalling, glucose sensing and fat storage, plus the thyroid, parathyroid, pituitary and sex-steroid axes. Glucose targets are drawn beside glucose, pyruvate or triacylglycerol; the rest sit on the hub ring." },
  on: { label: "Oncology", code: "ON", color: "#facc15", desc: "Cytotoxic chemotherapy kills dividing cells, so its targets are the supply of DNA building blocks, the integrity of DNA and the mitotic spindle. Drugs are grouped by mechanism and, where it applies, by cell-cycle phase. Tissues that divide quickly (marrow, gut lining, hair follicles, gonads) set the usual toxicities. Hormonal agents and antiemetics that sit on other hubs are linked here, and rescue and supportive drugs are included." },
  im: { label: "Immune", code: "IM", color: "#34d399", desc: "Antibodies (immunoglobulins) are made by plasma cells and fall into five classes set by the heavy chain: IgG, IgA, IgM, IgE and IgD. Each class has its own job in blood, mucosa, allergy and B-cell signalling. Drugs here supply antibody (immune globulin, hyperimmune globulin, antibody fragments), lower it (FcRn blockers, B-cell depletion, BAFF blockade), block one class (anti-IgE), or act on the cytokines, kinases and receptors around it (TNF, IL-6R, IL-1R, JAK, the glucocorticoid receptor)." },
  vt: { label: "Vitamins", code: "VT", color: "#f59e0b", desc: "Thirteen vitamins in two groups. Fat-soluble A, D, E and K are absorbed with dietary fat, stored in liver and fat, and toxic in excess. Water-soluble C and the B group are absorbed in the small intestine, stored little (B₁₂ and folate in the liver) and excreted in urine. Most are cofactor precursors: thiamine gives TPP, riboflavin FAD and FMN, niacin NAD⁺ and NADP⁺, pantothenate coenzyme A, pyridoxine PLP, biotin the carboxylase prosthetic group, folate THF and cobalamin methyl- and adenosylcobalamin. Vitamin K and vitamin C are cofactors of carboxylase and hydroxylase reactions. Vitamins A, D and E are not enzyme cofactors: they act as visual pigment and receptor ligand, hormone and antioxidant. Cofactor vitamins are linked to the metabolites, targets and cofactor cards they work with; the lines show when this hub is selected." },
};
const EXIST_ORG = { t_gr: ["rs", "sk", "en", "im"], t_urat1: ["rn", "sk"], t_ace: ["cv", "rn"], t_at1: ["cv", "rn"], t_hmgcr: ["hp", "cv"], t_sglt2: ["rn", "en"], t_gk: ["hp", "en"], t_pdc: ["en"], t_lipase: ["gi"], t_ppara: ["hp", "cv"], t_pparg: ["en"], t_cps1: ["hp"], t_ugt: ["hp"], t_cox: ["cv", "sk"], t_cpt1: ["hp", "cv"],
  t_nav: ["cv", "cn"], t_a2: ["sk", "cv"], t_d2: ["cn", "gi", "en"], t_mu: ["cn", "gi"], t_ache: ["sk", "cn"], t_h1: ["rs", "cn"], t_npc1l1: ["hp", "gi"], t_pcsk9: ["hp", "cv"], t_ampk: ["en", "hp"], t_er: ["sk", "en"], t_pde5: ["rs", "cv"], t_vkor: ["cv", "hp"] };
// Oncology also lists these targets, which are defined on other hubs (hormonal therapy, antifolates, antimitotics, antiemetics)
Object.assign(EXIST_ORG, { t_ige: ["im"], t_tnf: ["im"], t_il6r: ["im"], t_il1r: ["im"], t_jak: ["im"] }); // immune hub also lists these sk-hub targets
Object.assign(EXIST_ORG, { t_dhfr: ["sk", "on"], t_tubulin: ["sk", "on"], t_cyp19: ["en", "on"], t_ar: ["en", "on"], t_gnrhr: ["en", "on"], t_er: ["sk", "en", "on"], t_5ht3: ["gi", "on"], t_nk1: ["gi", "on"] });
/* ------------------------------ vitamins ------------------------------ */
// All thirteen vitamins, fat-soluble first. `links` join a vitamin to the nodes its coenzyme works on (drawn while the Vitamins hub is selected);
// `cof2` feeds the clickable chips on the card (cofactor cards, enzymes, elements); `drug` adds one drug node to the hub:
// [id, drug name, class, examples, note, effect, detail].
const VIT_ORDER = ["t_va", "t_vd", "t_vk", "t_ve", "t_vc", "t_b1", "t_b2", "t_b3", "t_b5", "t_b6", "t_b7", "t_b9", "t_b12"];
const VIT = {
  t_va: {
    name: "Vitamin A (retinol)", kind: "vitf", gene: "Not an enzyme cofactor", locs: ["cyt", "nuc"],
    note: "Fat-soluble retinoid. Retinol is oxidised to retinal, the light-absorbing group of rhodopsin in rod cells, and to retinoic acid, which binds RAR and RXR nuclear receptors to steer differentiation of epithelia and immune cells.",
    sol: "Fat-soluble; stored in liver stellate cells", names: "Retinol, retinal, retinoic acid; provitamin A carotenoids such as β-carotene",
    forms: "11-cis-retinal (vision); all-trans and 9-cis retinoic acid (gene control)", cofShort: "No: prosthetic group and receptor ligand",
    cof: "Not an enzyme cofactor. 11-cis-retinal is a prosthetic group of the opsins: a photon flips it to all-trans-retinal and starts the visual cascade. Retinoic acid acts like a hormone, binding RAR–RXR heterodimers that switch genes on.",
    rda: "900 µg RAE (men), 700 µg RAE (women)", src: "Liver, fish-liver oil, egg yolk, dairy; carotenoids in carrots, sweet potato and leafy greens",
    fn: ["Vision: retinal in rod and cone pigments", "Differentiation of epithelia and mucus-secreting cells", "Immune function and mucosal barriers", "Fetal development of limb, heart, eye and nervous system"],
    def: ["Night blindness first, then xerophthalmia, Bitot spots and keratomalacia", "Follicular hyperkeratosis and more severe infections (supplements lower measles mortality)", "Causes: fat malabsorption (cystic fibrosis, cholestasis), abetalipoproteinemia, malnutrition"],
    ex: ["Teratogenic (craniofacial, cardiac and CNS defects), so retinoids are contraindicated in pregnancy", "Liver injury, alopecia, dry skin, bone pain and hypercalcemia", "Pseudotumor cerebri (headache, papilledema); acute excess gives vomiting and drowsiness", "Carotenoids only turn skin orange (carotenodermia); this is harmless"],
    cof2: { mol: [], enz: [], el: [] }, links: [], relDrugs: [],
    drug: ["d_retin", "Retinoids", "Vitamin A derivatives", "isotretinoin, tretinoin (all-trans retinoic acid), acitretin",
      "Isotretinoin for severe nodulocystic acne, acitretin for psoriasis, tretinoin for acute promyelocytic leukaemia (PML–RARα), where it forces promyelocytes to mature and can cause differentiation syndrome. All are teratogenic (pregnancy prevention programme for isotretinoin). Other adverse effects: dry skin and lips, raised triglycerides, liver injury, pseudotumor cerebri (risk rises with tetracyclines).",
      "activate", "Bind retinoic acid receptors, switching on differentiation genes."],
  },
  t_vd: {
    name: "Vitamin D (calciferol)", kind: "vitf", gene: "Not a cofactor · hormone (VDR)", locs: ["cyt", "nuc"],
    note: "A prohormone made in skin from 7-dehydrocholesterol (UVB) or eaten as D₂ or D₃. The liver (25-hydroxylase) and then the kidney (1α-hydroxylase, stimulated by PTH) make calcitriol, which acts through the vitamin D receptor.",
    sol: "Fat-soluble", names: "Cholecalciferol (D₃), ergocalciferol (D₂), calcifediol (25-OH-D), calcitriol (1,25-(OH)₂-D)",
    forms: "1,25-dihydroxyvitamin D (calcitriol); 25-OH-D is the storage form measured in blood", cofShort: "No: steroid-like hormone",
    cof: "Not a cofactor. Calcitriol binds the vitamin D receptor, which pairs with RXR and switches on genes for intestinal calcium and phosphate absorption and for bone turnover.",
    rda: "15 µg (600 IU); 20 µg (800 IU) after age 70", src: "Sunlight (UVB on skin), fatty fish, fortified milk and cereal, egg yolk, supplements",
    fn: ["Raises intestinal calcium and phosphate absorption", "Supports bone mineralisation and lowers PTH", "Modulates immunity (antimicrobial peptides in macrophages)"],
    def: ["Children: rickets (bowed legs, rachitic rosary, craniotabes, late fontanelle closure)", "Adults: osteomalacia with bone pain and proximal weakness; secondary hyperparathyroidism", "Low calcium and phosphate, high PTH and alkaline phosphatase", "Causes: little sun, dark skin, exclusive breastfeeding without supplement, kidney disease (no 1α-hydroxylase), liver disease, anticonvulsants (CYP induction)"],
    ex: ["Hypercalcemia: polyuria, constipation, confusion, kidney stones, nephrocalcinosis", "Granulomatous disease (sarcoidosis, TB) makes calcitriol outside PTH control because macrophages express 1α-hydroxylase"],
    cof2: { mol: [], enz: [], el: ["Ca", "P"] }, links: [["t_vdr", "calcitriol binds"]], relDrugs: ["d_vitd"], drug: null,
  },
  t_vk: {
    name: "Vitamin K (phylloquinone, menaquinones)", kind: "vitf", gene: "Cofactor: γ-glutamyl carboxylase", locs: ["er"],
    note: "A quinone made by plants (K₁, phylloquinone) and gut bacteria (K₂, menaquinones). In the endoplasmic reticulum its reduced form is the cofactor of γ-glutamyl carboxylase, which adds a second carboxylate to glutamate so clotting factors can bind Ca²⁺. The epoxide left behind is recycled by VKOR, the target of warfarin.",
    sol: "Fat-soluble", names: "K₁ phylloquinone, K₂ menaquinones, K₃ menadione (synthetic)",
    forms: "Vitamin K hydroquinone (reduced); vitamin K epoxide is the by-product", cofShort: "Yes: γ-glutamyl carboxylase",
    cof: "Cofactor of γ-glutamyl carboxylase. Making γ-carboxyglutamate (Gla) lets factors II, VII, IX and X, proteins C, S and Z, and osteocalcin bind Ca²⁺ and phospholipid. Each cycle turns K hydroquinone into K epoxide, and VKOR (VKORC1) reduces it back; warfarin blocks that recycling.",
    rda: "120 µg (men), 90 µg (women), adequate intake", src: "Leafy greens (spinach, kale, broccoli), vegetable oils; K₂ from gut bacteria and fermented foods",
    fn: ["γ-Carboxylation of factors II, VII, IX, X and proteins C, S, Z", "Bone: osteocalcin and matrix Gla protein (limits calcification)"],
    def: ["Bleeding with a long PT/INR (factor VII has the shortest half-life); aPTT lengthens later", "Newborns: haemorrhagic disease of the newborn (sterile gut, little placental transfer, little in breast milk), prevented by IM vitamin K at birth", "Causes: broad-spectrum antibiotics, fat malabsorption, cholestasis, warfarin; severe liver disease is not corrected by vitamin K"],
    ex: ["Natural K₁ and K₂ have no known toxicity", "Menadione (K₃) causes haemolysis and kernicterus in neonates, so it is not used", "IV phytonadione can cause anaphylactoid reactions"],
    more: ["Warfarin start: protein C and S fall before the other factors, a transient hypercoagulable state (warfarin skin necrosis); bridge with heparin."],
    cof2: { mol: [], enz: [], el: ["Ca"] }, links: [["t_vkor", "recycled by"]], relDrugs: ["d_warf"],
    drug: ["d_phyto", "Phytonadione (vitamin K₁)", "Vitamin K replacement", "phytonadione (oral, IV, IM)",
      "Reverses warfarin and treats deficiency bleeding. Given IM to every newborn. Oral for a raised INR without bleeding; slow IV with prothrombin complex concentrate for major bleeding. Onset takes hours because new factors must be made. IV dosing risks an anaphylactoid reaction; large doses make patients resistant to warfarin for days.",
      "activate", "Restores γ-carboxylation of factors II, VII, IX, X and proteins C and S."],
  },
  t_ve: {
    name: "Vitamin E (tocopherols)", kind: "vitf", gene: "Not a cofactor · antioxidant", locs: ["pm"],
    note: "Eight related compounds; α-tocopherol is the one the liver keeps (through α-tocopherol transfer protein). It sits in membranes and lipoproteins and donates an electron to lipid peroxyl radicals, ending the chain reaction that destroys polyunsaturated fats. The tocopheroxyl radical it becomes is regenerated by vitamin C.",
    sol: "Fat-soluble", names: "α-, β-, γ-, δ-tocopherol and the tocotrienols",
    forms: "α-tocopherol (reduced); tocopheroxyl radical (oxidised)", cofShort: "No: chain-breaking antioxidant",
    cof: "Not an enzyme cofactor. It scavenges radicals in the lipid phase and is recycled by ascorbate (vitamin C) and glutathione.",
    rda: "15 mg α-tocopherol", src: "Vegetable oils, nuts and seeds (sunflower seeds, almonds), wheat germ, leafy greens",
    fn: ["Protects membrane fats and LDL from oxidation", "Protects red cells and neurons from oxidative damage"],
    def: ["Rare. Seen with fat malabsorption (cystic fibrosis, cholestasis), abetalipoproteinemia and ataxia with vitamin E deficiency (TTPA mutation)", "Haemolytic anaemia (especially preterm infants), spinocerebellar ataxia, loss of vibration and position sense, areflexia, retinopathy"],
    ex: ["High-dose supplements antagonise vitamin K and add to bleeding risk, especially with warfarin", "Large trials found no cardiovascular or cancer benefit, and the SELECT trial found more prostate cancer"],
    cof2: { mol: [], enz: [], el: [] }, links: [], relDrugs: [], drug: null,
  },
  t_vc: {
    name: "Vitamin C (ascorbate)", kind: "vitw", gene: "Cofactor (reductant) for Fe and Cu hydroxylases", locs: ["cyt"],
    note: "A reducing agent. It keeps iron in the Fe²⁺ state in prolyl and lysyl hydroxylases (collagen), dopamine β-hydroxylase, the HIF prolyl hydroxylase and carnitine synthesis, reduces dietary Fe³⁺ for absorption, and regenerates vitamin E. Humans cannot make it (no L-gulonolactone oxidase).",
    sol: "Water-soluble", names: "Ascorbic acid, ascorbate; dehydroascorbate when oxidised",
    forms: "Ascorbate (reduced)", cofShort: "Yes: co-substrate reductant for Fe²⁺ and Cu⁺ enzymes",
    cof: "Gives electrons to Fe- or Cu-dependent hydroxylases so that they stay active: prolyl and lysyl hydroxylase (collagen cross-linking), dopamine β-hydroxylase (noradrenaline), the hydroxylases of carnitine synthesis and the HIF prolyl hydroxylase. It also reduces Fe³⁺ to Fe²⁺ in the gut and regenerates vitamin E.",
    rda: "90 mg (men), 75 mg (women); 35 mg more for smokers", src: "Citrus, strawberries, peppers, kiwi, broccoli, tomatoes; destroyed by heat",
    fn: ["Collagen synthesis: hydroxyproline and hydroxylysine", "Dopamine to noradrenaline; carnitine synthesis", "Antioxidant; recycles vitamin E", "Raises non-heme iron absorption"],
    def: ["Scurvy from weak collagen: perifollicular haemorrhages, corkscrew hairs, swollen bleeding gums, poor wound healing, bruising, joint and subperiosteal bleeding, anaemia", "Appears after about 1–3 months without intake; risk in restrictive diets, alcohol use disorder, the elderly; infantile scurvy on unfortified boiled milk", "Corrects within days of replacement"],
    ex: ["Osmotic diarrhoea, nausea and cramps with grams per day", "Calcium oxalate kidney stones", "Iron overload risk in hemochromatosis; haemolysis in G6PD deficiency with very high IV doses"],
    more: ["Prolyl and lysyl hydroxylase (collagen), dopamine β-hydroxylase and carnitine synthesis are not drawn in the atlas."],
    cof2: { mol: [], enz: [], el: ["Fe"] }, links: [["proline", "hydroxylase cofactor"], ["lysine", "hydroxylase cofactor"], ["fe", "reduces Fe³⁺"], ["t_phd", "hydroxylase cofactor"]], relDrugs: [], drug: null,
  },
  t_b1: {
    name: "Vitamin B₁ (thiamine)", kind: "vitw", gene: "Cofactor: thiamine pyrophosphate (TPP)", locs: ["mit", "cyt"],
    note: "Thiamine becomes thiamine pyrophosphate (TPP), the coenzyme for decarboxylation of α-keto acids and for transketolase. Stores last only 2–3 weeks, and brain and heart, which burn glucose heavily, show deficiency first.",
    sol: "Water-soluble", names: "Thiamine, thiamin", forms: "Thiamine pyrophosphate (TPP, thiamine diphosphate)", cofShort: "Yes: TPP",
    cof: "Coenzyme of four enzymes: pyruvate dehydrogenase, α-ketoglutarate dehydrogenase and branched-chain α-ketoacid dehydrogenase (all mitochondrial, and all also needing lipoate, CoA, FAD and NAD⁺), and transketolase of the pentose phosphate pathway (cytosol). TPP forms a carbanion that attacks the keto carbon of the substrate.",
    rda: "1.2 mg (men), 1.1 mg (women)", src: "Pork, whole grains, legumes, seeds, fortified cereal; polished rice lacks it; destroyed by heat and by thiaminase in raw fish",
    fn: ["Links glycolysis to the TCA cycle (pyruvate dehydrogenase)", "TCA cycle step α-ketoglutarate to succinyl-CoA", "Branched-chain amino acid catabolism", "Ribose and NADPH supply through transketolase"],
    def: ["Dry beriberi: symmetric peripheral neuropathy and wasting. Wet beriberi: high-output heart failure and oedema", "Wernicke encephalopathy (confusion, ophthalmoplegia, ataxia) and Korsakoff syndrome (amnesia, confabulation) in alcohol use disorder", "High pyruvate and lactate (lactic acidosis); low red-cell transketolase activity that rises when TPP is added", "Causes: alcohol use disorder, malnutrition, hyperemesis, bariatric surgery, refeeding, dialysis, loop diuretics"],
    ex: ["None known; excess is excreted in urine"],
    more: ["Branched-chain α-ketoacid dehydrogenase is not drawn (its deficiency is maple syrup urine disease, some forms respond to thiamine)."],
    cof2: { mol: [], enz: ["Pyruvate dehydrogenase complex", "α-KG dehydrogenase", "Transketolase"], el: [] },
    links: [["pyruvate", "cofactor (PDH)"], ["akg", "cofactor (α-KGDH)"], ["xu5p", "cofactor (transketolase)"], ["t_pdc", "TPP cofactor"]], relDrugs: [],
    drug: ["d_thiam", "Thiamine", "Vitamin B₁ replacement", "thiamine (IV or oral)",
      "Given IV before or with glucose in alcohol use disorder, malnutrition and refeeding so a carbohydrate load does not precipitate Wernicke encephalopathy. Also treats wet beriberi. Rare adverse effect: anaphylaxis with IV dosing.",
      "activate", "Restores TPP for pyruvate dehydrogenase, α-ketoglutarate dehydrogenase and transketolase."],
  },
  t_b2: {
    name: "Vitamin B₂ (riboflavin)", kind: "vitw", gene: "Cofactor: FAD and FMN", locs: ["mit"],
    note: "Riboflavin gives FMN and FAD, flavin coenzymes that carry two electrons and two protons in dehydrogenases and oxidases. The isoalloxazine ring is yellow, which is why the vitamin turns urine bright yellow.",
    sol: "Water-soluble", names: "Riboflavin", forms: "FMN (flavin mononucleotide) and FAD (flavin adenine dinucleotide)", cofShort: "Yes: FAD and FMN",
    cof: "Flavoprotein coenzymes. FAD is bound in succinate dehydrogenase (complex II), the acyl-CoA dehydrogenases of β-oxidation and the E3 subunit of the pyruvate and α-ketoglutarate dehydrogenase complexes; FMN is in complex I. Glutathione reductase, monoamine oxidase and xanthine oxidase also use flavins, and FMN is needed to make PLP from pyridoxine.",
    rda: "1.3 mg (men), 1.1 mg (women)", src: "Milk and dairy, eggs, organ meats, fortified cereals, almonds; light destroys it",
    fn: ["Electron transfer in the respiratory chain and β-oxidation", "Antioxidant defence (glutathione reductase)", "Activates vitamin B₆ and helps make niacin from tryptophan"],
    def: ["Ariboflavinosis: cheilosis, angular stomatitis, magenta tongue (glossitis), seborrheic dermatitis, corneal vascularisation, normocytic anaemia", "Phototherapy for neonatal jaundice breaks down riboflavin", "Causes: alcohol use disorder, malabsorption, anorexia"],
    ex: ["No toxicity; bright yellow-orange urine"],
    cof2: { mol: ["fad", "fadh2"], enz: ["Succinate dehydrogenase", "β-oxidation", "Pyruvate dehydrogenase complex", "α-KG dehydrogenase"], el: [] },
    links: [["succinate", "cofactor (FAD)"], ["facyl", "cofactor (acyl-CoA DH)"], ["pyruvate", "cofactor (PDH E3)"]], relDrugs: [], drug: null,
  },
  t_b3: {
    name: "Vitamin B₃ (niacin)", kind: "vitw", gene: "Cofactor: NAD⁺ and NADP⁺", locs: ["cyt", "mit"],
    note: "Nicotinic acid and nicotinamide are the precursors of NAD⁺ and NADP⁺, the hydride carriers of hundreds of dehydrogenases. It is the one B vitamin the body can partly make, from tryptophan (about 60 mg for 1 mg of niacin), a route that needs vitamins B₂ and B₆.",
    sol: "Water-soluble", names: "Niacin (nicotinic acid), nicotinamide (niacinamide), nicotinamide riboside", forms: "NAD⁺, NADH, NADP⁺, NADPH", cofShort: "Yes: NAD⁺ and NADP⁺",
    cof: "NAD⁺ accepts electrons in catabolic dehydrogenases (glycolysis, pyruvate dehydrogenase, TCA cycle, β-oxidation, lactate and malate dehydrogenases) and feeds complex I. NADPH is the reductant of biosynthesis (fatty acids, cholesterol), antioxidant defence (glutathione reductase) and the respiratory burst, and the pentose phosphate pathway makes it. NAD⁺ is also consumed by sirtuins and PARP.",
    rda: "16 mg NE (men), 14 mg NE (women)", src: "Meat, fish, poultry, peanuts, fortified grains; tryptophan in protein; the niacin in maize is bound unless the grain is treated with lime",
    fn: ["Redox reactions of catabolism (NAD⁺) and biosynthesis (NADPH)", "DNA repair (PARP) and sirtuin signalling", "At pharmacologic doses lowers LDL and triglycerides and raises HDL"],
    def: ["Pellagra, the 4 Ds: dermatitis (photosensitive, Casal necklace), diarrhoea, dementia, death", "Causes: maize-based diet, Hartnup disease (neutral amino-acid transporter, so little tryptophan), carcinoid syndrome (tryptophan goes to serotonin), isoniazid and B₆ deficiency"],
    ex: ["Flushing (prostaglandin-mediated; blunted by aspirin beforehand)", "Hyperglycaemia, hyperuricaemia (gout), liver injury, itching", "Nicotinamide does not flush"],
    cof2: { mol: ["nad", "nadh", "nadp", "nadph"], enz: ["Isocitrate dehydrogenase", "Malate dehydrogenase", "G3P dehydrogenase", "Lactate dehydrogenase", "G6P dehydrogenase", "Pyruvate dehydrogenase complex", "α-KG dehydrogenase", "Biliverdin reductase"], el: [] },
    links: [["gap", "cofactor (NAD⁺)"], ["lactate", "cofactor (NADH)"], ["isocitrate", "cofactor (NAD⁺)"], ["malate", "cofactor (NAD⁺)"], ["p6gl", "cofactor (NADP⁺)"]], relDrugs: [],
    drug: ["d_niacin", "Niacin (nicotinic acid)", "Lipid-lowering vitamin", "extended-release nicotinic acid",
      "Pellagra is treated with nicotinamide (no flushing). In grams per day nicotinic acid lowers LDL and triglycerides and raises HDL more than any other lipid drug, but trials of niacin added to a statin showed no further benefit. Adverse effects: flushing (prostaglandin D₂), hyperglycaemia, hyperuricaemia, liver injury.",
      "activate", "Replacement restores NAD⁺ and NADP⁺; at pharmacologic doses nicotinic acid also acts on the adipocyte receptor GPR109A and cuts free fatty acid release."],
  },
  t_b5: {
    name: "Vitamin B₅ (pantothenate)", kind: "vitw", gene: "Cofactor: coenzyme A and ACP", locs: ["mit", "cyt"],
    note: "Pantothenate forms the middle of coenzyme A (with cysteamine and ADP 3′-phosphate) and the phosphopantetheine arm of acyl carrier protein. It is in nearly every food, so deficiency is rare.",
    sol: "Water-soluble", names: "Pantothenic acid, pantothenate", forms: "Coenzyme A; 4′-phosphopantetheine of acyl carrier protein", cofShort: "Yes: CoA and ACP",
    cof: "CoA carries acyl groups as thioesters (acetyl-CoA, succinyl-CoA, malonyl-CoA, fatty acyl-CoA). It takes part in pyruvate and α-ketoglutarate dehydrogenase, citrate synthase, succinyl-CoA synthetase, acyl-CoA synthetase, β-oxidation, acetyl-CoA carboxylase and ALA synthase. The phosphopantetheine arm of ACP carries the growing chain through fatty acid synthase.",
    rda: "5 mg (adequate intake)", src: "Nearly all foods: meat, mushrooms, avocado, eggs, whole grains, legumes",
    fn: ["Acyl-group transfer for fatty acid synthesis and oxidation", "TCA cycle entry as acetyl-CoA", "Cholesterol, ketone body and heme synthesis"],
    def: ["Very rare: burning feet (paraesthesia), fatigue, irritability, GI upset, seen in severe malnutrition", "Pantothenate kinase-associated neurodegeneration (PKAN) is a genetic block in CoA synthesis with iron build-up in the globus pallidus"],
    ex: ["No toxicity; very large doses may cause diarrhoea"],
    cof2: { mol: ["coa"], enz: ["Succinyl-CoA synthetase", "Acyl-CoA synthetase", "Citrate synthase", "Acetyl-CoA carboxylase", "Fatty acid synthase", "β-oxidation"], el: [] },
    links: [["acetylcoa", "part of CoA"], ["succoa", "part of CoA"], ["malonyl", "part of CoA"], ["facyl", "part of CoA"]], relDrugs: [], drug: null,
  },
  t_b6: {
    name: "Vitamin B₆ (pyridoxine)", kind: "vitw", gene: "Cofactor: pyridoxal phosphate (PLP)", locs: ["cyt", "mit"],
    note: "Pyridoxine, pyridoxal and pyridoxamine are phosphorylated to pyridoxal 5′-phosphate (PLP). Its aldehyde forms a Schiff base with the amino group of the substrate, so PLP enzymes run transamination, decarboxylation and elimination reactions of amino acids.",
    sol: "Water-soluble", names: "Pyridoxine, pyridoxal, pyridoxamine", forms: "Pyridoxal 5′-phosphate (PLP); pyridoxamine phosphate", cofShort: "Yes: PLP",
    cof: "PLP is the cofactor of every transaminase (ALT, AST), ALA synthase (first step of heme synthesis), amino-acid decarboxylases (dopa decarboxylase, glutamate decarboxylase giving GABA, histidine decarboxylase), cystathionine β-synthase and γ-lyase (transsulfuration of homocysteine), serine hydroxymethyltransferase and kynureninase (tryptophan to niacin). Glycogen phosphorylase also uses PLP, through its phosphate group rather than the aldehyde.",
    rda: "1.3 mg (adults up to age 50)", src: "Poultry, fish, potatoes, chickpeas, bananas, fortified cereal",
    fn: ["Transamination and decarboxylation of amino acids", "Heme synthesis; dopamine, serotonin and GABA synthesis", "Homocysteine metabolism; glycogen breakdown"],
    def: ["Sideroblastic microcytic anaemia (ALAS2), peripheral neuropathy, seizures (low GABA), cheilosis, glossitis, depression", "Causes: isoniazid (forms a hydrazone with PLP), hydralazine, cycloserine, penicillamine, alcohol use disorder", "Infants: irritability and seizures (pyridoxine-dependent epilepsy responds to B₆)"],
    ex: ["Chronic doses above about 100 mg/day cause a sensory neuropathy that usually reverses on stopping", "Lowers the effect of levodopa given without carbidopa"],
    more: ["Decarboxylases, transsulfuration, serine hydroxymethyltransferase and kynureninase are not drawn in the atlas."],
    cof2: { mol: [], enz: ["Alanine transaminase", "Aspartate transaminase", "Transaminase / GDH", "ALA synthase (B₆)", "Glycogen phosphorylase"], el: [] },
    links: [["alanine", "cofactor (ALT)"], ["aspartate", "cofactor (AST)"], ["ala", "cofactor (ALAS)"], ["glycogen", "cofactor (phosphorylase)"]], relDrugs: [],
    drug: ["d_pyrid", "Pyridoxine", "Vitamin B₆ replacement", "pyridoxine",
      "Given with isoniazid to prevent neuropathy in at-risk patients, and IV for isoniazid overdose seizures. Treats pyridoxine-dependent seizures and some sideroblastic anaemias, and with doxylamine for nausea in pregnancy. Excess causes sensory neuropathy.",
      "activate", "Becomes PLP, restoring transamination, ALA synthase and decarboxylase activity."],
  },
  t_b7: {
    name: "Vitamin B₇ (biotin)", kind: "vitw", gene: "Cofactor: carboxylases (CO₂ carrier)", locs: ["mit", "cyt"],
    note: "Biotin is attached to a lysine of each carboxylase, where it carries activated CO₂ (made from bicarbonate and ATP) and hands it to the substrate. Gut bacteria make some, so deficiency needs an unusual cause.",
    sol: "Water-soluble", names: "Biotin, vitamin H", forms: "Biocytin (biotin bound to lysine of the enzyme)", cofShort: "Yes: carboxylases",
    cof: "Prosthetic group of the four human carboxylases: pyruvate carboxylase (pyruvate to oxaloacetate, mitochondria), acetyl-CoA carboxylase (acetyl-CoA to malonyl-CoA, cytosol), propionyl-CoA carboxylase (propionyl-CoA to methylmalonyl-CoA) and 3-methylcrotonyl-CoA carboxylase (leucine breakdown).",
    rda: "30 µg (adequate intake)", src: "Egg yolk, liver, salmon, nuts, sweet potato; also made by gut bacteria",
    fn: ["Gluconeogenesis (pyruvate carboxylase)", "Fatty acid synthesis (acetyl-CoA carboxylase)", "Propionate and leucine catabolism"],
    def: ["Rare: periorificial scaly rash, alopecia, conjunctivitis, brittle nails, enteritis; in infants with biotinidase deficiency also hypotonia, seizures and lactic acidosis (multiple carboxylase deficiency)", "Causes: raw egg white (avidin binds biotin), prolonged TPN without biotin, long-term anticonvulsants, biotinidase deficiency"],
    ex: ["No known toxicity", "High-dose supplements interfere with biotin–streptavidin immunoassays (troponin, TSH, free T4, PTH, hCG): results read falsely high or low depending on assay format, for example low TSH with high free T4 that mimics Graves disease"],
    more: ["Pyruvate carboxylase, propionyl-CoA carboxylase and 3-methylcrotonyl-CoA carboxylase are not drawn as steps in the atlas."],
    cof2: { mol: [], enz: ["Acetyl-CoA carboxylase"], el: [] },
    links: [["malonyl", "cofactor (ACC)"], ["pyruvate", "cofactor (pyruvate carboxylase)"], ["oaa", "cofactor (pyruvate carboxylase)"]], relDrugs: [], drug: null,
  },
  t_b9: {
    name: "Vitamin B₉ (folate)", kind: "vitw", gene: "Cofactor: tetrahydrofolate (THF)", locs: ["cyt", "mit"],
    note: "Folate is reduced by DHFR to tetrahydrofolate (THF), the carrier of one-carbon units (methyl, methylene, formyl) for purine and thymidylate synthesis, serine–glycine interconversion and homocysteine remethylation. Stores last 3–4 months.",
    sol: "Water-soluble", names: "Folate (food), folic acid (supplement), folinic acid (leucovorin), L-methylfolate",
    forms: "THF and its one-carbon forms: N⁵,N¹⁰-methylene-THF, N⁵-methyl-THF, N¹⁰-formyl-THF", cofShort: "Yes: THF",
    cof: "One-carbon carrier. N⁵,N¹⁰-methylene-THF gives the methyl group of dTMP (thymidylate synthase; DHFR regenerates THF); N¹⁰-formyl-THF supplies two carbons of the purine ring; serine hydroxymethyltransferase moves a carbon from serine to THF, making glycine; N⁵-methyl-THF passes its methyl to homocysteine through methionine synthase (vitamin B₁₂).",
    rda: "400 µg DFE (600 µg in pregnancy)", src: "Leafy greens (the word means foliage), legumes, liver, citrus, fortified grains",
    fn: ["DNA synthesis: thymidylate and purines", "Methionine regeneration and methylation (SAM)", "Serine, glycine and histidine metabolism"],
    def: ["Megaloblastic macrocytic anaemia: high MCV, hypersegmented neutrophils, glossitis; no neurological signs", "High homocysteine with normal methylmalonic acid (in B₁₂ deficiency both are high)", "Neural-tube defects: 400 µg daily before conception and in early pregnancy, 4 mg after a previous affected pregnancy", "Causes: alcohol use disorder, pregnancy, coeliac disease and tropical sprue (jejunal malabsorption), methotrexate, trimethoprim, phenytoin, sulfasalazine, haemolytic anaemia"],
    ex: ["Folic acid alone corrects the anaemia of B₁₂ deficiency but not the neuropathy, which can progress: check B₁₂ first", "No other toxicity; may blunt the effect of phenytoin"],
    more: ["Purine transformylases, serine hydroxymethyltransferase and methionine synthase are not drawn as steps in the atlas."],
    cof2: { mol: [], enz: [], el: [] },
    links: [["t_ts", "methylene-THF donor"], ["t_dhfr", "reduced by"], ["methionine", "methyl-THF (methionine synthase)"], ["serine", "carbon donor (SHMT)"], ["glycine", "made by SHMT"]],
    relDrugs: ["d_mtx", "d_peme", "d_leuco"],
    drug: ["d_folic", "Folic acid", "Folate replacement", "folic acid",
      "Treats megaloblastic anaemia, prevents neural-tube defects (400 µg preconception; 4 mg after a previous affected pregnancy) and lessens methotrexate mucositis. Check B₁₂ first, because folic acid can mask pernicious anaemia while neuropathy advances. Leucovorin (folinic acid) bypasses DHFR and sits on the oncology hub.",
      "activate", "Is reduced by DHFR to THF, restoring one-carbon transfer for thymidylate and purine synthesis."],
  },
  t_b12: {
    name: "Vitamin B₁₂ (cobalamin)", kind: "vitw", gene: "Cofactor: methyl- and adenosylcobalamin", locs: ["mit", "cyt"],
    note: "A corrin ring around a cobalt ion, made only by microbes and the one vitamin that contains a metal. It binds gastric intrinsic factor and is absorbed in the terminal ileum; the liver stores 3–5 years' worth.",
    sol: "Water-soluble (stored in liver)", names: "Cobalamin; cyanocobalamin and hydroxocobalamin as supplements",
    forms: "Methylcobalamin (cytosol) and 5′-deoxyadenosylcobalamin (mitochondria)", cofShort: "Yes: two enzymes",
    cof: "Methylcobalamin is the cofactor of methionine synthase (cytosol): it moves the methyl of N⁵-methyl-THF onto homocysteine, making methionine and freeing THF. Adenosylcobalamin is the cofactor of methylmalonyl-CoA mutase (mitochondria), which turns L-methylmalonyl-CoA, from odd-chain fatty acids and several amino acids, into succinyl-CoA.",
    rda: "2.4 µg", src: "Animal foods only: meat, fish, shellfish, dairy, eggs, liver; fortified foods for strict vegans",
    fn: ["Homocysteine to methionine; recycling of folate", "Methylmalonyl-CoA to succinyl-CoA", "Myelin maintenance"],
    def: ["Megaloblastic anaemia as in folate deficiency, plus subacute combined degeneration (dorsal columns and lateral corticospinal tracts: loss of vibration and position sense, spastic weakness), paraesthesias, dementia", "High homocysteine and high methylmalonic acid", "Causes: pernicious anaemia (anti-intrinsic factor and anti-parietal cell antibodies), gastrectomy, ileal disease or resection (Crohn), Diphyllobothrium latum, strict veganism, chronic metformin or PPI use, nitrous oxide", "Folate 'methyl trap': N⁵-methyl-THF cannot give up its methyl without B₁₂, so folate is stuck in an unusable form"],
    ex: ["No known toxicity; excess is excreted"],
    more: ["Methylmalonyl-CoA and homocysteine are not drawn; the links go to methionine and succinyl-CoA."],
    cof2: { mol: [], enz: [], el: ["Co"] },
    links: [["methionine", "methylcobalamin: methionine synthase"], ["succoa", "adenosylcobalamin: mutase"]], relDrugs: [],
    drug: ["d_b12", "Cobalamin", "Vitamin B₁₂ replacement", "cyanocobalamin, hydroxocobalamin",
      "IM or high-dose oral replacement in pernicious anaemia, ileal disease and after gastric bypass; lifelong in pernicious anaemia. Hydroxocobalamin is also the antidote for cyanide poisoning, because it binds cyanide. Potassium can fall in the first days as the marrow recovers.",
      "activate", "Restores methionine synthase and methylmalonyl-CoA mutase activity."],
  },
};
// vitamin to vitamin links: [from, to, what the link is]
const VIT_VV = [["t_vc", "t_ve", "regenerates"], ["t_b2", "t_b6", "FMN makes PLP"], ["t_b2", "t_b3", "needed to make from Trp"], ["t_b6", "t_b3", "needed to make from Trp"], ["t_b12", "t_b9", "methyl-folate trap"]];
const VIT_NODES = (id) => [...new Set([...VIT[id].links.map((l) => l[0]), ...VIT_VV.filter((v) => v[0] === id || v[1] === id).map((v) => (v[0] === id ? v[1] : v[0]))])];
const VIT_ROWS = VIT_ORDER.map((id) => { const v = VIT[id]; return ["vt", id, v.name, v.kind, v.gene, v.note, ...(v.drug || [null, null, null, null, null, null, null]), v.locs]; });
// org, target id, target, type, gene, what it does | drug id, drug, class, examples, note | effect, detail | locations
const ORGAN_RX = [
  ["cv", "t_adrb1", "β₁-adrenergic receptor", "receptor", "ADRB1", "Gs-coupled receptor of cardiac muscle and renin-secreting kidney cells; noradrenaline raises heart rate, contractility and renin release.", "d_bb", "Beta-blockers", "β₁ antagonists", "metoprolol, atenolol, bisoprolol", "Lower heart rate, contractility and renin release. Used after myocardial infarction and in heart failure, angina, arrhythmia and hypertension. Avoid in asthma and heart block.", "inhibit", "Competitive antagonism blunts catecholamine signalling.", ["pm"]],
  ["cv", "t_ace", "Angiotensin-converting enzyme", "enzyme", "ACE", "Zinc peptidase on endothelium (most in the lungs) that converts angiotensin I to the vasoconstrictor angiotensin II and degrades bradykinin.", "d_acei", "ACE inhibitors", "Prils", "lisinopril, enalapril, ramipril", "Lower blood pressure and protect the heart and kidney in heart failure and diabetic nephropathy. Adverse effects: dry cough and angioedema (bradykinin), hyperkalemia; contraindicated in pregnancy.", "inhibit", "Less angiotensin II, and more bradykinin, so vessels dilate and aldosterone falls.", ["pm"]],
  ["cv", "t_at1", "AT₁ receptor", "receptor", "AGTR1", "Gq-coupled receptor for angiotensin II on vascular smooth muscle and adrenal cortex: vasoconstriction, aldosterone release, salt retention.", "d_arb", "ARBs", "Sartans", "losartan, valsartan, candesartan", "Same indications as ACE inhibitors, with little cough because bradykinin is unaffected. Hyperkalemia and fetal toxicity still apply.", "inhibit", "Blocks angiotensin II at its receptor.", ["pm"]],
  ["cv", "t_cav", "L-type calcium channel", "transporter", "CACNA1C", "Voltage-gated channel that lets calcium into cardiac and vascular smooth muscle, triggering contraction.", "d_ccb", "Dihydropyridines", "Calcium-channel blockers", "amlodipine, nifedipine", "Relax arterial smooth muscle, so lower blood pressure and relieve angina. Adverse effects: ankle oedema, flushing, headache. Verapamil and diltiazem also slow the heart.", "inhibit", "Less calcium entry, so vascular smooth muscle relaxes.", ["pm"]],
  ["rn", "t_nkcc2", "NKCC2 (Na⁺–K⁺–2Cl⁻)", "transporter", "SLC12A1", "Cotransporter of the thick ascending limb of the loop of Henle; reabsorbs about 25% of filtered sodium.", "d_loop", "Loop diuretics", "NKCC2 inhibitors", "furosemide, bumetanide", "Strong diuresis for oedema and heart failure. Adverse effects: low potassium and magnesium, hearing loss at high dose, gout.", "inhibit", "Blocks the transporter from the tubular lumen side, so salt and water are excreted.", ["ap"]],
  ["rn", "t_ncc", "NCC (Na⁺–Cl⁻)", "transporter", "SLC12A3", "Cotransporter of the distal convoluted tubule; reabsorbs about 5% of filtered sodium and, in this segment, calcium reabsorption is raised.", "d_thz", "Thiazides", "NCC inhibitors", "hydrochlorothiazide, chlorthalidone", "First-line for hypertension; also lower urinary calcium. Adverse effects: low sodium and potassium, high urate and glucose.", "inhibit", "Blocks sodium–chloride reabsorption in the distal tubule.", ["ap"]],
  ["rn", "t_mr", "Mineralocorticoid receptor", "receptor", "NR3C2", "Aldosterone-activated nuclear receptor in the collecting duct; raises ENaC and Na⁺/K⁺-ATPase expression, retaining sodium and wasting potassium.", "d_mra", "Mineralocorticoid antagonists", "Potassium-sparing diuretics", "spironolactone, eplerenone, finerenone", "Add to heart-failure therapy (lower mortality) and treat resistant hypertension and hyperaldosteronism. Main risk: hyperkalemia.", "inhibit", "Competes with aldosterone, so less sodium retention and potassium loss.", ["cyt", "nuc"]],
  ["rn", "t_ca", "Carbonic anhydrase (II, IV)", "enzyme", "CA2, CA4", "Zinc enzyme that hydrates CO₂ to H⁺ and HCO₃⁻; in the proximal tubule it drives bicarbonate and sodium reabsorption.", "d_acetaz", "Carbonic anhydrase inhibitors", "Weak diuretics", "acetazolamide", "Cause a bicarbonate diuresis and mild metabolic acidosis. Used for glaucoma, altitude sickness and alkalinising urine. Adverse effects: paresthesia, kidney stones, low potassium.", "inhibit", "Less H⁺ secretion, so bicarbonate and sodium stay in the lumen.", ["ap", "cyt"]],
  ["rn", "t_urat1", "URAT1 (urate transporter)", "transporter", "SLC22A12", "Exchanges urate for intracellular anions to reclaim about 90% of filtered urate.", "d_uricos", "Uricosurics", "URAT1 inhibitors", "probenecid, lesinurad", "Raise urinary urate excretion in gout when xanthine oxidase inhibitors are not enough. Risk of kidney stones (keep fluids up); probenecid also blocks OAT1/3, slowing penicillin excretion.", "inhibit", "Less urate reabsorption, so more is excreted.", ["ap"]],
  ["rn", "t_enac", "ENaC (epithelial Na⁺ channel)", "transporter", "SCNN1A/B/G", "Sodium channel of collecting-duct principal cells; its sodium entry makes the lumen negative and drives potassium and H⁺ secretion. Aldosterone raises its number.", "d_enaci", "ENaC blockers", "Potassium-sparing diuretics", "amiloride, triamterene", "Weak diuretics added to thiazides or loop diuretics to hold potassium. Amiloride also treats lithium-induced diabetes insipidus. Main risk: hyperkalemia.", "inhibit", "Channel block, so less sodium is absorbed and less potassium is lost.", ["ap"]],
  ["rn", "t_v2r", "Vasopressin V₂ receptor", "receptor", "AVPR2", "Gs-coupled receptor on the blood side of collecting-duct cells; vasopressin raises cAMP and inserts aquaporin-2 into the apical membrane, so water is reabsorbed.", "d_vaptan", "Vaptans", "V₂ antagonists", "tolvaptan", "Cause free-water excretion in hyponatremia (SIADH, heart failure) and slow polycystic kidney disease. Correct sodium slowly (osmotic demyelination); liver injury risk. The agonist desmopressin does the reverse in diabetes insipidus.", "inhibit", "Aquaporin-2 is not inserted, so water is excreted.", ["bl"]],
  ["rn", "t_eta", "Endothelin A receptor", "receptor", "EDNRA", "Gq-coupled receptor on vascular smooth muscle, mesangial cells and podocytes; endothelin-1 constricts vessels and promotes proteinuria and fibrosis.", "d_era", "Endothelin receptor antagonists", "ERAs", "atrasentan, sparsentan", "Cut proteinuria in IgA nephropathy. Adverse effects: fluid retention and teratogenicity.", "inhibit", "Antagonism lowers glomerular pressure and protein leak.", ["pm"]],
  ["rn", "t_renin", "Renin", "enzyme", "REN", "Aspartyl protease secreted by juxtaglomerular cells when perfusion or salt falls; cleaves angiotensinogen to angiotensin I, the rate-limiting step of the renin–angiotensin system.", "d_dri", "Direct renin inhibitors", "Renin–angiotensin blockers", "aliskiren", "Lower blood pressure by blocking the first step of the cascade; rarely used. Hyperkalemia risk; avoid with ACE inhibitors or ARBs in diabetes.", "inhibit", "Binds the active site, so less angiotensin I is made.", ["ext"]],
  ["rn", "t_phd", "HIF prolyl hydroxylase", "enzyme", "EGLN1 (PHD2)", "Oxygen sensor in kidney interstitial fibroblasts that tags HIF-α for destruction; when oxygen is low it is inactive, HIF rises and erythropoietin is made.", "d_hifphi", "HIF-PH inhibitors", "Oral anaemia drugs", "roxadustat, daprodustat", "Raise erythropoietin and improve iron use in anaemia of chronic kidney disease. Risks: thrombosis and a rise in blood pressure.", "inhibit", "HIF-α is stabilised, so erythropoietin genes switch on.", ["cyt"]],
  ["rs", "t_adrb2", "β₂-adrenergic receptor", "receptor", "ADRB2", "Gs-coupled receptor on airway smooth muscle; raised cAMP relaxes the muscle and opens the airway.", "d_saba", "β₂ agonists", "Bronchodilators", "salbutamol, salmeterol, formoterol", "Short-acting agents rescue asthma attacks; long-acting agents are paired with an inhaled corticosteroid. Adverse effects: tremor, tachycardia, low potassium.", "activate", "Direct agonism raises cAMP and relaxes bronchial muscle.", ["pm"]],
  ["rs", "t_m3", "Muscarinic M₃ receptor", "receptor", "CHRM3", "Gq-coupled receptor on airway smooth muscle and mucous glands; vagal acetylcholine causes bronchoconstriction and mucus secretion.", "d_lama", "Anticholinergic bronchodilators", "LAMA / SAMA", "tiotropium, ipratropium", "Maintenance therapy in COPD. Adverse effects: dry mouth, urinary retention, glaucoma.", "inhibit", "Blocks acetylcholine, so airway tone falls.", ["pm"]],
  ["rs", "t_gr", "Glucocorticoid receptor", "receptor", "NR3C1", "Cytosolic receptor that moves to the nucleus when bound; switches off inflammatory genes and switches on anti-inflammatory ones.", "d_ics", "Inhaled corticosteroids", "Glucocorticoid agonists", "budesonide, fluticasone", "First-line controller in asthma. Local action limits systemic effects; adverse effects: oral thrush, hoarseness.", "activate", "Receptor activation reduces airway inflammation over days.", ["cyt", "nuc"]],
  ["sk", "t_fdps", "Farnesyl pyrophosphate synthase", "enzyme", "FDPS", "Mevalonate-pathway enzyme in osteoclasts; its products prenylate small GTPases that osteoclasts need to resorb bone.", "d_bp", "Bisphosphonates", "Antiresorptives", "alendronate, zoledronate", "Bind bone mineral and are taken up by osteoclasts. Treat osteoporosis and bone metastases. Adverse effects: oesophagitis (oral forms), rare jaw osteonecrosis and atypical femur fracture.", "inhibit", "Osteoclasts lose prenylated GTPases and undergo apoptosis.", ["cyt"]],
  ["sk", "t_xo", "Xanthine oxidase", "enzyme", "XDH", "Oxidises hypoxanthine to xanthine and then to uric acid; excess urate crystallises in joints as gout.", "d_xoi", "Xanthine oxidase inhibitors", "Urate-lowering drugs", "allopurinol, febuxostat", "Long-term prevention of gout flares and uric-acid stones. Start low and cover with an anti-inflammatory; allopurinol can cause a severe hypersensitivity (HLA-B*58:01).", "inhibit", "Less uric acid is made.", ["cyt"]],
  ["sk", "t_nachr", "Nicotinic ACh receptor (muscle)", "receptor", "CHRNA1", "Ligand-gated channel at the neuromuscular junction; acetylcholine opens it and the muscle fibre contracts.", "d_nmb", "Neuromuscular blockers", "Non-depolarising blockers", "rocuronium, vecuronium", "Paralyse skeletal muscle for intubation and surgery; given only with ventilation and sedation. Reversed by sugammadex or neostigmine.", "inhibit", "Competitive antagonism at the motor end plate.", ["pm"]],
  ["sk", "t_rankl", "RANKL (RANK ligand)", "ligand", "TNFSF11", "Cytokine made by osteoblasts and T cells; binds RANK on osteoclast precursors and drives their formation and survival.", "d_dmab", "Denosumab", "Anti-RANKL antibody", "denosumab", "Twice-yearly injection for osteoporosis and bone metastases. Adverse effects: hypocalcemia, jaw osteonecrosis; bone loss returns quickly if stopped.", "inhibit", "Neutralises RANKL, so osteoclasts are not formed.", ["ext"]],
  ["sk", "t_sost", "Sclerostin", "ligand", "SOST", "Protein from osteocytes that blocks Wnt signalling in osteoblasts and so brakes bone formation.", "d_romo", "Romosozumab", "Anti-sclerostin antibody", "romosozumab", "Builds bone and lowers resorption in severe osteoporosis. Boxed warning: myocardial infarction and stroke.", "inhibit", "Releases the Wnt brake on osteoblasts.", ["ext"]],
  ["sk", "t_pth1r", "PTH1 receptor", "receptor", "PTH1R", "Gs-coupled receptor on osteoblasts and kidney tubule cells; parathyroid hormone given in pulses builds bone, but continuous exposure resorbs it.", "d_pth", "PTH analogues", "Anabolic bone agents", "teriparatide, abaloparatide", "Daily injection builds bone in severe osteoporosis. Adverse effects: hypercalcemia, orthostatic hypotension; limited to two years.", "activate", "Intermittent agonism favours osteoblast activity.", ["pm"]],
  ["sk", "t_er", "Estrogen receptor α", "receptor", "ESR1", "Nuclear receptor that restrains osteoclasts and keeps bone mass; estrogen loss at menopause speeds bone loss.", "d_serm", "SERMs", "Selective estrogen receptor modulators", "raloxifene", "Agonist in bone, antagonist in breast and uterus: prevents vertebral fractures and breast cancer. Risks: venous thromboembolism, hot flushes.", "activate", "Tissue-selective agonism in bone.", ["cyt", "nuc"]],
  ["sk", "t_vdr", "Vitamin D receptor", "receptor", "VDR", "Nuclear receptor for calcitriol; raises intestinal calcium and phosphate absorption and lowers PTH.", "d_vitd", "Vitamin D and analogues", "VDR agonists", "cholecalciferol, calcitriol, paricalcitol", "Treat rickets, osteomalacia and secondary hyperparathyroidism. Excess causes hypercalcemia and kidney stones.", "activate", "Raises calcium absorption and bone mineralisation.", ["cyt", "nuc"]],
  ["sk", "t_fgf23", "FGF23", "ligand", "FGF23", "Bone-derived hormone that makes the kidney waste phosphate; excess causes X-linked hypophosphatemia.", "d_buro", "Burosumab", "Anti-FGF23 antibody", "burosumab", "Raises serum phosphate and heals rickets in X-linked hypophosphatemia and tumour-induced osteomalacia.", "inhibit", "Neutralises FGF23, so the kidney keeps phosphate.", ["ext"]],
  ["sk", "t_dhfr", "Dihydrofolate reductase", "enzyme", "DHFR", "Regenerates tetrahydrofolate for purine and thymidylate synthesis; dividing immune cells depend on it.", "d_mtx", "Methotrexate", "csDMARD", "methotrexate", "Anchor drug in rheumatoid arthritis, given weekly with folic acid. At high dose, with leucovorin rescue, it is chemotherapy for acute lymphoblastic leukemia, lymphoma, osteosarcoma and choriocarcinoma. Adverse effects: liver injury, marrow suppression, mouth ulcers, lung toxicity; teratogenic.", "inhibit", "Competitive, so lymphocytes lack nucleotides; low dose also raises adenosine.", ["cyt"]],
  ["sk", "t_dhodh", "Dihydroorotate dehydrogenase", "enzyme", "DHODH", "Inner mitochondrial membrane enzyme of pyrimidine synthesis; activated T cells need it.", "d_lef", "Leflunomide", "csDMARD", "leflunomide, teriflunomide", "Alternative to methotrexate in rheumatoid and psoriatic arthritis. Adverse effects: hepatotoxicity, hypertension, teratogenicity (very long half-life).", "inhibit", "Less pyrimidine, so activated lymphocytes stop dividing.", ["mit"]],
  ["sk", "t_jak", "Janus kinases (JAK1/2/3)", "enzyme", "JAK1, JAK2, JAK3", "Tyrosine kinases bound to cytokine receptors; they phosphorylate STAT proteins that switch on inflammatory genes.", "d_jaki", "JAK inhibitors", "Targeted synthetic DMARDs", "tofacitinib, baricitinib, upadacitinib", "Oral drugs for rheumatoid and psoriatic arthritis. Boxed warning: infection, thrombosis, cardiovascular events, malignancy; they raise lipids.", "inhibit", "Cytokine signalling is cut off inside the cell.", ["cyt"]],
  ["sk", "t_tnf", "TNF-α", "ligand", "TNF", "Cytokine from macrophages that drives synovial inflammation and joint erosion.", "d_tnfi", "TNF inhibitors", "Biologic DMARDs", "infliximab, adalimumab, etanercept", "Used in rheumatoid and psoriatic arthritis and ankylosing spondylitis. Risks: serious infection, reactivated TB (screen first), demyelination.", "inhibit", "Antibodies or a decoy receptor mop up TNF.", ["ext"]],
  ["sk", "t_il6r", "IL-6 receptor", "receptor", "IL6R", "Receptor for interleukin-6, the cytokine behind fever, acute-phase proteins and joint inflammation.", "d_il6", "IL-6 receptor antibodies", "Biologic DMARDs", "tocilizumab, sarilumab", "Used in rheumatoid arthritis and giant cell arteritis. Adverse effects: infection, raised liver enzymes and lipids, low neutrophils.", "inhibit", "Blocks IL-6 signalling.", ["pm"]],
  ["sk", "t_il1r", "IL-1 receptor", "receptor", "IL1R1", "Receptor for interleukin-1, which the NLRP3 inflammasome releases when urate crystals are engulfed.", "d_il1", "IL-1 blockers", "Biologic anti-inflammatories", "anakinra, canakinumab", "Treat refractory gout flares and autoinflammatory syndromes. Risks: infection, injection-site reactions.", "inhibit", "Prevents IL-1 from signalling.", ["pm"]],
  ["sk", "t_tubulin", "β-Tubulin", "protein", "TUBB", "Building block of microtubules; neutrophils need them to migrate and release inflammatory mediators.", "d_colch", "Colchicine", "Antimitotic anti-inflammatory", "colchicine", "Treats and prevents acute gout flares and familial Mediterranean fever. Adverse effects: diarrhoea, myopathy, marrow suppression; narrow margin (CYP3A4 and P-gp interactions).", "inhibit", "Microtubules fall apart, so neutrophil movement and inflammasome activity drop.", ["cyt"]],
  ["sk", "t_ache", "Acetylcholinesterase", "enzyme", "ACHE", "Enzyme in the neuromuscular synaptic cleft that destroys acetylcholine within milliseconds.", "d_achei", "Cholinesterase inhibitors", "Myasthenia drugs", "pyridostigmine, neostigmine", "Raise acetylcholine in myasthenia gravis and reverse non-depolarising blockers. Adverse effects: cramps, salivation, bradycardia.", "inhibit", "More acetylcholine reaches the end plate.", ["ext"]],
  ["sk", "t_ryr1", "Ryanodine receptor 1", "transporter", "RYR1", "Calcium-release channel of the sarcoplasmic reticulum; opens to trigger muscle contraction. Mutations cause malignant hyperthermia.", "d_dant", "Dantrolene", "Muscle relaxant", "dantrolene", "Treats malignant hyperthermia (with cooling) and spasticity. Adverse effects: weakness, hepatotoxicity.", "inhibit", "Less calcium leaves the sarcoplasmic reticulum.", ["er"]],
  ["sk", "t_gabab", "GABA-B receptor", "receptor", "GABBR1/2", "Gi-coupled receptor in the spinal cord; dampens motor neuron firing and reflexes.", "d_bacl", "Baclofen", "Spasticity drug", "baclofen", "Treats spasticity from spinal cord injury and multiple sclerosis. Adverse effects: sedation; abrupt withdrawal causes seizures.", "activate", "Agonism reduces excitatory transmitter release.", ["pm"]],
  ["sk", "t_a2", "α₂-adrenergic receptor", "receptor", "ADRA2A", "Gi-coupled presynaptic receptor; its activation lowers spinal motor neuron drive.", "d_tiz", "Tizanidine", "Centrally acting muscle relaxant", "tizanidine", "Spasticity and muscle spasm. Adverse effects: drowsiness, low blood pressure, liver enzyme rise.", "activate", "Less release of excitatory transmitters in the spinal cord.", ["pm"]],
  ["sk", "t_cox", null, null, null, null, "d_nsaid", "NSAIDs", "COX inhibitors", "ibuprofen, naproxen, diclofenac, celecoxib", "First-line for joint pain and inflammation, and for acute gout. Adverse effects: ulcer and bleeding, kidney injury, raised blood pressure; celecoxib spares platelet COX-1 but not the cardiovascular risk.", "inhibit", "Reversible block of prostaglandin synthesis.", null],
  ["sk", "t_gr", null, null, null, null, "d_pred", "Systemic glucocorticoids", "Anti-inflammatory steroids", "prednisone, methylprednisolone", "Rapid control of arthritis, gout and polymyalgia. Long-term: osteoporosis, myopathy, avascular necrosis, hyperglycemia.", "activate", "Switches off inflammatory genes (the same receptor as inhaled steroids).", null],
  ["sk", "t_nachr", null, null, null, null, "d_sux", "Depolarising blockers", "Neuromuscular blockers", "succinylcholine", "Fast-onset paralysis for intubation. Risks: hyperkalemia, malignant hyperthermia, prolonged block in pseudocholinesterase deficiency.", "activate", "Persistent depolarisation of the end plate makes the muscle flaccid.", null],
  ["gi", "t_hkatpase", "H⁺/K⁺-ATPase (proton pump)", "transporter", "ATP4A", "Pumps acid into the stomach lumen from parietal cells; the final step of gastric acid secretion.", "d_ppi", "Proton-pump inhibitors", "PPIs", "omeprazole, pantoprazole", "Treat reflux, ulcers and H. pylori regimens. Long-term: low magnesium and B₁₂, fracture risk, C. difficile.", "inhibit", "Covalent, so acid output stays low until new pumps are made.", ["pm"]],
  ["gi", "t_h2", "Histamine H₂ receptor", "receptor", "HRH2", "Gs-coupled receptor on parietal cells; histamine drives acid secretion.", "d_h2", "H₂ blockers", "Acid suppressants", "famotidine, ranitidine", "Milder acid suppression than PPIs; useful at night. Tolerance develops quickly.", "inhibit", "Competitive antagonism lowers cAMP and acid secretion.", ["pm"]],
  ["cn", "t_sert", "Serotonin transporter", "transporter", "SLC6A4", "Takes serotonin back up into the presynaptic neuron, ending its signal.", "d_ssri", "SSRIs", "Reuptake inhibitors", "fluoxetine, sertraline, escitalopram", "First-line for depression and anxiety disorders; effect builds over weeks. Adverse effects: nausea, sexual dysfunction, serotonin syndrome with other serotonergic drugs.", "inhibit", "Serotonin stays longer in the synapse.", ["pm"]],
  ["cn", "t_gabaa", "GABA-A receptor", "receptor", "GABRA1", "Chloride channel opened by GABA; the main fast inhibitory receptor of the brain.", "d_bzd", "Benzodiazepines", "Positive allosteric modulators", "diazepam, lorazepam", "Anxiolytic, sedative, anticonvulsant and muscle relaxant. Risks: dependence, respiratory depression with opioids or alcohol.", "activate", "Raise how often the channel opens when GABA binds.", ["pm"]],
  ["en", "t_dpp4", "Dipeptidyl peptidase-4", "enzyme", "DPP4", "Cell-surface and circulating protease that degrades the incretin hormones GLP-1 and GIP within minutes.", "d_gliptin", "DPP-4 inhibitors", "Gliptins", "sitagliptin, linagliptin", "Modest glucose lowering without hypoglycemia or weight gain. Rare pancreatitis.", "inhibit", "Incretins last longer, so glucose-dependent insulin release rises.", ["pm", "ext"]],
  ["en", "t_glp1r", "GLP-1 receptor", "receptor", "GLP1R", "Gs-coupled receptor on pancreatic β-cells and in the brain; raises glucose-dependent insulin release and satiety.", "d_glp1", "GLP-1 receptor agonists", "Incretin mimetics", "semaglutide, liraglutide", "Lower glucose and body weight; some reduce cardiovascular events. Adverse effects: nausea, rare pancreatitis.", "activate", "Direct agonism of the incretin receptor.", ["pm"]],
  ["cv", "t_nkatpase", "Na⁺/K⁺-ATPase", "transporter", "ATP1A1", "Sodium pump of every cell. In cardiac myocytes it keeps intracellular sodium low, which lets the Na⁺/Ca²⁺ exchanger remove calcium.", "d_digoxin", "Cardiac glycosides", "Na⁺/K⁺-ATPase inhibitors", "digoxin", "Slow the ventricular rate in atrial fibrillation and add inotropy in heart failure. Narrow therapeutic window: toxicity causes nausea, yellow-green vision and arrhythmia, and is worse with hypokalemia.", "inhibit", "Less sodium export means more intracellular calcium and a stronger contraction.", ["pm"]],
  ["cv", "t_p2y12", "P2Y₁₂ receptor", "receptor", "P2RY12", "Gi-coupled ADP receptor on platelets; ADP binding amplifies activation and aggregation.", "d_p2y12i", "P2Y₁₂ inhibitors", "Antiplatelets", "clopidogrel, prasugrel, ticagrelor", "Prevent stent thrombosis and recurrent MI, usually with aspirin. Adverse effects: bleeding. Clopidogrel is a prodrug that needs CYP2C19; ticagrelor can cause dyspnea.", "inhibit", "Clopidogrel and prasugrel bind irreversibly; ticagrelor binds reversibly.", ["pm"]],
  ["cv", "t_fxa", "Factor Xa", "enzyme", "F10", "Serine protease where the intrinsic and extrinsic pathways meet; each Xa generates many thrombin molecules.", "d_xai", "Direct Xa inhibitors", "DOACs", "apixaban, rivaroxaban, edoxaban", "Prevent stroke in atrial fibrillation and treat venous thromboembolism without routine monitoring. Adverse effect: bleeding; reversed by andexanet alfa.", "inhibit", "Block the active site of free and clot-bound Xa.", ["ext"]],
  ["cv", "t_thrombin", "Thrombin (factor IIa)", "enzyme", "F2", "Cleaves fibrinogen to fibrin and activates platelets and factors V, VIII, XI and XIII.", "d_dti", "Direct thrombin inhibitors", "Anticoagulants", "dabigatran, argatroban, bivalirudin", "Dabigatran is an oral option in atrial fibrillation and VTE (reversal: idarucizumab). Argatroban and bivalirudin are intravenous, used in heparin-induced thrombocytopenia and PCI.", "inhibit", "Bind the active site directly, without needing antithrombin.", ["ext"]],
  ["cv", "t_vkor", "Vitamin K epoxide reductase", "enzyme", "VKORC1", "Recycles vitamin K so that it can γ-carboxylate factors II, VII, IX, X and proteins C and S.", "d_warf", "Warfarin", "Vitamin K antagonist", "warfarin", "Oral anticoagulant for mechanical valves and atrial fibrillation with mitral stenosis; dosed by INR. Adverse effects: bleeding, skin necrosis, teratogenicity; many interactions (CYP2C9). Reversal: vitamin K, prothrombin complex concentrate.", "inhibit", "Depletes active vitamin K, so factors are made without their γ-carboxyglutamate; protein C falls first.", ["er"]],
  ["cv", "t_nav", "Voltage-gated Na⁺ channel", "transporter", "SCN5A (heart), SCN1A/2A (brain)", "Opens on depolarisation; it makes the upstroke of the cardiac action potential and of neuronal firing.", "d_class1", "Class I antiarrhythmics", "Sodium-channel blockers", "lidocaine, flecainide, procainamide", "Slow conduction and suppress ventricular and atrial arrhythmias. Flecainide is contraindicated after MI or in structural heart disease; procainamide can cause drug-induced lupus.", "inhibit", "Use-dependent block: they bind open channels, so fast rhythms are affected most.", ["pm"]],
  ["cv", "t_herg", "hERG K⁺ channel", "transporter", "KCNH2", "Delayed-rectifier potassium channel that repolarises the cardiac action potential (phase 3).", "d_class3", "Class III antiarrhythmics", "Potassium-channel blockers", "amiodarone, sotalol, dofetilide", "Rhythm control in atrial fibrillation and ventricular tachycardia. QT prolongation and torsades; amiodarone adds thyroid, lung, liver and corneal toxicity.", "inhibit", "Block repolarisation, lengthening the action potential and refractory period.", ["pm"]],
  ["cv", "t_gc", "Soluble guanylyl cyclase", "enzyme", "GUCY1A1, GUCY1B1", "Receives nitric oxide in smooth muscle and makes cGMP, which relaxes the muscle.", "d_nitrate", "Organic nitrates", "NO donors", "nitroglycerin, isosorbide mononitrate", "Relieve angina and acute heart failure by venodilation and, at higher doses, coronary dilation. Adverse effects: headache, hypotension, tolerance; never with PDE5 inhibitors.", "activate", "Release NO, which activates the enzyme and raises cGMP.", ["cyt"]],
  ["cv", "t_nep", "Neprilysin", "enzyme", "MME", "Membrane peptidase that degrades natriuretic peptides, bradykinin and angiotensin II.", "d_arni", "Sacubitril (with valsartan)", "ARNI", "sacubitril/valsartan", "Lowers death and admissions in heart failure with reduced ejection fraction. Adverse effects: hypotension, hyperkalemia, angioedema; never within 36 h of an ACE inhibitor.", "inhibit", "Natriuretic peptides persist, promoting natriuresis and vasodilation.", ["pm"]],
  ["cv", "t_hcn", "HCN channel (funny current)", "transporter", "HCN4", "Pacemaker current of the sinoatrial node; sets the slope of phase 4 depolarisation.", "d_ivab", "Ivabradine", "If-channel blocker", "ivabradine", "Lowers heart rate without lowering contractility in heart failure and angina when a beta-blocker is not enough. Adverse effects: bradycardia, visual phosphenes, atrial fibrillation.", "inhibit", "Slows spontaneous depolarisation of the sinoatrial node.", ["pm"]],
  ["cv", "t_a1", "α₁-adrenergic receptor", "receptor", "ADRA1A", "Gq-coupled receptor on vascular smooth muscle and the prostate; noradrenaline constricts vessels and tightens the bladder neck.", "d_a1b", "α₁ blockers", "Vasodilators", "prazosin, doxazosin, tamsulosin", "Lower blood pressure and relieve urinary obstruction in benign prostatic hyperplasia. Adverse effects: first-dose orthostatic hypotension, dizziness.", "inhibit", "Relax arterial, venous and prostatic smooth muscle.", ["pm"]],
  ["cv", "t_a2", null, null, null, null, "d_clon", "Central α₂ agonists", "Sympatholytics", "clonidine, methyldopa", "Lower blood pressure by cutting sympathetic outflow; methyldopa is used in pregnancy. Adverse effects: sedation, dry mouth, rebound hypertension if clonidine is stopped abruptly.", "activate", "Stimulate presynaptic α₂ receptors in the brainstem, so less noradrenaline is released.", null],
  ["rs", "t_cyslt1", "Cysteinyl leukotriene receptor 1", "receptor", "CYSLTR1", "Gq-coupled receptor on airway smooth muscle; leukotrienes C₄, D₄ and E₄ from mast cells and eosinophils constrict the airway and raise mucus and oedema.", "d_ltra", "Leukotriene receptor antagonists", "LTRAs", "montelukast, zafirlukast", "Add-on in asthma, exercise-induced bronchoconstriction and allergic rhinitis. Warning: neuropsychiatric effects with montelukast.", "inhibit", "Block the receptor for leukotriene D₄.", ["pm"]],
  ["rs", "t_ige", "IgE", "antibody", "IGHE", "The scarcest class in serum, but its Fc region binds FcεRI on mast cells and basophils for weeks. Allergen cross-linking those bound IgE molecules triggers degranulation (type I hypersensitivity); it also drives eosinophil attack on helminths.", "d_omal", "Omalizumab", "Anti-IgE antibody", "omalizumab", "Add-on for moderate-to-severe allergic asthma, chronic spontaneous urticaria, nasal polyps and IgE-mediated food allergy (it lessens reactions to accidental exposure). Risk: anaphylaxis (boxed warning), so observe after the dose.", "inhibit", "Binds the Fc region of free IgE, so it cannot attach to FcεRI, and receptor numbers on mast cells and basophils fall.", ["ext", "pm"]],
  ["rs", "t_il5", "IL-5 and its receptor", "ligand", "IL5, IL5RA", "Cytokine that matures and sustains eosinophils.", "d_il5", "Anti-IL-5 antibodies", "Eosinophil-directed biologics", "mepolizumab, reslizumab, benralizumab", "Severe eosinophilic asthma and eosinophilic granulomatosis with polyangiitis; they cut exacerbations and oral steroid use.", "inhibit", "Remove IL-5 signalling (benralizumab targets the receptor), so eosinophils fall.", ["ext"]],
  ["rs", "t_pde4", "Phosphodiesterase-4", "enzyme", "PDE4B, PDE4D", "Breaks down cAMP in airway inflammatory cells.", "d_pde4", "PDE4 inhibitors", "Anti-inflammatory COPD drugs", "roflumilast", "Reduce exacerbations in severe COPD with chronic bronchitis. Adverse effects: diarrhoea, weight loss, insomnia, depression.", "inhibit", "cAMP stays high in inflammatory cells, damping their activity.", ["cyt"]],
  ["rs", "t_pde5", "Phosphodiesterase-5", "enzyme", "PDE5A", "Breaks down cGMP in pulmonary vascular and penile smooth muscle.", "d_pde5", "PDE5 inhibitors", "Vasodilators", "sildenafil, tadalafil", "Pulmonary arterial hypertension and erectile dysfunction. Adverse effects: headache, flushing, visual changes; never with nitrates.", "inhibit", "cGMP accumulates and relaxes the smooth muscle.", ["cyt"]],
  ["rs", "t_h1", "Histamine H₁ receptor", "receptor", "HRH1", "Gq-coupled receptor on airway and vascular smooth muscle, endothelium and sensory nerves; histamine causes itch, wheal, rhinorrhoea and bronchoconstriction.", "d_h1", "H₁ antihistamines", "Allergy drugs", "cetirizine, loratadine, diphenhydramine", "Allergic rhinitis and urticaria. First-generation agents are sedating and anticholinergic; second-generation agents are not.", "inhibit", "Inverse agonism at the receptor.", ["pm"]],
  ["rs", "t_cftr", "CFTR chloride channel", "transporter", "CFTR", "Apical chloride and bicarbonate channel of airway epithelium; defects thicken mucus in cystic fibrosis.", "d_cftrm", "CFTR modulators", "Potentiators and correctors", "ivacaftor, elexacaftor, tezacaftor", "Improve lung function in cystic fibrosis with eligible CFTR variants. Adverse effects: raised liver enzymes, cataracts in children.", "activate", "Hold the channel open (ivacaftor) or improve its folding and trafficking (correctors).", ["ap"]],
  ["gi", "t_5ht3", "5-HT₃ receptor", "receptor", "HTR3A", "Ligand-gated cation channel on vagal afferents and in the chemoreceptor trigger zone; serotonin from enterochromaffin cells triggers nausea and vomiting.", "d_5ht3", "5-HT₃ antagonists", "Antiemetics", "ondansetron, granisetron", "Prevent chemotherapy, radiation and post-operative vomiting. Adverse effects: constipation, headache, QT prolongation.", "inhibit", "Competitive block of the channel.", ["pm"]],
  ["gi", "t_nk1", "NK₁ receptor", "receptor", "TACR1", "Substance P receptor in the brainstem vomiting centre.", "d_nk1", "NK₁ antagonists", "Antiemetics", "aprepitant, fosaprepitant", "Added to a 5-HT₃ blocker and dexamethasone to prevent delayed chemotherapy-induced vomiting. CYP3A4 interactions.", "inhibit", "Block substance P signalling in the brainstem.", ["pm"]],
  ["gi", "t_gcc", "Guanylate cyclase-C", "receptor", "GUCY2C", "Apical receptor of intestinal epithelium; guanylin raises cGMP, which opens CFTR and secretes fluid.", "d_gcc", "GC-C agonists", "Secretagogues", "linaclotide, plecanatide", "Irritable bowel syndrome with constipation and chronic constipation. Adverse effect: diarrhoea.", "activate", "More cGMP, so chloride and water enter the lumen.", ["ap"]],
  ["gi", "t_clc2", "ClC-2 chloride channel", "transporter", "CLCN2", "Apical channel of intestinal epithelium that secretes chloride and with it water.", "d_lubi", "Lubiprostone", "Chloride-channel activator", "lubiprostone", "Chronic constipation and IBS with constipation. Adverse effects: nausea, diarrhoea.", "activate", "Opens the channel, so fluid enters the lumen.", ["ap"]],
  ["gi", "t_ep", "Prostaglandin E receptors (EP)", "receptor", "PTGER1–4", "Receptors for PGE₂ on gastric epithelium and the uterus; in the stomach they raise mucus and bicarbonate and lower acid.", "d_miso", "Misoprostol", "PGE₁ analogue", "misoprostol", "Protects the stomach from NSAID ulcers; also ripens the cervix and induces abortion, so it is contraindicated in pregnancy unless intended. Adverse effect: diarrhoea.", "activate", "Mimics mucosal PGE₂.", ["pm"]],
  ["gi", "t_a4b7", "α4β7 integrin", "receptor", "ITGA4, ITGB7", "Gut-homing integrin on lymphocytes; binds MAdCAM-1 on gut vessels.", "d_vedo", "Vedolizumab", "Anti-integrin antibody", "vedolizumab", "Ulcerative colitis and Crohn disease. Gut-selective, so systemic infections are uncommon.", "inhibit", "Stops lymphocytes homing to the gut wall.", ["pm"]],
  ["gi", "t_d2", null, null, null, null, "d_proki", "Prokinetics", "D₂ antagonists", "metoclopramide, domperidone", "Gastroparesis and nausea. Adverse effects: extrapyramidal symptoms and tardive dyskinesia (metoclopramide crosses the blood–brain barrier), hyperprolactinemia; domperidone prolongs QT.", "inhibit", "Block inhibitory dopamine on gut neurons and in the chemoreceptor trigger zone.", null],
  ["gi", "t_mu", null, null, null, null, "d_loper", "Peripheral opioids", "Antidiarrhoeals", "loperamide, diphenoxylate", "Slow gut motility and secretion. Avoid in infectious colitis; loperamide in very high doses causes QT prolongation.", "activate", "μ-receptor activation on enteric neurons reduces peristalsis.", null],
  ["cn", "t_d2", "Dopamine D₂ receptor", "receptor", "DRD2", "Gi-coupled receptor in the striatum, mesolimbic pathway, pituitary and chemoreceptor trigger zone.", "d_apsy", "Antipsychotics", "D₂ antagonists", "haloperidol, risperidone, olanzapine", "Treat psychosis and mania. Adverse effects: parkinsonism, tardive dyskinesia, hyperprolactinemia, QT prolongation; atypicals add weight gain and metabolic syndrome. Rare neuroleptic malignant syndrome. (Aripiprazole is a partial agonist.)", "inhibit", "Block dopamine signalling in the mesolimbic pathway.", ["pm"]],
  ["cn", "t_dat", "Dopamine transporter", "transporter", "SLC6A3", "Takes dopamine back into the presynaptic neuron.", "d_stim", "CNS stimulants", "Reuptake inhibitors and releasers", "methylphenidate, amphetamine", "ADHD and narcolepsy. Adverse effects: insomnia, appetite loss, hypertension, tachycardia, abuse potential.", "inhibit", "More dopamine and noradrenaline stay in the synapse.", ["pm"]],
  ["cn", "t_maob", "Monoamine oxidase B", "enzyme", "MAOB", "Outer mitochondrial membrane enzyme that deaminates dopamine in the brain.", "d_maobi", "MAO-B inhibitors", "Parkinson drugs", "selegiline, rasagiline, safinamide", "Add-on in Parkinson disease. Avoid with SSRIs and meperidine (serotonin syndrome).", "inhibit", "Less dopamine is broken down.", ["mit"]],
  ["cn", "t_ddc", "Aromatic L-amino acid decarboxylase", "enzyme", "DDC", "Converts L-DOPA to dopamine.", "d_levo", "Levodopa with carbidopa", "Dopamine precursor", "levodopa–carbidopa", "The most effective drug for Parkinson disease. Carbidopa blocks the enzyme outside the brain so more levodopa gets in and nausea and hypotension fall. Adverse effects: dyskinesias, on–off fluctuations.", "substrate", "Levodopa is decarboxylated to dopamine in nigrostriatal neurons; carbidopa inhibits the enzyme in the periphery.", ["cyt"]],
  ["cn", "t_mu", "μ-opioid receptor", "receptor", "OPRM1", "Gi-coupled receptor in the brain, spinal cord and gut; endorphins and morphine reduce pain and bowel motility.", "d_opioid", "Opioids", "μ agonists", "morphine, fentanyl, oxycodone", "Severe pain. Adverse effects: respiratory depression, constipation, miosis, dependence; overdose is reversed by naloxone.", "activate", "Hyperpolarise pain-pathway neurons and cut transmitter release.", ["pm"]],
  ["cn", "t_a2d", "α₂δ subunit of Ca²⁺ channels", "transporter", "CACNA2D1", "Auxiliary subunit that brings calcium channels to presynaptic terminals.", "d_gaba", "Gabapentinoids", "α₂δ ligands", "gabapentin, pregabalin", "Neuropathic pain, postherpetic neuralgia and focal seizures. Adverse effects: sedation, dizziness, oedema; cleared by the kidney, so dose by renal function.", "inhibit", "Lower presynaptic calcium entry and glutamate release.", ["pm"]],
  ["cn", "t_nmda", "NMDA receptor", "receptor", "GRIN1, GRIN2A/B", "Glutamate-gated calcium channel needed for synaptic plasticity; excess calcium entry is excitotoxic.", "d_nmdaa", "NMDA antagonists", "Channel blockers", "memantine, ketamine", "Memantine in moderate to severe Alzheimer disease; ketamine as an anaesthetic and rapid-acting antidepressant. Adverse effects: dizziness, dissociation, raised blood pressure.", "inhibit", "Block the open channel.", ["pm"]],
  ["cn", "t_5ht1b", "5-HT₁B/₁D receptor", "receptor", "HTR1B, HTR1D", "Gi-coupled receptors on cranial vessels and trigeminal nerve endings.", "d_triptan", "Triptans", "5-HT₁B/₁D agonists", "sumatriptan, rizatriptan", "Abort migraine attacks. Contraindicated in coronary disease and uncontrolled hypertension; may cause chest tightness.", "activate", "Constrict cranial vessels and block release of CGRP.", ["pm"]],
  ["cn", "t_sv2a", "Synaptic vesicle protein 2A", "protein", "SV2A", "Vesicle glycoprotein that helps neurotransmitter release.", "d_levet", "Levetiracetam", "Antiseizure drug", "levetiracetam, brivaracetam", "Broad-spectrum antiseizure drug with few interactions. Adverse effects: irritability, somnolence.", "inhibit", "Binding reduces transmitter release at high firing rates.", ["pm"]],
  ["cn", "t_nav", null, null, null, null, "d_aed_na", "Sodium-channel anticonvulsants", "Antiseizure drugs", "phenytoin, carbamazepine, lamotrigine", "Focal and generalised tonic–clonic seizures; carbamazepine also treats trigeminal neuralgia. Adverse effects: carbamazepine hyponatremia and HLA-B*15:02 Stevens–Johnson syndrome, enzyme induction; phenytoin gingival hyperplasia.", "inhibit", "Stabilise inactivated channels so repetitive firing stops.", null],
  ["cn", "t_ache", null, null, null, null, "d_donep", "Central cholinesterase inhibitors", "Alzheimer drugs", "donepezil, rivastigmine, galantamine", "Modest benefit in mild to moderate Alzheimer disease. Adverse effects: nausea, bradycardia, vivid dreams.", "inhibit", "Raise acetylcholine in cortical synapses.", null],
  ["hp", "t_npc1l1", "NPC1L1", "transporter", "NPC1L1", "Brush-border protein that takes up dietary and biliary cholesterol in enterocytes (and hepatocytes).", "d_ezet", "Ezetimibe", "Cholesterol-absorption inhibitor", "ezetimibe", "Adds about 20% LDL lowering to a statin, or replaces it in intolerance. Well tolerated; liver enzymes may rise slightly with a statin.", "inhibit", "Less cholesterol is absorbed, so hepatic LDL-receptor uptake rises.", ["ap"]],
  ["hp", "t_pcsk9", "PCSK9", "ligand", "PCSK9", "Secreted protease that sends the LDL receptor to lysosomes; less receptor means higher LDL.", "d_pcsk9", "PCSK9 inhibitors", "Antibodies and siRNA", "evolocumab, alirocumab, inclisiran", "Lower LDL by about 50–60% on top of a statin in familial hypercholesterolemia and atherosclerotic disease. Adverse effect: injection-site reactions.", "inhibit", "More LDL receptors recycle to the hepatocyte surface.", ["ext"]],
  ["hp", "t_fxr", "Farnesoid X receptor", "receptor", "NR1H4", "Nuclear bile-acid sensor in liver and ileum; represses bile-acid synthesis and raises their export.", "d_ocalic", "FXR agonists", "Bile-acid receptor agonists", "obeticholic acid", "Second-line for primary biliary cholangitis. Adverse effects: pruritus; hepatic decompensation in advanced cirrhosis.", "activate", "Lowers bile-acid synthesis and the cholestatic load.", ["nuc"]],
  ["hp", "t_hbvpol", "HBV DNA polymerase", "enzyme", "HBV P protein", "Reverse transcriptase of hepatitis B virus.", "d_nuc", "Nucleos(t)ide analogues", "Antivirals", "entecavir, tenofovir", "Suppress hepatitis B replication; often lifelong, and stopping can cause a flare. Tenofovir: kidney and bone toxicity.", "inhibit", "Chain termination of viral DNA.", ["cyt"]],
  ["hp", "t_ns5b", "HCV NS5B polymerase", "enzyme", "NS5B", "RNA-dependent RNA polymerase of hepatitis C virus.", "d_daa", "Direct-acting antivirals", "Polymerase inhibitors", "sofosbuvir (with velpatasvir)", "Courses of 8–12 weeks cure over 95% of hepatitis C. Risks: hepatitis B reactivation, bradycardia with amiodarone.", "inhibit", "Chain termination of viral RNA.", ["cyt"]],
  ["hp", "t_adh", "Alcohol dehydrogenase", "enzyme", "ADH1B", "Cytosolic liver enzyme that oxidises ethanol, and also methanol and ethylene glycol, with NAD⁺.", "d_fomep", "Fomepizole", "ADH inhibitor", "fomepizole", "Antidote for methanol and ethylene glycol poisoning: stops formation of formic acid and glycolate/oxalate. Adverse effects: headache, nausea.", "inhibit", "Competitive block, so the toxic metabolites are not formed.", ["cyt"]],
  ["hp", "t_aldh", "Aldehyde dehydrogenase", "enzyme", "ALDH2", "Mitochondrial enzyme that converts acetaldehyde to acetate.", "d_disulf", "Disulfiram", "ALDH inhibitor", "disulfiram", "Alcohol-use disorder: drinking then causes flushing, palpitations and vomiting. Adverse effects: hepatotoxicity, neuropathy.", "inhibit", "Acetaldehyde builds up after alcohol.", ["mit"]],
  ["en", "t_ir", "Insulin receptor", "receptor", "INSR", "Receptor tyrosine kinase on liver, muscle and fat; insulin triggers GLUT4 translocation, glycogen and lipid synthesis.", "d_ins", "Insulins", "Insulin and analogues", "regular insulin, lispro, glargine, detemir", "Type 1 diabetes, insulin-requiring type 2 diabetes and DKA. Adverse effects: hypoglycemia, weight gain, hypokalemia (insulin drives K⁺ into cells).", "activate", "Direct agonism of the receptor.", ["pm"]],
  ["en", "t_katp", "K-ATP channel (SUR1/Kir6.2)", "transporter", "ABCC8, KCNJ11", "Closes when β-cell ATP rises, depolarising the cell and opening calcium channels for insulin release.", "d_su", "Sulfonylureas", "Insulin secretagogues", "glipizide, glimepiride, repaglinide", "Type 2 diabetes. Adverse effects: hypoglycemia (glyburide especially with renal impairment), weight gain.", "inhibit", "Close the channel, so insulin is released regardless of glucose.", ["pm"]],
  ["en", "t_ampk", "AMP-activated protein kinase", "enzyme", "PRKAA1, PRKAA2", "Cellular energy sensor; when AMP is high it switches off gluconeogenesis and fatty-acid synthesis and switches on glucose uptake.", "d_metf", "Metformin", "Biguanide", "metformin", "First-line for type 2 diabetes: lowers hepatic glucose output without hypoglycemia, with mild weight loss. Adverse effects: GI upset, B₁₂ deficiency, rare lactic acidosis (stop with eGFR below 30 or before contrast).", "activate", "Raises AMP by inhibiting mitochondrial complex I, an effect on the enzyme through its energy signal.", ["cyt"]],
  ["en", "t_tpo", "Thyroid peroxidase", "enzyme", "TPO", "Iodinates tyrosine residues on thyroglobulin and couples them to make T₃ and T₄.", "d_ats", "Thionamides", "Antithyroid drugs", "methimazole, propylthiouracil", "Graves disease and toxic nodules. Adverse effects: agranulocytosis (fever or sore throat: stop and check the count), rash. PTU can cause liver failure, so it is kept for the first trimester and thyroid storm; methimazole is teratogenic.", "inhibit", "Less hormone is made.", ["ap"]],
  ["en", "t_thr", "Thyroid hormone receptor", "receptor", "THRA, THRB", "Nuclear receptor; T₃ raises metabolic rate, heart rate and protein synthesis.", "d_levot", "Thyroid hormone replacement", "Levothyroxine", "levothyroxine, liothyronine", "Hypothyroidism and TSH suppression after thyroid cancer. Dose to TSH; excess causes tachycardia, atrial fibrillation and bone loss. Take on an empty stomach, apart from calcium and iron.", "activate", "Replaces the missing hormone.", ["nuc"]],
  ["en", "t_casr", "Calcium-sensing receptor", "receptor", "CASR", "Gq-coupled receptor on parathyroid chief cells and kidney tubule; high calcium lowers PTH release and raises urinary calcium loss.", "d_cinac", "Calcimimetics", "CaSR agonists", "cinacalcet, etelcalcetide", "Secondary hyperparathyroidism in dialysis and parathyroid carcinoma. Adverse effects: hypocalcemia, nausea, QT prolongation.", "activate", "The parathyroid reads calcium as higher, so PTH falls.", ["pm"]],
  ["en", "t_cyp19", "Aromatase", "enzyme", "CYP19A1", "Converts androgens to estrogens in fat, ovary and breast.", "d_ai", "Aromatase inhibitors", "Anti-estrogens", "anastrozole, letrozole", "Adjuvant therapy of hormone-receptor-positive breast cancer after menopause. Adverse effects: bone loss, arthralgia, hot flushes.", "inhibit", "Estrogen synthesis falls.", ["er"]],
  ["en", "t_srd5a2", "5α-reductase type 2", "enzyme", "SRD5A2", "Converts testosterone to dihydrotestosterone in prostate and hair follicles.", "d_5ari", "5α-reductase inhibitors", "BPH and alopecia drugs", "finasteride, dutasteride", "Shrink the prostate and slow male-pattern hair loss. Adverse effects: low libido, erectile dysfunction; they halve PSA.", "inhibit", "Less DHT is made.", ["er"]],
  ["en", "t_ar", "Androgen receptor", "receptor", "AR", "Nuclear receptor for testosterone and DHT; drives prostate growth.", "d_antiand", "Antiandrogens", "AR antagonists", "bicalutamide, flutamide, enzalutamide", "Prostate cancer. Adverse effects: gynecomastia, hot flushes; flutamide can injure the liver.", "inhibit", "Block androgen binding.", ["nuc"]],
  ["en", "t_gnrhr", "GnRH receptor", "receptor", "GNRHR", "Gq-coupled receptor on pituitary gonadotrophs; pulsatile GnRH releases LH and FSH.", "d_gnrh", "GnRH analogues", "Agonists and antagonists", "leuprolide, goserelin, degarelix", "Prostate cancer, endometriosis, fibroids, precocious puberty. Agonists cause an initial testosterone flare.", "activate", "Continuous exposure desensitises the receptor, so LH and FSH fall (antagonists such as degarelix block it directly).", ["pm"]],
  ["en", "t_sstr2", "Somatostatin receptor 2", "receptor", "SSTR2", "Gi-coupled receptor on pituitary somatotrophs and neuroendocrine tumour cells.", "d_octr", "Somatostatin analogues", "Octreotide-type drugs", "octreotide, lanreotide", "Acromegaly, carcinoid and VIPoma symptoms, variceal bleeding. Adverse effects: gallstones, steatorrhea, bradycardia, dysglycemia.", "activate", "Suppress GH, insulin, glucagon and gut hormone release.", ["pm"]],
  ["en", "t_er", null, null, null, null, "d_tamox", "Tamoxifen", "SERM, breast antagonist", "tamoxifen", "Adjuvant therapy of ER-positive breast cancer. Adverse effects: endometrial cancer, venous thromboembolism, hot flushes.", "inhibit", "Blocks estrogen in the breast; acts as an agonist in endometrium and bone.", null],
  ["en", "t_d2", null, null, null, null, "d_dagon", "Dopamine agonists", "Prolactinoma drugs", "cabergoline, bromocriptine", "First-line for prolactinoma: shrink the tumour and restore gonadal function. Adverse effects: nausea, orthostatic hypotension, impulse-control problems.", "activate", "Stimulate D₂ receptors on lactotrophs, which suppresses prolactin.", null],
  ["en", "t_gr", null, null, null, null, "d_hydrocort", "Glucocorticoid replacement", "Adrenal steroids", "hydrocortisone, dexamethasone", "Adrenal insufficiency and congenital adrenal hyperplasia. Stress-dose in illness; excess causes Cushing features.", "activate", "Replaces cortisol at the same receptor.", null],
  // ---- Oncology hub: cytotoxic chemotherapy grouped by mechanism, then rescue and supportive drugs ----
  // antimetabolites (mostly S phase)
  ["on", "t_ts", "Thymidylate synthase", "enzyme", "TYMS", "Methylates dUMP to dTMP with N⁵,N¹⁰-methylene-tetrahydrofolate as the methyl donor: the only de novo source of thymidine for DNA, so dividing cells depend on it.", "d_fu", "Fluoropyrimidines", "Pyrimidine antimetabolites", "fluorouracil (5-FU), capecitabine", "Colorectal, gastric, pancreatic, breast and head-and-neck cancers (capecitabine is the oral prodrug). Adverse effects: myelosuppression, mucositis, diarrhoea, and hand–foot syndrome with capecitabine. Dihydropyrimidine dehydrogenase (DPD) deficiency causes severe early toxicity.", "inhibit", "The metabolite FdUMP forms a covalent complex with the enzyme and folate, so dTMP is not made: thymineless death in S phase.", ["cyt"]],
  ["on", "t_ts", null, null, null, null, "d_peme", "Pemetrexed", "Multitargeted antifolate", "pemetrexed", "Non-squamous non-small-cell lung cancer and mesothelioma. Also blocks DHFR and purine synthesis (GARFT). Give folic acid and vitamin B₁₂ to lessen toxicity. Adverse effects: myelosuppression, mucositis, rash; cleared by the kidney.", "inhibit", "Blocks thymidylate synthase (and DHFR and GARFT), so both thymidine and purines run short.", null],
  ["on", "t_ts", null, null, null, null, "d_leuco", "Leucovorin (folinic acid)", "Reduced-folate rescue", "leucovorin, levoleucovorin", "Already-reduced folate, so it needs no DHFR. Rescues normal cells after high-dose methotrexate (give on schedule, with hydration and urine alkalinisation) and, with fluorouracil, strengthens its effect in colorectal cancer. It can worsen fluorouracil diarrhoea and mucositis.", "activate", "Supplies N⁵,N¹⁰-methylene-tetrahydrofolate, which locks FdUMP onto thymidylate synthase.", null],
  ["on", "t_ppat", "Amidophosphoribosyltransferase", "enzyme", "PPAT", "First committed step of de novo purine synthesis: PRPP and glutamine give 5-phosphoribosylamine. AMP, GMP and their analogues switch it off by feedback.", "d_thiop", "Thiopurines", "Purine antimetabolites", "mercaptopurine (6-MP), thioguanine, azathioprine", "Mercaptopurine and thioguanine treat acute lymphoblastic and myeloid leukemias; azathioprine is an immunosuppressant (transplant, IBD). HGPRT converts them to fraudulent nucleotides. Xanthine oxidase inactivates 6-MP, so cut the dose by about 75% with allopurinol; TPMT deficiency causes severe myelosuppression. Adverse effects: myelosuppression, hepatotoxicity.", "inhibit", "The nucleotide TIMP mimics AMP and GMP and shuts the enzyme off, so purine synthesis falls.", ["cyt"]],
  ["on", "t_rnr", "Ribonucleotide reductase", "enzyme", "RRM1, RRM2", "Converts ribonucleoside diphosphates to deoxyribonucleotides, the rate-limiting supply of DNA building blocks. A tyrosyl radical drives the reaction.", "d_hu", "Hydroxyurea", "Ribonucleotide reductase inhibitor", "hydroxyurea", "Chronic myeloid leukemia, polycythemia vera and essential thrombocythemia; in sickle cell disease it raises fetal hemoglobin and cuts crises. Adverse effects: myelosuppression, macrocytosis (megaloblastic changes), skin changes; teratogenic.", "inhibit", "Quenches the tyrosyl radical, so dNTP pools fall and S-phase cells stall.", ["cyt"]],
  ["on", "t_polym", "DNA polymerase (α, δ, ε)", "enzyme", "POLA1, POLD1, POLE", "Replicative polymerases that copy the genome in S phase; each needs a free 3′-OH on the growing strand.", "d_pyra", "Pyrimidine nucleoside analogues", "Cytidine antimetabolites", "cytarabine (ara-C), gemcitabine", "Cytarabine is the backbone of acute myeloid leukemia regimens; gemcitabine treats pancreatic, bladder, lung and ovarian cancers. Phosphorylated to the triphosphate and built into DNA. Adverse effects: myelosuppression; high-dose cytarabine causes cerebellar toxicity and conjunctivitis; gemcitabine can cause hemolytic uremic syndrome.", "inhibit", "Chain termination or stalled elongation (gemcitabine also inhibits ribonucleotide reductase).", ["nuc"]],
  ["on", "t_polym", null, null, null, null, "d_puran", "Purine nucleoside analogues", "Adenosine-deaminase-resistant antimetabolites", "fludarabine, cladribine", "Chronic lymphocytic leukemia, hairy cell leukemia (cladribine) and low-grade lymphomas. They kill resting lymphocytes as well as dividing cells. Adverse effects: profound lymphopenia with opportunistic infection (give Pneumocystis prophylaxis), myelosuppression, neurotoxicity at high dose; fludarabine can cause autoimmune hemolytic anemia.", "inhibit", "Built into DNA after phosphorylation, they end the chain and block repair.", null],
  ["on", "t_dnmt", "DNA methyltransferase 1", "enzyme", "DNMT1", "Copies CpG methylation onto the new strand after replication; hypermethylation silences tumour-suppressor genes.", "d_hma", "Hypomethylating agents", "Cytidine analogues", "azacitidine, decitabine", "Myelodysplastic syndromes and acute myeloid leukemia in patients unfit for intensive chemotherapy. Adverse effects: myelosuppression, nausea, injection-site reactions.", "inhibit", "Built into nucleic acid, they trap the enzyme covalently, so methylation is lost and silenced genes switch back on.", ["nuc"]],
  // DNA-damaging agents (not cell-cycle specific)
  ["on", "t_dnaalk", "DNA (guanine alkylation)", "nucleic", "N7 and O⁶ of guanine", "Alkyl groups on guanine cause cross-links and mispairing that block replication and trigger apoptosis. The repair enzyme MGMT removes O⁶-alkyl groups.", "d_mustard", "Nitrogen mustards", "Alkylating agents", "cyclophosphamide, ifosfamide, melphalan, chlorambucil", "Lymphoma, leukemia, myeloma, breast and ovarian cancer and sarcoma; cyclophosphamide also treats vasculitis and nephrotic syndrome. Cyclophosphamide and ifosfamide are prodrugs activated by liver CYP450; their metabolite acrolein causes hemorrhagic cystitis (prevent with mesna and fluids). Adverse effects: myelosuppression, infertility, secondary malignancy (bladder cancer, leukemia); ifosfamide also causes encephalopathy and Fanconi-type kidney injury.", "alter", "Cross-link guanines on the same or opposite strands, so DNA cannot be copied or read.", ["nuc"]],
  ["on", "t_dnaalk", null, null, null, null, "d_nitroso", "Nitrosoureas", "Lipid-soluble alkylating agents", "carmustine, lomustine, streptozocin", "Lipid solubility lets carmustine and lomustine cross the blood–brain barrier: glioma and brain metastases. Streptozocin enters β-cells through GLUT2 and treats pancreatic islet-cell tumours; it is toxic to β-cells and the kidney. Adverse effects: delayed myelosuppression, pulmonary fibrosis (carmustine).", "alter", "Alkylate and cross-link DNA.", null],
  ["on", "t_dnaalk", null, null, null, null, "d_busulfan", "Busulfan", "Alkyl sulfonate", "busulfan", "Conditioning before stem-cell transplant and, historically, chronic myeloid leukemia. Adverse effects: severe myelosuppression, pulmonary fibrosis (busulfan lung), hyperpigmentation, seizures, hepatic veno-occlusive disease.", "alter", "Alkylates guanine and cross-links DNA strands.", null],
  ["on", "t_dnaalk", null, null, null, null, "d_triaz", "Triazenes", "Methylating agents", "dacarbazine, temozolomide", "Dacarbazine: melanoma and Hodgkin lymphoma (ABVD); needs liver activation. Temozolomide: oral, crosses the blood–brain barrier and treats glioblastoma, with a better response when the MGMT promoter is methylated (less repair). Adverse effects: myelosuppression, nausea.", "alter", "Add methyl groups to guanine, causing mispairing and strand breaks.", null],
  ["on", "t_dnapt", "DNA (platinum cross-links)", "nucleic", "N7 of guanine", "Platinum binds guanine N7 and makes intrastrand and interstrand cross-links that bend the helix and stall replication and transcription.", "d_pt", "Platinum agents", "Platinum coordination complexes", "cisplatin, carboplatin, oxaliplatin", "Cisplatin and carboplatin: testicular, ovarian, lung, bladder and head-and-neck cancers; oxaliplatin: colorectal cancer. Cisplatin: nephrotoxicity (hydrate; amifostine), ototoxicity, neuropathy, hypomagnesemia, severe emesis. Carboplatin: myelosuppression. Oxaliplatin: cold-triggered neuropathy.", "alter", "Platinum adducts cross-link guanines; cells that cannot repair them undergo apoptosis.", ["nuc"]],
  ["on", "t_dnaint", "DNA (intercalation)", "nucleic", "GC-rich base pairs", "Flat aromatic drugs slide between base pairs, unwinding the helix and blocking RNA polymerase.", "d_dactino", "Dactinomycin", "Antitumour antibiotic, intercalator", "dactinomycin (actinomycin D)", "Wilms tumour, rhabdomyosarcoma, Ewing sarcoma and gestational trophoblastic neoplasia, often in children. Adverse effects: myelosuppression, mucositis, tissue injury if it extravasates, hepatic veno-occlusive disease, radiation recall.", "inhibit", "Sits between GC base pairs and blocks RNA polymerase, so transcription stops.", ["nuc"]],
  ["on", "t_dnabl", "DNA (strand scission)", "nucleic", "Fe²⁺-dependent cleavage", "Single- and double-strand breaks made when an iron–drug complex generates oxygen radicals next to DNA.", "d_bleo", "Bleomycin", "Antitumour antibiotic", "bleomycin", "Hodgkin lymphoma (ABVD), testicular germ-cell tumours (BEP) and squamous cancers; G2-phase specific and sparing the marrow. Adverse effects: pulmonary fibrosis (cumulative dose; oxygen worsens it), skin hyperpigmentation, fever. Inactivated by bleomycin hydrolase, which is low in lung and skin.", "alter", "Fe²⁺–bleomycin makes free radicals that cut DNA strands.", ["nuc"]],
  // topoisomerase poisons
  ["on", "t_top1", "Topoisomerase I", "enzyme", "TOP1", "Makes a transient single-strand nick so supercoiled DNA can unwind ahead of the replication fork, then reseals it.", "d_camp", "Camptothecins", "Topoisomerase I inhibitors", "irinotecan, topotecan", "Irinotecan: colorectal and pancreatic cancer; a prodrug converted to SN-38, which UGT1A1 inactivates (UGT1A1*28 raises toxicity). Topotecan: small-cell lung, ovarian and cervical cancers. Adverse effects: neutropenia and diarrhoea (early cholinergic diarrhoea responds to atropine, late diarrhoea to loperamide).", "inhibit", "Trap the cleavable complex, so collisions with replication forks make double-strand breaks.", ["nuc"]],
  ["on", "t_top2", "Topoisomerase II", "enzyme", "TOP2A, TOP2B", "Cuts both strands of one DNA duplex to pass another through, untangling copied chromosomes.", "d_epip", "Epipodophyllotoxins", "Topoisomerase II inhibitors", "etoposide, teniposide", "Small-cell lung cancer, testicular cancer, lymphoma and leukemias. Adverse effects: myelosuppression, alopecia, hypotension with rapid infusion, secondary acute myeloid leukemia (11q23 rearrangement).", "inhibit", "Stabilise the enzyme–DNA cleavage complex, leaving double-strand breaks.", ["nuc"]],
  ["on", "t_top2", null, null, null, null, "d_anthra", "Anthracyclines", "Antitumour antibiotics", "doxorubicin, daunorubicin, epirubicin, idarubicin", "Breast cancer, lymphoma, sarcoma and acute leukemias. They intercalate DNA, poison topoisomerase II and generate free radicals. Adverse effects: dose-dependent dilated cardiomyopathy (iron-driven radicals; dexrazoxane protects, so check the ejection fraction), myelosuppression, alopecia, red urine; tissue injury if they extravasate.", "inhibit", "Stabilise the topoisomerase II–DNA complex and intercalate, causing double-strand breaks.", null],
  // microtubule poisons (M phase); β-tubulin sits on the Skeletal hub
  ["on", "t_tubulin", null, null, null, null, "d_vinca", "Vinca alkaloids", "Microtubule destabilisers", "vincristine, vinblastine, vinorelbine", "Vincristine: acute lymphoblastic leukemia, lymphoma, Wilms tumour; spares the marrow but is neurotoxic (peripheral neuropathy, constipation and ileus, SIADH). Vinblastine: Hodgkin lymphoma and testicular cancer; myelosuppression. Vinorelbine: lung and breast cancers. Intravenous only; fatal if given intrathecally.", "inhibit", "Bind β-tubulin and stop polymerisation, so no mitotic spindle forms (M-phase arrest).", null],
  ["on", "t_tubulin", null, null, null, null, "d_taxane", "Taxanes", "Microtubule stabilisers", "paclitaxel, docetaxel, cabazitaxel", "Breast, ovarian, lung, prostate and head-and-neck cancers. Paclitaxel: hypersensitivity (premedicate with a steroid and antihistamine), neuropathy, myelosuppression. Docetaxel: neutropenia, fluid retention, nail changes.", "activate", "Stabilising, not blocking: microtubules cannot depolymerise, so the spindle is frozen and cells arrest in M phase.", null],
  // enzyme drugs that remove a metabolite
  ["on", "t_asn", "L-asparagine (serum)", "metabolite", "C₄H₈N₂O₃", "Non-essential amino acid. Normal cells make it with asparagine synthetase; lymphoblasts have little of the enzyme and depend on circulating asparagine.", "d_aspase", "Asparaginases", "Enzyme drugs", "asparaginase, pegaspargase", "Acute lymphoblastic leukemia. Adverse effects: hypersensitivity, pancreatitis, thrombosis and bleeding (low clotting factors), hepatotoxicity, hyperglycemia; little myelosuppression.", "alter", "Hydrolyses asparagine to aspartate, so lymphoblasts cannot make protein.", ["ext"]],
  // supportive care
  ["on", "t_uric", "Uric acid (serum)", "metabolite", "C₅H₄N₄O₃", "End product of purine breakdown in humans. Massive tumour cell death in tumour lysis syndrome releases purines, giving hyperuricemia with hyperkalemia, hyperphosphatemia and hypocalcemia; crystals injure the kidney.", "d_rasbu", "Rasburicase", "Recombinant urate oxidase", "rasburicase", "Prevents and treats tumour lysis syndrome in leukemia and lymphoma, working within hours (allopurinol only stops new urate). Adverse effects: hemolysis and methemoglobinemia in G6PD deficiency (contraindicated), hypersensitivity; the enzyme goes on degrading urate in the sample, so send blood on ice.", "alter", "Converts uric acid to the far more soluble allantoin, a step humans lack.", ["ext"]],
  ["on", "t_csf3r", "G-CSF receptor", "receptor", "CSF3R", "Cytokine receptor on neutrophil precursors; G-CSF drives their proliferation, maturation and release from the marrow.", "d_gcsf", "G-CSF analogues", "Myeloid growth factors", "filgrastim, pegfilgrastim", "Shorten neutropenia and cut febrile neutropenia after myelosuppressive chemotherapy; also mobilise stem cells for transplant. Adverse effects: bone pain, leukocytosis, rare splenic rupture.", "activate", "Direct agonism drives neutrophil production.", ["pm"]],
  // ---- Immune hub: the five immunoglobulin classes, then the drugs that supply, lower or block antibody ----
  ["im", "t_igg", "IgG", "antibody", "IGHG1–4", "The commonest class, about 75% of serum immunoglobulin, in four subclasses. It carries the secondary (memory) response, is the only class that crosses the placenta, and is the class of most pathogenic autoantibodies.", "d_ivig", "Immune globulin (IVIG, SCIG)", "Pooled human IgG", "immune globulin intravenous (IVIG), subcutaneous immune globulin (SCIG)", "Replacement in primary antibody deficiency (agammaglobulinaemia, common variable immunodeficiency), given every 3–4 weeks IV or weekly SC. At high dose it is immunomodulatory in immune thrombocytopenia, Kawasaki disease (with aspirin), Guillain–Barré syndrome, CIDP and myasthenic crisis. Adverse effects: infusion reactions, headache and aseptic meningitis, thrombosis, haemolysis, kidney injury with sucrose-stabilised products, volume load; anaphylaxis in IgA deficiency with anti-IgA antibodies.", "activate", "Supplies pooled IgG. At high dose it is thought to saturate FcRn, so the patient's own IgG is cleared faster, and to block Fc receptors on macrophages.", ["ext"]],
  ["im", "t_igg", null, null, null, null, "d_hig", "Hyperimmune globulins", "Passive immunisation", "anti-D immune globulin (RhoGAM), hepatitis B immune globulin, rabies immune globulin, tetanus immune globulin, varicella-zoster immune globulin, botulism immune globulin (BabyBIG)", "Concentrated IgG from donors with a high titre to one antigen. Given for immediate protection after exposure, when a vaccine would act too slowly. Anti-D stops an Rh-negative mother making her own anti-D by clearing fetal D-positive cells: give at 28 weeks and within 72 hours of delivery or a sensitising event. Protection wanes over weeks to months.", "activate", "Supplies IgG specific for one pathogen, toxin or antigen: passive immunity.", null],
  ["im", "t_igg", null, null, null, null, "d_fab", "Antibody fragments and antivenoms", "Fab and F(ab′)₂ fragments", "crotalid antivenom (CroFab, Anavip), digoxin immune Fab (DigiFab), idarucizumab", "Animal-derived or engineered fragments that bind a toxin or drug and lift it out of circulation: snake envenomation, digoxin toxicity, and reversal of dabigatran. Adverse effects: allergy and serum sickness from animal protein, and venom effects returning as the short-lived fragment clears first.", "activate", "Adds binding capacity against one toxin or drug. The fragments lack the Fc region, so FcRn does not recycle them and they clear within hours to days.", null],
  ["im", "t_iga", "IgA", "antibody", "IGHA1, IGHA2", "Monomer in serum, but in secretions a dimer joined by a J chain and carrying secretory component, which the epithelial polymeric Ig receptor attaches as it moves IgA across the cell. The main antibody of tears, saliva, milk, gut and airway.", "d_budigan", "Targeted-release budesonide", "Mucosal glucocorticoid", "budesonide delayed-release capsules (Tarpeyo, Kinpeygo)", "For IgA nephropathy with persistent proteinuria. The capsule releases in the distal ileum, where Peyer's patches make the galactose-deficient IgA1 that deposits in the kidney, and heavy first-pass liver metabolism limits systemic effects. Adverse effects: Cushingoid features, hypertension, infection.", "inhibit", "Lowers production of galactose-deficient IgA1 by mucosal B cells in the ileum.", ["ext"]],
  ["im", "t_igm", "IgM", "antibody", "IGHM", "A pentamer joined by a J chain, the first class made in a primary response and the strongest activator of the classical complement pathway. As a monomer on the B-cell surface it is the antigen receptor of naive B cells.", null, null, null, null, null, null, null, ["ext"]],
  ["im", "t_igd", "IgD", "antibody", "IGHD", "Less than 1% of serum immunoglobulin. It is co-expressed with IgM on naive mature B cells, made by alternative splicing of one heavy-chain transcript, and serves as an antigen receptor. The role of secreted IgD is poorly understood.", null, null, null, null, null, null, null, ["pm", "ext"]],
  ["im", "t_fcrn", "Neonatal Fc receptor (FcRn)", "receptor", "FCGRT", "MHC class I-like receptor in the endosomes of endothelium and other cells. It binds IgG and albumin at acidic pH and returns them to the surface, rescuing them from lysosomal breakdown; this gives IgG its half-life of about 3 weeks. In the placenta it carries IgG to the fetus.", "d_fcrni", "FcRn blockers", "IgG-lowering agents", "efgartigimod, rozanolixizumab", "Generalised myasthenia gravis with anti-acetylcholine-receptor antibodies (efgartigimod also for CIDP). Adverse effects: infections, headache. Total IgG falls, autoantibody included, but IgM, IgA and IgE do not.", "inhibit", "Occupy FcRn, so endocytosed IgG goes to the lysosome and is degraded rather than recycled.", ["pm"]],
  ["im", "t_cd20", "CD20", "receptor", "MS4A1", "Membrane protein on B cells from the pre-B to the memory stage. It is absent from stem cells and from plasma cells, so antibody-secreting cells survive depletion of their precursors.", "d_cd20", "Anti-CD20 antibodies", "B-cell-depleting monoclonals", "rituximab, ocrelizumab, ofatumumab, obinutuzumab", "Rituximab: B-cell lymphoma and CLL, rheumatoid arthritis, ANCA vasculitis, pemphigus, and off-label for many autoantibody diseases; ocrelizumab and ofatumumab for multiple sclerosis. Adverse effects: infusion reactions, hypogammaglobulinaemia, hepatitis B reactivation, PML.", "inhibit", "Bind CD20 and deplete B cells by complement, antibody-dependent cytotoxicity and apoptosis. Because plasma cells lack CD20, serum IgG falls only slowly.", ["pm"]],
  ["im", "t_baff", "BAFF (BLyS)", "ligand", "TNFSF13B", "TNF-family cytokine from myeloid cells that keeps B cells alive and lets autoreactive B cells escape deletion. Raised in systemic lupus erythematosus.", "d_belim", "Anti-BAFF antibody", "B-cell survival blocker", "belimumab", "Add-on therapy in SLE and lupus nephritis; lowers anti-dsDNA antibodies and raises complement. Adverse effects: infusion reactions, infection, depression and suicidality warning.", "inhibit", "Binds soluble BAFF, so B cells lose a survival signal and fewer become plasma cells.", ["ext"]],
  ...VIT_ROWS,
];
Object.assign(KIND, { nucleic: { label: "Nucleic acid", color: "#7dd3fc" }, metabolite: { label: "Metabolite", color: "#fdba74" }, organ: { label: "Organ hub", color: "#cbd5e1" }, ligand: { label: "Ligand / cytokine", color: "#fda4af" }, protein: { label: "Structural protein", color: "#bef264" } });
const REN = {
  t_sglt2: [1, "Proximal tubule S1–S2 · apical membrane"], t_ca: [2, "Proximal tubule · apical membrane (CA IV) and cytosol (CA II)"], t_urat1: [3, "Proximal tubule · apical membrane"],
  t_nkcc2: [4, "Thick ascending limb · apical membrane"], t_ncc: [5, "Distal convoluted tubule · apical membrane"], t_enac: [6, "Collecting duct principal cell · apical membrane"],
  t_mr: [7, "Collecting duct principal cell · cytosol, then nucleus"], t_v2r: [8, "Collecting duct principal cell · basolateral membrane"],
  t_eta: [9, "Glomerular and vascular cells · plasma membrane"], t_renin: [10, "Juxtaglomerular cells · secretory granules, then blood"], t_phd: [11, "Peritubular interstitial fibroblasts · cytosol"],
  t_ace: [12, "Glomerular and peritubular capillary endothelium · luminal membrane"], t_at1: [13, "Efferent arteriole and proximal tubule · plasma membrane"],
};
// Oncology: where each target acts in the cell cycle, in order G1 -> S -> G2 -> M, then phase-independent DNA damage
const ONC = {
  t_asn: [1, "G1 phase · lymphoblasts starved of asparagine cannot make protein"], t_ts: [2, "S phase · thymidine supply for DNA synthesis"], t_dhfr: [3, "S phase · folate cycle that feeds thymidylate and purines"],
  t_ppat: [4, "S phase · purine supply for DNA synthesis"], t_rnr: [5, "S phase · deoxyribonucleotide supply"], t_polym: [6, "S phase · DNA replication"], t_dnmt: [7, "S phase · methylation of newly copied DNA"],
  t_top1: [8, "S phase · unwinding ahead of the replication fork"], t_top2: [9, "Late S and G2 phases · untangling copied chromosomes (anthracyclines act in any phase)"], t_dnabl: [10, "G2 phase · DNA strand breaks"],
  t_tubulin: [11, "M phase · mitotic spindle"], t_dnaalk: [12, "Any phase · not cell-cycle specific"], t_dnapt: [13, "Any phase · not cell-cycle specific"], t_dnaint: [14, "Any phase · not cell-cycle specific"],
};
const ORG_OF = {}, ORGAN_SET = {}, ORG_RX_IDS = new Set();
Object.entries(EXIST_ORG).forEach(([t, os]) => (ORG_OF[t] = os));
DRUGS.forEach((d) => (ORG_OF[d[0]] = [...new Set(d[5].flatMap((f) => EXIST_ORG[f[0]] || []))]));
// Vitamins hub also lists targets that sit elsewhere: the vitamin K cycle, vitamin D receptor, thiamine (PDH) and folate (DHFR, thymidylate synthase)
["t_vkor", "t_pdc", "t_dhfr"].forEach((t) => { ORG_OF[t] = [...ORG_OF[t], "vt"]; });
Object.assign(EXIST_ORG, { t_vkor: [...EXIST_ORG.t_vkor, "vt"], t_pdc: [...EXIST_ORG.t_pdc, "vt"], t_dhfr: [...EXIST_ORG.t_dhfr, "vt"], t_vdr: ["vt"], t_ts: ["vt"] });
ORGAN_RX.forEach((r) => { const m = [...new Set([r[0], ...(EXIST_ORG[r[1]] || [])])]; if (r[2]) { ORG_OF[r[1]] = m; LOC_OF[r[1]] = r[13]; } if (r[6]) ORG_OF[r[6]] = r[2] ? m : [r[0]]; });
// Oncology: tamoxifen's row sits on the endocrine hub, so list it here too; colchicine shares β-tubulin but is not chemotherapy
ORG_OF.d_tamox = [...ORG_OF.d_tamox, "on"]; ORG_OF.d_colch = ORG_OF.d_colch.filter((o) => o !== "on");
(() => { // placement: hubs in two columns to the right of the atlas; targets on a ring, their drugs just outside it
  const codes = Object.keys(ORGANS);
  const cur = [600, 600]; // next free y in the left / right column; clusters grow with their number of rows
  codes.forEach((o, i) => {
    const hid = "o_" + o, rows = ORGAN_RX.filter((r) => r[0] === o).sort((a, b) => (REN[a[1]]?.[0] || 0) - (REN[b[1]]?.[0] || 0)),
      xs = Object.keys(EXIST_ORG).filter((t) => EXIST_ORG[t].includes(o) && !rows.some((r) => r[1] === t && r[2]));
    const rt = Math.max(560, (o === "vt" ? 56 : 40) * rows.length), rd = rt + 520, ext = rd + 160, c = i % 2, hx = c ? 8000 : 4800, hy = cur[c] + ext;
    cur[c] = hy + ext + 200;
    layout[hid] = [hx, hy]; PATH_OF[hid] = "pharm";
    NODES.push({ id: hid, kind: "organ", rx: "organ", organ: o, label: ORGANS[o].label, formula: `${xs.length + rows.filter((r) => r[2]).length} targets`, note: ORGANS[o].desc, w: 250, pharm: true });
    rows.forEach((r, k) => {
      const a = ((-90 + (360 * k) / rows.length + (rows.length === 2 ? 90 : 0)) * Math.PI) / 180, [, tid, tn, tt, gene, tnote, did, dn, dc, dex, dnote, fx, detail] = r;
      if (did) {
        layout[did] = [Math.round(hx + rd * Math.cos(a)), Math.round(hy + rd * Math.sin(a))];
        NODES.push({ id: did, kind: "drug", rx: "drug", label: dn, formula: dc, note: `${dnote} Examples: ${dex}.`, examples: dex, dm: null, shown: null, pharm: true, organ: o });
        PATH_OF[did] = "pharm";
      }
      if (tn) { // a new target; rows without one point at a target that already sits elsewhere on the map
        layout[tid] = [Math.round(hx + rt * Math.cos(a)), Math.round(hy + rt * Math.sin(a))];
        NODES.push({ id: tid, kind: tt, rx: "target", label: tn, formula: gene, note: tnote, enz: null, w: 210, pharm: true, organ: o });
        PATH_OF[tid] = "pharm"; TARGETS.push([tid, tn, tt, gene, tnote, [], null, "r"]);
        EDGES.push({ id: `og_${o}_${tid}`, source: hid, target: tid, label: "", fx: "organ", auto: true, path: "pharm", org: o });
      }
      if (did) { // rows without a drug (IgM, IgD) only add the target
        DRUGS.push([did, dn, dc, dex, dnote, [[tid, fx, detail]], null]);
        RX_EFFECTS.push({ drug: did, target: tid, fx, detail });
        EDGES.push({ id: `rx_${did}_${tid}`, source: did, target: tid, label: FX[fx].verb, fx, auto: true, path: "pharm", org: o, cross: !tn });
      }
    });
    xs.forEach((t) => EDGES.push({ id: `og_${o}_${t}`, source: hid, target: t, label: "", fx: "organ", auto: true, path: "pharm", org: o, cross: true }));
  });
  codes.forEach((o) => {
    const set = new Set(["o_" + o]);
    NODES.forEach((n) => { if (n.rx && ORG_OF[n.id]?.includes(o)) set.add(n.id); });
    RX_ACTS.forEach((a) => { if (set.has(a.target)) set.add(a.met); });
    ORGAN_SET[o] = set;
  });
  // vitamins: cofactor links to the metabolites and targets they work with (shown while the hub is selected), and vitamin-to-vitamin links
  VIT_ORDER.forEach((v) => VIT[v].links.forEach(([n, label]) => {
    ORGAN_SET.vt.add(n);
    EDGES.push({ id: `vc_${v}_${n}`, source: v, target: n, label, fx: "organ", auto: true, path: "pharm", org: "vt", cross: true });
  }));
  VIT_VV.forEach(([a, b, label], i) => EDGES.push({ id: `vv_${i}`, source: a, target: b, label, fx: "organ", auto: true, path: "pharm", org: "vt" }));
  NODES.forEach((n) => { if (n.kind === "cofactor" && !LOC_OF[n.id] && layout[n.id]) { // cofactors take the location of the nearest molecule
    const [x, y] = layout[n.id], near = NODES.filter((m) => m.mol && LOC_OF[m.id]).sort((u, v) => Math.hypot(layout[u.id][0] - x, layout[u.id][1] - y) - Math.hypot(layout[v.id][0] - x, layout[v.id][1] - y))[0];
    if (near) LOC_OF[n.id] = [LOC_OF[near.id][0]];
  } });
})();
/* ------------------------------ NBME laboratory reference values ------------------------------ */
// key: [test, reference range, SI interval ("" when identical)]. Source: NBME Laboratory Reference Values.
const LABS = {
  na: ["Sodium, serum", "136–146 mEq/L", "136–146 mmol/L"], k: ["Potassium, serum", "3.5–5.0 mEq/L", "3.5–5.0 mmol/L"], cl: ["Chloride, serum", "95–105 mEq/L", "95–105 mmol/L"], hco3: ["Bicarbonate, serum", "22–28 mEq/L", "22–28 mmol/L"],
  bun: ["Urea nitrogen, serum", "7–18 mg/dL", "2.5–6.4 mmol/L"], cr: ["Creatinine, serum", "0.6–1.2 mg/dL", "53–106 µmol/L"], crcl: ["Creatinine clearance", "M 97–137, F 88–128 mL/min", ""],
  glu: ["Glucose, fasting", "70–100 mg/dL", "3.8–5.6 mmol/L"], glur: ["Glucose, random", "<140 mg/dL", "<7.77 mmol/L"], a1c: ["Hemoglobin A1c", "≤6%", "≤42 mmol/mol"],
  ca: ["Calcium, serum", "8.4–10.2 mg/dL", "2.1–2.6 mmol/L"], mg: ["Magnesium, serum", "1.5–2.0 mg/dL", "0.75–1.0 mmol/L"], phos: ["Phosphorus, serum", "3.0–4.5 mg/dL", "1.0–1.5 mmol/L"],
  alt: ["ALT", "10–40 U/L", ""], ast: ["AST", "12–38 U/L", ""], alp: ["Alkaline phosphatase", "25–100 U/L", ""], bilt: ["Bilirubin, total", "0.1–1.0 mg/dL", "2–17 µmol/L"], bild: ["Bilirubin, direct", "0.0–0.3 mg/dL", "0–5 µmol/L"],
  prot: ["Protein, total", "6.0–7.8 g/dL", "60–78 g/L"], alb: ["Albumin", "3.5–5.5 g/dL", "35–55 g/L"], amy: ["Amylase", "25–125 U/L", ""], lip: ["Lipase", "13–60 U/L", ""],
  ck: ["Creatine kinase", "M 25–90, F 10–70 U/L", ""], ldh: ["Lactate dehydrogenase", "45–200 U/L", ""], tni: ["Troponin I", "≤0.04 ng/mL", "≤0.04 µg/L"], osm: ["Osmolality, serum", "275–295 mOsmol/kg H₂O", ""], ua: ["Uric acid, serum", "3.0–8.2 mg/dL", "0.18–0.48 mmol/L"],
  tc: ["Cholesterol, total", "<200 mg/dL (high >240)", "<5.2 mmol/L"], hdl: ["HDL cholesterol", "40–60 mg/dL", "1.0–1.6 mmol/L"], ldl: ["LDL cholesterol", "<160 mg/dL", "<4.2 mmol/L"], tg: ["Triglycerides", "<150 mg/dL", "<1.70 mmol/L"],
  fer: ["Ferritin", "M 20–250, F 10–120 ng/mL", "M 20–250, F 10–120 µg/L"], iron: ["Iron, serum", "M 65–175, F 50–170 µg/dL", "M 11.6–31.3, F 9.0–30.4 µmol/L"], tibc: ["Total iron-binding capacity", "250–400 µg/dL", "44.8–71.6 µmol/L"], trf: ["Transferrin", "200–360 mg/dL", "2.0–3.6 g/L"],
  cort: ["Cortisol, 0800 h", "5–23 µg/dL", "138–635 nmol/L"], pth: ["Intact PTH", "10–60 pg/mL", "10–60 ng/L"],
  prl: ["Prolactin", "M <17, F <25 ng/mL", "M <17, F <25 µg/L"], gh: ["Growth hormone, fasting", "<5 ng/mL (provoked >7)", "<5 µg/L (provoked >7)"], lh: ["Luteinizing hormone", "M 6–23; F follicular 5–30, midcycle 75–150, postmenopause 30–200 mIU/mL", "same numbers, IU/L"], fsh: ["Follicle-stimulating hormone", "M 4–25; F premenopause 4–30, midcycle 10–90, postmenopause 40–250 mIU/mL", "same numbers, IU/L"],
  tsh: ["TSH", "0.4–4.0 µU/mL", "0.4–4.0 mIU/L"], t4: ["Thyroxine (T4)", "5–12 µg/dL", "64–155 nmol/L"], ft4: ["Free T4", "0.9–1.7 ng/dL", "12.0–21.9 pmol/L"], t3: ["Triiodothyronine (T3, RIA)", "100–200 ng/dL", "1.5–3.1 nmol/L"], i123: ["Thyroidal ¹²³I uptake", "8%–30% of dose/24 h", "0.08–0.30/24 h"],
  po2: ["Po₂, arterial (room air)", "75–105 mm Hg", "10.0–14.0 kPa"], pco2: ["Pco₂, arterial", "33–45 mm Hg", "4.4–5.9 kPa"], ph: ["pH, arterial", "7.35–7.45", "[H⁺] 36–44 nmol/L"],
  hb: ["Hemoglobin", "M 13.5–17.5, F 12.0–16.0 g/dL", "M 135–175, F 120–160 g/L"], retic: ["Reticulocytes", "0.5%–1.5%", "0.005–0.015"], plt: ["Platelet count", "150,000–400,000/mm³", "150–400 × 10⁹/L"], wbc: ["Leukocyte count", "4,500–11,000/mm³", "4.5–11.0 × 10⁹/L"], mcv: ["MCV", "80–100 µm³", "80–100 fL"],
  pt: ["Prothrombin time", "11–15 s", ""], ptt: ["aPTT", "25–40 s", ""], esr: ["ESR (Westergren)", "M 0–15, F 0–20 mm/h", ""],
  uosm: ["Osmolality, urine", "50–1200 mOsmol/kg H₂O", ""], uca: ["Calcium, urine", "100–300 mg/24 h", "2.5–7.5 mmol/24 h"], uprot: ["Protein, urine total", "<150 mg/24 h", "<0.15 g/24 h"], uox: ["Oxalate, urine", "8–40 µg/mL", "90–445 µmol/L"],
  igg: ["Immunoglobulin G, serum", "650–1500 mg/dL", "6.5–15.0 g/L"], iga: ["Immunoglobulin A, serum", "76–390 mg/dL", "0.76–3.90 g/L"], igm: ["Immunoglobulin M, serum", "40–345 mg/dL", "0.4–3.45 g/L"], ige: ["Immunoglobulin E, serum", "0–380 IU/mL", "0–380 kIU/L"],
};
const LAB_ORDER = Object.keys(LABS), LAB_OF = {};
Object.entries({
  glucose: "glu glur a1c", urea: "bun", bilirubin: "bilt bild", bilglu: "bild", fe: "iron tibc trf fer", heme: "hb retic", mg: "mg", k: "k", p: "phos", alanine: "alt", aspartate: "ast", glutamate: "alt ast", tag: "tg",
  pi: "phos", co2: "pco2 hco3", o2: "po2", hplus: "ph", nh3: "bun", lactate: "ldh", glycogen: "glu", glycerol: "tg", fa: "tg tc", biliverdin: "bilt", udpglcA: "bilt bild",
  cp: "bun", ornithine: "bun", citrulline: "bun", argsucc: "bun", arginine: "bun",
  t_hmgcr: "tc ldl hdl tg alt ast ck", t_sglt2: "glu a1c cr", t_gk: "glu a1c", t_lipase: "lip tg", t_ppara: "tg hdl", t_pparg: "glu a1c", t_cps1: "bun", t_ugt: "bilt bild", t_cox: "plt pt ptt cr esr", t_cpt1: "ck",
  t_adrb1: "tni k", t_ace: "k cr bun", t_at1: "k cr", t_nkcc2: "na k cl hco3 mg ca uca ua cr bun", t_ncc: "na k cl ca uca mg ua glu", t_mr: "na k cr", t_enac: "na k", t_ca: "hco3 ph k uox", t_urat1: "ua uox cr",
  t_v2r: "na osm uosm", t_eta: "uprot cr alb", t_renin: "k cr bun", t_phd: "hb retic fer iron", t_adrb2: "po2 pco2 ph k", t_m3: "po2 pco2 ph", t_gr: "po2 pco2 ph cort glu",
  t_fdps: "ca phos alp pth uca", t_xo: "ua cr", t_nachr: "ck k", t_hkatpase: "mg", t_sert: "na", t_dpp4: "glu a1c amy lip", t_glp1r: "glu a1c amy lip",
  t_rankl: "ca phos alp pth", t_sost: "ca phos alp", t_pth1r: "ca phos pth uca alp", t_er: "ca alp", t_vdr: "ca phos pth uca", t_fgf23: "phos ca alp pth", t_dhfr: "alt ast cr hb plt wbc mcv", t_dhodh: "alt ast",
  t_jak: "hb plt alt ast tc ldl", t_igg: "igg", t_iga: "iga", t_igm: "igm", t_tnf: "esr", t_il6r: "esr alt plt", t_il1r: "esr ua", t_tubulin: "ua ck wbc plt alt ast bilt", t_ryr1: "ck k", t_a2: "alt ast",
  t_nkatpase: "k mg ca cr", t_p2y12: "plt pt ptt", t_fxa: "pt ptt plt cr", t_thrombin: "ptt pt plt cr", t_vkor: "pt ptt alt ast", t_herg: "k mg ca", t_nav: "na k", t_nep: "k cr bun", t_a1: "cr",
  t_cyslt1: "po2 pco2", t_ige: "ige po2 pco2", t_il5: "po2 pco2", t_pde5: "po2 pco2", t_cftr: "alt ast", t_5ht3: "k mg", t_nk1: "k", t_gcc: "na k", t_clc2: "na k", t_ep: "hb", t_a4b7: "alt ast hb esr", t_d2: "prl glu a1c tg", t_mu: "po2 pco2 ph", t_a2d: "cr crcl", t_dat: "k", t_maob: "alt ast",
  t_npc1l1: "tc ldl alt ast", t_pcsk9: "tc ldl", t_fxr: "alp bilt alt ast", t_hbvpol: "alt ast bilt cr phos", t_ns5b: "alt ast", t_adh: "osm hco3 ph cr ca uox", t_aldh: "alt ast",
  t_ir: "glu glur a1c k", t_katp: "glu a1c", t_ampk: "glu a1c cr hco3", t_tpo: "tsh t4 ft4 t3 alt ast", t_thr: "tsh t4 ft4 t3 tc", t_casr: "ca pth phos", t_cyp19: "ca phos alp tc", t_ar: "alt ast", t_gnrhr: "lh fsh", t_sstr2: "gh glu",
  t_ts: "wbc hb plt alt ast bilt", t_ppat: "wbc hb plt alt ast bilt ua", t_rnr: "wbc hb mcv plt", t_polym: "wbc hb plt alt ast cr", t_dnmt: "wbc hb plt",
  t_dnaalk: "wbc hb plt cr na alt ast", t_dnapt: "wbc hb plt cr na k mg ca", t_dnaint: "wbc plt alt ast bilt", t_dnabl: "po2 pco2 cr",
  t_top1: "wbc hb plt alt ast bilt", t_top2: "wbc hb plt tni alt ast bilt cr", t_asn: "glu amy lip alb alt ast bilt pt ptt", t_uric: "ua k phos ca cr ldh", t_csf3r: "wbc",
}).forEach(([id, ks]) => (LAB_OF[id] = ks.split(" ")));
Object.entries({ t_va: "alt ast", t_vd: "ca phos alp pth uca", t_vk: "pt ptt", t_ve: "hb retic", t_b3: "tc ldl hdl tg glu ua alt ast", t_b6: "hb mcv alt ast", t_b9: "hb mcv retic", t_b12: "hb mcv retic k" }).forEach(([id, ks]) => (LAB_OF[id] = ks.split(" ")));
const ORG_LAB = { cv: "tni ck ldh tc ldl hdl tg k", rn: "bun cr crcl na k cl hco3 osm uosm uprot ua", rs: "po2 pco2 ph", sk: "ca phos alp pth ck uca ua esr", gi: "amy lip", cn: "na", hp: "alt ast alp bilt bild prot alb", en: "glu glur a1c cort", on: "wbc hb plt mcv ua ldh cr alt ast bilt", im: "igg iga igm ige wbc esr prot alb", vt: "hb mcv retic ca phos alp pth uca pt ptt" };
DRUGS.forEach((d) => { const u = new Set(d[5].flatMap((f) => LAB_OF[f[0]] || [])); if (u.size) LAB_OF[d[0]] = [...u]; }); // a drug inherits its targets' monitoring labs
Object.entries(ORGAN_SET).forEach(([o, set]) => { const u = new Set(ORG_LAB[o].split(" ")); set.forEach((id) => (LAB_OF[id] || []).forEach((k) => u.add(k))); LAB_OF["o_" + o] = [...u]; });
Object.keys(LAB_OF).forEach((id) => (LAB_OF[id] = LAB_ORDER.filter((k) => LAB_OF[id].includes(k))));

/* ---- essential vs non-essential amino acids ---- */
const AA_LABEL = { essential: "Essential", nonessential: "Non-essential" };
const AA_COLOR = { essential: "#ffb454", nonessential: "#6fe0b4" };
const AA_CLASS = {
  valine: "essential", leucine: "essential", isoleucine: "essential", methionine: "essential", threonine: "essential", lysine: "essential", histidine: "essential", phenylalanine: "essential", tryptophan: "essential",
  alanine: "nonessential", arginine: "nonessential", asparagine: "nonessential", aspartate: "nonessential", cysteine: "nonessential", glutamate: "nonessential", glutamine: "nonessential", glycine: "nonessential", proline: "nonessential", serine: "nonessential", tyrosine: "nonessential",
};
const AA_NOTE = {
  valine: "Branched-chain essential amino acid. Muscle transaminates it for fuel; the branched-chain keto acid dehydrogenase step is blocked in maple syrup urine disease. Glucogenic, ending as succinyl-CoA.",
  leucine: "Branched-chain essential amino acid, purely ketogenic (with lysine), ending as acetyl-CoA and acetoacetate. It switches on mTORC1 and so muscle protein synthesis. Raised with isoleucine and valine in maple syrup urine disease.",
  isoleucine: "Branched-chain essential amino acid, both glucogenic and ketogenic: breakdown gives acetyl-CoA and succinyl-CoA. Raised with leucine and valine in maple syrup urine disease.",
  methionine: "Sulfur-containing essential amino acid. As S-adenosylmethionine it is the main methyl donor; demethylation leaves homocysteine, which is remethylated (folate, B₁₂) or converted to cysteine. Cystathionine β-synthase deficiency causes homocystinuria.",
  threonine: "Essential amino acid with a secondary alcohol and two chiral centres. Its OH is a site of O-glycosylation and phosphorylation. Glucogenic and ketogenic.",
  lysine: "Basic essential amino acid, purely ketogenic (with leucine). Its ε-amino group is modified in collagen (hydroxylysine and cross-links) and histones (acetylation, methylation). Cereal proteins are low in it.",
  histidine: "Essential (clearly so in infants). The imidazole ring has a pKa near 6, so it buffers at physiological pH and binds metals in active sites. Decarboxylation gives histamine.",
  phenylalanine: "Aromatic essential amino acid. Phenylalanine hydroxylase, which needs tetrahydrobiopterin, turns it into tyrosine; a defect is phenylketonuria, treated with a low-phenylalanine diet.",
  tryptophan: "Aromatic essential amino acid with an indole ring. Precursor of serotonin, melatonin and niacin (about 60 mg tryptophan makes 1 mg niacin). Poor absorption in Hartnup disease gives a pellagra-like rash.",
  serine: "Made from the glycolytic intermediate 3-phosphoglycerate. It donates one-carbon units to folate (becoming glycine) and is the backbone of sphingolipids and phosphatidylserine. Its OH is a common phosphorylation site.",
  cysteine: "Non-essential, but conditionally essential in premature infants and liver disease. Its sulfur comes from methionine and its carbon skeleton from serine. The thiol forms disulfide bonds and is the active group of glutathione.",
  tyrosine: "Made from phenylalanine, so it becomes essential in phenylketonuria. Precursor of dopamine, noradrenaline, adrenaline, thyroid hormones and melanin; its OH is phosphorylated by tyrosine kinases.",
  proline: "The only protein amino acid whose ring includes the α-amino nitrogen, so it kinks chains and is abundant in collagen (hydroxyproline needs vitamin C). Made from glutamate.",
  glutamine: "The most abundant free amino acid in blood. Carries ammonia between tissues and fuels gut and immune cells. Glutamine synthetase makes it from glutamate and NH₃ using ATP; conditionally essential in illness.",
  asparagine: "Made from aspartate and glutamine by asparagine synthetase. N-linked glycosylation attaches to its amide nitrogen. Asparaginase removes circulating asparagine to starve leukaemic lymphoblasts, which lack the synthetase.",
};
Object.entries(AA_CLASS).forEach(([id, c]) => { const n = NODES.find((x) => x.id === id); if (n) { n.aa = c; if (AA_NOTE[id] && !n.note) n.note = AA_NOTE[id]; } });
const tagText = (d) => [...(d.locs || []).map((l) => LOCS[l].label), ...(d.orgs || []).map((o) => ORGANS[o].label), ...(d.aa ? [`${AA_LABEL[d.aa]} amino acid`] : [])].join(" ");

const initialNodes = NODES.map((n) => ({
  id: n.id,
  type: n.title ? "pathway" : n.rx || "compound",
  draggable: !n.title,
  selectable: !n.title,
  position: { x: layout[n.id][0], y: layout[n.id][1] },
  data: { ...n, w: sizeOf(n).w, path: PATH_OF[n.id] || n.path, locs: LOC_OF[n.id], orgs: ORG_OF[n.id], seg: REN[n.id]?.[1] },
}));

const handles = (e) => {
  if (!e.auto) return [e.sh || "b", e.th || "t"];
  const [sx, sy] = layout[e.source], [tx, ty] = layout[e.target], dx = tx - sx, dy = ty - sy;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? ["r", "l"] : ["l", "r"]) : dy > 0 ? ["b", "t"] : ["t", "b"];
};
const initialEdges = EDGES.map((e) => ({
  id: e.id,
  type: "omino",
  source: e.source,
  target: e.target,
  sourceHandle: handles(e)[0],
  targetHandle: handles(e)[1],
  data: { main: !!e.main, label: e.label, path: e.path || PATH_OF[e.target] || PATH_OF[e.source], fx: e.fx, pharm: !!e.fx, org: e.org, cross: !!e.cross },
}));

/* ================================================================== */
/* 3. Custom node + edge                                               */
/* ================================================================== */

const handleStyle = { opacity: 0, width: 8, height: 8 };

function CompoundNode({ data, selected }) {
  const open = React.useContext(OpenCtx);
  const k = KIND[data.kind];
  const cls = `omino-node ${data.dim ? "is-dim" : ""} ${data.hit ? "is-hit" : ""} ${selected ? "is-selected" : ""}`;
  const handles = ["t", "l", "r", "b"].map((id, i) => (
    <Handle key={id} id={id} type="source" position={[Position.Top, Position.Left, Position.Right, Position.Bottom][i]} style={handleStyle} />
  ));
  if (data.kind === "cofactor") {
    const toks = cofTokens(data.label);
    return (
      <div className={cls} style={{ "--accent": k.color, width: "max-content" }} title={toks.some((t) => t.to) ? "Click a name to see what it is and its structure" : data.note}>
        {handles}
        <div className="omino-node__cofactor">
          {toks.map((t, i) => t.to
            ? <span key={i} className="omino-cof" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); open(t.to[0], t.to[1]); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); open(t.to[0], t.to[1]); } }}>{t.t}</span>
            : t.t)}
        </div>
      </div>
    );
  }
  const drawing = DRAWINGS[data.id];
  return (
    <div className={cls} style={{ "--accent": k.color, width: NODE_W }} title={data.note}>
      {handles}
      <div className="omino-node__art">
        {drawing ? <img src={drawing.src} alt={data.label} draggable={false} /> : data.mol ? <Skeletal mol={MOLS[data.mol]} /> : <AtomTile glyph={data.glyph} color={k.color} />}
      </div>
      <div className="omino-node__name">{data.label}</div>
      {data.kind !== "molecule" && <div className="omino-node__formula">{data.formula}</div>}
      {data.aa && <div className="omino-aac" style={{ "--c": AA_COLOR[data.aa] }}>{AA_LABEL[data.aa]}</div>}
      <LocTags data={data} />
    </div>
  );
}

function OminoEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }) {
  const open = React.useContext(OpenCtx);
  const args = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path, lx, ly] = data.main ? getSmoothStepPath({ ...args, borderRadius: 12 }) : getBezierPath(args);
  const mEnd = data.fx === "inhibit" ? "url(#omino-bar)" : markerEnd; // flat-headed bar for inhibition
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={mEnd} style={style} />
      {data.label && !data.hideLabel && <EdgeLabelRenderer>
        <div
          className={`omino-edge-label nodrag nopan ${data.main ? "is-main is-link" : ""} ${data.fx ? "is-fx" : ""}`}
          onClick={() => data.main && open("enz", data.label)}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, opacity: data.faded ? 0.15 : 1, color: data.main ? data.color : data.fxColor }}
        >
          {data.label}
        </div>
      </EdgeLabelRenderer>}
    </>
  );
}

function PathwayNode({ data }) {
  return (
    <div className={`omino-pathtitle ${data.dim ? "is-dim" : ""}`} style={{ "--c": PATHWAYS[data.path].color, width: data.w }}>
      {data.label}
    </div>
  );
}

// Drug (capsule) and target (enzyme / transporter / receptor) nodes of the pharmacology layer
const RX_GLYPH = {
  drug: "M10.5 4.5l9 9a4.2 4.2 0 0 1-6 6l-9-9a4.2 4.2 0 0 1 6-6zM8 10l6 6",
  enzyme: "M12 3l7 4v10l-7 4-7-4V7z",
  transporter: "M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4",
  receptor: "M12 21v-7M12 14L6 7M12 14l6-7M6 7V3M18 7V3",
  antibody: "M12 21v-8M12 13L6 4M12 13l6-9",
  vitw: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  vitf: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM8.5 15h7",
  ligand: "M12 3a4 4 0 1 0 0 8 4 4 0 0 1 0-8zM12 15v6M9 18h6",
  protein: "M4 6h16M4 12h16M4 18h16",
  nucleic: "M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9M9.5 6.5h5M9.5 17.5h5",
  metabolite: "M12 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM18 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM11 8l-4 7M13 8l4 7M8.5 17.5h7",
};
function RxNode({ data, selected }) {
  const k = KIND[data.kind];
  const m = data.dm ? MOLS[data.dm] : null; // drugs carry a skeletal structure
  const cls = `omino-rx omino-rx--${data.rx} ${data.rx === "drug" && !m ? "omino-rx--hug" : ""} ${m ? "has-mol" : ""} ${data.dim ? "is-dim" : ""} ${data.hit ? "is-hit" : ""} ${selected ? "is-selected" : ""}`;
  const hs = ["t", "l", "r", "b"].map((id, i) => <Handle key={id} id={id} type="source" position={[Position.Top, Position.Left, Position.Right, Position.Bottom][i]} style={handleStyle} />);
  return (
    <div className={cls} style={{ "--accent": k.color, width: data.w }} title={data.note}>
      {hs}
      <div className="omino-rx__tag"><Icon d={RX_GLYPH[data.kind]} size={13} />{k.label}</div>
      {m && <div className="omino-rx__art"><Skeletal mol={m} /></div>}
      <div className="omino-rx__name">{data.label}</div>
      {data.formula && <div className="omino-rx__sub">{data.formula}</div>}
      {data.shown && <div className="omino-rx__shown">Structure shown: {data.shown}</div>}
      {data.rx === "drug" && !m && <div className="omino-rx__shown">Structure not drawn yet</div>}
      {data.seg && data.showLoc && <div className="omino-rx__seg">{data.seg}</div>}
      <LocTags data={data} />
      {data.showOrg && data.orgs && <div className="omino-orgs">{data.orgs.map((o) => <span key={o} title={ORGANS[o].label} style={{ "--o": ORGANS[o].color }}>{ORGANS[o].code}</span>)}</div>}
    </div>
  );
}

function LocTags({ data }) {
  const open = React.useContext(OpenCtx);
  if (!data.showLoc || !data.locs || data.kind === "cofactor") return null;
  return <div className="omino-loc nodrag">{data.locs.map((l) => <button key={l} style={{ "--l": LOCS[l].color }} title={`${LOCS[l].label}: click for details`} onClick={(e) => { e.stopPropagation(); open("loc", l); }}>{LOCS[l].short}</button>)}</div>;
}
function OrganNode({ data, selected }) {
  const o = ORGANS[data.organ];
  const hs = ["t", "l", "r", "b"].map((id, i) => <Handle key={id} id={id} type="source" position={[Position.Top, Position.Left, Position.Right, Position.Bottom][i]} style={handleStyle} />);
  return (
    <div className={`omino-organ ${data.dim ? "is-dim" : ""} ${data.hit ? "is-hit" : ""} ${selected ? "is-selected" : ""}`} style={{ "--accent": o.color, width: data.w }} title={data.note}>
      {hs}
      <div className="omino-organ__code">{o.code}</div>
      <div className="omino-organ__name">{data.label}</div>
      <div className="omino-organ__sub">{data.formula}</div>
    </div>
  );
}
const nodeTypes = { compound: CompoundNode, pathway: PathwayNode, drug: RxNode, target: RxNode, organ: OrganNode };
const edgeTypes = { omino: OminoEdge };

/* ================================================================== */
/* 4. Atlas                                                            */
/* ================================================================== */

const ICON = {
  zoomIn: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M11 8v6M8 11h6",
  zoomOut: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6",
  pan: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-2.6 3.3M6.6 6.7A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9M9.9 10a3 3 0 0 0 4.1 4.1",
  eye: "M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  fit: "M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M4 19h16",
  table: "M3 5h18v14H3zM3 10h18M3 14.5h18M9 5v14M15 5v14",
  close: "M6 6l12 12M18 6L6 18",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  grid: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  chevL: "M15 5l-7 7 7 7",
  chevR: "M9 5l7 7-7 7",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5",
};
const Icon = ({ d, size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/* ================================================================== */
/* Periodic table: the biologically relevant elements, as a card       */
/* ================================================================== */

const CATS = {
  nonmetal: ["Nonmetal", "#6fe0b4"], alkali: ["Alkali metal", "#ff7ab6"], alkaline: ["Alkaline earth metal", "#6fa8ff"],
  transition: ["Transition metal", "#ff8a65"], post: ["Post-transition metal", "#f2c94c"], metalloid: ["Metalloid", "#c7a8ff"], halogen: ["Halogen", "#a3e36f"],
  noble: ["Noble gas", "#7de3f4"], lanthanide: ["Lanthanide", "#c9a27e"],
};
const ROLES = { bulk: ["Bulk element", "#6fe0b4"], major: ["Major mineral", "#6fa8ff"], trace: ["Trace element", "#ffb454"], toxic: ["Toxic", "#ff5d6c"], drug: ["Drug / imaging element", RX_COLOR] };
// [symbol, name, Z, mass, group, period, category, electrons per shell, neutrons (commonest isotope), role, note]
// Where each element turns up in drugs and diagnostic agents (shown as "In drugs" on its card, and searchable)
const EL_RX = {
  H: "Every organic drug. Proton-pump inhibitors block the gastric H⁺/K⁺-ATPase.",
  He: "Heliox (helium–oxygen) in severe airway obstruction.",
  Li: "Lithium carbonate for bipolar disorder. Levels are monitored; thiazides, ACE inhibitors and NSAIDs raise them.",
  B: "Bortezomib, a boronic acid, is a proteasome inhibitor for multiple myeloma; boric acid is a mild topical antiseptic.",
  C: "The skeleton of every organic drug; ¹¹C is used in PET tracers.",
  N: "Amines, amides and heterocycles in most drugs; nitroglycerin releases nitric oxide; N₂O is an anaesthetic gas; ¹³N-ammonia is a PET perfusion tracer.",
  O: "Oxygen therapy; hydroxyl, carbonyl and ether groups in nearly all drugs; ¹⁵O-water is a PET tracer.",
  F: "Fluoxetine, fluoroquinolones, fluorouracil, fluticasone and sevoflurane; ¹⁸F-FDG is the main PET tracer; fluoride in toothpaste.",
  Na: "Saline and sodium bicarbonate; the counter-ion in many drug salts (penicillin G sodium). Diuretics act on renal Na⁺ transport.",
  Mg: "Magnesium sulfate for eclampsia and torsades de pointes; magnesium hydroxide as an antacid and laxative.",
  Al: "Aluminium hydroxide (antacid, phosphate binder), sucralfate, and aluminium salts as vaccine adjuvants.",
  Si: "Simethicone (anti-foaming) and dimethicone; silicone in implants and catheters.",
  P: "Tenofovir, cyclophosphamide and fosfomycin; bisphosphonates have a P–C–P core; organophosphates inhibit acetylcholinesterase.",
  S: "Sulfonamides, thiazides, sulfonylureas, penicillins, proton-pump inhibitors and the thionamides (methimazole).",
  Cl: "Chlorpromazine, chloroquine, clindamycin and chlorothiazide; chloride in saline.",
  K: "Potassium chloride replaces K⁺; potassium iodide protects the thyroid from radioiodine.",
  Ca: "Calcium gluconate and chloride for hypocalcaemia and hyperkalaemia; calcium carbonate is an antacid and phosphate binder. Calcium-channel blockers act on its channels.",
  Ti: "Titanium dioxide in physical sunscreens and tablet coatings; titanium alloys in implants.",
  V: "Vanadyl sulfate has been sold as an insulin-mimetic supplement; it is not an approved drug.",
  Cr: "Chromium picolinate is sold as a supplement for glycaemic control; the evidence is weak.",
  Mn: "Added to parenteral nutrition as a trace element; mangafodipir was an MRI contrast agent.",
  Fe: "Ferrous sulfate, iron sucrose, ferumoxytol and iron dextran for iron deficiency; deferoxamine and deferasirox chelate it.",
  Co: "Cyanocobalamin and hydroxocobalamin (also the cyanide antidote) carry cobalt; ⁶⁰Co has been used for teletherapy.",
  Ni: "No drug uses it directly; nickel–titanium alloys are used in stents and orthodontic wires.",
  Cu: "Copper IUDs are a non-hormonal contraceptive; trientine and penicillamine chelate it in Wilson disease; ⁶⁴Cu-dotatate is a PET tracer.",
  Zn: "Zinc acetate for Wilson disease; zinc oxide in skin protectants; zinc in insulin formulations.",
  Ga: "Gallium nitrate for hypercalcaemia of malignancy; ⁶⁷Ga citrate and ⁶⁸Ga-labelled peptides for imaging.",
  As: "Arsenic trioxide treats acute promyelocytic leukaemia by degrading the PML–RARα fusion protein.",
  Se: "Selenium sulfide shampoo for seborrhoeic dermatitis and tinea versicolor; selenium is added to parenteral nutrition.",
  Br: "Bromide salts of ipratropium, tiotropium and vecuronium; bromocriptine; bromides were early antiepileptics.",
  Rb: "⁸²Rb, from a generator, is a PET tracer for myocardial perfusion.",
  Sr: "⁸⁹Sr chloride for pain from bone metastases; strontium ranelate for osteoporosis (restricted or withdrawn in many countries).",
  Y: "⁹⁰Y microspheres for liver tumours; ⁹⁰Y-ibritumomab tiuxetan.",
  Zr: "Sodium zirconium cyclosilicate for hyperkalaemia; ⁸⁹Zr-labelled antibodies for PET.",
  Mo: "⁹⁹Mo is the parent in the generator that makes ⁹⁹ᵐTc; tetrathiomolybdate has been studied in Wilson disease.",
  Tc: "⁹⁹ᵐTc-labelled agents: sestamibi (heart), MDP (bone), MAA (lung), MAG3 (kidney) and pertechnetate (thyroid).",
  Ag: "Silver sulfadiazine for burns; silver nitrate for cautery; silver-coated dressings.",
  Cd: "No therapeutic use.",
  In: "¹¹¹In-pentetreotide (an octreotide analogue) and ¹¹¹In-labelled white cells for scintigraphy.",
  Sn: "Stannous fluoride in toothpaste; stannous chloride in ⁹⁹ᵐTc kits, where it reduces pertechnetate so that it can bind its ligand.",
  Sb: "Sodium stibogluconate and meglumine antimoniate for leishmaniasis.",
  I: "Levothyroxine, iodinated contrast agents, amiodarone and povidone-iodine; ¹³¹I treats hyperthyroidism and thyroid cancer; ¹²³I images the thyroid.",
  Xe: "¹³³Xe for lung ventilation scans; xenon as an anaesthetic (rarely used); hyperpolarised ¹²⁹Xe for MRI.",
  Ba: "Barium sulfate, which is insoluble and not absorbed, as a radiopaque contrast for the gut.",
  La: "Lanthanum carbonate, a phosphate binder for kidney disease.",
  Sm: "¹⁵³Sm-lexidronam for pain from bone metastases.",
  Gd: "Gadolinium chelates (gadobutrol, gadoterate, gadopentetate) as MRI contrast; linked to nephrogenic systemic fibrosis in severe kidney disease.",
  Lu: "¹⁷⁷Lu-dotatate for neuroendocrine tumours and ¹⁷⁷Lu-PSMA-617 for prostate cancer.",
  Pt: "Cisplatin, carboplatin and oxaliplatin. Toxicity: kidney, hearing and nerve damage; cisplatin is also strongly emetogenic.",
  Au: "Auranofin and aurothiomalate, second-line DMARDs for rheumatoid arthritis.",
  Hg: "Historic mercurial diuretics and merbromin; thimerosal as a preservative in some vaccines; dental amalgam.",
  Tl: "²⁰¹Tl chloride for myocardial perfusion scans; Prussian blue is the antidote for thallium poisoning.",
  Pb: "No therapeutic use; lead poisoning is treated with chelators (succimer, dimercaprol, calcium disodium EDTA).",
  Bi: "Bismuth subsalicylate, and bismuth quadruple therapy for H. pylori; it can blacken stool and tongue.",
  Ra: "²²³Ra dichloride for bone metastases of castration-resistant prostate cancer.",
};
// Toxicity of each element: excess, deficiency where it matters, and the adverse effects of its drugs (shown as "Toxicity" on its card, and searchable)
const EL_TOX = {
  H: "No toxicity as an element; the clinical problem is H⁺ balance: acidaemia (pH below 7.35) and alkalaemia (pH above 7.45).",
  He: "Non-toxic. An asphyxiant that displaces oxygen in confined spaces; inhaling from a pressurised cylinder risks barotrauma and gas embolism.",
  Li: "Narrow window (about 0.6–1.2 mmol/L). Chronic: tremor, nephrogenic diabetes insipidus, hypothyroidism, reduced GFR. Acute: ataxia, confusion, seizures; haemodialysis for severe cases. Associated with cardiac malformations in pregnancy.",
  B: "Boric acid ingestion, mostly in infants: vomiting, red rash, kidney injury, seizures. Bortezomib: peripheral neuropathy and thrombocytopenia.",
  C: "The element is benign. Carbon monoxide binds haemoglobin about 200 times more tightly than O₂ and shifts the curve left; treat with 100% oxygen. CO₂ retention causes narcosis.",
  N: "N₂ narcosis and decompression sickness in divers. N₂O inactivates vitamin B₁₂ (methionine synthase), causing megaloblastic anaemia and myeloneuropathy with chronic use. Nitrites oxidise haemoglobin to methaemoglobin.",
  O: "Oxygen toxicity from reactive oxygen species: lung injury (absorptive atelectasis, ARDS-like damage), retinopathy of prematurity, and seizures at hyperbaric pressures.",
  F: "Excess fluoride: dental fluorosis in childhood and skeletal fluorosis. Acute ingestion causes hypocalcaemia, hypomagnesaemia and hyperkalaemia with arrhythmia.",
  Na: "Hyponatraemia (below 135 mmol/L): cerebral oedema and seizures; correcting too fast causes osmotic demyelination. Hypernatraemia (above 145 mmol/L): thirst, confusion, seizures.",
  Mg: "Hypermagnesaemia (magnesium sulfate, or antacids in renal failure): loss of deep tendon reflexes first, then respiratory depression, hypotension and arrest; calcium gluconate is the antidote. Hypomagnesaemia: arrhythmia, with low K⁺ and Ca²⁺.",
  Al: "Accumulates in kidney failure: dialysis encephalopathy, microcytic anaemia and aluminium bone disease. Aluminium antacids cause constipation and, with kidney disease, hypophosphataemia.",
  Si: "Inhaled crystalline silica causes silicosis, raises the risk of tuberculosis and lung cancer. Silicone implants rarely cause capsular contracture.",
  P: "Hyperphosphataemia (renal failure): binds calcium, giving hypocalcaemia, secondary hyperparathyroidism and metastatic calcification. White phosphorus is hepatotoxic. Organophosphates inhibit cholinesterase (treat with atropine and pralidoxime).",
  S: "Hydrogen sulfide inhibits cytochrome c oxidase; SO₂ irritates the airways. Sulfonamide drugs: rash, Stevens–Johnson syndrome, haemolysis in G6PD deficiency, crystalluria.",
  Cl: "Chlorine gas: airway irritation and pulmonary oedema. Large volumes of saline cause hyperchloraemic metabolic acidosis.",
  K: "Hyperkalaemia: peaked T waves, wide QRS, arrhythmia and asystole; treat with calcium, insulin with glucose, and removal. Hypokalaemia: weakness, U waves, arrhythmia. Rapid IV potassium chloride can stop the heart.",
  Ca: "Hypercalcaemia: stones, bones, groans and psychiatric overtones; short QT, polyuria. Hypocalcaemia: perioral paraesthesia, tetany (Chvostek and Trousseau signs), long QT.",
  Ti: "Low toxicity; rare hypersensitivity to titanium implants.",
  V: "Inhaled vanadium pentoxide irritates the airways (boilermaker's bronchitis). Oral supplements cause GI upset and a green tongue.",
  Cr: "Cr(VI) is carcinogenic (lung cancer when inhaled), perforates the nasal septum and causes contact dermatitis; Cr(III) is far less toxic.",
  Mn: "Manganism: a parkinsonian syndrome (dystonia, masked face) from miners' dust, parenteral nutrition or liver failure; T1 hyperintensity in the basal ganglia.",
  Fe: "Acute overdose, mostly in children: vomiting and haematemesis, then shock and metabolic acidosis, later liver failure and GI scarring; treat with deferoxamine. Chronic overload (haemochromatosis): liver, heart, pancreas and skin.",
  Co: "Excess: cardiomyopathy, polycythaemia and hypothyroidism; metal-on-metal hip implants release it.",
  Ni: "The commonest contact allergen (type IV hypersensitivity). Refinery dust and nickel carbonyl raise the risk of nasal and lung cancer.",
  Cu: "Wilson disease (ATP7B): copper builds up in liver, basal ganglia and cornea (Kayser–Fleischer rings), with low ceruloplasmin. Deficiency (Menkes, ATP7A): kinky hair and neurodegeneration. Copper sulfate ingestion causes haemolysis and liver injury.",
  Zn: "Excess zinc induces metallothionein and blocks copper absorption, giving anaemia and neutropenia; zinc oxide fumes cause metal-fume fever. Deficiency: acrodermatitis enteropathica, poor wound healing, loss of taste and smell.",
  Ga: "Gallium nitrate: nephrotoxicity (dose-limiting), hypocalcaemia and nausea.",
  As: "Acute: vomiting, rice-water diarrhoea, QT prolongation, garlic breath. Chronic: Mees lines, hyperkeratosis, hyperpigmentation, neuropathy, and skin, lung and bladder cancer. Arsenic trioxide: differentiation syndrome and QT prolongation. Chelate with dimercaprol or succimer.",
  Se: "Selenosis: garlic breath, brittle hair and nails, GI upset, neuropathy. Deficiency: Keshan cardiomyopathy.",
  Br: "Bromism with chronic bromide: somnolence, confusion, psychosis and an acneiform rash.",
  Rb: "Chemically low toxicity; the concern is radiation, and breakthrough of the parent strontium isotopes from the ⁸²Rb generator is monitored.",
  Sr: "Strontium ranelate: venous thromboembolism, DRESS and cardiovascular risk. ⁸⁹Sr: bone-marrow suppression.",
  Y: "⁹⁰Y radioembolisation: radiation-induced liver disease, lung shunting with pneumonitis, GI ulcers from misplaced microspheres. Ibritumomab: cytopenias.",
  Zr: "Sodium zirconium cyclosilicate: oedema from the sodium load, and hypokalaemia.",
  Mo: "Excess molybdenum induces copper deficiency and raises uric acid.",
  Tc: "Low chemical toxicity and a small radiation dose. Rare hypersensitivity; ⁹⁹ᵐTc passes into breast milk, so feeding is interrupted briefly.",
  Ag: "Argyria: permanent blue-grey skin discolouration from silver deposition. Silver nitrate burns skin; silver sulfadiazine can cause leukopenia and sulfonamide reactions.",
  Cd: "Accumulates in the proximal tubule (tubular proteinuria, Fanconi-type), causes osteomalacia (itai-itai disease) and lung cancer; its half-life in the body is decades.",
  In: "Tracer doses are low risk. Inhaled indium–tin oxide causes alveolar proteinosis and lung fibrosis in industrial workers.",
  Sn: "Inorganic tin is poorly absorbed and largely harmless; organotins such as tributyltin and trimethyltin are neurotoxic and immunotoxic.",
  Sb: "Like arsenic: vomiting, QT prolongation and arrhythmia, pancreatitis and hepatotoxicity with antimonials; stibine gas causes haemolysis.",
  I: "Excess iodide: Wolff–Chaikoff effect and Jod-Basedow hyperthyroidism; amiodarone can cause hypo- or hyperthyroidism. Contrast: anaphylactoid reactions and contrast nephropathy. Deficiency: goitre and cretinism.",
  Xe: "Chemically inert; an asphyxiant in confined spaces.",
  Ba: "Soluble barium salts block K⁺ channels: hypokalaemia, paralysis and arrhythmia. Barium sulfate is safe unless it leaks through a perforation (peritonitis) or is aspirated.",
  La: "Lanthanum carbonate: GI upset; it deposits in bone and tissue, with unclear clinical significance.",
  Sm: "¹⁵³Sm: transient marrow suppression (low platelets and white cells) 3–5 weeks after the dose, and a pain flare.",
  Gd: "Nephrogenic systemic fibrosis (skin thickening and contractures) in advanced kidney disease, mainly with linear agents; deposition in brain and bone; hypersensitivity.",
  Lu: "¹⁷⁷Lu: myelosuppression and nephrotoxicity (amino acids are infused to protect the kidney); dry mouth with PSMA ligands.",
  Pt: "Cisplatin: nephrotoxicity (proximal tubule; give fluids), ototoxicity, neuropathy, severe emesis and low Mg²⁺. Carboplatin: myelosuppression. Oxaliplatin: cold-triggered neuropathy.",
  Au: "Gold salts: rash, stomatitis, proteinuria (membranous nephropathy), blood dyscrasias; blood counts and urine are monitored.",
  Hg: "Vapour: tremor, gingivitis and erethism (irritability, shyness). Inorganic salts: corrosive to the gut, acute tubular necrosis. Methylmercury: neurotoxicity, crosses the placenta (Minamata disease). Chelate with dimercaprol or succimer.",
  Tl: "GI upset, then painful ascending neuropathy and hair loss after 2–3 weeks. Prussian blue binds thallium in the gut.",
  Pb: "Basophilic stippling, microcytic anaemia, abdominal colic, Burton lines, wrist and foot drop, and encephalopathy in children. Treat with succimer; add EDTA or dimercaprol if encephalopathic.",
  Bi: "Bismuth encephalopathy with excessive chronic use; salicylate toxicity from bismuth subsalicylate (avoided in children with viral illness because of Reye syndrome); black tongue and stool.",
  Ra: "α-emitter that deposits in bone: osteosarcoma and jaw necrosis in the radium dial painters. ²²³Ra therapy: myelosuppression and diarrhoea.",
};
const ELEMENTS = [
  ["H", "Hydrogen", 1, 1.008, 1, 1, "nonmetal", [1], 0, "bulk", "In water and every organic molecule; carried as NADH and FADH₂, and the proton gradient drives ATP synthase."],
  ["Li", "Lithium", 3, 6.94, 1, 2, "alkali", [2, 1], 4, "trace", "Lithium salts are a mood stabiliser with a narrow therapeutic window."],
  ["B", "Boron", 5, 10.81, 13, 2, "metalloid", [2, 3], 6, "trace", "Trace nutrient in plants; not clearly essential in humans."],
  ["C", "Carbon", 6, 12.011, 14, 2, "nonmetal", [2, 4], 6, "bulk", "The backbone of every organic molecule in the atlas."],
  ["N", "Nitrogen", 7, 14.007, 15, 2, "nonmetal", [2, 5], 7, "bulk", "Amino groups, nucleotide bases and heme; waste nitrogen leaves as urea."],
  ["O", "Oxygen", 8, 15.999, 16, 2, "nonmetal", [2, 6], 8, "bulk", "Terminal electron acceptor, and the hydroxyl and carboxyl oxygens in every structure here."],
  ["F", "Fluorine", 9, 18.998, 17, 2, "halogen", [2, 7], 10, "trace", "Strengthens enamel; fluoride inhibits enolase in glycolysis."],
  ["Na", "Sodium", 11, 22.99, 1, 3, "alkali", [2, 8, 1], 12, "major", "Main extracellular cation; sets membrane potential and drives co-transport."],
  ["Mg", "Magnesium", 12, 24.305, 2, 3, "alkaline", [2, 8, 2], 12, "major", "Binds ATP as Mg-ATP; cofactor for kinases and enolase."],
  ["Si", "Silicon", 14, 28.085, 14, 3, "metalloid", [2, 8, 4], 14, "trace", "Trace role in connective tissue and bone formation."],
  ["P", "Phosphorus", 15, 30.974, 15, 3, "nonmetal", [2, 8, 5], 16, "bulk", "Phosphate in ATP, nucleotides and nearly every glycolytic intermediate."],
  ["S", "Sulfur", 16, 32.06, 16, 3, "nonmetal", [2, 8, 6], 16, "bulk", "Cysteine, methionine, coenzyme A and iron–sulfur clusters."],
  ["Cl", "Chlorine", 17, 35.45, 17, 3, "halogen", [2, 8, 7], 18, "major", "Main extracellular anion; gastric acid, and the chloride shift in red cells."],
  ["K", "Potassium", 19, 39.098, 1, 4, "alkali", [2, 8, 8, 1], 20, "major", "Main intracellular cation; cofactor for pyruvate kinase."],
  ["Ca", "Calcium", 20, 40.078, 2, 4, "alkaline", [2, 8, 8, 2], 20, "major", "Signalling, muscle contraction and bone mineral."],
  ["V", "Vanadium", 23, 50.942, 5, 4, "transition", [2, 8, 11, 2], 28, "trace", "Vanadate inhibits phosphatases and ATPases."],
  ["Cr", "Chromium", 24, 51.996, 6, 4, "transition", [2, 8, 13, 1], 28, "trace", "Proposed role in insulin signalling; the evidence is limited."],
  ["Mn", "Manganese", 25, 54.938, 7, 4, "transition", [2, 8, 13, 2], 30, "trace", "Cofactor for arginase in the urea cycle and for mitochondrial superoxide dismutase."],
  ["Fe", "Iron", 26, 55.845, 8, 4, "transition", [2, 8, 14, 2], 30, "trace", "Centre of heme; iron–sulfur clusters in aconitase and the respiratory chain."],
  ["Co", "Cobalt", 27, 58.933, 9, 4, "transition", [2, 8, 15, 2], 32, "trace", "Centre of vitamin B₁₂; needed by methylmalonyl-CoA mutase."],
  ["Ni", "Nickel", 28, 58.693, 10, 4, "transition", [2, 8, 16, 2], 30, "trace", "Urease in bacteria; not clearly essential in humans."],
  ["Cu", "Copper", 29, 63.546, 11, 4, "transition", [2, 8, 18, 1], 34, "trace", "Cytochrome c oxidase and superoxide dismutase; ceruloplasmin carries it in blood."],
  ["Zn", "Zinc", 30, 65.38, 12, 4, "transition", [2, 8, 18, 2], 34, "trace", "In over 300 enzymes, including carbonic anhydrase and alcohol dehydrogenase, and in zinc fingers."],
  ["As", "Arsenic", 33, 74.922, 15, 4, "metalloid", [2, 8, 18, 5], 42, "toxic", "Arsenite binds lipoate and blocks pyruvate dehydrogenase and α-ketoglutarate dehydrogenase."],
  ["Se", "Selenium", 34, 78.971, 16, 4, "nonmetal", [2, 8, 18, 6], 46, "trace", "Selenocysteine in glutathione peroxidase and thioredoxin reductase."],
  ["Br", "Bromine", 35, 79.904, 17, 4, "halogen", [2, 8, 18, 7], 44, "trace", "Trace role in cross-linking collagen IV in basement membranes."],
  ["Mo", "Molybdenum", 42, 95.95, 6, 5, "transition", [2, 8, 18, 13, 1], 56, "trace", "Cofactor in xanthine oxidase and sulfite oxidase."],
  ["Cd", "Cadmium", 48, 112.414, 12, 5, "transition", [2, 8, 18, 18, 2], 66, "toxic", "Accumulates in the kidney and displaces zinc."],
  ["I", "Iodine", 53, 126.904, 17, 5, "halogen", [2, 8, 18, 18, 7], 74, "trace", "Part of the thyroid hormones T₃ and T₄."],
  ["Hg", "Mercury", 80, 200.592, 12, 6, "transition", [2, 8, 18, 32, 18, 2], 122, "toxic", "Binds thiols and inhibits many enzymes."],
  ["Pb", "Lead", 82, 207.2, 14, 6, "post", [2, 8, 18, 32, 18, 4], 126, "toxic", "Inhibits ALA dehydratase and ferrochelatase in heme synthesis."],
  ["He", "Helium", 2, 4.0026, 18, 1, "noble", [2], 2, "drug", "Inert and very light; its low gas density eases flow through narrowed airways."],
  ["Al", "Aluminium", 13, 26.982, 13, 3, "post", [2, 8, 3], 14, "drug", "No known biological role; it accumulates in kidney failure."],
  ["Ti", "Titanium", 22, 47.867, 4, 4, "transition", [2, 8, 10, 2], 26, "drug", "Inert, biocompatible metal; titanium dioxide scatters ultraviolet light."],
  ["Ga", "Gallium", 31, 69.723, 13, 4, "post", [2, 8, 18, 3], 39, "drug", "Ga³⁺ resembles Fe³⁺, so transferrin carries it and cells take it up; it also inhibits osteoclast bone resorption."],
  ["Rb", "Rubidium", 37, 85.468, 1, 5, "alkali", [2, 8, 18, 8, 1], 48, "drug", "Rb⁺ behaves like K⁺ and is taken up by heart muscle."],
  ["Sr", "Strontium", 38, 87.62, 2, 5, "alkaline", [2, 8, 18, 8, 2], 50, "drug", "Bone-seeking, like calcium."],
  ["Y", "Yttrium", 39, 88.906, 3, 5, "transition", [2, 8, 18, 9, 2], 50, "drug", "Its β-emitting isotope ⁹⁰Y is delivered to tumours on microspheres or antibodies."],
  ["Zr", "Zirconium", 40, 91.224, 4, 5, "transition", [2, 8, 18, 10, 2], 50, "drug", "Zr⁴⁺ forms insoluble lattices that trap K⁺ selectively; ⁸⁹Zr has a half-life of about 3 days, long enough to follow an antibody."],
  ["Tc", "Technetium", 43, 98.906, 7, 5, "transition", [2, 8, 18, 13, 2], 56, "drug", "No stable isotope. ⁹⁹ᵐTc emits a 140 keV γ-ray with a 6-hour half-life, well suited to gamma cameras."],
  ["Ag", "Silver", 47, 107.868, 11, 5, "transition", [2, 8, 18, 18, 1], 60, "drug", "Ag⁺ binds thiols and damages bacterial membranes and enzymes."],
  ["In", "Indium", 49, 114.818, 13, 5, "post", [2, 8, 18, 18, 3], 66, "drug", "¹¹¹In has a 2.8-day half-life and a γ emission suited to imaging."],
  ["Sn", "Tin", 50, 118.71, 14, 5, "post", [2, 8, 18, 18, 4], 70, "drug", "Sn²⁺ is a mild reducing agent."],
  ["Sb", "Antimony", 51, 121.76, 15, 5, "metalloid", [2, 8, 18, 18, 5], 70, "drug", "Antimony binds thiols much as arsenic does."],
  ["Xe", "Xenon", 54, 131.293, 18, 5, "noble", [2, 8, 18, 18, 8], 78, "drug", "An inert, highly lipid-soluble gas."],
  ["Ba", "Barium", 56, 137.327, 2, 6, "alkaline", [2, 8, 18, 18, 8, 2], 82, "drug", "Barium is dense and absorbs X-rays strongly; soluble barium salts are toxic."],
  ["La", "Lanthanum", 57, 138.905, 3, 6, "lanthanide", [2, 8, 18, 18, 9, 2], 82, "drug", "La³⁺ binds phosphate tightly."],
  ["Sm", "Samarium", 62, 150.36, 3, 6, "lanthanide", [2, 8, 18, 24, 8, 2], 90, "drug", "Its isotope ¹⁵³Sm is a β-emitter that localises to bone."],
  ["Gd", "Gadolinium", 64, 157.25, 3, 6, "lanthanide", [2, 8, 18, 25, 9, 2], 94, "drug", "Seven unpaired f electrons make Gd³⁺ strongly paramagnetic, which shortens T1 relaxation. Free Gd³⁺ is toxic, so it is always chelated."],
  ["Lu", "Lutetium", 71, 174.967, 3, 6, "lanthanide", [2, 8, 18, 32, 9, 2], 104, "drug", "A β-emitter (¹⁷⁷Lu, half-life 6.7 days) delivered to tumours by a targeting ligand."],
  ["Pt", "Platinum", 78, 195.084, 10, 6, "transition", [2, 8, 18, 32, 17, 1], 117, "drug", "Inside the cell, where chloride is low, the drug loses chloride and Pt²⁺ cross-links the N7 of guanines in DNA."],
  ["Au", "Gold", 79, 196.967, 11, 6, "transition", [2, 8, 18, 32, 18, 1], 118, "drug", "Gold binds thiols and selenols, including thioredoxin reductase."],
  ["Tl", "Thallium", 81, 204.38, 13, 6, "post", [2, 8, 18, 32, 18, 3], 124, "drug", "Tl⁺ mimics K⁺ and enters heart muscle through the Na⁺/K⁺-ATPase; thallium is highly toxic."],
  ["Bi", "Bismuth", 83, 208.98, 15, 6, "post", [2, 8, 18, 32, 18, 5], 126, "drug", "Bismuth salts coat the ulcer base and are bactericidal to Helicobacter pylori."],
  ["Ra", "Radium", 88, 226.025, 2, 7, "alkaline", [2, 8, 18, 32, 18, 8, 2], 138, "drug", "No stable isotope; bone-seeking like calcium. ²²³Ra emits α-particles that kill cells within a few cell diameters."],
].map(([sym, name, z, mass, g, p, cat, shells, n, role, note]) => ({ sym, name, z, mass, g, p, cat, shells, n, role, note, rx: EL_RX[sym] || "", tox: EL_TOX[sym] || "", gc: cat === "lanthanide" ? z - 54 : g, gr: cat === "lanthanide" ? 9 : p })) // gc/gr = grid column and row; the lanthanides sit in their own row under the table
  .sort((a, b) => a.z - b.z);
const EL_LAB = Object.fromEntries(Object.entries({ H: "ph", C: "pco2", N: "bun", O: "po2", Na: "na osm", Mg: "mg", P: "phos", Cl: "cl", K: "k", Ca: "ca uca", Fe: "iron tibc trf fer", I: "tsh t4 ft4 t3 i123" }).map(([s, ks]) => [s, LAB_ORDER.filter((k) => ks.split(" ").includes(k))])); // NBME tests that follow each element
const EL_NODE = { Mg: "mg", K: "k", P: "p", Fe: "fe" }; // elements that are also nodes in the atlas

function Bohr({ el, size = 210 }) {
  const c = size / 2, r = (i) => 14 + (i * (c - 20)) / 6;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Bohr model of ${el.name}: ${el.shells.join(", ")} electrons per shell`}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={c} cy={c} r={r(i)} fill="none" stroke={i < el.shells.length ? "#9a9aa5" : "#34343a"} strokeWidth="1.4" />)}
      <circle cx={c} cy={c} r="4" fill={CHALK} />
      {el.shells.flatMap((n, i) =>
        Array.from({ length: n }, (_, j) => {
          const [x, y] = ang(c, c, r(i), -90 + (360 * j) / n + i * 23);
          return <circle key={`${i}-${j}`} cx={x} cy={y} r="3.2" fill={CHALK} />;
        })
      )}
    </svg>
  );
}

function Footnote() {
  return (
    <footer className="omino-foot">
      <p className="omino-foot__by">
        OMINO is created by <strong>Oscar Perez</strong> — Medical student | Founder of Verde+
        <span aria-hidden="true" className="omino-foot__dot">•</span>
        <a href="https://discord.gg/ecYDZgumB" target="_blank" rel="noopener noreferrer">Join our Discord</a>
        <span aria-hidden="true" className="omino-foot__dot">•</span>
        <a href="https://www.patreon.com/cw/Oworld" target="_blank" rel="noopener noreferrer" className="omino-foot__support">
          <Icon d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" size={12} />
          Support Oworld
        </a>
      </p>
    </footer>
  );
}

function PeriodicTable({ q, setQ, sel, onPick, onClose, width }) {
  const [rxOnly, setRxOnly] = useState(false); // highlight the elements added for drugs and imaging
  const hit = (e) => (!q || [e.sym, e.name, e.z, CATS[e.cat][0], ROLES[e.role][0], e.note, e.rx, e.tox].join(" ").toLowerCase().includes(q)) && (!rxOnly || e.role === "drug");
  return (
    <section className="omino-ptable" style={{ width }} aria-label="Periodic table">
      <div className="omino-ptable__bar">
        <div className="omino-ptable__search">
          <Icon d={ICON.search} size={18} />
          <input
            type="search" value={q} placeholder="Search elements, roles, drugs, toxicity" aria-label="Search elements" autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { const f = ELEMENTS.find(hit); if (f) onPick(f); } }}
          />
        </div>
        <button className="omino-tool omino-tool--sm" onClick={onClose} aria-label="Close periodic table" title="Close"><Icon d={ICON.close} size={18} /></button>
      </div>
      <div className="omino-ptable__grid">
        <div className="omino-cell omino-cell--ph" style={{ gridColumn: 3, gridRow: 6 }} aria-hidden="true">57–71</div>
        <span className="omino-ptable__flabel" style={{ gridColumn: "1 / 3", gridRow: 9 }}>Lanthanides</span>
        {ELEMENTS.map((e) => (
          <button key={e.sym} className={`omino-cell ${sel === e.sym ? "is-sel" : ""} ${hit(e) ? "" : "is-dim"}`}
            style={{ gridColumn: e.gc, gridRow: e.gr, "--c": CATS[e.cat][1] }} onClick={() => onPick(e)} title={`${e.name} (${e.z})`} aria-label={`${e.name}, atomic number ${e.z}`}>
            <small>{e.z}</small><b>{e.sym}</b>{e.role === "drug" && <i className="omino-cell__rx" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="omino-ptable__legend">
        {Object.values(CATS).map(([l, c]) => <span key={l} style={{ "--c": c }}><i />{l}</span>)}
        <button className={`omino-ptable__rx ${rxOnly ? "is-on" : ""}`} style={{ "--c": RX_COLOR }} aria-pressed={rxOnly} onClick={() => setRxOnly((v) => !v)} title="Elements that are here because of drugs and imaging agents">
          <i />Drug / imaging elements
        </button>
      </div>
      <Footnote />
    </section>
  );
}

function ElementCard({ el, onClose, onBack, onStep, onShow }) {
  const [cl, cc] = CATS[el.cat], [rl, rc] = ROLES[el.role];
  const i = ELEMENTS.indexOf(el), prev = ELEMENTS[i - 1], next = ELEMENTS[i + 1];
  return (
    <aside className="omino-ecard" style={{ "--c": cc }} aria-label={`${el.name} element card`}>
      <header>
        <div>
          <div className="omino-ecard__name">{el.name}</div>
          <div className="omino-ecard__sym">{el.sym}<sup>{el.z}</sup></div>
          <div className="omino-ecard__mass">{el.mass} g/mol</div>
        </div>
        <div className="omino-ecard__btns">
          {onBack && <button className="omino-tool omino-tool--sm" onClick={onBack} aria-label="Back" title="Back"><Icon d={ICON.chevL} size={18} /></button>}
          <button className="omino-tool omino-tool--sm" onClick={onClose} aria-label="Close card" title="Close"><Icon d={ICON.close} size={18} /></button>
        </div>
      </header>
      <div className="omino-ecard__tags"><span style={{ "--c": cc }}>{cl}</span><span style={{ "--c": rc }}>{rl}</span></div>
      <div className="omino-ecard__bohr"><Bohr el={el} /></div>
      <div className="omino-ecard__stats">
        {[["Electrons", el.z, "#ff5d6c"], ["Protons", el.z, "#ffb454"], ["Neutrons", el.n, "#6f93ff"]].map(([l, v, c]) => (
          <div key={l} style={{ "--c": c }}><span>{l}</span><b>{v}</b></div>
        ))}
      </div>
      <dl className="omino-ecard__facts">
        <dt>Electron shell</dt><dd>{el.shells.map((n, k) => "KLMNOPQ"[k] + n).join("-")}</dd>
        <dt>Group · period</dt><dd>{el.cat === "lanthanide" ? "f-block" : el.g} · {el.p}</dd>
      </dl>
      <p className="omino-ecard__note">{el.note}</p>
      {el.rx && <Sec t="In drugs"><p className="omino-ecard__note" style={{ margin: 0 }}>{el.rx}</p></Sec>}
      {el.tox && <Sec t="Toxicity"><p className="omino-ecard__note" style={{ margin: 0 }}>{el.tox}</p></Sec>}
      {EL_LAB[el.sym]?.length > 0 && <Sec t="Reference values"><ul className="omino-ecard__list">{EL_LAB[el.sym].map((k) => <li key={k}><b>{LABS[k][0]}</b>{" · "}{LABS[k][1]}{LABS[k][2] ? ` (${LABS[k][2]})` : ""}</li>)}</ul></Sec>}
      {EL_NODE[el.sym] && <button className="omino-ecard__show" onClick={onShow}>Show in atlas</button>}
      <footer>
        <button disabled={!prev} onClick={() => onStep(-1)} aria-label="Previous element">{prev && <><Icon d={ICON.chevL} size={16} />{prev.z} {prev.name}</>}</button>
        <button disabled={!next} onClick={() => onStep(1)} aria-label="Next element">{next && <>{next.name} {next.z}<Icon d={ICON.chevR} size={16} /></>}</button>
      </footer>
    </aside>
  );
}

/* ================================================================== */
/* Explanation cards: molecules, bond types, enzymes and pathways      */
/* ================================================================== */

const BONDS = {
  ch: { name: "C–H bond", g: [["C", "H"], [1]], len: "≈ 109 pm", e: "≈ 410 kJ/mol", text: "Hydrogens on carbon are normally left out of skeletal drawings. They are drawn here where they matter: the two H on C4 of NADH, one of which is the hydride that NADH hands on." },
  oh: { name: "O–H bond", g: [["H", "O"], [1]], len: "≈ 96 pm", e: "≈ 460 kJ/mol", text: "Water, hydroxyls and acids. The hydrogen is slightly positive, so it forms hydrogen bonds with other O and N atoms." },
  nh: { name: "N–H bond", g: [["H", "N"], [1]], len: "≈ 101 pm", e: "≈ 390 kJ/mol", text: "In ammonia and amines. Ammonia picks up a proton to become NH₄⁺ at physiological pH." },
  oo: { name: "O–O peroxide bond", g: [["O", "O"], [1]], len: "≈ 148 pm", e: "≈ 140 kJ/mol", text: "A weak, reactive bond, as in hydrogen peroxide. Catalase and peroxidases split it before it can damage cells." },
  oo2: { name: "O=O double bond", g: [["O", "O"], [2]], len: "≈ 121 pm", e: "≈ 498 kJ/mol", text: "Molecular oxygen. It is a strong bond, but O₂ is a diradical, so it reacts slowly with organic molecules unless an enzyme (often one with iron or flavin) helps." },
  co3: { name: "C≡O triple bond", g: [["C", "O"], [3]], len: "≈ 113 pm", e: "≈ 1072 kJ/mol", text: "Carbon monoxide, one of the strongest bonds known. CO binds the iron of heme about 200 times more tightly than O₂ does." },
  cc: { name: "C–C single bond", g: [["C", "C"], [1]], len: "≈ 154 pm", e: "≈ 350 kJ/mol", text: "The covalent skeleton of every organic molecule. Atoms can rotate about it, so chains fold and flex. Lyases such as aldolase and decarboxylases break it." },
  cc2: { name: "C=C double bond", g: [["C", "C"], [2]], len: "≈ 134 pm", e: "≈ 610 kJ/mol", text: "Rigid and planar, with no rotation, so cis and trans forms differ. Fumarase hydrates the C=C of fumarate; vinyl groups and the conjugated pyrrole rings of heme also rely on it." },
  co: { name: "C–O single bond", g: [["C", "O"], [1]], len: "≈ 143 pm", e: "≈ 360 kJ/mol", text: "Hydroxyls, ethers, esters and the glycosidic links of glycogen. Oxidising a C–OH to C=O, as malate dehydrogenase does, is a common dehydrogenase step." },
  co2: { name: "C=O carbonyl", g: [["C", "O"], [2]], len: "≈ 120 pm", e: "≈ 750–800 kJ/mol", text: "In ketones, aldehydes and carboxylates. It is polarised, so the carbon is electrophilic and the oxygen takes part in hydrogen bonds. Decarboxylations release CO₂ from it." },
  cn: { name: "C–N single bond", g: [["C", "N"], [1]], len: "≈ 147 pm", e: "≈ 305 kJ/mol", text: "Amines and amides: the amino acid backbone, peptide bonds, nucleobases and the pyrrole nitrogens of heme." },
  cn2: { name: "C=N double bond", g: [["C", "N"], [2]], len: "≈ 129 pm", e: "≈ 615 kJ/mol", text: "Imines, the guanidinium group of arginine and the aromatic rings of adenine. Transamination runs through an imine (Schiff base) with pyridoxal phosphate." },
  cs: { name: "C–S bond (thioester)", g: [["C", "S"], [1]], len: "≈ 182 pm", e: "≈ 270 kJ/mol", text: "In acyl-CoA the carbonyl carbon is bonded to sulfur, forming a thioester. It is an activated acyl donor: hydrolysis releases about −31 kJ/mol, enough to drive condensations and the GTP made at succinyl-CoA synthetase." },
  po: { name: "P–O phosphate ester", g: [["P", "O"], [1]], len: "≈ 160 pm", e: "≈ 335 kJ/mol", text: "A phosphate attached to a sugar or other alcohol, as in glucose 6-phosphate. The charged phosphate traps the molecule in the cell and is recognised by enzymes." },
  po2: { name: "P=O phosphoryl", g: [["P", "O"], [2]], len: "≈ 148 pm", e: "≈ 540 kJ/mol", text: "The phosphoryl oxygen. By resonance the negative charge is shared over the phosphate oxygens, so the drawn double bond is a convention." },
  pop: { name: "P–O–P phosphoanhydride", g: [["P", "O", "P"], [1, 1]], len: "≈ 160 pm", e: "hydrolysis ≈ −30 kJ/mol", text: "The high-energy bonds of ATP. Hydrolysis releases about −30 kJ/mol under standard biochemical conditions, largely from relieved charge repulsion, resonance of the products and solvation. Kinases couple it to phosphorylations." },
  metal: { name: "Fe–N coordinate bond", g: [["Fe", "N"], [1]], len: "≈ 200 pm", e: "variable (dative)", text: "The four pyrrole nitrogens hold Fe²⁺ in the plane of the porphyrin. Ferrochelatase inserts the iron; the iron then binds O₂ in haemoglobin and myoglobin." },
  link: { name: "Bond to an abbreviated group", g: [["C", "R"], [1]], len: "—", e: "—", text: "CoA, uridine, Glc (glucosyl) and the porphyrin side chains A, P, M and V are drawn as labels, not in full, as in most textbook skeletal drawings." },
  cs1: { name: "C–S single bond (thiol, thioether)", g: [["C", "S"], [1]], len: "≈ 182 pm", e: "≈ 270 kJ/mol", text: "Sulfur bonded to a carbon that is not a carbonyl: the thiol (SH) of coenzyme A and cysteine, or the thioether ring sulfur of pioglitazone's thiazolidinedione." },
  cf: { name: "C–F bond", g: [["C", "F"], [1]], len: "≈ 135 pm", e: "≈ 485 kJ/mol", text: "One of the strongest single bonds to carbon. A fluorine on an aryl ring, as in atorvastatin, blocks oxidation at that position and makes the drug last longer." },
  ccl: { name: "C–Cl bond", g: [["C", "Cl"], [1]], len: "≈ 177 pm", e: "≈ 340 kJ/mol", text: "Chlorine on carbon. On an aryl ring (dapagliflozin, fenofibrate, dorzagliatin) it adds lipophilicity and slows metabolism; in dichloroacetate the two Cl make the acid stronger." },
  nn: { name: "N–N bond", g: [["N", "N"], [1]], len: "≈ 145 pm", e: "≈ 160 kJ/mol", text: "The adjacent nitrogens of the pyrazole ring in dorzagliatin. The ring is aromatic, so the bond is shorter and stronger than in a hydrazine." },
};
function classify(mol) {
  const by = Object.fromEntries(mol.atoms.map((a) => [a.id, a]));
  const el = (a) => (a.text ? (a.el === "X" ? "R" : a.el) : "C");
  const nb = {};
  mol.bonds.forEach(([a, b]) => { (nb[a] ||= []).push(b); (nb[b] ||= []).push(a); });
  const carbonyl = new Set(); // carbons that carry a C=O (so a C–S bond to them is a thioester)
  mol.bonds.forEach(([a, b, o = 1]) => { if (o === 2) { if (el(by[a]) === "C" && el(by[b]) === "O") carbonyl.add(a); if (el(by[b]) === "C" && el(by[a]) === "O") carbonyl.add(b); } });
  return mol.bonds.map(([a, b, o = 1]) => {
    const x = el(by[a]), y = el(by[b]), k = [x, y].sort().join("");
    if (k.includes("R")) return "link";
    if (k === "CC") return o === 2 ? "cc2" : "cc";
    if (k === "CO") return o === 3 ? "co3" : o === 2 ? "co2" : "co";
    if (k === "HO") return "oh";
    if (k === "CH") return "ch";
    if (k === "HN") return "nh";
    if (k === "OO") return o === 2 ? "oo2" : "oo";
    if (k === "CN") return o === 2 ? "cn2" : "cn";
    if (k === "CS") return carbonyl.has(x === "C" ? a : b) ? "cs" : "cs1";
    if (k === "CF") return "cf";
    if (k === "CCl") return "ccl";
    if (k === "NN") return "nn";
    if (k === "MN") return "metal";
    if (k === "OP") {
      if (o === 2) return "po2";
      const oid = x === "O" ? a : b;
      return nb[oid].filter((i) => el(by[i]) === "P").length > 1 ? "pop" : "po";
    }
    return "cc";
  });
}
const _kinds = {};
const kindsOf = (id) => (_kinds[id] ||= classify(MOLS[id]));
const NODE_BY = Object.fromEntries(NODES.map((n) => [n.id, n]));
const nm = (id) => NODE_BY[id]?.label || id;
const pathOfEdge = (e) => PATH_OF[e.target] || PATH_OF[e.source];


/* ------------------------------------------------------------------ */
/* Co-substrates: what each name in a "+ ATP" / "NAD⁺ + Pᵢ" label is  */
/* ------------------------------------------------------------------ */
const SPECIES = {}, CARD_EXTRA = {};
const sp = (id, label, formula, role, note, rx, rel = []) => {
  SPECIES[id] = { id, kind: "cofactor", mol: id, label, formula, note };
  CARD_EXTRA[id] = { role, rx, rel };
};
CARD_EXTRA.atp = { role: "Energy currency", rx: "ATP + H₂O → ADP + Pᵢ   (ΔG°′ ≈ −30 kJ/mol)", rel: ["adp", "amp", "gtp", "pi", "ppi"] };
sp("adp", "ADP", "C10H15N5O10P2", "Energy currency", "ATP after it has given up its terminal phosphate. Rising ADP and AMP tell the cell energy is low, so they activate phosphofructokinase-1 and isocitrate dehydrogenase. It is re-phosphorylated at substrate level (phosphoglycerate kinase, pyruvate kinase) and, far more, by ATP synthase.",
  "Kinase: substrate + ATP → substrate–P + ADP", ["atp", "amp", "pi"]);
sp("amp", "AMP", "C10H14N5O7P", "Energy signal", "Adenosine with a single phosphate. It is made when a reaction cleaves ATP between its α and β phosphates, as in argininosuccinate synthetase, and by adenylate kinase (2 ADP ⇌ ATP + AMP). AMP switches on AMPK and phosphofructokinase-1 and switches off fructose 1,6-bisphosphatase.",
  "ATP + citrulline + aspartate → AMP + PPᵢ + argininosuccinate", ["atp", "adp", "ppi"]);
sp("gtp", "GTP", "C10H16N5O14P3", "Energy currency", "The guanine twin of ATP: guanine has a C=O at C6 and an extra NH₂ at C2 where adenine has NH₂ at C6. In the TCA cycle, succinyl-CoA synthetase uses the thioester energy of succinyl-CoA to make GTP (or ATP, depending on the isoform). GTP also drives protein synthesis and G-protein signalling.",
  "Succinyl-CoA + GDP + Pᵢ → succinate + CoA + GTP", ["atp", "utp", "coa"]);
sp("utp", "UTP", "C9H15N2O15P3", "Sugar activation", "The uracil nucleotide. It activates sugars: UTP and glucose 1-phosphate give UDP-glucose and PPᵢ, which pyrophosphatase then hydrolyses so the step cannot run backwards. Uracil is a six-membered ring with two C=O groups.",
  "Glucose 1-P + UTP → UDP-glucose + PPᵢ", ["udp", "ppi", "gtp"]);
sp("udp", "UDP", "C9H14N2O12P2", "Leaving group", "What is left of UDP-glucose or UDP-glucuronate once the sugar has been transferred. It is turned back into UTP by nucleoside diphosphate kinase.",
  "Bilirubin + UDP-glucuronate → bilirubin glucuronide + UDP", ["utp", "udpglcA"]);
sp("udpglcA", "UDP-glucuronate", "C15H22N2O18P2", "Sugar donor", "UDP-glucose whose C6 CH₂OH has been oxidised to a carboxylate (COO⁻, drawn at the top). The liver adds glucuronate to bilirubin, drugs and steroids so they become water-soluble and can leave in bile or urine.",
  "UDP-glucose + 2 NAD⁺ + H₂O → UDP-glucuronate + 2 NADH + 2 H⁺", ["udp", "bilirubin"]);
sp("ppi", "Pyrophosphate (PPᵢ)", "P2O7 4−", "Byproduct", "Two phosphates joined by an O. It is released when ATP is split between α and β, or when UTP is used. Pyrophosphatase hydrolyses it at once, which makes these steps effectively irreversible.",
  "PPᵢ + H₂O → 2 Pᵢ   (ΔG°′ ≈ −20 kJ/mol)", ["pi", "atp", "utp"]);
sp("pi", "Inorganic phosphate (Pᵢ)", "HPO₄²⁻", "Phosphate pool", "The free phosphate ion, mostly HPO₄²⁻ at pH 7.4: P bonded to four oxygens, one of them double-bonded. Glyceraldehyde 3-phosphate dehydrogenase adds Pᵢ directly to make 1,3-bisphosphoglycerate; most other phosphoryl groups come from ATP.",
  "G3P + NAD⁺ + Pᵢ → 1,3-BPG + NADH + H⁺", ["atp", "ppi", "nad"]);
sp("nad", "NAD⁺", "C21H28N7O14P2", "Electron carrier (oxidised)", "Nicotinamide adenine dinucleotide: adenosine and nicotinamide riboside joined through a diphosphate. Dehydrogenases pass it a hydride (H⁻, a proton plus two electrons) that lands on C4 of the positively charged nicotinamide ring, giving NADH. It is made from niacin (vitamin B₃) and drives catabolism.",
  "Substrate–H₂ + NAD⁺ → product + NADH + H⁺", ["nadh", "nadp", "fad"]);
sp("nadh", "NADH", "C21H29N7O14P2", "Electron carrier (reduced)", "The reduced form. The ring is now a 1,4-dihydropyridine: the two H drawn on C4 are the hydride just received and the one already there. NADH carries the electrons to complex I of the respiratory chain, where each is worth about 2.5 ATP.",
  "NADH + H⁺ + ½ O₂ → NAD⁺ + H₂O   (via the respiratory chain)", ["nad", "nadph", "fadh2"]);
sp("nadp", "NADP⁺", "C21H29N7O17P3", "Electron carrier (oxidised)", "NAD⁺ plus a phosphate on the 2′ oxygen of the adenosine ribose (the group hanging below the left ring). That one phosphate lets enzymes tell the two coenzymes apart, so the cell can keep NADP⁺ mostly reduced.",
  "G6P + NADP⁺ → 6-phosphogluconolactone + NADPH + H⁺", ["nadph", "nad"]);
sp("nadph", "NADPH", "C21H30N7O17P3", "Reducing power for synthesis", "NADH with the extra 2′-phosphate. It is the electron donor for fatty acid synthesis and for antioxidant defence (glutathione reductase), and the pentose phosphate pathway makes it. Heme oxygenase and biliverdin reductase use it in the heme-breakdown pathway.",
  "Biliverdin + NADPH + H⁺ → bilirubin + NADP⁺", ["nadp", "nadh"]);
sp("fad", "FAD", "C27H33N9O15P2", "Electron carrier (oxidised)", "Flavin adenine dinucleotide: adenosine – diphosphate – ribitol – an isoalloxazine ring of three fused rings. Made from riboflavin (vitamin B₂). It can take two electrons and two protons in one step, at N1 and N5.",
  "Succinate + FAD → fumarate + FADH₂", ["fadh2", "nad"]);
sp("fadh2", "FADH₂", "C27H35N9O15P2", "Electron carrier (reduced)", "The flavin has taken two H atoms (drawn on N1 and N5), which also changes the double bonds in the middle ring. In succinate dehydrogenase the flavin stays bound to the enzyme and hands its electrons to ubiquinone; each FADH₂ is worth about 1.5 ATP.",
  "Succinate + FAD → fumarate + FADH₂", ["fad", "nadh"]);
sp("coa", "Coenzyme A", "C21H36N7O16P3S", "Acyl carrier", "ADP 3′-phosphate joined to pantothenate (vitamin B₅) and cysteamine, ending in a free thiol (SH, far right). Acyl groups attach to that sulfur as thioesters, giving acetyl-CoA, succinyl-CoA and malonyl-CoA. In the atlas, free CoA is a product when succinyl-CoA is used.",
  "Succinyl-CoA + glycine → ALA + CoA + CO₂", ["gtp", "nadh"]);
sp("h2o", "Water", "H2O", "Solvent and reactant", "A bent molecule: two O–H bonds at about 104.5°. Enolase removes it from 2-phosphoglycerate to make PEP, fumarase adds it across the C=C of fumarate, and hydrolases such as lipase and arginase use it to cut bonds.",
  "Fumarate + H₂O ⇌ malate", ["co2", "h2o2"]);
sp("co2", "Carbon dioxide", "CO2", "Waste carbon", "A linear molecule with two C=O bonds. Decarboxylases such as pyruvate dehydrogenase, isocitrate dehydrogenase, α-KG dehydrogenase and 6-phosphogluconate dehydrogenase release it. It is carried in the blood mainly as bicarbonate and exhaled.",
  "Isocitrate + NAD⁺ → α-KG + CO₂ + NADH", ["co", "h2o"]);
sp("nh3", "Ammonia", "NH3", "Nitrogen waste", "Nitrogen with three hydrogens and a lone pair; at pH 7.4 it is mostly NH₄⁺. PBG deaminase releases one NH₃ for each porphobilinogen it links. Free ammonia is toxic, so the urea cycle in the liver turns it into urea.",
  "4 PBG + H₂O → hydroxymethylbilane + 4 NH₃", ["urea", "h2o"]);
sp("co", "Carbon monoxide", "CO", "Signalling gas", "Heme oxygenase releases CO when it opens the heme ring, the main source made in the body. It is a triple-bonded C≡O molecule that binds the iron of heme about 200 times more tightly than O₂, which is why it poisons haemoglobin.",
  "Heme + O₂ + NADPH → biliverdin + CO + Fe²⁺", ["o2", "co2"]);
sp("o2", "Oxygen", "O2", "Oxidant", "A double-bonded O=O molecule, the terminal electron acceptor of respiration. Heme oxygenase and many other oxygenases and oxidases use it directly.",
  "Heme + O₂ + NADPH → biliverdin + CO + Fe²⁺", ["h2o2", "co"]);
sp("h2o2", "Hydrogen peroxide", "H2O2", "Reactive oxygen species", "Two OH groups joined by a weak O–O bond. Oxidases that pass electrons straight to O₂ (here protoporphyrinogen oxidase, shown as 3 H₂O₂) make it. Catalase and glutathione peroxidase remove it.",
  "Protoporphyrinogen IX + 3 O₂ → protoporphyrin IX + 3 H₂O₂", ["o2", "h2o"]);
sp("hplus", "Proton (H⁺)", "H+", "Acid", "A bare hydrogen nucleus. Inserting Fe²⁺ into protoporphyrin IX (ferrochelatase) displaces the two N–H protons, so two H⁺ are released. Proton gradients across the mitochondrial membrane are what ATP synthase runs on.",
  "Protoporphyrin IX + Fe²⁺ → heme + 2 H⁺", ["h2o", "nadh"]);

// the names that can appear in a co-substrate label, and where clicking each one goes
const TOK = [
  ["UDP-glucuronate", ["mol", "udpglcA"]], ["NADPH", ["mol", "nadph"]], ["NADH", ["mol", "nadh"]], ["NAD⁺", ["mol", "nad"]],
  ["FADH₂", ["mol", "fadh2"]], ["ATP", ["mol", "atp"]], ["ADP", ["mol", "adp"]], ["AMP", ["mol", "amp"]], ["GTP", ["mol", "gtp"]],
  ["UTP", ["mol", "utp"]], ["UDP", ["mol", "udp"]], ["CoA", ["mol", "coa"]], ["PPᵢ", ["mol", "ppi"]], ["Pᵢ", ["mol", "pi"]],
  ["H₂O₂", ["mol", "h2o2"]], ["H₂O", ["mol", "h2o"]], ["CO₂", ["mol", "co2"]], ["CO", ["mol", "co"]], ["NH₃", ["mol", "nh3"]],
  ["O₂", ["mol", "o2"]], ["H⁺", ["mol", "hplus"]], ["Fe²⁺", ["el", "Fe"]],
];
const TOKMAP = Object.fromEntries(TOK);
const TOK_RE = new RegExp("(" + TOK.map((t) => t[0]).sort((a, b) => b.length - a.length).join("|") + ")");
const cofTokens = (label) => label.split(TOK_RE).filter(Boolean).map((t) => (TOKMAP[t] ? { t, to: TOKMAP[t] } : { t }));

const EXPLAIN = {
  ...AA_NOTE,
  glucose: "The body's main circulating fuel. Cells phosphorylate it as soon as it enters, which traps it and starts glycolysis.",
  g6p: "A branch point: glycolysis, the pentose phosphate pathway and glycogen synthesis all start here. The phosphate keeps it inside the cell.",
  pyruvate: "End product of glycolysis. Depending on oxygen and tissue it becomes acetyl-CoA, lactate, alanine or oxaloacetate.",
  acetylcoa: "The common two-carbon currency of metabolism, a thioester with high group-transfer potential. It feeds the TCA cycle, fatty acid synthesis and ketogenesis.",
  atp: "The cell's energy carrier. Hydrolysing its terminal phosphoanhydride bond (about −30 kJ/mol) powers kinases and many other reactions.",
  citrate: "First product of the TCA cycle and a sign of energy abundance: it inhibits phosphofructokinase-1 and activates acetyl-CoA carboxylase.",
  oaa: "Regenerated at the end of each TCA turn; it is also the precursor of aspartate and, in gluconeogenesis, of glucose.",
  urea: "The main nitrogen waste in mammals. It is small, neutral and very soluble, so the kidney clears it easily.",
  glycogen: "Branched storage polymer of glucose, mostly in liver and muscle. The ring drawn is one α-glucose unit, with the chain running on at C1 and C4.",
  heme: "An iron–porphyrin that carries O₂ in haemoglobin and myoglobin and passes electrons in cytochromes. Free heme is toxic, so it is bound to protein or degraded.",
  bilirubin: "Yellow, lipophilic breakdown product of heme. It travels on albumin to the liver; a build-up causes jaundice.",
  glutamate: "The amino-group hub: transaminases pass nitrogen to and from α-ketoglutarate, and glutamate dehydrogenase releases it as ammonia.",
};
const ENZN = {
  "Phenylalanine hydroxylase": "Adds a hydroxyl group to the ring of phenylalanine to make tyrosine, using O₂ and tetrahydrobiopterin (BH₄). Deficiency is phenylketonuria; some forms respond to BH₄ (sapropterin). Tyrosine then becomes an essential amino acid.",
  "Hexokinase / Glucokinase": "Traps glucose as glucose 6-phosphate using ATP. Glucokinase (liver, β-cells) has a high Km and is not inhibited by G6P, so it tracks blood glucose; hexokinase is inhibited by its product.",
  "Phosphofructokinase-1": "The committed step of glycolysis. Activated by AMP and fructose 2,6-bisphosphate; inhibited by ATP and citrate.",
  "Pyruvate kinase": "Moves phosphate from PEP to ADP, making ATP at the substrate level. Fructose 1,6-bisphosphate activates it; in liver, glucagon-driven phosphorylation inhibits it.",
  "Pyruvate dehydrogenase complex": "Links glycolysis to the TCA cycle. Needs thiamine, lipoate, CoA, FAD and NAD⁺; inhibited by its products and by PDH kinase.",
  "Citrate synthase": "Condenses acetyl-CoA with oxaloacetate. Its pace follows the supply of oxaloacetate and acetyl-CoA.",
  "Isocitrate dehydrogenase": "The main rate-limiting step of the TCA cycle. Activated by ADP and Ca²⁺; inhibited by ATP and NADH.",
  "α-KG dehydrogenase": "Uses the same cofactors as pyruvate dehydrogenase, including the lipoate that arsenite attacks. Inhibited by succinyl-CoA and NADH.",
  "G6P dehydrogenase": "Rate-limiting step of the pentose phosphate pathway and source of the first NADPH. NADPH inhibits it; deficiency causes haemolytic anaemia under oxidative stress.",
  "Glycogen phosphorylase": "Releases glucose 1-phosphate from the ends of glycogen. Activated by phosphorylation (glucagon, adrenaline) and by AMP.",
  "Glycogen synthase": "Adds glucose from UDP-glucose to growing chains. Phosphorylation inactivates it; insulin promotes its dephosphorylation.",
  "Acetyl-CoA carboxylase": "Commits acetyl-CoA to fatty acid synthesis. Needs biotin; citrate and insulin activate it, palmitoyl-CoA and AMPK inhibit it.",
  "Arginase": "Last step of the urea cycle, in liver cytosol: it cleaves arginine to urea and ornithine. Mn²⁺ is its cofactor.",
  "ALA synthase (B₆)": "Rate-limiting step of heme synthesis, in mitochondria; needs pyridoxal phosphate. ALAS1 is repressed by heme; the erythroid ALAS2 is regulated by iron.",
  "ALA dehydratase": "Joins two ALA molecules into porphobilinogen. It contains zinc and is inhibited by lead.",
  "PBG deaminase": "Chains four porphobilinogens into hydroxymethylbilane. Deficiency causes acute intermittent porphyria.",
  "Uroporphyrinogen decarboxylase": "Removes four carboxyl groups from the acetate side chains. Deficiency causes porphyria cutanea tarda.",
  "Ferrochelatase": "Inserts Fe²⁺ into protoporphyrin IX in the mitochondrion. Lead inhibits it.",
  "Heme oxygenase": "Opens the heme ring at the α-meso carbon using O₂ and NADPH, releasing CO and Fe²⁺ and giving biliverdin.",
  "UDP-glucuronosyltransferase": "Conjugates bilirubin with glucuronate in the liver so it can enter bile. Reduced in Gilbert syndrome, absent in Crigler–Najjar type I.",
};
const PDESC = {
  glycolysis: "Splits glucose into two pyruvate in the cytosol, netting 2 ATP and 2 NADH. Phosphofructokinase-1 is the committed, most regulated step.",
  glycogen: "Stores glucose as a branched polymer. Glycogen synthase uses UDP-glucose; phosphorylase releases glucose 1-phosphate.",
  ppp: "The oxidative branch makes NADPH (via G6P dehydrogenase) and ribose 5-phosphate; the non-oxidative branch interconverts sugars and returns carbon to glycolysis.",
  tca: "Oxidises acetyl-CoA to CO₂ in the mitochondrial matrix, capturing electrons as NADH and FADH₂ and making GTP at succinyl-CoA synthetase.",
  urea: "Turns ammonia (as carbamoyl phosphate) and aspartate nitrogen into urea in the liver. It starts in mitochondria and finishes in the cytosol.",
  amino: "Transaminases shuttle amino groups among α-keto acids and amino acids, linking glycolysis, the TCA cycle and the urea cycle.",
  aa: "The twenty protein amino acids. Nine are essential (valine, leucine, isoleucine, methionine, threonine, lysine, histidine, phenylalanine, tryptophan) because humans cannot make their carbon skeletons; the rest are made from glycolytic and TCA intermediates or from other amino acids, and a few become conditionally essential in illness or infancy. Alanine, aspartate, glutamate, glycine and arginine sit in the pathways they feed.",
  lipid: "Stores fatty acids as triacylglycerol on glycerol 3-phosphate, builds fatty acids from malonyl-CoA and breaks them down by β-oxidation.",
  ala: "Succinyl-CoA and glycine condense to 5-aminolevulinate in the mitochondrion. ALA synthase is the rate-limiting step of heme synthesis.",
  heme: "Eight enzymes, split between mitochondria and cytosol, build the porphyrin ring and insert iron. Genetic defects cause the porphyrias; lead inhibits two steps.",
  pharm: "Drugs (capsules) point at their targets: enzymes, transporters, receptors and, for chemotherapy, DNA itself. The coloured line shows the effect, and a dotted line joins each target to the metabolite it works on. Organ hubs group the targets by organ system; the Oncology hub groups chemotherapy by mechanism. Switch the layer off in Settings.",
  bili: "Heme oxygenase opens the ring to biliverdin (releasing CO and iron), biliverdin reductase makes bilirubin, and the liver conjugates it with glucuronate for bile.",
};

const Pill = ({ children, onClick, c }) => <button className="omino-pill" style={{ "--c": c || "#8e8e99" }} onClick={onClick}>{children}</button>;
const Sec = ({ t, children }) => <section className="omino-ecard__sec"><h4>{t}</h4>{children}</section>;
function CardShell({ c, sub, title, tags, onClose, onBack, label, children }) {
  return (
    <aside className="omino-ecard" style={{ "--c": c }} aria-label={label}>
      <header>
        <div><div className="omino-ecard__name">{sub}</div><div className="omino-ecard__title">{title}</div></div>
        <div className="omino-ecard__btns">
          {onBack && <button className="omino-tool omino-tool--sm" onClick={onBack} aria-label="Back" title="Back"><Icon d={ICON.chevL} size={18} /></button>}
          <button className="omino-tool omino-tool--sm" onClick={onClose} aria-label="Close card" title="Close"><Icon d={ICON.close} size={18} /></button>
        </div>
      </header>
      {tags && <div className="omino-ecard__tags">{tags}</div>}
      {children}
    </aside>
  );
}
function BondGlyph({ k }) {
  const [labels, orders] = BONDS[k].g, E = { C: "C", O: "O", N: "N", S: "S", P: "P", Fe: "M", R: "X", H: "H", F: "F", Cl: "Cl" };
  const mol = { name: BONDS[k].name, scale: 1.5, atoms: labels.map((t, i) => A("a" + i, [i * 54, 0], t, E[t])), bonds: orders.map((o, i) => ["a" + i, "a" + (i + 1), o]) };
  return <Skeletal mol={mol} hit={false} />;
}
function MolCard({ id, open, fit, shell }) {
  const n = NODE_BY[id] || SPECIES[id], cnt = {}, p = PATH_OF[id], pc = PATHWAYS[p], x = CARD_EXTRA[id] || {};
  const [big, setBig] = useState(false);
  const m = MOLS[n.mol], wide = bounds(m).w * (m.scale || 1) > 380;
  const isCof = !!SPECIES[id] || !!x.role, accent = pc?.color || (isCof ? KIND.cofactor.color : CHALK);
  kindsOf(n.mol).forEach((k) => (cnt[k] = (cnt[k] || 0) + 1));
  const els = [...new Set(n.formula.match(/[A-Z][a-z]?/g) || [])].filter((s) => ELEMENTS.some((e) => e.sym === s));
  const made = EDGES.filter((e) => e.target === id && e.main), used = EDGES.filter((e) => e.source === id && e.main);
  // co-substrate labels on the canvas that contain this molecule, with the molecule they sit beside
  const where = NODES.filter((c) => c.kind === "cofactor" && cofTokens(c.label).some((t) => t.to && t.to[1] === id)).map((c) => {
    const [cx, cy] = layout[c.id];
    const near = NODES.filter((q) => q.mol && layout[q.id]).sort((u, v) => Math.hypot(layout[u.id][0] - cx, layout[u.id][1] - cy) - Math.hypot(layout[v.id][0] - cx, layout[v.id][1] - cy))[0];
    return { id: c.id, text: `${c.label.trim()} · beside ${near ? near.label : "the map"}` };
  });
  const showIds = NODE_BY[id] ? [id] : where.map((w) => w.id);
  const step = (e, other) => (
    <li key={e.id}>
      {e.label ? <button className="omino-link" onClick={() => open("enz", e.label)}>{e.label}</button> : <span>unlabelled step</span>}
      {" · "}<button className="omino-link" onClick={() => open("mol", other)}>{nm(other)}</button>
    </li>
  );
  return (
    <CardShell {...shell} c={accent} sub={n.formula} title={n.label} label={`${n.label} molecule card`}
      tags={<><span style={{ "--c": isCof ? KIND.cofactor.color : CHALK }}>{isCof ? "Cofactor" : "Molecule"}</span>{n.aa && <span style={{ "--c": AA_COLOR[n.aa] }}>{AA_LABEL[n.aa]} amino acid</span>}{x.role && <span style={{ "--c": accent }}>{x.role}</span>}{pc && <Pill c={pc.color} onClick={() => open("path", p)}>{pc.label}</Pill>}</>}>
      <div className={`omino-ecard__art ${big ? "is-big" : ""}`}><Skeletal mol={m} /></div>
      {wide && <button className="omino-ecard__zoom" onClick={() => setBig((v) => !v)}>{big ? "Fit structure to card" : "Enlarge structure (scrolls)"}</button>}
      {Object.keys(cnt).length > 0 && <div className="omino-ecard__hint">Click any bond to see what it is</div>}
      <p className="omino-ecard__note">{EXPLAIN[id] || n.note}</p>
      {x.rx && <Sec t="Typical reaction"><div className="omino-ecard__rx">{x.rx}</div></Sec>}
      {x.rel?.length > 0 && <Sec t="Related"><div className="omino-chiprow">{x.rel.map((r) => <Pill key={r} c={KIND.cofactor.color} onClick={() => open("mol", r)}>{(SPECIES[r] || NODE_BY[r]).label}</Pill>)}</div></Sec>}
      {Object.keys(cnt).length > 0 && <Sec t="Bond types here"><div className="omino-chiprow">{Object.entries(cnt).map(([k, c]) => <Pill key={k} onClick={() => open("bond", k)}>{BONDS[k].name} × {c}</Pill>)}</div></Sec>}
      <Sec t="Elements"><div className="omino-chiprow">{els.map((s) => { const e = ELEMENTS.find((x) => x.sym === s); return <Pill key={s} c={CATS[e.cat][1]} onClick={() => open("el", s)}>{s} · {e.name}</Pill>; })}</div></Sec>
      {made.length > 0 && <Sec t="Made by"><ul className="omino-ecard__list">{made.map((e) => step(e, e.source))}</ul></Sec>}
      {used.length > 0 && <Sec t="Used by"><ul className="omino-ecard__list">{used.map((e) => step(e, e.target))}</ul></Sec>}
      {RX_ACTS.some((a) => a.met === id) && <Sec t="Drug targets"><div className="omino-chiprow">{RX_ACTS.filter((a) => a.met === id).map((a) => <Pill key={a.target} c={KIND[NODE_BY[a.target].kind].color} onClick={() => open("target", a.target)}>{nm(a.target)}</Pill>)}</div></Sec>}
      {where.length > 0 && <Sec t="Where it appears in the atlas"><div className="omino-chiprow">{where.slice(0, 14).map((w) => <Pill key={w.id} onClick={() => fit([w.id])}>{w.text}</Pill>)}</div></Sec>}
      <Tags id={id} open={open} />
      {showIds.length > 0 && <button className="omino-ecard__show" onClick={() => fit(showIds)}>Show in atlas</button>}
    </CardShell>
  );
}
function BondCard({ kind, open, shell }) {
  const b = BONDS[kind], mols = [...NODES, ...Object.values(SPECIES)].filter((n) => n.mol && kindsOf(n.mol).includes(kind));
  return (
    <CardShell {...shell} c="#38bdf8" sub="Bond type" title={b.name} label={`${b.name} card`}>
      <div className="omino-ecard__art"><BondGlyph k={kind} /></div>
      <dl className="omino-ecard__facts"><dt>Typical length</dt><dd>{b.len}</dd><dt>Typical energy</dt><dd>{b.e}</dd></dl>
      <p className="omino-ecard__note">{b.text}</p>
      <Sec t={`In ${mols.length} molecules`}>
        <div className="omino-chiprow">{mols.slice(0, 18).map((n) => <Pill key={n.id} c={PATHWAYS[PATH_OF[n.id]]?.color} onClick={() => open("mol", n.id)}>{n.label}</Pill>)}{mols.length > 18 && <span className="omino-ecard__hint">+ {mols.length - 18} more</span>}</div>
      </Sec>
    </CardShell>
  );
}
function EnzCard({ label, open, fit, shell }) {
  const es = EDGES.filter((e) => e.main && e.label === label), ps = [...new Set(es.map(pathOfEdge))].filter(Boolean);
  const c = PATHWAYS[ps[0]]?.color || "#38bdf8";
  return (
    <CardShell {...shell} c={c} sub="Enzyme" title={label} label={`${label} enzyme card`}
      tags={ps.map((p) => <Pill key={p} c={PATHWAYS[p].color} onClick={() => open("path", p)}>{PATHWAYS[p].label}</Pill>)}>
      <p className="omino-ecard__note">{ENZN[label] || `Catalyses the conversion of ${nm(es[0].source)} to ${nm(es[0].target)}${es.length > 1 ? `, and ${es.length - 1} similar step${es.length > 2 ? "s" : ""}` : ""}.`}</p>
      <Sec t={es.length > 1 ? "Reactions" : "Reaction"}>
        <ul className="omino-ecard__list">{es.map((e) => <li key={e.id}><button className="omino-link" onClick={() => open("mol", e.source)}>{nm(e.source)}</button> → <button className="omino-link" onClick={() => open("mol", e.target)}>{nm(e.target)}</button></li>)}</ul>
      </Sec>
      {RX_EFFECTS.some((x) => NODE_BY[x.target].enz === label) && (
        <Sec t="Drugs acting here">
          <div className="omino-chiprow">{RX_EFFECTS.filter((x) => NODE_BY[x.target].enz === label).map((x) => <Pill key={x.drug} c={FX[x.fx].color} onClick={() => open("drug", x.drug)}>{nm(x.drug)} · {FX[x.fx].verb === "substrate of" ? "substrate" : FX[x.fx].verb}</Pill>)}</div>
        </Sec>
      )}
      <button className="omino-ecard__show" onClick={() => fit(es.flatMap((e) => [e.source, e.target]))}>Show in atlas</button>
    </CardShell>
  );
}
function PathCard({ p, open, shell }) {
  if (p === "pharm") {
    return (
      <CardShell {...shell} c={RX_COLOR} sub="Layer" title="Pharmacology" label="Pharmacology layer card">
        <p className="omino-ecard__note">{PDESC.pharm}</p>
        <dl className="omino-ecard__facts"><dt>Drugs</dt><dd>{DRUGS.length}</dd><dt>Targets</dt><dd>{TARGETS.length}</dd></dl>
        <Sec t="Drugs"><div className="omino-chiprow">{DRUGS.map((d) => <Pill key={d[0]} c={RX_COLOR} onClick={() => open("drug", d[0])}>{d[1]}</Pill>)}</div></Sec>
        <Sec t="Targets"><div className="omino-chiprow">{TARGETS.map((t) => <Pill key={t[0]} c={KIND[t[2]].color} onClick={() => open("target", t[0])}>{t[1]}</Pill>)}</div></Sec>
        <Sec t="Line styles"><FxLegend /></Sec>
      </CardShell>
    );
  }
  const pc = PATHWAYS[p], mols = NODES.filter((n) => n.mol && PATH_OF[n.id] === p);
  const enz = [...new Set(EDGES.filter((e) => e.main && e.label && pathOfEdge(e) === p).map((e) => e.label))];
  return (
    <CardShell {...shell} c={pc.color} sub="Pathway" title={pc.label} label={`${pc.label} pathway card`}>
      <p className="omino-ecard__note">{PDESC[p]}</p>
      <dl className="omino-ecard__facts"><dt>Molecules</dt><dd>{mols.length}</dd><dt>Enzymes</dt><dd>{enz.length}</dd></dl>
      <Sec t="Molecules"><div className="omino-chiprow">{mols.map((n) => <Pill key={n.id} c={pc.color} onClick={() => open("mol", n.id)}>{n.label}</Pill>)}</div></Sec>
      {enz.length > 0 && <Sec t="Enzymes"><div className="omino-chiprow">{enz.map((l) => <Pill key={l} onClick={() => open("enz", l)}>{l}</Pill>)}</div></Sec>}
    </CardShell>
  );
}
// Legend for the pharmacology lines (also shown in Settings)
function FxLegend({ onHide }) {
  const rows = [
    ["inhibit", "Inhibition", "bar", "7 6", "#ff5d5d"], ["activate", "Activation", "arrow", "7 6", "#4ade80"], ["substrate", "Substrate", "arrow", "", "#38bdf8"], ["alter", "Chemical alteration", "arrow", "", "#f59e0b"], ["tether", "Target acts on this metabolite", "", "2 5", "#59626e"],
  ];
  return (
    <div className="omino-fxlegend" role="group" aria-label="Pharmacology line styles">
      <h5>Drug effects{onHide && <button className="omino-fxlegend__x" onClick={onHide} aria-label="Hide legend" title="Hide legend">×</button>}</h5>
      {rows.map(([id, label, head, dash, c]) => (
        <div key={id}>
          <svg width="46" height="14" viewBox="0 0 46 14" aria-hidden="true">
            <line x1="2" y1="7" x2={head ? 36 : 44} y2="7" stroke={c} strokeWidth={id === "tether" ? 1.6 : 2.4} strokeDasharray={dash || undefined} strokeLinecap="round" />
            {head === "bar" && <path d="M40 1.5V12.5" stroke={c} strokeWidth="2.8" strokeLinecap="round" />}
            {head === "arrow" && <path d="M34 2.5L43 7L34 11.5Z" fill={c} />}
          </svg>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function DrugCard({ id, open, fit, shell }) {
  const d = NODE_BY[id], rx = RX_EFFECTS.filter((e) => e.drug === id);
  return (
    <CardShell {...shell} c={RX_COLOR} sub={d.formula} title={d.label} label={`${d.label} drug card`}
      tags={<>{rx.map((e) => <span key={e.target} style={{ "--c": FX[e.fx].color }}>{FX[e.fx].label}</span>)}<Pill c={RX_COLOR} onClick={() => open("path", "pharm")}>Pharmacology</Pill></>}>
      {MOLS[id] && <div className="omino-ecard__art"><Skeletal mol={MOLS[id]} /></div>}
      {d.shown && <div className="omino-ecard__hint">Structure shown: {d.shown}</div>}
      <p className="omino-ecard__note">{d.note.replace(/ Examples: .*$/, "")}</p>
      <dl className="omino-ecard__facts"><dt>Examples</dt><dd>{d.examples}</dd></dl>
      <Sec t="Acts on">
        <ul className="omino-ecard__list">{rx.map((e) => (
          <li key={e.target}>
            <span style={{ color: FX[e.fx].color, fontWeight: 600 }}>{FX[e.fx].verb}</span>{" · "}<button className="omino-link" onClick={() => open("target", e.target)}>{nm(e.target)}</button>
            {e.detail && <div>{e.detail}</div>}
          </li>
        ))}</ul>
      </Sec>
      <Tags id={id} open={open} />
      <button className="omino-ecard__show" onClick={() => fit([id, ...rx.map((e) => e.target)])}>Show in atlas</button>
    </CardShell>
  );
}
/* Immunoglobulin classes: schematic and facts shown on their target cards */
const IG = {
  t_igg: { n: 1, facts: [["Heavy chain", "γ (IgG1–4)"], ["Form", "Monomer, about 150 kDa"], ["Share of serum Ig", "About 75%"], ["Half-life", "About 3 weeks (IgG3 about 1 week)"], ["Placenta", "Crosses, via FcRn"], ["Complement", "Classical pathway (IgG3 > IgG1 > IgG2; IgG4 none)"]],
    fn: ["Main antibody of the secondary (memory) response", "Opsonises bacteria for phagocytes and neutralises toxins and viruses", "Activates complement and drives antibody-dependent cellular cytotoxicity by NK cells", "Gives the newborn passive immunity across the placenta"],
    clin: ["Low in Bruton agammaglobulinaemia and common variable immunodeficiency: recurrent infections with encapsulated bacteria", "IgG4-related disease: tumefactive fibrosis with raised IgG4", "Anti-D IgG from an Rh-negative mother causes haemolytic disease of the newborn", "Many autoantibodies are IgG, for example anti-GBM and anti-acetylcholine-receptor"] },
  t_iga: { n: 2, j: true, facts: [["Heavy chain", "α (IgA1, IgA2)"], ["Form", "Monomer in serum; dimer with J chain and secretory component in secretions"], ["Share of serum Ig", "About 10–15%, and the main class in secretions"], ["Half-life", "About 6 days"], ["Placenta", "No (milk IgA protects the infant gut)"], ["Complement", "Does not activate the classical pathway"]],
    fn: ["Mucosal defence in gut, airway, tears, saliva and milk", "Blocks pathogen attachment to the epithelium (immune exclusion) without causing inflammation", "Carried across epithelium by the polymeric Ig receptor, which leaves secretory component attached"],
    clin: ["Selective IgA deficiency, the commonest primary immunodeficiency: often silent, or recurrent sinopulmonary and GI infections (Giardia); anaphylaxis to IgA-containing blood products", "IgA nephropathy (Berger disease) and IgA vasculitis (Henoch–Schönlein purpura)", "Coeliac disease: anti-tissue transglutaminase IgA is the screening test; dermatitis herpetiformis"] },
  t_igm: { n: 5, j: true, facts: [["Heavy chain", "μ"], ["Form", "Pentamer with J chain, about 900 kDa; monomer on the B-cell surface"], ["Share of serum Ig", "About 5–10%"], ["Half-life", "About 5 days"], ["Placenta", "No"], ["Complement", "Strongest classical-pathway activator"]],
    fn: ["First antibody made in a primary response, before class switching", "One pentamer binding antigen can bind C1q and start complement", "Natural antibodies, such as anti-A and anti-B isoagglutinins", "Membrane IgM, with IgD, is the antigen receptor of naive B cells"],
    clin: ["Raised IgM in a newborn suggests intrauterine infection, because IgM does not cross the placenta", "Hyper-IgM syndrome (CD40 ligand defect): no class switching, so IgM is high and IgG, IgA and IgE are low", "Waldenström macroglobulinaemia: IgM paraprotein with hyperviscosity", "Cold agglutinin disease and rheumatoid factor are IgM"] },
  t_ige: { n: 1, facts: [["Heavy chain", "ε"], ["Form", "Monomer"], ["Share of serum Ig", "Least abundant class (nanograms per mL)"], ["Half-life", "About 2 days free; weeks when bound to FcεRI"], ["Placenta", "No"], ["Complement", "None"]],
    fn: ["Binds FcεRI on mast cells and basophils; allergen cross-linking triggers degranulation (type I hypersensitivity)", "Defence against helminths, through eosinophils", "Class switching to IgE needs IL-4 and IL-13 from Th2 cells"],
    clin: ["Anaphylaxis, atopic dermatitis, allergic rhinitis and allergic asthma", "Hyper-IgE (Job) syndrome: STAT3 defect, eczema, staphylococcal abscesses and retained primary teeth, with very high IgE", "Raised in parasitic infection and allergic bronchopulmonary aspergillosis"] },
  t_igd: { n: 1, facts: [["Heavy chain", "δ"], ["Form", "Monomer"], ["Share of serum Ig", "Less than 1%"], ["Half-life", "About 3 days"], ["Placenta", "No"], ["Complement", "None"]],
    fn: ["Co-expressed with IgM on naive mature B cells as an antigen receptor", "Secreted IgD binds basophils and mast cells; its role is poorly understood"],
    clin: ["Hyper-IgD syndrome (mevalonate kinase deficiency): periodic fevers; IgD is raised but is not thought to cause them", "IgD myeloma is rare"] },
};
// Y-shaped schematic: n units (1 monomer, 2 dimer, 5 pentamer); j draws the J chain; heavy chains thick, antigen-binding tips ringed
function IgSketch({ n, j }) {
  const C = "#34d399";
  const Y = ({ t }) => (
    <g transform={t} fill="none" stroke={C} strokeLinecap="round">
      <path d="M0 0V-26M0 -26L-15 -50M0 -26L15 -50" strokeWidth="5" />
      <path d="M-9 -34L-19 -48M9 -34L19 -48" strokeWidth="2" opacity=".55" />
      <circle cx="-15" cy="-50" r="3.4" fill="#0a0a0a" strokeWidth="2" /><circle cx="15" cy="-50" r="3.4" fill="#0a0a0a" strokeWidth="2" />
    </g>
  );
  const units = n === 5 ? [0, 72, 144, 216, 288].map((a) => `translate(100 100) rotate(${a}) translate(0 -9)`) : n === 2 ? ["translate(100 128) rotate(-35)", "translate(100 128) rotate(35)"] : ["translate(100 140)"];
  const jc = n === 5 ? [100, 100] : [100, 128];
  return (
    <svg viewBox="0 0 200 170" width="200" height="170" role="img" aria-label={n === 1 ? "Antibody monomer" : n === 2 ? "Dimeric antibody joined by a J chain" : "Pentameric antibody joined by a J chain"}>
      {units.map((t, i) => <Y key={i} t={t} />)}
      {j && <circle cx={jc[0]} cy={jc[1]} r="5" fill="#facc15" />}
    </svg>
  );
}
/* Vitamin cards: facts, cofactor role (with links), deficiency and excess */
function VitBlock({ id, open, fit }) {
  const v = VIT[id], k = KIND[v.kind], vs = VIT_VV.filter(([a, b]) => a === id || b === id);
  const jump = (n) => (NODE_BY[n].mol ? open("mol", n) : NODE_BY[n].rx === "target" ? open("target", n) : fit([n]));
  const elName = (sy) => ELEMENTS.find((e) => e.sym === sy)?.name || sy;
  const chips = v.cof2.mol.length + v.cof2.enz.length + v.cof2.el.length + v.links.length;
  const List = ({ t, a }) => a?.length > 0 && <Sec t={t}><ul className="omino-ecard__list">{a.map((x) => <li key={x}>{x}</li>)}</ul></Sec>;
  return (
    <>
      <dl className="omino-ecard__facts">
        {[["Solubility", v.sol], ["Also called", v.names], ["Active form", v.forms], ["Cofactor?", v.cofShort], ["Adult RDA / AI", v.rda], ["Main sources", v.src]].map(([a, b]) => <React.Fragment key={a}><dt>{a}</dt><dd>{b}</dd></React.Fragment>)}
      </dl>
      <Sec t="Cofactor role">
        <p className="omino-ecard__note" style={{ margin: 0 }}>{v.cof}</p>
        {chips > 0 && <div className="omino-chiprow" style={{ marginTop: 8 }}>
          {v.cof2.mol.map((m) => <Pill key={m} c={KIND.cofactor.color} onClick={() => open("mol", m)}>{SPECIES[m].label}</Pill>)}
          {v.cof2.enz.map((e) => <Pill key={e} c="#38bdf8" onClick={() => open("enz", e)}>{e}</Pill>)}
          {v.cof2.el.map((e) => <Pill key={e} c="#ff9d5c" onClick={() => open("el", e)}>{elName(e)}</Pill>)}
        </div>}
      </Sec>
      {v.links.length > 0 && <Sec t="Linked in the atlas"><ul className="omino-ecard__list">{v.links.map(([n, l]) => <li key={n}><button className="omino-link" onClick={() => jump(n)}>{nm(n)}</button>{" · "}{l}</li>)}</ul></Sec>}
      {vs.length > 0 && <Sec t="Other vitamins"><ul className="omino-ecard__list">{vs.map(([a, b, l]) => { const o = a === id ? b : a; return <li key={o}><button className="omino-link" onClick={() => open("target", o)}>{nm(o)}</button>{" · "}{l}{a === id ? "" : " (it acts on this one)"}</li>; })}</ul></Sec>}
      <List t="Functions" a={v.fn} />
      <List t="Deficiency" a={v.def} />
      <List t="Excess" a={v.ex} />
      <List t="Not drawn in the atlas" a={v.more} />
      {v.relDrugs.length > 0 && <Sec t="Related drugs"><div className="omino-chiprow">{v.relDrugs.map((d) => <Pill key={d} c={RX_COLOR} onClick={() => open("drug", d)}>{nm(d)}</Pill>)}</div></Sec>}
    </>
  );
}
function TargetCard({ id, open, fit, shell }) {
  const t = NODE_BY[id], k = KIND[t.kind], rx = RX_EFFECTS.filter((e) => e.target === id), acts = RX_ACTS.filter((a) => a.target === id);
  return (
    <CardShell {...shell} c={k.color} sub={`${k.label} · ${t.formula}`} title={t.label} label={`${t.label} target card`}
      tags={<><span style={{ "--c": k.color }}>{k.label}</span><Pill c={RX_COLOR} onClick={() => open("path", "pharm")}>Pharmacology</Pill></>}>
      <p className="omino-ecard__note">{t.note}</p>
      {IG[id] && <>
        <div className="omino-ecard__art"><IgSketch n={IG[id].n} j={IG[id].j} /></div>
        <dl className="omino-ecard__facts">{IG[id].facts.map(([a, b]) => <React.Fragment key={a}><dt>{a}</dt><dd>{b}</dd></React.Fragment>)}</dl>
        <Sec t="Functions"><ul className="omino-ecard__list">{IG[id].fn.map((x) => <li key={x}>{x}</li>)}</ul></Sec>
        <Sec t="Clinical"><ul className="omino-ecard__list">{IG[id].clin.map((x) => <li key={x}>{x}</li>)}</ul></Sec>
      </>}
      {VIT[id] && <VitBlock id={id} open={open} fit={fit} />}
      {rx.length > 0 && <Sec t={rx.length > 1 ? "Drugs" : "Drug"}>
        <ul className="omino-ecard__list">{rx.map((e) => (
          <li key={e.drug}>
            <button className="omino-link" onClick={() => open("drug", e.drug)}>{nm(e.drug)}</button>{" · "}<span style={{ color: FX[e.fx].color, fontWeight: 600 }}>{FX[e.fx].verb === "substrate of" ? "is a substrate" : FX[e.fx].verb}</span>
            {e.detail && <div>{e.detail}</div>}
          </li>
        ))}</ul>
      </Sec>}
      {(acts.length > 0 || t.enz) && <Sec t="Acts on">
        <div className="omino-chiprow">
          {acts.map((a) => <Pill key={a.met} c={KIND.cofactor.color} onClick={() => (NODE_BY[a.met].mol ? open("mol", a.met) : fit([a.met]))}>{nm(a.met)}</Pill>)}
          {t.enz && <Pill onClick={() => open("enz", t.enz)}>{t.enz}</Pill>}
        </div>
      </Sec>}
      <Tags id={id} open={open} />
      <button className="omino-ecard__show" onClick={() => fit([id, ...rx.map((e) => e.drug), ...acts.map((a) => a.met), ...(VIT[id] ? VIT_NODES(id) : [])])}>Show in atlas</button>
    </CardShell>
  );
}
function Tags({ id, open }) {
  const l = LOC_OF[id], o = ORG_OF[id];
  return (
    <>
      {ONC[id] && <Sec t="Cell-cycle phase"><p className="omino-ecard__note" style={{ margin: 0 }}>{ONC[id][1]}</p></Sec>}
      {REN[id] && <Sec t="Nephron site"><p className="omino-ecard__note" style={{ margin: 0 }}>{REN[id][1]}</p></Sec>}
      {l?.length > 0 && <Sec t="Cellular location"><div className="omino-chiprow">{l.map((k) => <Pill key={k} c={LOCS[k].color} onClick={() => open("loc", k)}>{LOCS[k].label}</Pill>)}</div></Sec>}
      {o?.length > 0 && <Sec t="Organ systems"><div className="omino-chiprow">{o.map((k) => <Pill key={k} c={ORGANS[k].color} onClick={() => open("organ", "o_" + k)}>{ORGANS[k].label}</Pill>)}</div></Sec>}
      {LAB_OF[id]?.length > 0 && <Sec t="Reference values"><ul className="omino-ecard__list">{LAB_OF[id].map((k) => <li key={k}><b>{LABS[k][0]}</b>{" · "}{LABS[k][1]}{LABS[k][2] ? ` (${LABS[k][2]})` : ""}</li>)}</ul></Sec>}
    </>
  );
}
function LocCard({ id, open, fit, shell }) {
  const l = LOCS[id], mols = NODES.filter((n) => n.mol && hasLoc(n.id, id)), tg = NODES.filter((n) => n.rx === "target" && hasLoc(n.id, id));
  const ps = [...new Set(mols.map((n) => PATH_OF[n.id]).filter(Boolean))];
  return (
    <CardShell {...shell} c={l.color} sub="Cellular location" title={l.label} label={`${l.label} location card`}>
      <p className="omino-ecard__note">{l.desc}</p>
      <dl className="omino-ecard__facts"><dt>Molecules</dt><dd>{mols.length}</dd><dt>Drug targets</dt><dd>{tg.length}</dd></dl>
      {ps.length > 0 && <Sec t="Pathways here"><div className="omino-chiprow">{ps.map((p) => <Pill key={p} c={PATHWAYS[p].color} onClick={() => open("path", p)}>{PATHWAYS[p].label}</Pill>)}</div></Sec>}
      {mols.length > 0 && <Sec t="Molecules"><div className="omino-chiprow">{mols.map((n) => <Pill key={n.id} c={PATHWAYS[PATH_OF[n.id]]?.color} onClick={() => open("mol", n.id)}>{n.label}</Pill>)}</div></Sec>}
      {tg.length > 0 && <Sec t="Drug targets"><div className="omino-chiprow">{tg.map((n) => <Pill key={n.id} c={KIND[n.kind].color} onClick={() => open("target", n.id)}>{n.label}</Pill>)}</div></Sec>}
      <button className="omino-ecard__show" onClick={() => fit([...mols, ...tg].map((n) => n.id))}>Show in atlas</button>
    </CardShell>
  );
}
function OrganCard({ id, open, fit, shell }) {
  const code = id.slice(2), o = ORGANS[code], tg = NODES.filter((n) => n.rx === "target" && ORG_OF[n.id]?.includes(code)), dg = NODES.filter((n) => n.rx === "drug" && ORG_OF[n.id]?.includes(code));
  return (
    <CardShell {...shell} c={o.color} sub="Organ hub" title={o.label} label={`${o.label} organ hub card`}
      tags={<Pill c={RX_COLOR} onClick={() => open("path", "pharm")}>Pharmacology</Pill>}>
      <p className="omino-ecard__note">{o.desc}</p>
      <dl className="omino-ecard__facts"><dt>Targets</dt><dd>{tg.length}</dd><dt>Drug classes</dt><dd>{dg.length}</dd></dl>
      {tg.length > 0 && <Sec t="Targets"><div className="omino-chiprow">{tg.map((n) => <Pill key={n.id} c={KIND[n.kind].color} onClick={() => open("target", n.id)}>{n.label}</Pill>)}</div></Sec>}
      {dg.length > 0 && <Sec t="Drug classes"><div className="omino-chiprow">{dg.map((n) => <Pill key={n.id} c={RX_COLOR} onClick={() => open("drug", n.id)}>{n.label}</Pill>)}</div></Sec>}
      {code === "rn" && <Sec t="Along the nephron"><ul className="omino-ecard__list">{Object.entries(REN).sort((a, b) => a[1][0] - b[1][0]).map(([k, v]) => <li key={k}><button className="omino-link" onClick={() => open("target", k)}>{nm(k)}</button>{" · "}{v[1]}</li>)}</ul></Sec>}
      {code === "on" && <Sec t="Along the cell cycle"><ul className="omino-ecard__list">{Object.entries(ONC).sort((a, b) => a[1][0] - b[1][0]).map(([k, v]) => <li key={k}><button className="omino-link" onClick={() => open("target", k)}>{nm(k)}</button>{" · "}{v[1]}</li>)}</ul></Sec>}
      <Tags id={id} open={open} />
      <button className="omino-ecard__show" onClick={() => fit([...ORGAN_SET[code]])}>Show in atlas</button>
    </CardShell>
  );
}
function InfoCard({ cur, open, swap, fit, onBack, onClose }) {
  const shell = { onBack, onClose };
  if (cur.t === "drug") return <DrugCard key={cur.id} id={cur.id} open={open} fit={fit} shell={shell} />;
  if (cur.t === "target") return <TargetCard key={cur.id} id={cur.id} open={open} fit={fit} shell={shell} />;
  if (cur.t === "mol") return <MolCard key={cur.id} id={cur.id} open={open} fit={fit} shell={shell} />;
  if (cur.t === "loc") return <LocCard key={cur.id} id={cur.id} open={open} fit={fit} shell={shell} />;
  if (cur.t === "organ") return <OrganCard key={cur.id} id={cur.id} open={open} fit={fit} shell={shell} />;
  if (cur.t === "bond") return <BondCard kind={cur.id} open={open} shell={shell} />;
  if (cur.t === "enz") return <EnzCard label={cur.id} open={open} fit={fit} shell={shell} />;
  if (cur.t === "path") return <PathCard p={cur.id} open={open} shell={shell} />;
  const el = ELEMENTS.find((e) => e.sym === cur.id);
  return (
    <ElementCard el={el} onBack={onBack} onClose={onClose}
      onStep={(d) => { const e = ELEMENTS[ELEMENTS.indexOf(el) + d]; if (e) swap("el", e.sym); }}
      onShow={() => fit([EL_NODE[el.sym]])} />
  );
}

// Same breakpoints as OWORLD: >= 960px the search is a centered bar in the top bar; below that it is an icon that drops a full-width row.
function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);
  return vp;
}

// Search bar, built to behave exactly like OWORLD's universal search: pill field, clear button, a dropdown panel with "Search in" scope chips,
// This page = filter the atlas in place as you type; Everywhere / Elements / Pathways = list matches, tap one to jump to it.
const OT = { card: "#121212", border: "#27272A", ink: "#FFFFFF", muted: "#A1A1AA", sel: "#71717A", blue: "#38BDF8", blueLight: "#1F1F23" };
const SEARCH_FONT = "'Inter', Arial, 'Segoe UI', sans-serif";
const LucideSvg = ({ size, color, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{children}</svg>
);
const SearchGlyph = ({ size = 17, color, style }) => <LucideSvg size={size} color={color} style={style}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></LucideSvg>;
const XGlyph = ({ size = 16, color, style }) => <LucideSvg size={size} color={color} style={style}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></LucideSvg>;
const SCOPES = [["auto", "This page"], ["all", "Everywhere"], ["drugs", "Drugs & targets"], ["molecules", "Molecules"], ["elements", "Elements"], ["pathways", "Pathways"]];
const SEARCH_PH = { auto: "Search Everything", all: "Search Everything", drugs: "Search drugs, targets, vitamins, immunoglobulins…", molecules: "Search molecules, bonds, enzymes…", elements: "Search elements…", pathways: "Search pathways…" };
function AtlasSearch({ q, setQ, scope, setScope, res, on, matchLine, onClear, onEnter, onPick, sugg = [], pickMode = "both", setPickMode = () => {}, wide, autoFocus = false }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1); // highlighted suggestion (arrow keys)
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const inPlace = scope === "auto";
  const showSugg = sugg.length > 0 && (inPlace || !on);
  useEffect(() => setAct(-1), [q, scope]);
  const takeSugg = (t) => { setQ(t); setAct(-1); if (inputRef.current) inputRef.current.focus(); };
  const goSugg = (g) => { setQ(g.t); setAct(-1); setOpen(false); if (inputRef.current) inputRef.current.blur(); if (g.go) onPick(g.go.kind, g.go.r); }; // navigate to it and open its card
  useEffect(() => { if (autoFocus && inputRef.current) { inputRef.current.focus(); setOpen(true); } }, []); // eslint-disable-line
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { setOpen(false); if (inputRef.current) inputRef.current.blur(); } };
    document.addEventListener("mousedown", down); document.addEventListener("touchstart", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const total = res.groups.reduce((a, g) => a + g.items.length, 0);
  const grp = { fontFamily: SEARCH_FONT, fontWeight: 700, fontSize: 11, color: OT.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 4px" };
  const row = { width: "100%", textAlign: "left", display: "block", background: "transparent", border: "none", borderBottom: `1px solid ${OT.border}`, padding: "10px 4px", cursor: "pointer", fontFamily: SEARCH_FONT, color: OT.ink };
  const sub = { fontSize: 12, color: OT.muted, marginTop: 2, overflowWrap: "anywhere" };
  const pick = (fn) => () => { fn(); setOpen(false); };
  return (
    <div ref={boxRef} style={{ position: "relative", width: wide ? "clamp(300px, 34vw, 460px)" : "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 8px 0 16px", borderRadius: 999, background: OT.card, border: `1px solid ${open ? OT.sel : OT.border}`, boxSizing: "border-box" }}>
        <SearchGlyph size={17} color={OT.muted} style={{ flexShrink: 0 }} />
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} maxLength={80}
          onKeyDown={(e) => {
            if (showSugg && e.key === "ArrowDown") { e.preventDefault(); setAct((a) => (a + 1) % sugg.length); }
            else if (showSugg && e.key === "ArrowUp") { e.preventDefault(); setAct((a) => (a <= 0 ? sugg.length - 1 : a - 1)); }
            else if (e.key === "Enter") {
              const first = !inPlace && on ? res.groups.find((g) => g.items.length) : null;
              if (showSugg && act >= 0) { e.preventDefault(); goSugg(sugg[act]); }
              else if (first) { e.preventDefault(); pick(() => onPick(first.kind, first.items[0]))(); }
              else if (inPlace) onEnter();
            }
            else if (e.key === "Tab" && showSugg && !e.shiftKey && sugg[act >= 0 ? act : 0] && sugg[act >= 0 ? act : 0].t.toLowerCase() !== q.trim().toLowerCase()) { e.preventDefault(); takeSugg(sugg[act >= 0 ? act : 0].t); }
          }}
          placeholder={SEARCH_PH[scope]} aria-label="Search" role="combobox" aria-expanded={showSugg} aria-autocomplete="list" autoComplete="off" spellCheck={false}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: OT.ink, fontFamily: SEARCH_FONT, fontSize: 16 }} />
        {q && (
          <button onClick={() => { onClear(); if (inputRef.current) inputRef.current.focus(); }} title="Clear search" aria-label="Clear search"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: OT.muted, display: "flex", padding: 6, flexShrink: 0 }}><XGlyph size={16} /></button>
        )}
      </div>
      {open && (
        <div role="dialog" aria-label="Search" style={{ position: "absolute", top: 46, left: "50%", transform: "translateX(-50%)", width: wide ? "min(560px, 92vw)" : "100%", maxHeight: "70vh", overflowY: "auto", zIndex: 130, background: OT.card, border: `1px solid ${OT.border}`, borderRadius: 12, padding: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.35)", boxSizing: "border-box", fontFamily: SEARCH_FONT, color: OT.ink }}>
          <div role="group" aria-label="Search in" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
            <span style={{ fontFamily: SEARCH_FONT, fontSize: 12, color: OT.muted, marginRight: 2 }}>Search in</span>
            {SCOPES.map(([id, label]) => { const act = scope === id; return (
              <button key={id} aria-pressed={act} onClick={() => { setScope(id); if (inputRef.current) inputRef.current.focus(); }} style={{
                fontFamily: SEARCH_FONT, fontWeight: 600, fontSize: 12.5, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${act ? OT.sel : OT.border}`, background: act ? OT.blueLight : "transparent", color: act ? OT.blue : OT.ink,
              }}>{label}</button>
            ); })}
          </div>
          {(
            <div role="group" aria-label="On pick" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontFamily: SEARCH_FONT, fontSize: 12, color: OT.muted, marginRight: 2 }}>Show on</span>
              {[["both", "Canvas + card"], ["canvas", "Canvas"], ["card", "Card"]].map(([id, label]) => { const act2 = pickMode === id; return (
                <button key={id} aria-pressed={act2} onClick={() => setPickMode(id)} style={{
                  fontFamily: SEARCH_FONT, fontWeight: 600, fontSize: 12, padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${act2 ? OT.sel : OT.border}`, background: act2 ? OT.blueLight : "transparent", color: act2 ? OT.blue : OT.muted,
                }}>{label}</button>
              ); })}
            </div>
          )}
          {showSugg && (
            <div role="listbox" aria-label="Suggestions" style={{ marginTop: 10, borderTop: `1px solid ${OT.border}` }}>
              <div style={{ ...grp, margin: "10px 0 2px" }}>Suggestions</div>
              {sugg.map((g, i) => {
                const lo = g.t.toLowerCase(), at = lo.indexOf(q.trim().toLowerCase()), n = q.trim().length;
                return (
                  <button key={g.t + g.k} role="option" aria-selected={i === act} onMouseEnter={() => setAct(i)} onClick={() => goSugg(g)}
                    style={{ ...row, display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8, borderBottom: "none", background: i === act ? OT.blueLight : "transparent" }}>
                    <SearchGlyph size={14} color={OT.muted} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflowWrap: "anywhere" }}>
                      {at < 0 ? g.t : <>{g.t.slice(0, at)}<b>{g.t.slice(at, at + n)}</b>{g.t.slice(at + n)}</>}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: 11.5, color: OT.muted }}>{g.k}</span>
                  </button>
                );
              })}
            </div>
          )}
          {inPlace ? (
            <>
              <p style={{ fontFamily: SEARCH_FONT, fontSize: 12.5, color: OT.muted, lineHeight: 1.5, margin: "12px 4px 0", textAlign: "center" }}>{q.trim() ? "Filtering this page as you type. Press Enter, or pick a suggestion, to go to the item and open its card." : "Type to filter this page, or pick another scope to search elsewhere."}</p>
              {matchLine && <p style={{ fontFamily: SEARCH_FONT, fontSize: 12.5, color: OT.ink, lineHeight: 1.5, margin: "8px 4px 0", textAlign: "center" }}>{matchLine}</p>}
            </>
          ) : (
            <div>
              {!on && <p style={{ fontFamily: SEARCH_FONT, fontSize: 13, color: OT.muted, margin: "12px 2px 2px", textAlign: "center" }}>Type at least 2 letters to search.</p>}
              {on && total === 0 && <p style={{ fontFamily: SEARCH_FONT, fontSize: 13.5, color: OT.muted, margin: "14px 2px 2px" }}>{`No results for “${q.trim()}”.`}</p>}
              {res.groups.map((g) => g.items.length > 0 && (
                <React.Fragment key={g.key}>
                  <div style={grp}>{g.label}</div>
                  {g.items.map((r) => (
                    <button key={g.key + r.id} onClick={pick(() => onPick(g.kind, r))} style={row}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, overflowWrap: "anywhere" }}>{r.title}</div>
                      {r.sub && <div style={sub}>{r.sub}</div>}
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Atlas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [query, setQuery] = useState("");
  const [hideG, setHideG] = useState(false); // G: enzymes (edge labels)
  const [hideS, setHideS] = useState(false); // S: substrates / co-substrates
  const [focus, setFocus] = useState(null); // highlighted pathway
  const [scrollPans, setScrollPans] = useState(false); // scroll wheel / trackpad: zoom (default) or pan
  const { fitView, zoomIn, zoomOut, getViewport, setViewport } = useReactFlow();
  const [zoomLock, setZoomLock] = useState(false); // keeps the camera still while the location / organ / pathway chips are switched
  const lockTimer = useRef(null), lockFired = useRef(false);
  const chipFit = (opts) => { if (!zoomLock) fitView(opts); };
  const [ptOpen, setPtOpen] = useState(false); // periodic table panel
  const [stOpen, setStOpen] = useState(false); // settings panel
  const [showMini, setShowMini] = useState(true); // overview (minimap)
  const [showPaths, setShowPaths] = useState(true); // pathway chip bar
  const [showRx, setShowRx] = useState(true); // pharmacology layer (drugs, targets, effect lines)
  const [showKey, setShowKey] = useState(true); // legend for the pharmacology lines, toggled separately from the layer
  const [showLoc, setShowLoc] = useState(true); // cellular-location tags and filter chips
  const [showOrgans, setShowOrgans] = useState(true); // organ hubs (part of the pharmacology layer)
  const [locFocus, setLocFocus] = useState(null);
  const [organFocus, setOrganFocus] = useState(null);
  const chipWheel = (e) => { if (!e.deltaX) e.currentTarget.scrollLeft += e.deltaY; };
  const toggleLoc = () => {
    if (showLoc) { setLocFocus(null); setStack((s) => s.filter((x) => x.t !== "loc")); }
    setShowLoc((v) => !v);
  };
  const toggleOrgans = () => {
    if (showOrgans) { setOrganFocus(null); setStack((s) => s.filter((x) => x.t !== "organ")); }
    else setShowRx(true);
    setShowOrgans((v) => !v);
  };
  const toggleRx = () => {
    if (showRx) { setOrganFocus(null); if (focus === "pharm") setFocus(null); setStack((s) => s.filter((x) => x.t !== "drug" && x.t !== "target" && x.t !== "organ" && !(x.t === "path" && x.id === "pharm"))); }
    setShowRx((v) => !v);
  };
  const vp = useViewport();
  const wide = vp.w >= 960; // same breakpoint as OWORLD: search bar centered in the top bar
  const [searchOpen, setSearchOpen] = useState(false); // narrow screens: search drops down as its own row under the top bar
  const [pickMode, setPickMode] = useState("both"); // what picking a search result does: show it on the canvas, open its card, or both
  const [flash, setFlash] = useState([]); // nodes just summoned by search glow for a moment
  useEffect(() => { if (!flash.length) return undefined; const t = setTimeout(() => setFlash([]), 3200); return () => clearTimeout(t); }, [flash]);
  const [scope, setScope] = useState("auto"); // auto = this page (filter the atlas in place) | all | elements | pathways
  useEffect(() => {
    if (!stOpen) return;
    const away = (e) => { if (!e.target.closest(".omino-settings, [data-settings]")) setStOpen(false); };
    const esc = (e) => e.key === "Escape" && setStOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [stOpen]);
  const [elQ, setElQ] = useState("");
  const [stack, setStack] = useState([]); // explanation cards, newest last: { t: "el" | "mol" | "bond" | "enz" | "path", id }
  const cur = stack[stack.length - 1];
  const open = useCallback((t, id) => setStack((s) => (s.length && s[s.length - 1].t === t && s[s.length - 1].id === id ? s : [...s, { t, id }].slice(-30))), []);
  const swap = (t, id) => setStack((s) => [...s.slice(0, -1), { t, id }]);
  const fit = (ids) => fitView({ nodes: ids.map((id) => ({ id })), padding: 0.5, duration: 600, maxZoom: 1.2 });

  const sq = query.trim().toLowerCase();
  const q = scope === "auto" ? sq : ""; // only the "This page" scope filters the atlas in place
  const compounds = useMemo(() => nodes.filter((n) => !n.data.title), [nodes]);

  // Search matches names, formulas, notes and types, plus enzyme / cofactor labels on edges.
  const { matchIds, edgeHits } = useMemo(() => {
    if (!q) return { matchIds: null, edgeHits: null };
    const ids = new Set();
    const hits = new Set();
    for (const n of compounds) {
      const d = n.data;
      if ([d.label, d.formula, d.note, KIND[d.kind].label, PATHWAYS[d.path]?.label, tagText(d)].join(" ").toLowerCase().includes(q)) ids.add(n.id);
    }
    for (const e of edges) {
      if ((e.data.label || "").toLowerCase().includes(q)) {
        hits.add(e.id);
        ids.add(e.source);
        ids.add(e.target);
      }
    }
    return { matchIds: ids, edgeHits: hits };
  }, [compounds, edges, q]);

  const searchOn = sq.length >= 2 && scope !== "auto";
  const searchRes = useMemo(() => {
    if (!searchOn) return { groups: [] };
    const all = scope === "all", dr = all || scope === "drugs", mo = all || scope === "molecules";
    const has = (arr) => arr.join(" ").toLowerCase().includes(sq);
    const label = (id) => nodes.find((n) => n.id === id)?.data.label || id;
    const nodeText = (d) => [d.label, d.formula, d.note, KIND[d.kind].label, PATHWAYS[d.path]?.label, tagText(d)];
    // drugs also match on the targets they act on, and targets on the drugs that act on them
    const relText = (id) => RX_EFFECTS.filter((e) => e.drug === id || e.target === id).map((e) => label(e.drug === id ? e.target : e.drug));
    const sub = (n) => [n.data.formula, KIND[n.data.kind].label, PATHWAYS[n.data.path]?.label].filter(Boolean).join(" · ");
    const hit = (kind, lim) => compounds.filter((n) => n.data.rx === kind && has([...nodeText(n.data), ...relText(n.id)])).slice(0, lim).map((n) => ({ id: n.id, title: n.data.label, sub: sub(n), node: n }));
    const drugs = dr ? hit("drug", 12) : [];
    const tgts = dr ? hit("target", 12) : [];
    const orgs = dr ? hit("organ", 6) : [];
    const cmp = mo ? compounds.filter((n) => !n.data.rx && has(nodeText(n.data))).slice(0, 10).map((n) => ({ id: n.id, title: n.data.label, sub: sub(n), node: n })) : [];
    const spc = mo ? Object.values(SPECIES).filter((x) => has([x.label, x.formula, x.note, CARD_EXTRA[x.id]?.role])).slice(0, 6).map((x) => ({ id: x.id, title: x.label, sub: [x.formula, CARD_EXTRA[x.id]?.role].filter(Boolean).join(" · ") })) : [];
    const bnd = mo ? Object.entries(BONDS).filter(([, b]) => has([b.name, b.text])).slice(0, 5).map(([id, b]) => ({ id, title: b.name, sub: "Bond type" })) : [];
    const enz = mo ? edges.filter((e) => (e.data.label || "").toLowerCase().includes(sq)).slice(0, 8)
      .map((e) => ({ id: e.id, title: e.data.label, sub: `${label(e.source)} → ${label(e.target)}`, edge: e })) : [];
    const loc = all ? Object.entries(LOCS).filter(([, l]) => has([l.label, l.desc])).slice(0, 5).map(([id, l]) => ({ id, title: l.label, sub: "Cellular location" })) : [];
    const pth = (all || scope === "pathways") ? Object.entries(PATHWAYS).filter(([, p]) => p.label.toLowerCase().includes(sq)).slice(0, 6).map(([id, p]) => ({ id, title: p.label })) : [];
    const els = (all || scope === "elements") ? ELEMENTS.filter((e) => [e.sym, e.name, CATS[e.cat][0], ROLES[e.role][0], e.note, e.rx, e.tox].join(" ").toLowerCase().includes(sq)).slice(0, 8)
      .map((e) => ({ id: e.sym, title: `${e.name} (${e.sym})`, sub: `${CATS[e.cat][0]} · atomic number ${e.z}` })) : [];
    return { groups: [
      { key: "drug", kind: "drug", label: "Drugs", items: drugs }, { key: "tgt", kind: "target", label: "Targets, receptors and immunoglobulins", items: tgts },
      { key: "org", kind: "organ", label: "Organ hubs", items: orgs }, { key: "cmp", kind: "cmp", label: "Compounds", items: cmp },
      { key: "spc", kind: "sp", label: "Cofactors and energy carriers", items: spc }, { key: "enz", kind: "enz", label: "Enzymes", items: enz },
      { key: "bnd", kind: "bond", label: "Bond types", items: bnd }, { key: "loc", kind: "loc", label: "Cellular locations", items: loc },
      { key: "pth", kind: "pth", label: "Pathways", items: pth }, { key: "els", kind: "el", label: "Elements", items: els },
    ] };
  }, [searchOn, scope, sq, compounds, edges, nodes]); // eslint-disable-line
  // Suggestions while typing: names of everything searchable, prefix matches first, then word starts, then (from 2 letters) anywhere
  const suggIndex = useMemo(() => {
    const seen = new Set(), out = [];
    const add = (t, k, go) => { const key = (t || "").toLowerCase().trim(); if (key.length > 1 && !seen.has(key)) { seen.add(key); out.push({ t: t.trim(), k, lo: key, go }); } };
    compounds.forEach((n) => {
      const go = { kind: n.data.rx || "cmp", r: { id: n.id, title: n.data.label, node: n } };
      add(n.data.label, n.data.rx === "drug" ? "Drug" : n.data.rx === "target" ? "Target" : n.data.rx === "organ" ? "Organ" : KIND[n.data.kind].label, go);
      if (n.data.rx === "drug" && n.data.examples) n.data.examples.split(/,\s*/).forEach((x) => add(x.replace(/\s*\(.*?\)\s*/g, "").trim(), `Drug · ${n.data.label}`, go));
      if (n.data.rx === "target" && n.data.formula && !VIT[n.id]) n.data.formula.split(/,\s*/).forEach((x) => add(x, `Gene · ${n.data.label}`, go));
    });
    Object.values(SPECIES).forEach((x) => add(x.label, "Cofactor", { kind: "sp", r: { id: x.id, title: x.label } }));
    edges.forEach((e) => add(e.data.label, "Enzyme", { kind: "enz", r: { id: e.id, title: e.data.label, edge: e } }));
    Object.entries(PATHWAYS).forEach(([id, x]) => add(x.label, "Pathway", { kind: "pth", r: { id, title: x.label } }));
    ELEMENTS.forEach((e) => add(e.name, "Element", { kind: "el", r: { id: e.sym, title: e.name } }));
    Object.entries(BONDS).forEach(([id, b]) => add(b.name, "Bond type", { kind: "bond", r: { id, title: b.name } }));
    Object.entries(LOCS).forEach(([id, l]) => add(l.label, "Location", { kind: "loc", r: { id, title: l.label } }));
    return out;
  }, [compounds, edges]);
  const ranked = useMemo(() => {
    if (!sq) return [];
    const scored = [];
    for (const g of suggIndex) {
      const i = g.lo.indexOf(sq);
      if (i < 0 || (sq.length < 2 && i > 0 && !/[\s\-–(/]/.test(g.lo[i - 1]))) continue;
      scored.push([g.lo === sq ? -1 : i === 0 ? 0 : /[\s\-–(/]/.test(g.lo[i - 1]) ? 1 : 2, g.lo.length, g]);
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }, [suggIndex, sq]);
  const sugg = useMemo(() => ranked.filter((x) => x[0] >= 0).slice(0, 7).map((x) => x[2]), [ranked]); // already-typed-in-full names are not suggested again
  // the item Enter goes to: an exact name, else the first name that starts with (or has a word starting with) what was typed
  const topHit = ranked.length && ranked[0][0] <= 1 && sq.length >= 2 ? ranked[0][2] : null;
  const matchLine = matchIds ? (matchIds.size === 0
    ? "No matches. Try a name like “pyruvate”, a formula like “Mg”, or an enzyme like “kinase”."
    : `${matchIds.size} of ${compounds.length} nodes match. ${topHit ? `Press Enter to go to ${topHit.t}.` : "Press Enter to zoom to them."}`) : "";

  const shownNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        hidden: (hideS && n.data.kind === "cofactor") || (!showRx && !!n.data.pharm) || (!showOrgans && !!n.data.organ),
        data: {
          ...n.data,
          showLoc, showOrg: showOrgans,
          dim: (matchIds ? !matchIds.has(n.id) && !n.data.title : false) || (focus ? n.data.path !== focus && !(focus === "pharm" && RX_ANCHORS.has(n.id)) : false)
            || (locFocus ? !n.data.title && !hasLoc(n.id, locFocus) : false) || (organFocus ? !n.data.title && !ORGAN_SET[organFocus].has(n.id) : false),
          hit: (matchIds ? matchIds.has(n.id) : false) || flash.includes(n.id),
        },
      })),
    [nodes, matchIds, focus, hideS, showRx, showOrgans, showLoc, locFocus, organFocus, flash]
  );

  const shownEdges = useMemo(
    () =>
      edges.map((e) => {
        const faded =
          (matchIds && !edgeHits.has(e.id) && !(matchIds.has(e.source) && matchIds.has(e.target))) || (focus && e.data.path !== focus) || (locFocus && !(hasLoc(e.source, locFocus) && hasLoc(e.target, locFocus))) || (organFocus && !(ORGAN_SET[organFocus].has(e.source) && ORGAN_SET[organFocus].has(e.target)));
        const main = e.data.main;
        const color = PATHWAYS[e.data.path]?.color || "#f4f4f5";
        const stroke = main ? color : "#59626e";
        const fx = e.data.fx;
        if (fx) { // pharmacology lines: red dashed + flat head | green dashed | blue solid | grey dotted tether
          const fxc = fx === "tether" ? "#59626e" : fx === "organ" ? ORGANS[e.data.org].color : FX[fx].color;
          return {
            ...e,
            hidden: !showRx || (!!e.data.org && !showOrgans) || (!!e.data.cross && organFocus !== e.data.org),
            animated: false,
            markerEnd: fx === "tether" || fx === "organ" || fx === "inhibit" ? undefined : { type: MarkerType.ArrowClosed, color: fxc, width: 16, height: 16 },
            style: { stroke: fxc, strokeWidth: fx === "tether" || fx === "organ" ? 1.6 : 2.4, strokeDasharray: fx === "inhibit" || fx === "activate" ? "7 6" : fx === "tether" ? "2 5" : undefined, opacity: faded ? 0.12 : 1 },
            data: { ...e.data, faded, fxColor: fxc, hideLabel: false },
          };
        }
        return {
          ...e,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
          style: { stroke, strokeWidth: main ? 2.2 : 1.2, strokeDasharray: main ? undefined : "5 5", opacity: faded ? 0.12 : 1 },
          data: { ...e.data, faded, color, hideLabel: hideG },
        };
      }),
    [edges, matchIds, edgeHits, focus, hideG, showRx, showOrgans, locFocus, organFocus]
  );

  const focusMatches = useCallback(() => {
    if (!matchIds || matchIds.size === 0) return;
    fitView({ nodes: [...matchIds].map((id) => ({ id })), padding: 0.4, duration: 600, maxZoom: 1.3 });
  }, [matchIds, fitView]);

  const clear = () => {
    setQuery("");
    fitView({ padding: 0.15, duration: 600 });
  };

  // Selecting a pathway isolates it and flies the view to it; selecting it again returns to the full atlas.
  const selectPathway = (id) => {
    const next = focus === id ? null : id;
    setFocus(next);
    if (next) open("path", next);
    else setStack((s) => s.filter((x) => x.t !== "path"));
    if (next) {
      const ids = nodes.filter((n) => n.data.path === next).map((n) => ({ id: n.id }));
      chipFit({ nodes: ids, padding: 0.3, duration: 800, maxZoom: 1.1 });
    } else {
      chipFit({ padding: 0.15, duration: 800 });
    }
  };

  // Location and organ chips isolate one compartment / organ system the way pathway chips isolate a pathway.
  const selectLoc = (id) => {
    const next = locFocus === id ? null : id;
    setLocFocus(next);
    setStack((s) => s.filter((x) => x.t !== "loc"));
    if (next) { open("loc", next); chipFit({ nodes: nodes.filter((n) => hasLoc(n.id, next) && !n.hidden).map((n) => ({ id: n.id })), padding: 0.3, duration: 800, maxZoom: 1.1 }); }
    else chipFit({ padding: 0.15, duration: 800 });
  };
  const selectOrgan = (id) => {
    const next = organFocus === id ? null : id;
    setOrganFocus(next);
    setStack((s) => s.filter((x) => x.t !== "organ"));
    if (next) { open("organ", "o_" + next); chipFit({ nodes: [...ORGAN_SET[next]].map((n) => ({ id: n })), padding: 0.3, duration: 800, maxZoom: 1.1 }); }
    else chipFit({ padding: 0.15, duration: 800 });
  };

  // Picking a search result jumps to it, like OWORLD opens the matching page.
  // Make sure the target is on screen (layers switched back on, dimming filters cleared), fly the camera to it and make it glow.
  const summon = (ids) => {
    const ns = ids.map((id) => NODE_BY[id]).filter(Boolean);
    if (ns.some((n) => n.pharm) && !showRx) setShowRx(true);
    if (ns.some((n) => n.organ) && !showOrgans) setShowOrgans(true);
    if (ns.some((n) => n.kind === "cofactor") && hideS) setHideS(false);
    setFocus(null); setLocFocus(null); setOrganFocus(null);
    setFlash(ids);
    setTimeout(() => fit(ids), 90);
  };
  // Picking a result: on the canvas, as a card, or both (set in the search panel). Items with no place on the canvas, or no card, fall back to the other.
  const onSearchPick = (kind, r) => {
    const wantMap = pickMode !== "card", wantCard = pickMode !== "canvas";
    let ids = [], cardT = null, cardId = r.id;
    if (kind === "cmp") { ids = [r.id]; cardT = r.node.data.mol ? "mol" : r.node.data.rx || null; }
    else if (kind === "drug" || kind === "target" || kind === "organ") { ids = [r.id]; cardT = kind; }
    else if (kind === "enz") { ids = [r.edge.source, r.edge.target]; cardT = EDGES.some((e) => e.main && e.label === r.title) ? "enz" : null; cardId = r.title; }
    else if (kind === "el") { ids = EL_NODE[r.id] ? [EL_NODE[r.id]] : []; cardT = "el"; }
    else if (kind === "sp") cardT = "mol";
    else if (kind === "bond") cardT = "bond";
    else if (kind === "loc") { ids = nodes.filter((n) => hasLoc(n.id, r.id) && !n.data.title).map((n) => n.id); cardT = "loc"; }
    else if (kind === "pth") { ids = nodes.filter((n) => n.data.path === r.id).map((n) => n.id); cardT = "path"; }
    const hasMap = ids.length > 0, hasCard = !!cardT;
    const doMap = hasMap && (wantMap || !hasCard), doCard = hasCard && (wantCard || !hasMap);
    if (kind === "pth" && doMap) { // a pathway is shown by isolating it
      if (focus !== r.id) { setFocus(r.id); setLocFocus(null); setOrganFocus(null); if (r.id === "pharm" && !showRx) setShowRx(true); setTimeout(() => chipFit({ nodes: ids.map((id) => ({ id })), padding: 0.3, duration: 800, maxZoom: 1.1 }), 90); }
      else if (!doCard) fit(ids);
      if (doCard) open("path", r.id);
    } else if (kind === "loc" && doMap) {
      if (locFocus !== r.id) { setLocFocus(r.id); setFocus(null); setOrganFocus(null); setTimeout(() => chipFit({ nodes: ids.map((id) => ({ id })), padding: 0.3, duration: 800, maxZoom: 1.1 }), 90); }
      if (doCard) open("loc", r.id);
    } else {
      if (doMap) summon(ids);
      if (doCard) open(cardT, cardId);
    }
    setSearchOpen(false);
  };
  const searchProps = {
    q: query, setQ: setQuery, scope, setScope, res: searchRes, on: searchOn, matchLine,
    onClear: () => { setQuery(""); if (q) fitView({ padding: 0.15, duration: 600 }); },
    onEnter: () => { if (topHit) { setQuery(topHit.t); onSearchPick(topHit.go.kind, topHit.go.r); } else focusMatches(); setSearchOpen(false); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); },
    onPick: onSearchPick, sugg, pickMode, setPickMode,
  };

  // keep the active chip visible when a pathway is chosen from the canvas
  useEffect(() => {
    if (focus) document.querySelector(`.omino-chip[data-id="${focus}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [focus]);

  // Mouse buttons: left-drag pans (reactflow default); right-drag zooms about the press point (drag up = in, down = out).
  const startZoomDrag = (e) => {
    if (e.button !== 2 || e.target.closest(".react-flow__panel, .react-flow__minimap, .omino-ptable, .omino-ecard")) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const ax = e.clientX - r.left, ay = e.clientY - r.top, y0 = e.clientY, v = getViewport();
    const move = (m) => {
      const z = Math.min(4, Math.max(0.05, v.zoom * Math.exp((y0 - m.clientY) * 0.008))), k = z / v.zoom;
      setViewport({ x: ax - (ax - v.x) * k, y: ay - (ay - v.y) * k, zoom: z });
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const download = () => {
    const data = {
      nodes: compounds.map((n) => ({ id: n.id, name: n.data.label, formula: n.data.formula, pathway: n.data.path || null, locations: n.data.locs || null, organs: n.data.orgs || null, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, enzyme: e.data.fx ? null : e.data.label || null, effect: e.data.fx || null })),
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "omino-atlas.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <OpenCtx.Provider value={open}>
    <div className="omino-root">
      <style>{CSS}</style>
      <div className="omino-top">
        <header className={`omino-header ${wide ? "is-wide" : ""}`}>
          <button className="omino-wordmark" onClick={() => { setQuery(""); setFocus(null); setLocFocus(null); setOrganFocus(null); setStack([]); setSearchOpen(false); fitView({ padding: 0.15, duration: 600 }); }} aria-label="Home" title="Home">OMINO</button>
          {wide && <AtlasSearch {...searchProps} wide />}
          <div className="omino-hdr-right">
          {!wide && (
            <button className="omino-round omino-round--ghost" onClick={() => setSearchOpen((o) => !o)} aria-expanded={searchOpen} aria-label="Search" title="Search"><SearchGlyph size={15} /></button>
          )}
          <button className={`omino-round ${ptOpen ? "is-on" : ""}`} onClick={() => setPtOpen((v) => !v)} aria-pressed={ptOpen} aria-label="Periodic table" title="Periodic table">
            <Icon d={ICON.table} />{ptOpen && <i />}
          </button>
          <button data-settings className={`omino-round ${stOpen ? "is-on" : "is-sky"}`} onClick={() => setStOpen((v) => !v)} aria-pressed={stOpen} aria-expanded={stOpen} aria-label="Settings" title="Settings"><Icon d={ICON.settings} /></button>
          {stOpen && (
            <div className="omino-settings" role="dialog" aria-label="Settings">
              <h4>Settings</h4>
              {[
                ["Enzyme labels", "Names on the reaction arrows (G)", !hideG, () => setHideG((v) => !v)],
                ["Substrates", "Co-substrates beside each molecule (S)", !hideS, () => setHideS((v) => !v)],
                ["Pharmacology", "Drugs, their targets and effects", showRx, toggleRx],
                ["Pharmacology legend", "Key to the effect lines", showKey, () => setShowKey((v) => !v)],
                ["Cellular locations", "Compartment tags and a location filter", showLoc, toggleLoc],
                ["Organ hubs", "Renal, cardiovascular, respiratory, skeletal and more", showOrgans, toggleOrgans],
                ["Pathways", "Pathway chips along the bottom", showPaths, () => setShowPaths((v) => !v)],
                ["Overview", "Minimap in the corner", showMini, () => setShowMini((v) => !v)],
              ].map(([t, d, on, fn]) => (
                <div className="omino-settings__row" key={t}>
                  <div><b>{t}</b><span>{d}</span></div>
                  <button className={`omino-switch ${on ? "is-on" : ""}`} role="switch" aria-checked={on} aria-label={t} onClick={fn}><i /></button>
                </div>
              ))}
              {showKey && !wide && <div className="omino-settings__legend"><FxLegend /></div>}
              <div className="omino-settings__row">
                <div><b>Scroll wheel</b><span>What scrolling does on the canvas</span></div>
                <div className="omino-seg" role="group" aria-label="Scroll wheel">
                  <button className={!scrollPans ? "is-on" : ""} onClick={() => setScrollPans(false)}>Zoom</button>
                  <button className={scrollPans ? "is-on" : ""} onClick={() => setScrollPans(true)}>Pan</button>
                </div>
              </div>
              <button className="omino-settings__export" onClick={download}><Icon d={ICON.download} size={18} />Export atlas data (JSON)</button>
            </div>
          )}
        </div>
        </header>
        {!wide && searchOpen && (
          <div className="omino-searchrow"><AtlasSearch {...searchProps} autoFocus /></div>
        )}
      </div>


      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs>
        <marker id="omino-bar" viewBox="0 0 12 24" refX="9" refY="12" markerWidth="12" markerHeight="24" markerUnits="userSpaceOnUse" orient="auto"><path d="M6 2V22" stroke="#ff5d5d" strokeWidth="3" strokeLinecap="round" /></marker>
      </defs></svg>
      <div className="omino-canvas" onMouseDownCapture={startZoomDrag} onContextMenu={(e) => e.preventDefault()}>
        <ReactFlow
          nodes={shownNodes}
          edges={shownEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, n) => {
            if (n.data.title) selectPathway(n.data.path);
            else if (n.data.mol) open("mol", n.id);
            else if (n.data.rx) open(n.data.rx, n.id);
            else if (n.data.kind === "cofactor") { const t = cofTokens(n.data.label).find((x) => x.to); if (t) open(t.to[0], t.to[1]); }
            else if (n.data.glyph && ELEMENTS.some((e) => e.sym === n.data.glyph.symbol)) open("el", n.data.glyph.symbol);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodeOrigin={[0.5, 0.5]}
          connectionMode="loose"
          colorMode="dark"
          onInit={(inst) => {
            // Opening view: centred on the TCA ring at a readable zoom (the Fit button and Home still fit the whole map).
            const el = document.querySelector(".omino-canvas"), cw = el ? el.clientWidth : window.innerWidth, ch = el ? el.clientHeight : window.innerHeight;
            const zoom = Math.min(0.8, Math.max(0.3, Math.min(cw / 2300, ch / 1900)));
            inst.setViewport({ x: cw / 2 - RING.cx * zoom, y: ch / 2 - RING.cy * zoom, zoom });
          }}
          panOnScroll={scrollPans}
          zoomOnScroll={!scrollPans}
          minZoom={0.05}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.4} color="#1e1e22" />
          {showKey && wide && <Panel position="bottom-left"><FxLegend onHide={() => setShowKey(false)} /></Panel>}
          {showMini && <MiniMap pannable zoomable maskColor="rgba(10,10,10,0.75)" nodeColor={(n) => PATHWAYS[n.data.path]?.color || KIND[n.data.kind].color} nodeStrokeWidth={0} />}
          {showMini && <Panel position="bottom-right" className="omino-minix-panel"><button className="omino-fxlegend__x omino-minix" onClick={() => setShowMini(false)} aria-label="Hide overview" title="Hide overview (turn back on in Settings)">×</button></Panel>}

          <Panel position="top-left">
            <div className="omino-tools">
              <button className="omino-tool" onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in" title="Zoom in"><Icon d={ICON.zoomIn} /></button>
              <button
                className={`omino-tool ${zoomLock ? "is-locked" : ""}`} aria-pressed={zoomLock} aria-label={zoomLock ? "Zoom out (view locked)" : "Zoom out"}
                title={zoomLock ? "View locked: switching location, organ or pathway chips keeps the camera where it is. Hold, or Shift-click, to unlock" : "Zoom out. Hold, or Shift-click, to lock the view while switching location, organ or pathway chips"}
                onPointerDown={() => { lockFired.current = false; clearTimeout(lockTimer.current); lockTimer.current = setTimeout(() => { lockFired.current = true; setZoomLock((v) => !v); }, 500); }}
                onPointerUp={() => clearTimeout(lockTimer.current)} onPointerLeave={() => clearTimeout(lockTimer.current)} onPointerCancel={() => clearTimeout(lockTimer.current)}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => { if (lockFired.current) { lockFired.current = false; return; } if (e.shiftKey) { setZoomLock((v) => !v); return; } zoomOut({ duration: 200 }); }}>
                <Icon d={ICON.zoomOut} />{zoomLock && <i className="omino-tool__lock"><Icon d={ICON.lock} size={11} /></i>}
              </button>
              <button className={`omino-tool ${hideG ? "is-off" : ""}`} onClick={() => setHideG((v) => !v)} aria-pressed={hideG} aria-label="Toggle enzymes" title={hideG ? "Show enzymes" : "Hide enzymes"}>
                <Icon d={hideG ? ICON.eyeOff : ICON.eye} /><b>G</b>
              </button>
              <button className={`omino-tool ${hideS ? "is-off" : ""}`} onClick={() => setHideS((v) => !v)} aria-pressed={hideS} aria-label="Toggle substrates" title={hideS ? "Show substrates" : "Hide substrates"}>
                <Icon d={hideS ? ICON.eyeOff : ICON.eye} /><b>S</b>
              </button>
              <button className={`omino-tool ${!showRx ? "is-off" : ""}`} onClick={toggleRx} aria-pressed={!showRx} aria-label="Toggle pharmacology layer" title={showRx ? "Hide pharmacology layer" : "Show pharmacology layer"}>
                <Icon d={showRx ? ICON.eye : ICON.eyeOff} /><b>Rx</b>
              </button>
              <button className={`omino-tool ${!showKey ? "is-off" : ""}`} onClick={() => setShowKey((v) => !v)} aria-pressed={!showKey} aria-label="Toggle pharmacology legend" title={showKey ? "Hide pharmacology legend" : "Show pharmacology legend"}>
                <Icon d={showKey ? ICON.eye : ICON.eyeOff} /><b>L</b>
              </button>
              <button className={`omino-tool ${!showLoc ? "is-off" : ""}`} onClick={toggleLoc} aria-pressed={!showLoc} aria-label="Toggle cellular locations" title={showLoc ? "Hide cellular locations" : "Show cellular locations"}>
                <Icon d={showLoc ? ICON.eye : ICON.eyeOff} /><b>Loc</b>
              </button>
              <button className={`omino-tool ${!showOrgans ? "is-off" : ""}`} onClick={toggleOrgans} aria-pressed={!showOrgans} aria-label="Toggle organ hubs" title={showOrgans ? "Hide organ hubs" : "Show organ hubs"}>
                <Icon d={showOrgans ? ICON.eye : ICON.eyeOff} /><b>Org</b>
              </button>
              <button className="omino-tool" onClick={() => fitView({ padding: 0.15, duration: 600 })} aria-label="Fit to screen" title="Fit to screen"><Icon d={ICON.fit} /></button>
              <button className={`omino-tool ${scrollPans ? "is-off" : ""}`} onClick={() => setScrollPans((v) => !v)} aria-pressed={scrollPans} aria-label="Scroll behaviour" title={scrollPans ? "Scrolling pans (Ctrl/⌘ + scroll zooms). Click for scroll-to-zoom" : "Scrolling zooms. Click for scroll-to-pan"}>
                <Icon d={scrollPans ? ICON.pan : ICON.zoomIn} />
              </button>
            </div>
          </Panel>

          <Panel position="bottom-center"><div className="omino-chiprows">
            {showLoc && <div className="omino-chips nowheel nopan" onWheel={chipWheel}>
              {Object.entries(LOCS).map(([id, l]) => <button key={id} className={`omino-chip omino-chip--loc ${locFocus === id ? "is-on" : ""}`} style={{ "--c": l.color }} onClick={() => selectLoc(id)} aria-pressed={locFocus === id}><i />{l.label}</button>)}
            </div>}
            {showOrgans && showRx && <div className="omino-chips nowheel nopan" onWheel={chipWheel}>
              {Object.entries(ORGANS).map(([id, o]) => <button key={id} className={`omino-chip omino-chip--organ ${organFocus === id ? "is-on" : ""}`} style={{ "--c": o.color }} onClick={() => selectOrgan(id)} aria-pressed={organFocus === id}><i />{o.label}</button>)}
            </div>}
            {showPaths && <div className="omino-chips nowheel nopan" onWheel={chipWheel}>
              {Object.entries(PATHWAYS).filter(([id]) => id !== "pharm" || showRx).map(([id, p]) => (
                <button key={id} data-id={id} className={`omino-chip ${focus === id ? "is-on" : ""}`} style={{ "--c": p.color }} onClick={() => selectPathway(id)} aria-pressed={focus === id}>
                  <i />
                  {p.label}
                </button>
              ))}
            </div>}
          </div></Panel>
        </ReactFlow>
        {ptOpen && (
          <PeriodicTable q={elQ.trim().toLowerCase()} setQ={setElQ} sel={cur?.t === "el" ? cur.id : null} onPick={(e) => (cur?.t === "el" ? swap("el", e.sym) : open("el", e.sym))} onClose={() => setPtOpen(false)}
            width={cur ? "min(1120px, calc(100% - 440px))" : "min(1120px, calc(100% - 96px))"} />
        )}
        {cur && <InfoCard cur={cur} open={open} swap={swap} fit={fit} onBack={stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : null} onClose={() => setStack([])} />}
      </div>


    </div>
    </OpenCtx.Provider>
  );
}

export default function Omino() {
  return (
    <ReactFlowProvider>
      <Atlas />
    </ReactFlowProvider>
  );
}

/* ================================================================== */
/* 5. Styles                                                           */
/* ================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

.omino-root {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  background: #0a0a0a;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #f4f4f5;
}
.omino-root .react-flow { --xy-background-color: #0a0a0a; background: #0a0a0a; }

.omino-node {
  box-sizing: border-box;
  text-align: center;
  transition: opacity .2s, filter .2s;
  cursor: grab;
}
.omino-node:active { cursor: grabbing; }
.omino-node.is-selected { filter: drop-shadow(0 0 10px rgba(255,255,255,.35)); }
.omino-aac { width: fit-content; margin: 5px auto 0; padding: 1px 9px; font-size: 10px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); border-radius: 999px; }
.omino-node.is-hit { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)); }
.omino-node.is-dim { opacity: .16; }

.omino-node__art { display: flex; justify-content: center; align-items: center; margin: 0 0 8px; }
.omino-node__art svg, .omino-node__art img { display: block; max-width: 100%; max-height: 140px; width: auto; height: auto; }
.omino-node__name { font-size: 15px; font-weight: 400; line-height: 1.2; }
.omino-node__formula { margin-top: 3px; font-size: 12px; color: var(--accent); }
.omino-node__cofactor { font-size: 15px; font-weight: 500; color: var(--accent); white-space: nowrap; }

.omino-edge-label {
  position: absolute; pointer-events: none;
  width: max-content; max-width: 170px;
  padding: 2px 6px; text-align: center; line-height: 1.25;
  font-size: 11px; color: #8e8e99; background: #0a0a0a;
}
.omino-edge-label.is-main { font-size: 12px; color: #ff7b6e; text-decoration: underline; text-underline-offset: 3px; }

.omino-header {
  position: relative; z-index: 5; flex: none;
  display: grid; grid-template-columns: 1fr minmax(0, 720px) 1fr; align-items: center; gap: 16px;
  padding: 14px 32px; background: #0a0a0a; border-bottom: 1px solid #1b1b1f;
}
.omino-wordmark { font-size: 26px; font-weight: 700; letter-spacing: 0.01em; line-height: 1; }
.omino-search { position: relative; }
.omino-search > svg { position: absolute; left: 16px; top: 12px; color: #8e8e99; pointer-events: none; }
.omino-search input {
  width: 100%; box-sizing: border-box; height: 44px; padding: 0 18px 0 46px;
  font: inherit; font-size: 16px; color: #f4f4f5;
  background: #111113; border: 1px solid #26262b; border-radius: 999px; outline: none;
}
.omino-search input:focus-visible { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,.25); }
.omino-search input::placeholder { color: #6e6e78; }
.omino-search__meta {
  position: absolute; top: 52px; left: 0; right: 0; z-index: 6;
  display: flex; justify-content: space-between; gap: 10px; align-items: flex-start;
  padding: 8px 14px; font-size: 12px; line-height: 1.4; color: #9a9aa5;
  background: #111113; border: 1px solid #26262b; border-radius: 14px;
}
.omino-search__meta button {
  flex: none; font: inherit; font-size: 12px; color: #f4f4f5; cursor: pointer;
  background: transparent; border: 1px solid #34343a; border-radius: 6px; padding: 2px 8px;
}
.omino-search__meta button:hover { background: #1b1b1f; }
.omino-canvas { flex: 1; min-height: 0; position: relative; }

.omino-tools { display: flex; flex-direction: column; gap: 8px; }
.omino-tool {
  position: relative; width: 44px; height: 44px; display: grid; place-items: center; padding: 0;
  font: inherit; color: #f4f4f5; cursor: pointer;
  background: #111113; border: 1px solid #26262b; border-radius: 10px;
}
.omino-tool:hover { background: #1b1b1f; }
.omino-tool:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
.omino-tool.is-off { color: #38bdf8; border-color: #38bdf8; }
.omino-tool.is-locked { color: #38bdf8; border-color: #38bdf8; background: rgba(56,189,248,.08); }
.omino-tool__lock { position: absolute; right: 4px; bottom: 3px; display: flex; line-height: 0; }
.omino-tool b { position: absolute; right: 5px; bottom: 3px; font-size: 11px; font-weight: 600; }

.omino-chips {
  display: flex; flex-wrap: nowrap; gap: 8px; max-width: min(900px, 90vw); padding: 2px 16px 6px;
  overflow-x: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #26262b transparent;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent);
}
.omino-chip {
  flex: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px;
  font: inherit; font-size: 12px; color: #9a9aa5; cursor: pointer;
  background: #111113; border: 1px solid #26262b; border-radius: 999px;
}
.omino-chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.omino-chip:hover { background: #1b1b1f; }
.omino-chip.is-on { color: #f4f4f5; border-color: var(--c); }

.omino-pathtitle {
  font-size: 26px; font-weight: 600; text-align: center; line-height: 1.15;
  color: var(--c); cursor: pointer; transition: opacity .2s;
}
.omino-pathtitle:hover { text-decoration: underline; text-underline-offset: 6px; }
.omino-pathtitle.is-dim { opacity: .16; }

.react-flow__controls { box-shadow: none; border: 1px solid #26262b; border-radius: 8px; overflow: hidden; }
.react-flow__controls-button { background: #111113; border-bottom: 1px solid #26262b; fill: #f4f4f5; }
.react-flow__controls-button:hover { background: #1b1b1f; }
.react-flow__minimap { background: #111113; border: 1px solid #26262b; border-radius: 8px; }

.omino-ptable, .omino-ecard {
  position: absolute; z-index: 8; box-sizing: border-box; overflow: auto; max-height: calc(100% - 24px);
  background: #111113; border: 1px solid #26262b; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.5);
}
.omino-ptable { top: 12px; left: 76px; padding: 12px; }
.omino-ptable__bar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.omino-ptable__search { position: relative; flex: 1; }
.omino-ptable__search > svg { position: absolute; left: 12px; top: 10px; color: #8e8e99; pointer-events: none; }
.omino-ptable__search input {
  width: 100%; box-sizing: border-box; height: 38px; padding: 0 14px 0 38px; font: inherit; font-size: 14px; color: #f4f4f5;
  background: #0a0a0a; border: 1px solid #26262b; border-radius: 999px; outline: none;
}
.omino-ptable__search input:focus-visible { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,.25); }
.omino-tool--sm { width: 38px; height: 38px; flex: none; }
.omino-ptable__grid { display: grid; grid-template-columns: repeat(18, minmax(30px, 1fr)); grid-template-rows: repeat(7, clamp(40px, 6.4vh, 72px)) 12px clamp(40px, 6.4vh, 72px); gap: 4px; min-width: 600px; }
.omino-cell__rx { position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: #e879f9; }
.omino-cell--ph { align-items: center; justify-content: center; padding: 0; background: transparent; border: 1px dashed #26262b; color: #8e8e99; font: 10px var(--mono); pointer-events: none; }
.omino-ptable__flabel { align-self: center; justify-self: end; padding-right: 6px; font: 10.5px var(--mono); color: #8e8e99; }
.omino-ptable__rx { display: inline-flex; align-items: center; font: inherit; color: inherit; background: transparent; border: 1px solid #26262b; border-radius: 999px; padding: 2px 10px; cursor: pointer; }
.omino-ptable__rx:hover { background: #1b1b1f; }
.omino-ptable__rx.is-on { border-color: var(--c); color: #f4f4f5; }
.omino-ptable__rx:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
.omino-cell {
  position: relative; display: flex; align-items: flex-end; padding: 0 0 5px 5px; font: inherit; color: #f4f4f5; cursor: pointer;
  background: #0a0a0a; border: 1px solid #1b1b1f; border-bottom: 2px solid var(--c); border-radius: 6px; transition: opacity .15s, background .15s;
}
.omino-cell small { position: absolute; top: 3px; left: 5px; font-size: 9px; color: #8e8e99; }
.omino-cell b { font-size: 16px; font-weight: 600; line-height: 1; }
.omino-cell:hover { background: #1b1b1f; }
.omino-cell:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }
.omino-cell.is-sel { border-color: var(--c); box-shadow: 0 0 0 1px var(--c); }
.omino-cell.is-dim { opacity: .15; }
.omino-ptable__legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 11px; color: #9a9aa5; }
.omino-ptable__legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); margin-right: 6px; }

.omino-ecard { top: 12px; right: 12px; width: 320px; padding: 16px; }
.omino-ecard header { display: flex; justify-content: space-between; align-items: flex-start; }
.omino-ecard__name { font-size: 15px; color: #9a9aa5; }
.omino-ecard__sym { font-size: 52px; font-weight: 600; line-height: 1.05; color: var(--c); }
.omino-ecard__sym sup { margin-left: 4px; font-size: 14px; font-weight: 400; color: #f4f4f5; vertical-align: baseline; position: relative; top: -6px; }
.omino-ecard__mass { font-size: 13px; color: #f4f4f5; }
.omino-ecard__tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
.omino-ecard__tags span { padding: 3px 10px; font-size: 11px; color: var(--c); border: 1px solid var(--c); border-radius: 999px; }
.omino-ecard__bohr { display: flex; justify-content: center; margin: 6px 0; }
.omino-ecard__stats { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 6px; }
.omino-ecard__stats span { display: block; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--c); }
.omino-ecard__stats b { font-size: 28px; font-weight: 600; color: var(--c); }
.omino-ecard__facts { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 12px 0 0; font-size: 12px; }
.omino-ecard__facts dt { color: #8e8e99; }
.omino-ecard__facts dd { margin: 0; text-align: right; }
.omino-ecard__note { margin: 12px 0; font-size: 13px; line-height: 1.45; color: #d4d4d8; }
.omino-ecard__show {
  width: 100%; height: 36px; margin-bottom: 10px; font: inherit; font-size: 13px; color: #f4f4f5; cursor: pointer;
  background: transparent; border: 1px solid var(--c); border-radius: 10px;
}
.omino-ecard__show:hover { background: #1b1b1f; }
.omino-ecard footer { display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #1b1b1f; padding-top: 10px; }
.omino-ecard footer button { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; font: inherit; font-size: 12px; color: #9a9aa5; cursor: pointer; background: transparent; border: 0; border-radius: 6px; }
.omino-ecard footer button:hover:not(:disabled) { background: #1b1b1f; color: #f4f4f5; }

.omino-edge-label.is-link { pointer-events: auto; cursor: pointer; border-radius: 4px; }
.omino-edge-label.is-link:hover { background: #1b1b1f; }
.omino-bondhit line { stroke: transparent; cursor: pointer; pointer-events: stroke; }
.omino-bondhit line:hover { stroke: rgba(255,255,255,.28); }

.omino-ecard__btns { display: flex; gap: 6px; }
.omino-ecard__title { font-size: 24px; font-weight: 600; line-height: 1.15; color: var(--c); }
.omino-ecard__art { display: flex; justify-content: center; padding: 14px 0 6px; overflow: auto; }
.omino-ecard__art svg { display: block; max-width: 100%; height: auto; }
.omino-ecard__hint { text-align: center; font-size: 11px; color: #6e6e78; }
.omino-ecard__sec { margin-top: 14px; }
.omino-ecard__sec h4 { margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #8e8e99; }
.omino-chiprow { display: flex; flex-wrap: wrap; gap: 6px; }
.omino-pill { padding: 3px 10px; font: inherit; font-size: 12px; color: #f4f4f5; cursor: pointer; background: transparent; border: 1px solid var(--c); border-radius: 999px; }
.omino-pill:hover { background: #1b1b1f; }
.omino-ecard__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 12px; color: #9a9aa5; }
.omino-link { padding: 0; font: inherit; color: #f4f4f5; cursor: pointer; background: none; border: 0; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #34343a; }
.omino-link:hover { text-decoration-color: var(--c); }

.omino-cof { cursor: pointer; border-bottom: 1px dotted currentColor; border-radius: 2px; padding: 0 1px; }
.omino-cof:hover, .omino-cof:focus-visible { background: rgba(255,255,255,.14); outline: none; }
.omino-ecard__art.is-big { justify-content: flex-start; }
.omino-ecard__art.is-big svg { max-width: none; }
.omino-ecard__zoom { display: block; margin: 0 auto 4px; padding: 2px 10px; font: inherit; font-size: 11px; color: #8e8e99; cursor: pointer; background: none; border: 1px solid #26262b; border-radius: 999px; }
.omino-ecard__zoom:hover { color: #f4f4f5; background: #1b1b1f; }
.omino-ecard__rx { padding: 8px 10px; font-size: 12.5px; line-height: 1.45; color: #d4d4d8; background: #16161a; border: 1px solid #26262b; border-radius: 6px; }


/* ===== Oworld skin: shared with the sister app ===== */
.omino-root { --sky: #38bdf8; --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; -webkit-font-smoothing: antialiased; }
.omino-root * { scrollbar-width: thin; scrollbar-color: #2a2a30 transparent; }

.omino-header { padding: 16px 32px 14px; border-bottom: 0; }
.omino-wordmark { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.omino-search input { height: 46px; font-size: 15px; }
.omino-search > svg { top: 13px; }
.omino-search__meta { top: 54px; border-radius: 16px; font-family: var(--mono); font-size: 11.5px; }
.omino-header { z-index: 9; }
/* Pharmacology layer */
.omino-rx { box-sizing: border-box; text-align: center; padding: 9px 16px 11px; background: #101013; border: 1.5px solid var(--accent); transition: opacity .2s, filter .2s; cursor: pointer; }
.omino-rx--drug { border-radius: 22px; }
.omino-rx--drug.has-mol { padding-bottom: 12px; }
.omino-rx--drug .omino-rx__art svg { max-width: 100%; max-height: 140px; width: auto; height: auto; }
.omino-rx--hug { width: max-content; min-width: 150px; max-width: 240px; }
.omino-rx__art { display: flex; justify-content: center; margin: 8px 0 4px; }
.omino-rx__art svg { display: block; max-width: 100%; height: auto; }
.omino-rx__shown { margin-top: 5px; font-family: var(--mono); font-size: 10.5px; color: #8e8e99; }
.omino-rx--target { border-radius: 12px; border-style: solid; background: #0e0e11; }
.omino-rx.is-dim { opacity: .16; }
.omino-rx.is-hit { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)); }
.omino-rx.is-selected { filter: drop-shadow(0 0 10px rgba(255,255,255,.35)); }
.omino-rx__tag { display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.omino-rx__name { margin-top: 3px; font-size: 15px; font-weight: 600; line-height: 1.2; color: #f4f4f5; letter-spacing: -0.01em; }
.omino-rx__sub { margin-top: 3px; font-family: var(--mono); font-size: 11px; line-height: 1.25; color: #9a9aa5; }
.omino-edge-label.is-fx { font-family: 'Inter', system-ui, sans-serif; font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, #0a0a0a); }
.omino-fxlegend { display: grid; gap: 7px; padding: 10px 13px 11px; background: #111113; border: 1px solid #26262b; border-radius: 12px; font-size: 12px; color: #d4d4d8; }
.omino-fxlegend h5 { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 0 0 1px; font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #8e8e99; }
.omino-fxlegend__x { flex: none; width: 20px; height: 20px; margin: -3px -5px -3px 0; padding: 0; display: grid; place-items: center; font: inherit; font-size: 15px; line-height: 1; color: #8e8e99; background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
.omino-fxlegend__x:hover { color: #f4f4f5; background: #1b1b1f; }
.omino-fxlegend__x:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }
.omino-minix-panel { width: 200px; height: 150px; margin: 15px; pointer-events: none; }
.omino-minix { position: absolute; top: 5px; right: 5px; margin: 0; pointer-events: auto; z-index: 5; }
.omino-fxlegend div { display: flex; align-items: center; gap: 10px; }
.omino-fxlegend svg { flex: none; }
.omino-settings__legend { margin: 10px 0 4px; }
/* Top bar laid out like OWORLD's: logo | centered search | actions, 14px / 20px padding, 40px round buttons; below 960px the search is an icon that drops a full-width row */
.omino-top { flex: none; position: relative; z-index: 20; background: #0a0a0a; padding: 14px 20px 12px; }
.omino-top .omino-header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0; background: transparent; border: 0; z-index: auto; }
.omino-top .omino-header.is-wide { display: grid; grid-template-columns: 1fr auto 1fr; }
.omino-top .omino-header.is-wide .omino-wordmark { justify-self: start; }
.omino-top .omino-header.is-wide .omino-hdr-right { justify-self: end; }
.omino-top .omino-wordmark { background: transparent; border: 0; cursor: pointer; flex-shrink: 0; margin: 0; text-align: left; }
.omino-top .omino-wordmark:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; border-radius: 4px; }
.omino-top .omino-hdr-right { align-items: center; gap: 10px; }
.omino-top .omino-round { width: 40px; height: 40px; flex-shrink: 0; }
.omino-top .omino-settings { top: 48px; width: min(320px, calc(100vw - 40px)); max-height: calc(100dvh - 90px); overflow-y: auto; }
.omino-searchrow { margin-top: 12px; }
.omino-top .omino-round--ghost { background: transparent; border-color: #27272A; color: #FFFFFF; }
.omino-top .omino-round--ghost:hover { background: transparent; }
@media (max-width: 639px) { .omino-top .omino-hdr-right { gap: 8px; } }
/* OMINO wordmark = OWORLD logo: Inter 800, 22px (20px on phones), line-height 1.2, no tracking, 4px 2px box */
.omino-header .omino-wordmark { font-family: 'Inter', Arial, 'Segoe UI', sans-serif; font-size: 22px; font-weight: 800; line-height: 1.2; letter-spacing: 0; padding: 4px 2px; color: #f4f4f5; }
@media (max-width: 639px) { .omino-header .omino-wordmark { font-size: 20px; } }
/* Larger periodic table: bigger cells, type and search */
.omino-ptable .omino-cell b { font-size: clamp(16px, 2.4vh, 24px); }
.omino-ptable .omino-cell small { font-size: clamp(9px, 1.3vh, 12px); top: 4px; left: 6px; }
.omino-ptable .omino-ptable__search input { font-size: 15px; padding-top: 11px; padding-bottom: 11px; }
.omino-ptable .omino-ptable__legend { font-size: 12px; gap: 8px 18px; margin-top: 14px; }
/* Footnote (same text and type sizes as OWORLD's), tucked into the bottom of the periodic table panel */
.omino-foot { margin-top: 14px; padding-top: 12px; border-top: 1px solid #1f1f23; text-align: center; font-family: 'Inter', Arial, 'Segoe UI', sans-serif; }
.omino-foot p { margin: 0; font-size: 12px; color: #8e8e99; line-height: 1.7; }
.omino-foot__by strong { color: #f4f4f5; font-weight: 700; }
.omino-foot a { color: #D4D4D8; text-decoration: none; white-space: nowrap; }
.omino-foot a:hover { color: #f4f4f5; }
.omino-foot__support { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; }
.omino-foot__dot { margin: 0 8px; }
.omino-foot a:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; border-radius: 3px; }
.omino-hdr-right { position: relative; display: flex; justify-content: flex-end; gap: 12px; }
.omino-settings {
  position: absolute; top: 58px; right: 0; z-index: 20; width: 320px; box-sizing: border-box; padding: 20px;
  background: #111113; border: 1px solid #26262b; border-radius: 20px; box-shadow: 0 24px 64px rgba(0,0,0,.65);
}
.omino-settings h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #8e8e99; }
.omino-settings__row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid #1f1f23; }
.omino-settings__row b { display: block; font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: #f4f4f5; }
.omino-settings__row span { display: block; margin-top: 2px; font-family: var(--mono); font-size: 10.5px; line-height: 1.4; color: #8e8e99; }
.omino-switch { position: relative; flex: none; width: 42px; height: 24px; padding: 0; cursor: pointer; background: #26262b; border: 0; border-radius: 999px; transition: background .15s; }
.omino-switch i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #f4f4f5; border-radius: 50%; transition: transform .15s; }
.omino-switch.is-on { background: var(--sky); }
.omino-switch.is-on i { transform: translateX(18px); background: #04141c; }
.omino-switch:focus-visible, .omino-seg button:focus-visible, .omino-settings__export:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
.omino-seg { flex: none; display: flex; padding: 3px; background: #0a0a0a; border: 1px solid #26262b; border-radius: 999px; }
.omino-seg button { padding: 4px 12px; font: inherit; font-size: 12px; font-weight: 600; color: #9a9aa5; cursor: pointer; background: transparent; border: 0; border-radius: 999px; }
.omino-seg button.is-on { color: #04141c; background: var(--sky); }
.omino-settings__export {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 44px; margin-top: 16px;
  font: inherit; font-size: 14px; font-weight: 600; color: #f4f4f5; cursor: pointer; background: transparent; border: 1px solid #2c2c32; border-radius: 12px;
}
.omino-settings__export:hover { background: #1b1b1f; }
.omino-round {
  position: relative; width: 46px; height: 46px; display: grid; place-items: center; padding: 0;
  font: inherit; color: #f4f4f5; cursor: pointer; background: #111113; border: 1px solid #26262b; border-radius: 50%;
}
.omino-round:hover { background: #1b1b1f; }
.omino-round:focus-visible { outline: 2px solid var(--sky); outline-offset: 2px; }
.omino-round.is-sky { color: var(--sky); }
.omino-round.is-on { color: var(--sky); border-color: var(--sky); }
.omino-round i { position: absolute; top: 0; right: 0; width: 10px; height: 10px; background: #f5b14a; border: 2px solid #0a0a0a; border-radius: 50%; }

.omino-canvas .react-flow__panel.top { top: 4px; }
.omino-tool { border-radius: 14px; background: #111113; }
.omino-tool.is-off { color: var(--sky); border-color: var(--sky); background: rgba(56,189,248,.08); }
.omino-tool b { font-family: var(--mono); font-weight: 500; }
.react-flow__controls, .react-flow__minimap { border-radius: 12px; }

.omino-node__name { font-weight: 500; letter-spacing: -0.01em; }
.omino-node__formula { font-family: var(--mono); font-size: 11px; }
.omino-node__cofactor { font-weight: 600; letter-spacing: -0.01em; }
.omino-pathtitle { font-size: 30px; font-weight: 800; letter-spacing: -0.035em; }
.omino-edge-label { font-family: var(--mono); font-size: 10.5px; }
.omino-edge-label.is-main {
  font-family: 'Inter', system-ui, sans-serif; font-size: 12px; font-weight: 600; text-decoration: none;
  padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, #0a0a0a);
}
.omino-edge-label.is-link:hover { background: color-mix(in srgb, currentColor 26%, #0a0a0a); }

.omino-ptable, .omino-ecard { background: #111113; border: 1px solid #26262b; border-radius: 20px; box-shadow: 0 24px 64px rgba(0,0,0,.65); }
.omino-ptable { top: 16px; padding: 18px; }
.omino-ptable__search input { background: #0a0a0a; }
.omino-cell { background: #0a0a0a; border-color: #1f1f23; border-radius: 8px; }
.omino-cell small { font-family: var(--mono); }
.omino-cell b { font-weight: 700; letter-spacing: -0.02em; }
.omino-ptable__legend { font-family: var(--mono); font-size: 10.5px; }

.omino-ecard { top: 16px; right: 16px; width: 348px; padding: 22px; max-height: calc(100% - 32px); }
.omino-ecard__name { font-family: var(--mono); font-size: 12px; letter-spacing: .02em; color: #8e8e99; }
.omino-ecard__title { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; color: #f4f4f5; }
.omino-ecard__sym { font-weight: 800; letter-spacing: -0.04em; }
.omino-ecard__mass { font-family: var(--mono); font-size: 12px; }
.omino-ecard__tags { gap: 8px; margin: 14px 0 6px; }
.omino-ecard__tags span, .omino-ecard__tags .omino-pill {
  padding: 5px 10px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); border: 0; border-radius: 999px;
}
.omino-ecard__tags .omino-pill::before { display: none; }
.omino-ecard__tags .omino-pill:hover { background: color-mix(in srgb, var(--c) 28%, transparent); border: 0; }
.omino-ecard__stats span { font-family: var(--mono); }
.omino-ecard__stats b { font-weight: 700; letter-spacing: -0.03em; }
.omino-ecard__facts { font-family: var(--mono); font-size: 12px; }
.omino-ecard__note { margin: 16px 0 4px; font-size: 14px; line-height: 1.6; color: #a1a1ab; }
.omino-ecard__hint { font-family: var(--mono); font-size: 10.5px; }
.omino-ecard__sec { margin-top: 18px; padding-top: 16px; border-top: 1px solid #1f1f23; }
.omino-ecard__sec h4 { margin-bottom: 10px; font-size: 12px; font-weight: 600; letter-spacing: .12em; color: #8e8e99; }
.omino-ecard__list { font-family: var(--mono); font-size: 12px; line-height: 1.5; }
.omino-ecard__rx { font-family: var(--mono); font-size: 12px; background: #0a0a0a; border: 1px solid #26262b; border-radius: 12px; padding: 10px 12px; }
.omino-ecard__zoom { font-family: var(--mono); font-size: 10.5px; padding: 4px 12px; }
.omino-ecard__show {
  height: 46px; margin: 20px 0 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
  color: #04141c; background: var(--sky); border: 0; border-radius: 12px;
}
.omino-ecard__show:hover { background: #63cdfb; }
.omino-ecard footer { border-top-color: #1f1f23; }

.omino-pill {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 13px; font-weight: 500;
  color: #f4f4f5; background: transparent; border: 1px solid #2c2c32;
}
.omino-pill::before { content: ""; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.omino-pill:hover { background: #1b1b1f; border-color: color-mix(in srgb, var(--c) 70%, #2c2c32); }
.omino-link { text-decoration-color: #34343a; }

.omino-chiprows { display: flex; flex-direction: column; align-items: center; gap: 4px; max-width: 100%; }
.omino-chip--loc i { border-radius: 2px; }
.omino-chip--organ i { background: transparent; border: 2px solid var(--c); box-sizing: border-box; }
.omino-loc { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 7px; }
.omino-loc button { padding: 2px 8px; font: inherit; font-family: var(--mono); font-size: 10px; color: var(--l); cursor: pointer; background: color-mix(in srgb, var(--l) 14%, transparent); border: 0; border-radius: 999px; }
.omino-loc button:hover { background: color-mix(in srgb, var(--l) 28%, transparent); }
.omino-rx__seg { margin-top: 5px; font-family: var(--mono); font-size: 10px; line-height: 1.3; color: #8e8e99; }
.omino-orgs { display: flex; justify-content: center; gap: 4px; margin-top: 6px; }
.omino-orgs span { padding: 1px 7px; font-family: var(--mono); font-size: 10px; font-weight: 600; color: var(--o); border: 1px solid color-mix(in srgb, var(--o) 60%, transparent); border-radius: 6px; }
.omino-organ { box-sizing: border-box; text-align: center; padding: 16px 18px 18px; cursor: pointer; background: color-mix(in srgb, var(--accent) 10%, #0a0a0a); border: 2px solid var(--accent); border-radius: 28px; transition: opacity .2s, filter .2s; }
.omino-organ__code { width: 44px; height: 44px; margin: 0 auto 8px; display: grid; place-items: center; font-family: var(--mono); font-size: 15px; font-weight: 700; color: #04141c; background: var(--accent); border-radius: 50%; }
.omino-organ__name { font-size: 19px; font-weight: 700; letter-spacing: -0.02em; color: #f4f4f5; }
.omino-organ__sub { margin-top: 2px; font-family: var(--mono); font-size: 11px; color: #9a9aa5; }
.omino-organ.is-dim { opacity: .16; }
.omino-organ.is-hit { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)); }
.omino-organ.is-selected { filter: drop-shadow(0 0 10px rgba(255,255,255,.35)); }

@media (prefers-reduced-motion: reduce) {
  .omino-node { transition: none; }
  .react-flow__edge.animated path { animation: none; }
}
`;

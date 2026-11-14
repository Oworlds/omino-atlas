// omino.jsx (v1.1: Oworld look — Inter + mono, neutral black, sky accent, tab row, round header buttons; v1.0: + clickable co-substrates with structure cards: ATP/ADP/AMP/GTP/UTP, NAD(P)(H), FADH₂, CoA, H₂O, CO₂ …)  —  Omino, a spatial, searchable metabolic atlas
// Setup:  npm install reactflow            (v11.10 or newer, for colorMode)
// Usage:  import Omino from "./omino";  <Omino />
// The root fills the window (position: fixed). Change .omino-root if you embed it.

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
const EL_COLOR = { O: "#ff7a7a", N: "#7fb0ff", P: "#ffb454", S: "#f2d95c", X: "#c7a8ff", M: "#ff9d5c" };

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
  if (order === 1) return [[x1, y1, x2, y2]];
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
          bondLines(byId[a], byId[b], order, side).map((l, j) => (
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
  ["amino", -1000, 4550], ["lipid", 950, 2600],
  ["ala", 1000, 7000], ["heme", 1500, 10050], ["bili", -1000, 12300]].forEach(([p, x, y]) => {
  NODES.push({ id: "t_" + p, kind: "pathway", title: true, label: PATHWAYS[p].label, formula: "", note: "", path: p });
  layout["t_" + p] = [x, y];
});

const sizeOf = (n) => {
  if (n.title) return { w: 320 };
  if (n.kind === "cofactor") return { w: 130 };
  if (DRAWINGS[n.id]) return { w: DRAWINGS[n.id].w || 180 };
  if (n.mol) {
    const m = MOLS[n.mol];
    return { w: Math.max(100, bounds(m).w * (m.scale || 1)) };
  }
  return { w: 90 };
};

const initialNodes = NODES.map((n) => ({
  id: n.id,
  type: n.title ? "pathway" : "compound",
  draggable: !n.title,
  selectable: !n.title,
  position: { x: layout[n.id][0], y: layout[n.id][1] },
  data: { ...n, w: sizeOf(n).w, path: PATH_OF[n.id] || n.path },
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
  data: { main: !!e.main, label: e.label, path: PATH_OF[e.target] || PATH_OF[e.source] },
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
      <div className={cls} style={{ "--accent": k.color, width: data.w }} title={toks.some((t) => t.to) ? "Click a name to see what it is and its structure" : data.note}>
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
    <div className={cls} style={{ "--accent": k.color, width: data.w }} title={data.note}>
      {handles}
      <div className="omino-node__art">
        {drawing ? <img src={drawing.src} alt={data.label} draggable={false} /> : data.mol ? <Skeletal mol={MOLS[data.mol]} /> : <AtomTile glyph={data.glyph} color={k.color} />}
      </div>
      <div className="omino-node__name">{data.label}</div>
      {data.kind !== "molecule" && <div className="omino-node__formula">{data.formula}</div>}
    </div>
  );
}

function OminoEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }) {
  const open = React.useContext(OpenCtx);
  const args = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path, lx, ly] = data.main ? getSmoothStepPath({ ...args, borderRadius: 12 }) : getBezierPath(args);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {data.label && !data.hideLabel && <EdgeLabelRenderer>
        <div
          className={`omino-edge-label nodrag nopan ${data.main ? "is-main is-link" : ""}`}
          onClick={() => data.main && open("enz", data.label)}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, opacity: data.faded ? 0.15 : 1, color: data.main ? data.color : undefined }}
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

const nodeTypes = { compound: CompoundNode, pathway: PathwayNode };
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
};
const ROLES = { bulk: ["Bulk element", "#6fe0b4"], major: ["Major mineral", "#6fa8ff"], trace: ["Trace element", "#ffb454"], toxic: ["Toxic", "#ff5d6c"] };
// [symbol, name, Z, mass, group, period, category, electrons per shell, neutrons (commonest isotope), role, note]
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
].map(([sym, name, z, mass, g, p, cat, shells, n, role, note]) => ({ sym, name, z, mass, g, p, cat, shells, n, role, note }));
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

function PeriodicTable({ q, setQ, sel, onPick, onClose, width }) {
  const hit = (e) => !q || [e.sym, e.name, e.z, CATS[e.cat][0], ROLES[e.role][0], e.note].join(" ").toLowerCase().includes(q);
  return (
    <section className="omino-ptable" style={{ width }} aria-label="Periodic table">
      <div className="omino-ptable__bar">
        <div className="omino-ptable__search">
          <Icon d={ICON.search} size={18} />
          <input
            type="search" value={q} placeholder="Search elements, roles, enzymes" aria-label="Search elements" autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { const f = ELEMENTS.find(hit); if (f) onPick(f); } }}
          />
        </div>
        <button className="omino-tool omino-tool--sm" onClick={onClose} aria-label="Close periodic table" title="Close"><Icon d={ICON.close} size={18} /></button>
      </div>
      <div className="omino-ptable__grid">
        {ELEMENTS.map((e) => (
          <button key={e.sym} className={`omino-cell ${sel === e.sym ? "is-sel" : ""} ${hit(e) ? "" : "is-dim"}`}
            style={{ gridColumn: e.g, gridRow: e.p, "--c": CATS[e.cat][1] }} onClick={() => onPick(e)} title={`${e.name} (${e.z})`} aria-label={`${e.name}, atomic number ${e.z}`}>
            <small>{e.z}</small><b>{e.sym}</b>
          </button>
        ))}
      </div>
      <div className="omino-ptable__legend">
        {Object.values(CATS).map(([l, c]) => <span key={l} style={{ "--c": c }}><i />{l}</span>)}
      </div>
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
        <dt>Group · period</dt><dd>{el.g} · {el.p}</dd>
      </dl>
      <p className="omino-ecard__note">{el.note}</p>
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
};
function classify(mol) {
  const by = Object.fromEntries(mol.atoms.map((a) => [a.id, a]));
  const el = (a) => (a.text ? (a.el === "X" ? "R" : a.el) : "C");
  const nb = {};
  mol.bonds.forEach(([a, b]) => { (nb[a] ||= []).push(b); (nb[b] ||= []).push(a); });
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
    if (k === "CS") return "cs";
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
  lipid: "Stores fatty acids as triacylglycerol on glycerol 3-phosphate, builds fatty acids from malonyl-CoA and breaks them down by β-oxidation.",
  ala: "Succinyl-CoA and glycine condense to 5-aminolevulinate in the mitochondrion. ALA synthase is the rate-limiting step of heme synthesis.",
  heme: "Eight enzymes, split between mitochondria and cytosol, build the porphyrin ring and insert iron. Genetic defects cause the porphyrias; lead inhibits two steps.",
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
  const [labels, orders] = BONDS[k].g, E = { C: "C", O: "O", N: "N", S: "S", P: "P", Fe: "M", R: "X", H: "H" };
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
      tags={<><span style={{ "--c": isCof ? KIND.cofactor.color : CHALK }}>{isCof ? "Cofactor" : "Molecule"}</span>{x.role && <span style={{ "--c": accent }}>{x.role}</span>}{pc && <Pill c={pc.color} onClick={() => open("path", p)}>{pc.label}</Pill>}</>}>
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
      {where.length > 0 && <Sec t="Where it appears in the atlas"><div className="omino-chiprow">{where.slice(0, 14).map((w) => <Pill key={w.id} onClick={() => fit([w.id])}>{w.text}</Pill>)}</div></Sec>}
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
      <button className="omino-ecard__show" onClick={() => fit(es.flatMap((e) => [e.source, e.target]))}>Show in atlas</button>
    </CardShell>
  );
}
function PathCard({ p, open, shell }) {
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
function InfoCard({ cur, open, swap, fit, onBack, onClose }) {
  const shell = { onBack, onClose };
  if (cur.t === "mol") return <MolCard key={cur.id} id={cur.id} open={open} fit={fit} shell={shell} />;
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

function Atlas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [query, setQuery] = useState("");
  const [hideG, setHideG] = useState(false); // G: enzymes (edge labels)
  const [hideS, setHideS] = useState(false); // S: substrates / co-substrates
  const [focus, setFocus] = useState(null); // highlighted pathway
  const [scrollPans, setScrollPans] = useState(false); // scroll wheel / trackpad: zoom (default) or pan
  const { fitView, zoomIn, zoomOut, getViewport, setViewport } = useReactFlow();
  const [ptOpen, setPtOpen] = useState(false); // periodic table panel
  const [stOpen, setStOpen] = useState(false); // settings panel
  const [showMini, setShowMini] = useState(true); // minimap
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

  const q = query.trim().toLowerCase();
  const compounds = useMemo(() => nodes.filter((n) => !n.data.title), [nodes]);

  // Search matches names, formulas, notes and types, plus enzyme / cofactor labels on edges.
  const { matchIds, edgeHits } = useMemo(() => {
    if (!q) return { matchIds: null, edgeHits: null };
    const ids = new Set();
    const hits = new Set();
    for (const n of compounds) {
      const d = n.data;
      if ([d.label, d.formula, d.note, KIND[d.kind].label, PATHWAYS[d.path]?.label].join(" ").toLowerCase().includes(q)) ids.add(n.id);
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

  const shownNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        hidden: hideS && n.data.kind === "cofactor",
        data: {
          ...n.data,
          dim: (matchIds ? !matchIds.has(n.id) && !n.data.title : false) || (focus ? n.data.path !== focus : false),
          hit: matchIds ? matchIds.has(n.id) : false,
        },
      })),
    [nodes, matchIds, focus, hideS]
  );

  const shownEdges = useMemo(
    () =>
      edges.map((e) => {
        const faded =
          (matchIds && !edgeHits.has(e.id) && !(matchIds.has(e.source) && matchIds.has(e.target))) || (focus && e.data.path !== focus);
        const main = e.data.main;
        const color = PATHWAYS[e.data.path]?.color || "#f4f4f5";
        const stroke = main ? color : "#59626e";
        return {
          ...e,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
          style: { stroke, strokeWidth: main ? 2.2 : 1.2, strokeDasharray: main ? undefined : "5 5", opacity: faded ? 0.12 : 1 },
          data: { ...e.data, faded, color, hideLabel: hideG },
        };
      }),
    [edges, matchIds, edgeHits, focus, hideG]
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
      fitView({ nodes: ids, padding: 0.3, duration: 800, maxZoom: 1.1 });
    } else {
      fitView({ padding: 0.15, duration: 800 });
    }
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
      nodes: compounds.map((n) => ({ id: n.id, name: n.data.label, formula: n.data.formula, pathway: n.data.path || null, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, enzyme: e.data.label || null })),
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
      <header className="omino-header">
        <div className="omino-wordmark">OMINO</div>
        <div className="omino-search">
          <Icon d={ICON.search} />
          <input
            type="search"
            value={query}
            placeholder="Search Everything"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && focusMatches()}
            aria-label="Search Omino"
          />
          {q && (
            <div className="omino-search__meta">
              <span>
                {matchIds.size === 0
                  ? "No matches. Try a name like “pyruvate”, a formula like “Mg”, or an enzyme like “kinase”."
                  : `${matchIds.size} of ${compounds.length} nodes match. Press Enter to zoom to them.`}
              </span>
              <button onClick={clear}>Clear</button>
            </div>
          )}
        </div>
        <div className="omino-hdr-right">
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
                ["Minimap", "Overview in the corner", showMini, () => setShowMini((v) => !v)],
              ].map(([t, d, on, fn]) => (
                <div className="omino-settings__row" key={t}>
                  <div><b>{t}</b><span>{d}</span></div>
                  <button className={`omino-switch ${on ? "is-on" : ""}`} role="switch" aria-checked={on} aria-label={t} onClick={fn}><i /></button>
                </div>
              ))}
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


      <div className="omino-canvas" onMouseDownCapture={startZoomDrag} onContextMenu={(e) => e.preventDefault()}>
        <ReactFlow
          nodes={shownNodes}
          edges={shownEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, n) => {
            if (n.data.title) selectPathway(n.data.path);
            else if (n.data.mol) open("mol", n.id);
            else if (n.data.kind === "cofactor") { const t = cofTokens(n.data.label).find((x) => x.to); if (t) open(t.to[0], t.to[1]); }
            else if (n.data.glyph && ELEMENTS.some((e) => e.sym === n.data.glyph.symbol)) open("el", n.data.glyph.symbol);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodeOrigin={[0.5, 0.5]}
          connectionMode="loose"
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.15 }}
          panOnScroll={scrollPans}
          zoomOnScroll={!scrollPans}
          minZoom={0.05}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.4} color="#1e1e22" />
          {showMini && <MiniMap pannable zoomable maskColor="rgba(10,10,10,0.75)" nodeColor={(n) => PATHWAYS[n.data.path]?.color || KIND[n.data.kind].color} nodeStrokeWidth={0} />}

          <Panel position="top-left">
            <div className="omino-tools">
              <button className="omino-tool" onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in" title="Zoom in"><Icon d={ICON.zoomIn} /></button>
              <button className="omino-tool" onClick={() => zoomOut({ duration: 200 })} aria-label="Zoom out" title="Zoom out"><Icon d={ICON.zoomOut} /></button>
              <button className={`omino-tool ${hideG ? "is-off" : ""}`} onClick={() => setHideG((v) => !v)} aria-pressed={hideG} aria-label="Toggle enzymes" title={hideG ? "Show enzymes" : "Hide enzymes"}>
                <Icon d={hideG ? ICON.eyeOff : ICON.eye} /><b>G</b>
              </button>
              <button className={`omino-tool ${hideS ? "is-off" : ""}`} onClick={() => setHideS((v) => !v)} aria-pressed={hideS} aria-label="Toggle substrates" title={hideS ? "Show substrates" : "Hide substrates"}>
                <Icon d={hideS ? ICON.eyeOff : ICON.eye} /><b>S</b>
              </button>
              <button className="omino-tool" onClick={() => fitView({ padding: 0.15, duration: 600 })} aria-label="Fit to screen" title="Fit to screen"><Icon d={ICON.fit} /></button>
              <button className={`omino-tool ${scrollPans ? "is-off" : ""}`} onClick={() => setScrollPans((v) => !v)} aria-pressed={scrollPans} aria-label="Scroll behaviour" title={scrollPans ? "Scrolling pans (Ctrl/⌘ + scroll zooms). Click for scroll-to-zoom" : "Scrolling zooms. Click for scroll-to-pan"}>
                <Icon d={scrollPans ? ICON.pan : ICON.zoomIn} />
              </button>
            </div>
          </Panel>

          <Panel position="bottom-center">
            <div className="omino-chips nowheel nopan" onWheel={(e) => { if (!e.deltaX) e.currentTarget.scrollLeft += e.deltaY; }}>
              {Object.entries(PATHWAYS).map(([id, p]) => (
                <button key={id} data-id={id} className={`omino-chip ${focus === id ? "is-on" : ""}`} style={{ "--c": p.color }} onClick={() => selectPathway(id)} aria-pressed={focus === id}>
                  <i />
                  {p.label}
                </button>
              ))}
            </div>
          </Panel>
        </ReactFlow>
        {ptOpen && (
          <PeriodicTable q={elQ.trim().toLowerCase()} setQ={setElQ} sel={cur?.t === "el" ? cur.id : null} onPick={(e) => (cur?.t === "el" ? swap("el", e.sym) : open("el", e.sym))} onClose={() => setPtOpen(false)}
            width={cur ? "min(720px, calc(100% - 440px))" : "min(720px, calc(100% - 96px))"} />
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
.omino-node.is-hit { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--accent) 70%, transparent)); }
.omino-node.is-dim { opacity: .16; }

.omino-node__art { display: flex; justify-content: center; align-items: center; margin: 0 0 8px; }
.omino-node__art svg, .omino-node__art img { display: block; max-width: 100%; height: auto; }
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
.omino-ptable__grid { display: grid; grid-template-columns: repeat(18, minmax(30px, 1fr)); grid-template-rows: repeat(6, 46px); gap: 3px; min-width: 600px; }
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

@media (prefers-reduced-motion: reduce) {
  .omino-node { transition: none; }
  .react-flow__edge.animated path { animation: none; }
}
`;

export type ProgramCode = "V5RC" | "VIQRC" | "VURC" | "VAIRC";

export type GradeLevel =
  | "Elementary School"
  | "Middle School"
  | "High School"
  | "College";

export type ProgramDef = {
  code: ProgramCode;
  id: number;
  label: string;
  grades: GradeLevel[];
};

export const PROGRAMS: ProgramDef[] = [
  {
    code: "V5RC",
    id: 1,
    label: "VEX V5 Robotics Competition",
    grades: ["Middle School", "High School"],
  },
  {
    code: "VIQRC",
    id: 41,
    label: "VEX IQ Robotics Competition",
    grades: ["Elementary School", "Middle School"],
  },
  {
    code: "VURC",
    id: 4,
    label: "VEX U Robotics Competition",
    grades: ["College"],
  },
  {
    code: "VAIRC",
    id: 57,
    label: "VEX AI Robotics Competition",
    grades: ["High School", "College"],
  },
];

export function findProgram(code: string): ProgramDef | undefined {
  return PROGRAMS.find((p) => p.code === code.toUpperCase());
}

export function defaultGradeFor(code: ProgramCode): GradeLevel {
  return findProgram(code)?.grades[0] ?? "High School";
}

// Short label used in the combined Program + Grade dropdown.
// Examples: "VIQRC ES", "V5RC MS", "V5RC HS", "VURC", "VAIRC HS".
export function shortGrade(grade: GradeLevel): string {
  switch (grade) {
    case "Elementary School":
      return "ES";
    case "Middle School":
      return "MS";
    case "High School":
      return "HS";
    case "College":
      return "U";
  }
}

export type DivisionOption = {
  key: string; // e.g. "V5RC:Middle School"
  program: ProgramCode;
  grade: GradeLevel;
  label: string; // e.g. "V5RC MS"
  fullLabel: string; // e.g. "V5RC — Middle School"
};

const GRADE_ORDER: Record<GradeLevel, number> = {
  "Elementary School": 0,
  "Middle School": 1,
  "High School": 2,
  College: 3,
};

const PROGRAM_ORDER: Record<ProgramCode, number> = {
  VIQRC: 0,
  V5RC: 1,
  VURC: 2,
  VAIRC: 3,
};

export const DIVISION_OPTIONS: DivisionOption[] = PROGRAMS.flatMap((p) =>
  p.grades.map<DivisionOption>((g) => ({
    key: `${p.code}:${g}`,
    program: p.code,
    grade: g,
    label: p.code === "VURC" ? p.code : `${p.code} ${shortGrade(g)}`,
    fullLabel: `${p.code} — ${g}`,
  })),
).sort((a, b) => {
  const gradeDiff = GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade];
  if (gradeDiff !== 0) return gradeDiff;
  return PROGRAM_ORDER[a.program] - PROGRAM_ORDER[b.program];
});

export function findDivision(
  program: string,
  grade: string,
): DivisionOption | undefined {
  const key = `${program.toUpperCase()}:${grade}`;
  return DIVISION_OPTIONS.find((d) => d.key === key);
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-to-infrastructure",
      comment: "C2/C3: Domain layer must not depend on infrastructure.",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { path: "^src/infrastructure/" },
    },
    {
      name: "domain-to-external",
      comment: "C2: Domain must not depend on external SDKs/APIs directly.",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { path: "^(node_modules/|.*externa)" },
    },
    {
      name: "cross-feature-dependency",
      comment: "C4: Features must not depend on each other directly.",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/([^/]+)/",
        pathNot: "^src/features/$1/",
      },
    },
    {
      name: "service-to-controller",
      comment: "C3: Inner layers (services) must not depend on outer layers (controllers).",
      severity: "error",
      from: { path: "^src/(domain|services|use-cases)/" },
      to: { path: "^src/(controllers|routes|http|cli|cmd)/" },
    },
    {
      name: "no-circular",
      comment: "C4: Circular dependencies are forbidden.",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "^node_modules/[^/]+",
      },
      archi: {
        collapsePattern: "^[^/]+/([^/]+)/",
      },
    },
  },
};

export interface PhaseDetail {
  objectives: string[];
  project: string;
  evidence: string;
}

interface RoadmapDetail {
  outcome: string;
  weeklyRhythm: string[];
  phases: PhaseDetail[];
}

const DETAILS: Record<string, RoadmapDetail> = {
  "Frontend Developer": {
    outcome: "Build and deploy accessible, responsive interfaces that are ready for junior frontend applications.",
    weeklyRhythm: ["3 focused learning sessions", "2 implementation sessions", "1 portfolio review and reflection"],
    phases: [
      { objectives: ["Use semantic HTML correctly", "Create responsive layouts", "Apply WCAG-friendly interaction patterns"], project: "Responsive personal portfolio with accessible navigation and forms.", evidence: "Lighthouse accessibility score, responsive screenshots, and a documented component checklist." },
      { objectives: ["Use modern JavaScript confidently", "Handle asynchronous data", "Organize reusable application logic"], project: "Interactive job tracker using a public API and local persistence.", evidence: "Deployed application, clean repository, error states, and a short technical README." },
      { objectives: ["Build typed React components", "Manage client state", "Create reusable UI patterns"], project: "Type-safe analytics dashboard with filters, charts, and loading states.", evidence: "Component architecture diagram, tests for key flows, and deployed preview." },
      { objectives: ["Test critical interactions", "Improve performance", "Ship production-quality UX"], project: "Polish one project into an application-ready case study.", evidence: "Performance report, test results, design decisions, and live deployment." },
    ],
  },
  "Backend Developer": {
    outcome: "Design, secure, test, and deploy production-style APIs backed by reliable databases.",
    weeklyRhythm: ["2 concept sessions", "3 API/database implementation sessions", "1 testing and documentation review"],
    phases: [
      { objectives: ["Write maintainable service logic", "Use language tooling effectively", "Handle errors deliberately"], project: "Command-line data processing service with tests and structured logging.", evidence: "Automated tests, clear modules, sample inputs, and documented error handling." },
      { objectives: ["Design REST resources", "Validate requests", "Implement authentication and authorization"], project: "Authenticated task or internship management API.", evidence: "OpenAPI documentation, Postman collection, auth tests, and consistent error responses." },
      { objectives: ["Model relationships and documents", "Create indexes", "Explain database trade-offs"], project: "Data layer supporting users, saved jobs, and activity history.", evidence: "Schema diagram, migration or seed strategy, index rationale, and query examples." },
      { objectives: ["Containerize services", "Add health checks", "Deploy with environment configuration"], project: "Deploy the API and database integration as a monitored service.", evidence: "Live endpoint, Docker setup, deployment guide, and operational checklist." },
    ],
  },
  "Full-Stack Developer": {
    outcome: "Ship complete user-facing products from interface and API through persistence and deployment.",
    weeklyRhythm: ["2 frontend sessions", "2 backend sessions", "1 integration session", "1 review or deployment session"],
    phases: [
      { objectives: ["Build responsive interfaces", "Create accessible forms", "Manage client-side state"], project: "Responsive product dashboard with authentication screens.", evidence: "Component library, responsive QA checklist, and deployed frontend." },
      { objectives: ["Connect APIs and databases", "Manage server state", "Handle validation across layers"], project: "Full CRUD workflow with React, API routes, and MongoDB or PostgreSQL.", evidence: "Architecture diagram, API documentation, and integration tests." },
      { objectives: ["Implement complete product workflows", "Add authorization", "Design helpful empty and error states"], project: "Career, project, or learning tracker with accounts and analytics.", evidence: "End-to-end test, user-flow recording, and structured case study." },
      { objectives: ["Configure CI/CD", "Monitor failures", "Optimize production performance"], project: "Production deployment of the strongest full-stack project.", evidence: "Live URL, pipeline configuration, monitoring notes, and release checklist." },
    ],
  },
  "Data Scientist": {
    outcome: "Turn raw data into reproducible analysis, clear business insights, and evaluated predictive models.",
    weeklyRhythm: ["2 data practice sessions", "2 analysis/model sessions", "1 communication and portfolio session"],
    phases: [
      { objectives: ["Clean imperfect datasets", "Write useful SQL", "Perform reproducible exploration"], project: "Exploratory analysis of a public business or employment dataset.", evidence: "Clean notebook, data dictionary, SQL queries, and documented assumptions." },
      { objectives: ["Select meaningful metrics", "Build clear dashboards", "Explain findings to non-technical users"], project: "Interactive Power BI or Tableau decision dashboard.", evidence: "Published dashboard, insight summary, and stakeholder-focused presentation." },
      { objectives: ["Create baselines", "Evaluate models correctly", "Interpret model behavior"], project: "Classification or regression study with multiple model comparisons.", evidence: "Evaluation table, validation strategy, feature discussion, and reproducible code." },
      { objectives: ["Frame a business question", "Combine analysis and modeling", "Communicate limitations"], project: "End-to-end portfolio case study with measurable recommendations.", evidence: "Public repository, concise article, dashboard or app, and presentation deck." },
    ],
  },
  "ML Engineer": {
    outcome: "Build evaluated machine-learning systems and package models for practical production use.",
    weeklyRhythm: ["2 theory sessions", "2 model-building sessions", "1 engineering session", "1 experiment review"],
    phases: [
      { objectives: ["Strengthen Python and statistics", "Use vectorized data workflows", "Track experiments clearly"], project: "Reproducible notebook project with a documented baseline model.", evidence: "Experiment log, clean pipeline, metrics, and explanation of assumptions." },
      { objectives: ["Compare suitable algorithms", "Prevent leakage", "Tune and validate models"], project: "Recommendation, classification, or forecasting system.", evidence: "Validation design, model comparison, error analysis, and reproducible training." },
      { objectives: ["Build neural models", "Use pretrained models responsibly", "Evaluate NLP or vision outputs"], project: "Focused NLP or deep-learning application with a clear use case.", evidence: "Model card, evaluation examples, limitations, and inference demo." },
      { objectives: ["Serve model predictions", "Containerize inference", "Monitor inputs and outputs"], project: "Deploy the strongest model behind a FastAPI service and usable interface.", evidence: "Live demo, API contract, Docker image, latency report, and monitoring plan." },
    ],
  },
  "DevOps Engineer": {
    outcome: "Automate reliable software delivery using Linux, containers, cloud services, and infrastructure as code.",
    weeklyRhythm: ["2 infrastructure labs", "2 automation sessions", "1 incident review and documentation session"],
    phases: [
      { objectives: ["Navigate Linux confidently", "Understand processes and permissions", "Diagnose network problems"], project: "Automated Linux server setup and troubleshooting lab.", evidence: "Shell scripts, runbook, network diagram, and troubleshooting notes." },
      { objectives: ["Build efficient images", "Configure multi-service environments", "Manage secrets safely"], project: "Containerize a frontend, API, and database stack.", evidence: "Dockerfiles, Compose configuration, health checks, and security notes." },
      { objectives: ["Build CI/CD pipelines", "Deploy to cloud infrastructure", "Add logs and alerts"], project: "Automated test-to-deployment pipeline for a real application.", evidence: "Pipeline file, deployment record, alert example, and rollback procedure." },
      { objectives: ["Provision repeatable infrastructure", "Manage configuration", "Document recovery procedures"], project: "Infrastructure-as-code environment with automated configuration.", evidence: "Terraform or Ansible repository, architecture diagram, state strategy, and runbook." },
    ],
  },
};

export function getRoadmapDetail(role: string): RoadmapDetail {
  return DETAILS[role] || DETAILS["Full-Stack Developer"];
}

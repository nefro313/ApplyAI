export type FileType = "pdf" | "docx" | "txt";

export type ResumeUploadResponse = {
  file_id: string;
  gcs_url: string;
  file_type: FileType;
  uploaded_at: string;
  text_length: number;
};

export type ScrapeJDResponse = {
  success: boolean;
  jd_text: string | null;
  message: string | null;
};

export type StepState = "pending" | "running" | "done" | "failed" | "skipped";

export type AgentStatus = {
  name: string;
  state: StepState;
  started_at?: string | null;
  ended_at?: string | null;
  message?: string | null;
};

export type OverallStatus =
  | "started"
  | "running"
  | "awaiting_review"
  | "done"
  | "failed";

export type ChangeCategory =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "keywords";

export type ChangeOptionKind = "original" | "ai" | "custom";

export type ChangeOption = {
  id: string;
  label: string;
  text: string;
  kind: ChangeOptionKind;
};

export type ProposedChange = {
  id: string;
  category: ChangeCategory;
  title: string;
  detail: string;
  before: string | null;
  after: string | null;
  options: ChangeOption[];
  selected_option_id: string | null;
  custom_text: string | null;
  /** For `skills` changes: AI-suggested clickable skill chips + the picks. */
  chips: string[];
  selected_chips: string[] | null;
  accepted: boolean;
};

export type PipelineReview = {
  pipeline_id: string;
  proposed_changes: ProposedChange[];
  analyst_summary: string | null;
  candidate_name: string | null;
  role_title: string | null;
  company_name: string | null;
  original_ats: AtsAnalysis | null;
  template_id: ResumeTemplate;
};

export type ChangeSelection = {
  id: string;
  accepted: boolean;
  option_id?: string | null;
  custom_text?: string | null;
  selected_chips?: string[] | null;
};

export type ApplyChangesRequestBody = {
  selections?: ChangeSelection[];
  /** Legacy accept-only list — prefer `selections`. */
  accepted_ids?: string[];
  notes?: string | null;
  template_id?: ResumeTemplate;
};

export type PipelineProgress = {
  pipeline_id: string;
  overall_status: OverallStatus;
  current_step: string | null;
  steps: AgentStatus[];
  error: string | null;
  started_at: string | null;
  updated_at: string | null;
  /** Set when the analysis phase finishes and the review pause begins. */
  analysis_ended_at: string | null;
  /** Set when the user applies changes and the generation phase starts. */
  generation_started_at: string | null;
};

export type JDAnalysis = {
  role_title: string;
  company_name: string;
  location: string | null;
  remote_ok: boolean;
  required_skills: string[];
  nice_to_have_skills: string[];
  years_experience_required: number | null;
  key_responsibilities: string[];
  ats_keywords: string[];
};

export type AtsScore = {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  section_check: Record<string, boolean>;
  final_score: number;
};

export type AtsBreakdown = {
  keyword_match: number;
  skills_match: number;
  experience_match: number;
  education_match: number;
  formatting: number;
};

export type AtsAnalysis = {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  breakdown: AtsBreakdown;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string | null;
};

export type EmailDraftPayload = {
  subject: string;
  body: string;
  to: string;
  gmail_url: string;
};

export type PipelineResult = {
  pipeline_id: string;
  candidate_name: string;
  role_title: string;
  company_name: string;
  fit_summary: string | null;
  jd_analysis: JDAnalysis;
  analyst_report: Record<string, unknown>;
  resume_pdf_url: string;
  template_id: ResumeTemplate;
  cover_letter_pdf_url: string | null;
  cover_letter_docx_url: string | null;
  email_draft: EmailDraftPayload | null;
  ats_score: AtsScore;
  original_ats: AtsAnalysis | null;
  tailored_ats: AtsAnalysis | null;
  completed_at: string;
  /** Total active processing time in seconds (excludes the review pause). */
  duration_seconds: number | null;
  original_resume_text: string | null;
  resume_text: string | null;
  original_resume_url: string | null;
  original_resume_filename: string | null;
  original_resume_file_type: string | null;
  jd_text: string | null;
  // Pre-computed by the pipeline and cached on the doc, so the Skills & Growth
  // and Interview tabs can render straight from the result with no extra fetch.
  interview_prep: InterviewPrep | null;
  skill_roadmap: SkillRoadmap | null;
  // On-demand agents cached on the doc once the user first generates them, then
  // shipped with the result so a reopened pipeline renders them immediately.
  recruiter_review: RecruiterReview | null;
  resume_risks: ResumeRisks | null;
};

export type StartPipelineResponse = {
  pipeline_id: string;
  status: string;
};

export type PipelineRequestBody = {
  file_id: string;
  job_input: {
    url?: string | null;
    raw_jd?: string | null;
    company_name?: string | null;
    role_title?: string | null;
  };
  want_cover_letter: boolean;
  candidate_email_to_send?: string | null;
  /** Resume PDF style chosen on /home. Defaults to "classic" server-side. */
  template_id?: ResumeTemplate;
  /**
   * Caller-generated UUID. Lets the frontend route to /pipeline/<id> before
   * the start request resolves, and is reused as the LangSmith trace
   * thread id so every agent in the run groups together.
   */
  pipeline_id?: string | null;
};

/** Resume PDF templates the user can pick on /home. Mirrors the backend. */
export type ResumeTemplate = "classic" | "minimal" | "modern";

export type EmailDraftRequestBody = {
  pipeline_id: string;
  to_email: string;
};

export type ResumeSummary = {
  file_id: string;
  file_type: string;
  uploaded_at: string | null;
  text_length: number;
  candidate_name: string | null;
};

export type PipelineSummary = {
  pipeline_id: string;
  overall_status: string;
  role_title: string | null;
  company_name: string | null;
  candidate_name: string | null;
  final_score: number | null;
  started_at: string | null;
  updated_at: string | null;
  /** Total active processing time in seconds (excludes the review pause). */
  duration_seconds: number | null;
};

export type ExportResponse = {
  url: string;
  filename: string;
};

export type RegenerateResumeResponse = {
  resume_pdf_url: string;
  ats_score: AtsScore;
};

export type RegenerateResumeRequestBody = {
  notes?: string | null;
};

export type InterviewQuestion = {
  question: string;
  suggested_answer: string;
  anchor: string | null;
};

export type InterviewPrep = {
  behavioral: InterviewQuestion[];
  technical: InterviewQuestion[];
  role_specific: InterviewQuestion[];
  questions_to_ask: string[];
  watch_outs: string[];
};

export type SkillImportance = "critical" | "important" | "nice_to_have";
export type SkillStatus = "missing" | "partial";

export type SkillGap = {
  skill: string;
  importance: SkillImportance;
  status: SkillStatus;
  why: string | null;
};

export type RoadmapWeek = {
  week: number;
  focus: string;
  resources: string[];
  project: string | null;
};

export type SkillRoadmap = {
  gaps: SkillGap[];
  roadmap: RoadmapWeek[];
  summary: string | null;
};

export type HiringRecommendation = "strong_yes" | "yes" | "maybe" | "no";

export type RecruiterReview = {
  strengths: string[];
  concerns: string[];
  hiring_recommendation: HiringRecommendation;
  verdict: string | null;
};

export type RiskSeverity = "high" | "medium" | "low";

export type ResumeRisk = {
  type: string;
  severity: RiskSeverity;
  detail: string;
  fix: string | null;
};

export type ResumeRisks = {
  risks: ResumeRisk[];
  summary: string | null;
};

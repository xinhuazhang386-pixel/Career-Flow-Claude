// 简历文件
export interface ResumeItem {
  id: string;
  name: string;
  fileType: 'pdf' | 'doc' | 'docx';
  fileSize: number;
  uploadDate: string;
  text?: string;
}

// 工作区状态
export interface WorkspaceState {
  currentStep: number;
  selectedResumeId: string | null;
  companyName: string;
  roleName: string;
  jdText: string;
  modifiedContent: string;
}

// 面试问题
export interface InterviewQuestion {
  id: string;
  question: string;
  type: 'jd' | 'company' | 'resume';
  answer?: string;
  feedback?: string;
}

// 简历优化 - 左侧面板
export interface ResumeOptimizationLeftPanel {
  section: string;
  original_text: string;
  issue: string;
  revised_text: string;
  grounded: boolean;
  note: string;
}

// 简历优化 - 右侧面板
export interface ResumeOptimizationRightPanel {
  jd_keyword: string;
  reason: string;
  matched_resume_evidence: string;
  suggestion: string;
  safe_to_add: 'yes' | 'no';
}

// 简历优化结果
export interface ResumeOptimizationResult {
  left_panel: ResumeOptimizationLeftPanel[];
  right_panel: ResumeOptimizationRightPanel[];
  overall_note: string;
}

// 内容会话
export interface ContentSession {
  id: string;
  companyName: string;
  roleName: string;
  jdText: string;
  resumeId: string;
  matchResult?: {
    score: number;
    pros: string[];
    gaps: string[];
    suggestions: string[];
  };
  optimizationResult?: ResumeOptimizationResult;
  interviewQuestions: InterviewQuestion[];
  modifiedContent: string;
  createdAt: string;
}

// 申请状态
export type ApplicationStatus =
  | '已投递'
  | '笔试中'
  | '一面'
  | '二面'
  | 'Offer'
  | 'Rejected'
  | '已结束';

// 时间线条目
export interface TimelineEntry {
  status: ApplicationStatus;
  date: string;
  note: string;
}

// 投递记录
export interface ApplicationItem {
  id: string;
  companyName: string;
  roleName: string;
  channel: string;
  status: ApplicationStatus;
  applyDate: string;
  interviewDate?: string;
  notes: string;
  timeline: TimelineEntry[];
  updatedAt: string;
}

// 用户设置
export interface UserSettings {
  userName: string;
  email: string;
  avatar?: string;
  theme: 'light' | 'dark';
  // API 配置
  apiKey?: string;
  apiUrl?: string;
}

// API 设置（独立存储）
export interface ApiSettings {
  apiKey: string;
  apiUrl: string;
}

// Pipeline phases
export type Phase =
  | 'idea_submitted'
  | 'ceo_review'
  | 'specialist_review'
  | 'architecture'
  | 'implementation'
  | 'code_review'
  | 'completed'
  | 'rejected';

// Run status
export type RunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'awaiting_answer'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

// Agent types
export type AgentType =
  | 'ceo'
  | 'cto'
  | 'cpo'
  | 'ciso'
  | 'architect'
  | 'engineer'
  | 'qa'
  | 'devops'
  | 'tech_writer';

// Question from agent
export interface AgentQuestion {
  id: string;
  runId: string;
  phase: Phase;
  agent: AgentType;
  question: string;
  options?: string[];
  createdAt: string;
  answeredAt?: string;
  answer?: string;
}

// Issue found during review
export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  recommendation?: string;
  agent: AgentType;
}

// Phase result from agent
export interface PhaseResult {
  phase: Phase;
  agent: AgentType;
  status: 'success' | 'needs_changes' | 'blocked' | 'error';
  summary: string;
  details: Record<string, unknown>;
  issues?: Issue[];
  recommendations?: string[];
  tokenUsage?: {
    input: number;
    output: number;
  };
  cost?: number;
  duration?: number;
}

// Pipeline run
export interface Run {
  id: string;
  idea: string;
  status: RunStatus;
  currentPhase: Phase;
  phases: PhaseResult[];
  questions: AgentQuestion[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

// Event for real-time updates
export interface RunEvent {
  type: 'phase_started' | 'phase_completed' | 'status_changed' | 'question_asked' | 'agent_message' | 'error';
  runId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Phase display info
export const PHASE_INFO: Record<Phase, { label: string; description: string }> = {
  idea_submitted: { label: 'Submitted', description: 'Idea has been submitted' },
  ceo_review: { label: 'CEO Review', description: 'CEO is evaluating the idea' },
  specialist_review: { label: 'Specialist Review', description: 'CTO, CPO, and CISO reviewing in parallel' },
  architecture: { label: 'Architecture', description: 'Designing the implementation' },
  implementation: { label: 'Implementation', description: 'Building the feature' },
  code_review: { label: 'Code Review', description: 'QA, DevOps, and Tech Writer reviewing' },
  completed: { label: 'Completed', description: 'Successfully completed' },
  rejected: { label: 'Rejected', description: 'Rejected during review' },
};

// Agent display info
export const AGENT_INFO: Record<AgentType, { label: string; color: string; emoji: string }> = {
  ceo: { label: 'CEO', color: 'agent-ceo', emoji: '👔' },
  cto: { label: 'CTO', color: 'agent-cto', emoji: '💻' },
  cpo: { label: 'CPO', color: 'agent-cpo', emoji: '📊' },
  ciso: { label: 'CISO', color: 'agent-ciso', emoji: '🔒' },
  architect: { label: 'Architect', color: 'agent-architect', emoji: '🏗️' },
  engineer: { label: 'Engineer', color: 'agent-engineer', emoji: '⚙️' },
  qa: { label: 'QA', color: 'agent-qa', emoji: '🧪' },
  devops: { label: 'DevOps', color: 'agent-devops', emoji: '🚀' },
  tech_writer: { label: 'Tech Writer', color: 'agent-writer', emoji: '📝' },
};

// Status display info
export const STATUS_INFO: Record<RunStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'gray' },
  running: { label: 'Running', color: 'blue' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'yellow' },
  awaiting_answer: { label: 'Awaiting Answer', color: 'orange' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  completed: { label: 'Completed', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
};

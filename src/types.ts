export type TaskStatus = 'active' | 'done' | 'blocked';

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'blocked';

export interface Step {
  id: string;
  title: string;
  status: StepStatus;
  tries: number;
  max_tries: number;
  depends_on: string[];
  note: string | null;
  last_error: string | null;
  updated_at: string;
  assigned_agent?: string;
}

export interface ActiveAgentSession {
  agent_id: string;
  name?: string;
  role?: string;
  last_seen: string;
  active_step_id?: string;
}

export interface AgentDirective {
  id: string;
  directive: string;
  target_agent?: string;
  created_at: string;
  active: boolean;
}

export interface TaskLedger {
  version: number;
  task_id: string;
  goal: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  checkpoint_count: number;
  steps: Step[];
  active_agents?: Record<string, ActiveAgentSession>;
}

export interface HookState {
  pushes_in_a_row: number;
  total_pushes: number;
  last_checkpoint_count: number;
}

export interface StepInput {
  title: string;
  depends_on?: string[];
}

export interface TaskStartParams {
  goal: string;
  steps: StepInput[];
  max_tries?: number;
  replace?: boolean;
  project_path?: string;
}

export interface TaskCheckpointParams {
  step_id: string;
  status: 'in_progress' | 'done' | 'failed';
  note: string;
  error?: string;
  add_steps?: StepInput[];
  project_path?: string;
}

export interface TaskStatusParams {
  project_path?: string;
}

export interface KeepAwakeParams {
  action: 'hold' | 'release' | 'status';
  minutes?: number;
  reason?: string;
  project_path?: string;
}

export interface RepoBriefParams {
  refresh?: boolean;
  project_path?: string;
}

export interface AgentEnforceParams {
  action: 'status' | 'broadcast' | 'force_next';
  directive?: string;
  target_agent?: string;
  project_path?: string;
}

// 자동화 관련 타입 정의

export interface ComputerUseAction {
  action: 'goto' | 'click' | 'type' | 'scroll' | 'key' | 'wait' | 'screenshot' | 'done' |
          'doubleClick' | 'rightClick' | 'hover' | 'select' | 'checkbox' | 'drag' |
          'goBack' | 'goForward' | 'reload' | 'getText';
  params?: {
    url?: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    keys?: string[];
    direction?: 'up' | 'down' | 'left' | 'right' | 'to';
    timeout?: number;
    value?: string;
    checked?: boolean;
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    pressEnter?: boolean;
    selector?: string;
    amount?: number;
  };
  message?: string;
}

export interface ActionPlan {
  step: number;
  action: string;
  params: any;
  description: string;
  expectedResult?: string;
}

export interface ExecutionResult {
  success: boolean;
  step: number;
  action: string;
  result?: any;
  error?: string;
  screenshot?: string;
  currentUrl?: string;
  pageTitle?: string;
}

export interface VerificationResult {
  isValid: boolean;
  message: string;
  shouldRetry: boolean;
  suggestedFix?: string;
}

export interface AutomationState {
  isRunning: boolean;
  logs: string[];
  command: string;
}

import { sendMessageToGemini, ChatMessage } from './gemini';
import { executePlaywrightAction, getPlaywrightUrl } from './playwright-mcp';

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

// Webview 실행 함수 타입
export type WebviewExecutor = (code: string) => Promise<any>;
export type WebviewGetter = () => { getURL: () => string; reload: () => void; goBack: () => void; goForward: () => void } | null;
export type UrlSetter = (url: string) => void;

export interface VerificationResult {
  isValid: boolean;
  message: string;
  shouldRetry: boolean;
  suggestedFix?: string;
}

// 오케스트레이션: 계획 → 실행 → 검증 → 재시도
export class TaskOrchestrator {
  private actionHistory: ExecutionResult[] = [];
  private maxIterations = 30;
  private currentIteration = 0;
  private addLog: (message: string) => void;

  constructor(addLog: (message: string) => void) {
    this.addLog = addLog;
  }

  // 1. 계획 수립 (Planning) - LLM 자율성 강화
  async plan(userRequest: string, currentUrl?: string): Promise<ActionPlan[]> {
    try {
      const planningPrompt = `You are a browser automation expert. Analyze the user's request and create a step-by-step execution plan.

**Core Principles:**
1. Understand the user's intent completely. Break down complex requests into logical, sequential steps.
2. Context awareness: Distinguish between website names, time expressions, search queries, and other entities in the user's request.
3. Each step must include: step (number), description (what this step does), expectedResult (what should happen), action (Playwright action name), params (action parameters).
4. For information gathering tasks, use getText and evaluate actions to extract and structure data.
5. For report generation or data compilation, include steps for: data collection → structuring → generation.

**User Request:** "${userRequest}"
**Current URL:** ${currentUrl || 'Unknown'}

**Available Playwright Actions:**

**Navigation:**
- goto: Navigate to URL (params: { url: string })
- goBack: Navigate back (params: {})
- goForward: Navigate forward (params: {})
- reload: Reload page (params: {})

**Interaction:**
- click: Click element (params: { selector?: string, findByText?: string, x?: number, y?: number })
- doubleClick: Double click (params: { selector: string })
- rightClick: Right click (params: { selector: string })
- hover: Hover over element (params: { selector: string })
- fill: Fill input field (params: { selector: string, text: string, submit?: boolean })
- press: Press key (params: { key: string }) - Enter, Escape, Tab, Arrow keys, etc.
- select: Select dropdown option (params: { selector: string, value: string })
- checkbox: Check/uncheck checkbox (params: { selector: string, checked: boolean })
- drag: Drag and drop (params: { selector: string, toX: number, toY: number })

**Waiting:**
- wait: Wait for timeout (params: { timeout?: number })
- waitForSelector: Wait for selector to appear (params: { selector: string, timeout?: number })
- waitForNavigation: Wait for navigation to complete (params: { timeout?: number })

**Information Extraction:**
- getText: Extract text from element (params: { selector: string })
- text: Alias for getText (params: { selector: string })
- getUrl: Get current URL (params: {})
- screenshot: Take screenshot (params: { fullPage?: boolean })
- evaluate: Execute JavaScript (params: { code: string }) - Use for data collection, processing, and structuring

**Scrolling:**
- scroll: Scroll page (params: { direction: 'down' | 'up' | 'left' | 'right' | 'to', amount?: number, selector?: string })

**Action Selection Guidelines:**
- Use CSS selectors, XPath, or text-based selection for element targeting
- Use findByText when you need to find elements by their visible text
- waitForSelector automatically waits for elements to appear before proceeding
- Set submit: false in fill action to prevent automatic form submission
- Use evaluate for complex data extraction, processing, and JSON structuring

**Planning Guidelines:**
- Understand context: Distinguish website names from time expressions, search terms from navigation targets
- Be thorough: Include all necessary steps to complete the user's request
- Be efficient: Don't add unnecessary steps
- Handle edge cases: Consider what might go wrong and plan accordingly
- Use appropriate actions: Choose the right action for each task

**Response Format:** Return ONLY a JSON array. No additional text or explanation.

[
  {
    "step": 1,
    "action": "goto",
    "params": { "url": "https://example.com" },
    "description": "Navigate to website",
    "expectedResult": "Page loads successfully"
  }
]`;

      const messages: ChatMessage[] = [
        { role: 'user', content: planningPrompt }
      ];

      const response = await sendMessageToGemini(messages, currentUrl, 'flash'); // 계획 수립은 flash 사용
      
      // JSON 파싱
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const plans = JSON.parse(jsonMatch[0]) as ActionPlan[];
          // step이 없는 경우 자동으로 추가하고 검증
          const validatedPlans = plans.map((plan, index) => {
            const step = typeof plan.step === 'number' ? plan.step : (index + 1);
            return {
              ...plan,
              step: step,
              description: plan.description || `${plan.action} 실행`,
              expectedResult: plan.expectedResult || '액션 완료',
              action: plan.action || 'wait', // action이 없으면 기본값
              params: plan.params || {} // params가 없으면 빈 객체
            };
          }).filter(plan => plan.action); // action이 있는 계획만 유지
          
          if (validatedPlans.length > 0) {
            this.addLog(`계획 수립 완료: ${validatedPlans.length}개 단계`);
            validatedPlans.forEach((plan) => {
              this.addLog(`  Step ${plan.step}: ${plan.description || plan.action}`);
            });
            return validatedPlans;
          }
        } catch (parseError: any) {
          this.addLog(`JSON 파싱 오류: ${parseError.message}`);
        }
      }

      // 파싱 실패 시 사용자 요청에서 URL 추출 시도
      const urlMatch = userRequest.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.(?:com|net|org|co\.kr|kr))/i);
      let defaultUrl = currentUrl || 'https://www.google.com';
      
      if (urlMatch) {
        defaultUrl = `https://www.${urlMatch[1]}`;
      } else if (userRequest.includes('부킹닷컴') || userRequest.includes('booking.com') || userRequest.includes('booking')) {
        defaultUrl = 'https://www.booking.com';
      } else if (userRequest.includes('네이버') || userRequest.includes('naver')) {
        defaultUrl = 'https://www.naver.com';
      } else if (userRequest.includes('구글') || userRequest.includes('google')) {
        defaultUrl = 'https://www.google.com';
      } else if ((userRequest.includes('다음') || userRequest.includes('daum')) && 
                 !userRequest.includes('다음주') && 
                 !userRequest.includes('다음 달') && 
                 !userRequest.includes('다음 날') &&
                 !userRequest.includes('다음 주') &&
                 !userRequest.includes('다음번')) {
        // "다음"이 단독으로 언급되고 시간 표현이 아닌 경우에만 daum.net
        defaultUrl = 'https://www.daum.net';
      }
      
      return [{
        step: 1,
        action: 'goto',
        params: { url: defaultUrl },
        description: `${defaultUrl}로 이동`,
        expectedResult: '페이지가 로드됨'
      }];
    } catch (error: any) {
      console.error('계획 수립 오류:', error);
      return [];
    }
  }

  // 2. 액션 실행 (Execution) - Playwright 직접 사용
  async executeAction(plan: ActionPlan, currentUrl?: string, onUrlChange?: (url: string) => void): Promise<ExecutionResult> {
    try {
      this.addLog(`[실행] Step ${plan.step}: ${plan.description}`);
      
      const result = await executePlaywrightAction(plan.action, plan.params);
      
      // URL 변경 감지
      let newUrl = currentUrl;
      if (result?.url) {
        newUrl = result.url;
        if (newUrl) onUrlChange?.(newUrl);
      } else if (plan.action === 'goto' && plan.params?.url) {
        newUrl = plan.params.url;
        if (newUrl) onUrlChange?.(newUrl);
      } else {
        // URL 가져오기 시도
        const currentPlaywrightUrl = await getPlaywrightUrl();
        if (currentPlaywrightUrl) {
          newUrl = currentPlaywrightUrl;
          onUrlChange?.(newUrl);
        }
      }

      // 정보 추출 결과 로깅
      if (plan.action === 'getText' || plan.action === 'text') {
        const extractedText = result?.text || '';
        if (extractedText) {
          this.addLog(`[정보 추출] ${extractedText.substring(0, 100)}${extractedText.length > 100 ? '...' : ''}`);
        }
      }

      // evaluate 결과 로깅 (보고서 생성 등)
      if (plan.action === 'evaluate' && result) {
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        this.addLog(`[JavaScript 실행 결과] ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
      }

      return {
        success: true,
        step: plan.step,
        action: plan.action,
        result: result,
        currentUrl: newUrl
      };
    } catch (error: any) {
      this.addLog(`[실행 실패] Step ${plan.step}: ${error.message}`);
      return {
        success: false,
        step: plan.step,
        action: plan.action,
        error: error.message
      };
    }
  }

  // 3. 검증 (Verification) - 더 철저하고 정교하게
  async verify(
    plan: ActionPlan,
    executionResult: ExecutionResult,
    userRequest: string,
    currentUrl?: string
  ): Promise<VerificationResult> {
    try {
      // 빠른 검증: 실행 실패 시 재시도 제안
      if (!executionResult.success) {
        return {
          isValid: false,
          message: `실행 실패: ${executionResult.error}`,
          shouldRetry: true,
          suggestedFix: `액션 ${plan.action} 재시도 또는 대체 방법 시도`
        };
      }

      // 기본 검증: goto 액션이면 URL 확인
      if (plan.action === 'goto' && plan.params?.url) {
        const targetUrl = plan.params.url.toLowerCase();
        const currentUrlLower = (currentUrl || '').toLowerCase();
        if (currentUrlLower.includes(targetUrl.replace('https://', '').replace('http://', '').split('/')[0])) {
          return {
            isValid: true,
            message: 'URL 이동 성공',
            shouldRetry: false
          };
        }
      }

      // 기본 검증: wait 액션이면 항상 성공으로 간주
      if (plan.action === 'wait' || plan.action === 'waitForSelector' || plan.action === 'waitForNavigation') {
        return {
          isValid: true,
          message: '대기 완료',
          shouldRetry: false
        };
      }

      // 정보 추출 액션 검증
      if (plan.action === 'getText' || plan.action === 'text') {
        if (executionResult.result?.text) {
          return {
            isValid: true,
            message: `텍스트 추출 성공: ${executionResult.result.text.substring(0, 50)}...`,
            shouldRetry: false
          };
        } else {
          return {
            isValid: false,
            message: '텍스트 추출 실패 또는 빈 결과',
            shouldRetry: true,
            suggestedFix: '다른 selector 시도 또는 요소 확인'
          };
        }
      }

      // evaluate 액션 검증 (보고서 생성 등)
      if (plan.action === 'evaluate') {
        if (executionResult.result !== undefined && executionResult.result !== null) {
          return {
            isValid: true,
            message: 'JavaScript 실행 성공',
            shouldRetry: false
          };
        } else {
          return {
            isValid: false,
            message: 'JavaScript 실행 실패 또는 빈 결과',
            shouldRetry: true,
            suggestedFix: '코드 수정 또는 다른 방법 시도'
          };
        }
      }

      // Detailed verification using LLM
      const verificationPrompt = `You are a browser automation verification expert. Thoroughly verify the execution result of this step.

**Verification Target:**
- Action: ${plan.action}
- Description: ${plan.description}
- Expected Result: ${plan.expectedResult || 'N/A'}
- Execution Result: ${executionResult.success ? 'Success' : 'Failed'}
- Current URL: ${currentUrl || 'Unknown'}
- User Request: "${userRequest}"

**Verification Criteria:**
1. Execution success: Was the action actually executed?
2. Expected result achievement: Was the expectedResult achieved?
3. Next step feasibility: Can we proceed to the next step?
4. User request relevance: Does this step contribute to fulfilling the user's request?

**Special Considerations:**
- Information extraction tasks (getText, evaluate): Verify that information was actually collected
- Report generation tasks: Verify that sufficient information was collected and structured
- Navigation tasks: Verify that the correct page was reached
- Interaction tasks: Verify that elements were actually clicked/input

**Judgment Principles:**
- Clear success: isValid: true, shouldRetry: false
- Partial success (can proceed): isValid: true, shouldRetry: false
- Clear failure: isValid: false, shouldRetry: true, provide suggestedFix
- Uncertain cases: Be conservative (isValid: false, shouldRetry: true)

**Response Format:** Return ONLY JSON.
{
  "isValid": true or false,
  "message": "Detailed verification result",
  "shouldRetry": true or false,
  "suggestedFix": "Specific suggestion if retry or fix is needed"
}`;

      const messages: ChatMessage[] = [
        { role: 'user', content: verificationPrompt }
      ];

      // 검증은 flash-lite로 빠르게 처리
      const response = await sendMessageToGemini(messages, currentUrl, 'flash-lite');
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const verification = JSON.parse(jsonMatch[0]) as VerificationResult;
        return verification;
      }

      // 기본 검증: 실행 성공 여부만 확인
      return {
        isValid: executionResult.success,
        message: executionResult.success ? '액션 실행 성공' : `실행 실패: ${executionResult.error}`,
        shouldRetry: !executionResult.success
      };
    } catch (error: any) {
      return {
        isValid: executionResult.success,
        message: `검증 오류: ${error.message}`,
        shouldRetry: !executionResult.success
      };
    }
  }

  // 4. 전체 오케스트레이션 실행
  async orchestrate(
    userRequest: string, 
    currentUrl?: string,
    onUrlChange?: (url: string) => void
  ): Promise<{
    success: boolean;
    message: string;
    results: ExecutionResult[];
  }> {
    this.currentIteration = 0;
    this.actionHistory = [];

    try {
      // 1. 계획 수립
      this.addLog(`사용자 요청 분석 중: "${userRequest}"`);
      let plans = await this.plan(userRequest, currentUrl);
      
      if (plans.length === 0) {
        return {
          success: false,
          message: '계획을 수립할 수 없습니다',
          results: []
        };
      }
      
      this.addLog(`계획 수립 완료: 총 ${plans.length}개 단계`);
      plans.forEach((plan) => {
        this.addLog(`  Step ${plan.step}: ${plan.description}`);
      });

      // 2. 각 단계 실행 및 검증
      for (let i = 0; i < plans.length && this.currentIteration < this.maxIterations; i++) {
        this.currentIteration++;
        const plan = plans[i];
        
        console.log(`[${this.currentIteration}/${this.maxIterations}] 단계 ${plan.step} 실행: ${plan.description}`);

        let retryCount = 0;
        const maxRetries = 3;
        let verified = false;

        while (retryCount < maxRetries && !verified) {
          // 실행
          const executionResult = await this.executeAction(plan, currentUrl, onUrlChange);
          this.actionHistory.push(executionResult);
          
          // URL 업데이트
          if (executionResult.currentUrl) {
            currentUrl = executionResult.currentUrl;
            onUrlChange?.(executionResult.currentUrl);
          }

          // 검증
          const verification = await this.verify(plan, executionResult, userRequest, currentUrl);

          if (verification.isValid && !verification.shouldRetry) {
            verified = true;
            console.log(`단계 ${plan.step} 검증 통과: ${verification.message}`);
          } else {
            retryCount++;
            console.log(`단계 ${plan.step} 검증 실패 (재시도 ${retryCount}/${maxRetries}): ${verification.message}`);
            
            if (verification.suggestedFix && retryCount >= 2) {
              // 2번 재시도 후에도 실패하면 계획 적응 시도
              this.addLog(`계획 적응 시도: ${verification.suggestedFix}`);
              plans = await this.adaptPlan(plans, i, verification.suggestedFix, userRequest);
              // 계획이 변경되었으므로 처음부터 다시 시작
              i = -1;
              break;
            }
            
            // 재시도 전 대기
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // 재시도 후에도 실패했지만, 계속 진행 가능한 경우 계속 진행
        if (!verified && retryCount >= maxRetries) {
          this.addLog(`단계 ${plan.step} 재시도 실패했지만 계속 진행 시도`);
          // 다음 단계로 진행 (유연한 처리)
          verified = true; // 강제로 통과시켜 계속 진행
        }

        // 단계 간 대기
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 3. 최종 검증
      this.addLog(`모든 단계 실행 완료. 최종 검증 중... (실행된 단계: ${this.actionHistory.length}개)`);
      const finalVerification = await this.verifyFinalResult(userRequest, currentUrl);
      
      if (!finalVerification.isValid && finalVerification.suggestedFix) {
        this.addLog(`최종 검증 실패. 누락된 작업 자동 실행: ${finalVerification.suggestedFix}`);
        
        // Create additional plan to complete missing tasks
        const completionPrompt = `User Request: "${userRequest}"
Current URL: ${currentUrl || 'Unknown'}
Missing Tasks: ${finalVerification.suggestedFix}
Executed Steps: ${this.actionHistory.length}

Create an additional plan to complete the missing tasks. Provide specific steps to fully achieve the user's request.

Return ONLY a JSON array: [{step, action, params, description, expectedResult}]`;
        
        const completionMessages: ChatMessage[] = [
          { role: 'user', content: completionPrompt }
        ];
        
        try {
          const completionResponse = await sendMessageToGemini(completionMessages, currentUrl, 'flash');
          const completionJsonMatch = completionResponse.match(/\[[\s\S]*\]/);
          
          if (completionJsonMatch) {
            const additionalPlans = JSON.parse(completionJsonMatch[0]) as ActionPlan[];
            this.addLog(`추가 작업 계획 수립: ${additionalPlans.length}개 단계`);
            
            // 추가 계획 실행 (최대 10개까지)
            for (const plan of additionalPlans.slice(0, 10)) {
              try {
                this.addLog(`[추가 실행] Step ${plan.step}: ${plan.description}`);
                const result = await this.executeAction(plan, currentUrl, onUrlChange);
                this.actionHistory.push(result);
                if (result.currentUrl) {
                  currentUrl = result.currentUrl;
                  onUrlChange?.(result.currentUrl);
                }
                // 각 단계 간 대기
                await new Promise(resolve => setTimeout(resolve, 1500));
              } catch (e: any) {
                this.addLog(`추가 작업 실행 실패: ${e.message}`);
                // 실패해도 계속 진행
              }
            }
            
            // 다시 최종 검증
            const retryVerification = await this.verifyFinalResult(userRequest, currentUrl);
            if (retryVerification.isValid) {
              return {
                success: true,
                message: retryVerification.message,
                results: this.actionHistory
              };
            }
          }
        } catch (e: any) {
          this.addLog(`추가 작업 계획 수립 실패: ${e.message}`);
        }
      }
      
      return {
        success: finalVerification.isValid,
        message: finalVerification.message,
        results: this.actionHistory
      };
    } catch (error: any) {
      return {
        success: false,
        message: `오케스트레이션 오류: ${error.message}`,
        results: this.actionHistory
      };
    }
  }

  // 계획 적응 (Adaptation)
  private async adaptPlan(
    plans: ActionPlan[],
    currentStep: number,
    suggestedFix: string,
    userRequest: string
  ): Promise<ActionPlan[]> {
    try {
      const adaptationPrompt = `Current Plan:
${JSON.stringify(plans, null, 2)}

Current Step: ${currentStep + 1}
Modification Suggestion: ${suggestedFix}
User Request: "${userRequest}"

Modify the plan based on the suggestion and provide the updated plan. Return ONLY a JSON array.`;

      const messages: ChatMessage[] = [
        { role: 'user', content: adaptationPrompt }
      ];

      // 계획 적응은 flash-lite로 빠르게 처리
      const response = await sendMessageToGemini(messages, undefined, 'flash-lite');
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ActionPlan[];
      }
    } catch (error: any) {
      console.error('계획 적응 오류:', error);
    }

    return plans; // 실패 시 원래 계획 반환
  }

  // 최종 결과 검증 - 더 철저하고 정교하게
  private async verifyFinalResult(
    userRequest: string,
    currentUrl?: string
  ): Promise<VerificationResult> {
    try {
      const executedSteps = this.actionHistory.length;
      const successfulSteps = this.actionHistory.filter(r => r.success).length;
      const failedSteps = this.actionHistory.filter(r => !r.success);
      
      // 실행된 액션 유형 분석
      const actionTypes = this.actionHistory.map(r => r.action);
      const hasInfoCollection = actionTypes.some(a => a === 'getText' || a === 'text' || a === 'evaluate');
      const hasNavigation = actionTypes.some(a => a === 'goto');
      const hasInteraction = actionTypes.some(a => ['click', 'fill', 'press'].includes(a));
      
      // 보고서 작성 관련 키워드 확인
      const reportKeywords = ['보고서', '리서치', '정리', '분석', '리스트업', '작성', 'report', 'research', 'analyze'];
      const isReportTask = reportKeywords.some(keyword => userRequest.toLowerCase().includes(keyword));
      
      const finalPrompt = `You are a browser automation final verification expert. Thoroughly determine whether all steps have been executed and the user's request has been completed.

**User Request:** "${userRequest}"
**Current URL:** ${currentUrl || 'Unknown'}
**Executed Steps:** ${executedSteps}
**Successful Steps:** ${successfulSteps}
**Failed Steps:** ${failedSteps.length}

**Action Types Executed:**
- Navigation: ${hasNavigation ? 'Yes' : 'No'}
- Interaction: ${hasInteraction ? 'Yes' : 'No'}
- Information Collection: ${hasInfoCollection ? 'Yes' : 'No'}

**Task Type:**
- Report/Research Task: ${isReportTask ? 'Yes' : 'No'}

**Verification Criteria (Very Thorough):**
1. **Completeness Verification:**
   - Have all major tasks in the user's request been completed?
   - Consider the full scope of the request, not just individual steps
   
2. **Step Count Adequacy:**
   - Is the number of executed steps sufficient for the complexity of the task?
   - Complex tasks require more steps; simple tasks may need fewer
   - Report generation tasks should include information collection steps
   
3. **Result Quality:**
   - Did each step actually achieve its purpose?
   - For information collection: Was information actually extracted?
   - For report generation: Was a report actually created?
   
4. **URL Consistency:**
   - Does the current URL match the requested task?
   - Have we reached the necessary pages?

**Special Verification for Report/Research Tasks:**
${isReportTask ? `
- Were information collection steps executed sufficiently? (Minimum 3-5 pages)
- Was information actually extracted using getText or evaluate?
- Was information structured? (e.g., JSON generation via evaluate)
- Was final report content generated?
` : ''}

**Judgment Principles:**
- **Complete Success**: All tasks completed and user request fulfilled → isValid: true
- **Partial Success**: Mostly completed but some missing → isValid: false, specify missing tasks in suggestedFix
- **Clear Failure**: Major tasks not completed → isValid: false, specify required tasks in suggestedFix
- **Uncertain**: When judgment is difficult → Be conservative (isValid: false)

**Response Format:** Return ONLY JSON.
{
  "isValid": true or false,
  "message": "Final verification result (very specific and detailed)",
  "shouldRetry": false,
  "suggestedFix": "Specific and actionable steps if additional work is needed"
}`;

      const messages: ChatMessage[] = [
        { role: 'user', content: finalPrompt }
      ];

      // 최종 검증은 flash-lite로 빠르게 처리
      const response = await sendMessageToGemini(messages, currentUrl, 'flash-lite');
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as VerificationResult;
      }
    } catch (error: any) {
      console.error('최종 검증 오류:', error);
    }

    return {
      isValid: true,
      message: '모든 단계 완료',
      shouldRetry: false
    };
  }
}


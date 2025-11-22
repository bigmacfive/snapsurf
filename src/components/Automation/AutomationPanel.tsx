import React from 'react';

interface AutomationPanelProps {
  showAutomation: boolean;
  automationCommand: string;
  isAutomationRunning: boolean;
  automationLogs: string[];
  onClose: () => void;
  onCommandChange: (command: string) => void;
  onExecuteCommand: () => void;
  onQuickAction: (action: string, ...args: any[]) => void;
  onClearLogs: () => void;
}

export const AutomationPanel: React.FC<AutomationPanelProps> = ({
  showAutomation,
  automationCommand,
  isAutomationRunning,
  automationLogs,
  onClose,
  onCommandChange,
  onExecuteCommand,
  onQuickAction,
  onClearLogs
}) => {
  if (!showAutomation) return null;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onExecuteCommand();
    }
  };

  return (
    <div className="automation-panel">
      <div className="automation-header">
        <h3>자동화 제어</h3>
        <button className="close-panel-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="automation-commands">
        <div className="command-input-group">
          <input
            type="text"
            className="automation-command-input"
            value={automationCommand}
            onChange={(e) => onCommandChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="자연어 명령 입력 (예: 구글.com으로 이동하고 스크린샷 찍어줘)"
            disabled={isAutomationRunning}
          />
          <button
            className="automation-btn"
            onClick={onExecuteCommand}
            disabled={isAutomationRunning || !automationCommand.trim()}
          >
            {isAutomationRunning ? '실행 중...' : '실행'}
          </button>
        </div>

        <div className="quick-actions">
          <h4>빠른 작업</h4>
          <div className="quick-buttons">
            <button
              className="quick-btn"
              onClick={() => onQuickAction('goto', 'https://www.google.com')}
              disabled={isAutomationRunning}
            >
              구글로 이동
            </button>
            <button
              className="quick-btn"
              onClick={() => onQuickAction('screenshot')}
              disabled={isAutomationRunning}
            >
              스크린샷
            </button>
            <button
              className="quick-btn"
              onClick={() => onQuickAction('getUrl')}
              disabled={isAutomationRunning}
            >
              현재 URL
            </button>
          </div>
        </div>

        <div className="automation-logs">
          <h4>실행 로그</h4>
          <div className="logs-container">
            {automationLogs.length === 0 ? (
              <div className="log-empty">로그가 없습니다</div>
            ) : (
              automationLogs.map((log, idx) => (
                <div key={idx} className="log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
          {automationLogs.length > 0 && (
            <button className="clear-logs-btn" onClick={onClearLogs}>
              로그 지우기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

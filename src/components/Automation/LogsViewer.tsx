// 로그 뷰어 컴포넌트

interface LogsViewerProps {
  logs: string[];
  onClear: () => void;
}

export function LogsViewer({ logs, onClear }: LogsViewerProps) {
  return (
    <div className="automation-logs">
      <h4>실행 로그</h4>
      <div className="logs-container">
        {logs.length === 0 ? (
          <div className="log-empty">로그가 없습니다</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="log-entry">{log}</div>
          ))
        )}
      </div>
      {logs.length > 0 && (
        <button className="clear-logs-btn" onClick={onClear}>
          로그 지우기
        </button>
      )}
    </div>
  );
}

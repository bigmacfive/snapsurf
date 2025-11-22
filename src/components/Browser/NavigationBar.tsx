// 네비게이션 바 컴포넌트

interface NavigationBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleAutomation: () => void;
  showAutomation: boolean;
}

export function NavigationBar({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onReload,
  onToggleAutomation,
  showAutomation
}: NavigationBarProps) {
  return (
    <div className="nav-buttons">
      <button
        onClick={onGoBack}
        disabled={!canGoBack}
        className="nav-btn"
        title="뒤로"
      >
        ←
      </button>
      <button
        onClick={onGoForward}
        disabled={!canGoForward}
        className="nav-btn"
        title="앞으로"
      >
        →
      </button>
      <button
        onClick={onReload}
        className="nav-btn"
        title="새로고침"
      >
        ⟳
      </button>
      <button
        onClick={onToggleAutomation}
        className={`nav-btn ${showAutomation ? 'active' : ''}`}
        title="자동화 패널"
      >
        ⚙
      </button>
    </div>
  );
}

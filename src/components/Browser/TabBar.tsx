// 탭 바 컴포넌트

import { Tab } from '../../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onAddTab: () => void;
}

export function TabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, onAddTab }: TabBarProps) {
  return (
    <div className="tabs-bar">
      <div className="tabs-container">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onSwitchTab(tab.id)}
          >
            <span className="tab-title">{tab.title}</span>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => onCloseTab(tab.id, e)}
                title="탭 닫기"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="new-tab-btn" onClick={onAddTab} title="새 탭">
        +
      </button>
    </div>
  );
}

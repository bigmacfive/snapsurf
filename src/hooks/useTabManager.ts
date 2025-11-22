// 탭 관리 Hook

import { useState } from 'react';
import { Tab } from '../types';

export function useTabManager(initialUrl: string = 'https://www.google.com') {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: '새 탭', url: initialUrl }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const addTab = () => {
    const newTabId = Date.now().toString();
    const newTab: Tab = {
      id: newTabId,
      title: '새 탭',
      url: initialUrl
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTabId);
    return newTab;
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (tabId === activeTabId) {
      const newActiveTab = newTabs[newTabs.length - 1];
      setActiveTabId(newActiveTab.id);
      return newActiveTab;
    }
    return null;
  };

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
    return tabs.find(t => t.id === tabId);
  };

  const updateTab = (tabId: string, updates: Partial<Tab>) => {
    setTabs(tabs.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  };

  const updateActiveTab = (updates: Partial<Tab>) => {
    if (activeTabId) {
      updateTab(activeTabId, updates);
    }
  };

  return {
    tabs,
    activeTabId,
    activeTab,
    addTab,
    closeTab,
    switchTab,
    updateTab,
    updateActiveTab
  };
}

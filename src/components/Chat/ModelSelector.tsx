// 모델 선택 컴포넌트

import { ModelType } from '../../types';

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  return (
    <select
      className="model-selector"
      value={selectedModel}
      onChange={(e) => onModelChange(e.target.value as ModelType)}
      disabled={disabled}
    >
      <option value="auto">Auto</option>
      <option value="flash">Flash</option>
      <option value="pro">Pro (Computer Use)</option>
    </select>
  );
}

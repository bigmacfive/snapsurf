// 주소창 컴포넌트

interface AddressBarProps {
  url: string;
  isLoading: boolean;
  onUrlChange: (url: string) => void;
  onNavigate: () => void;
}

export function AddressBar({ url, isLoading, onUrlChange, onNavigate }: AddressBarProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onNavigate();
    }
  };

  return (
    <div className="address-bar-container">
      <input
        type="text"
        className="address-bar"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="주소를 입력하세요"
      />
      {isLoading && <div className="loading-spinner" />}
    </div>
  );
}

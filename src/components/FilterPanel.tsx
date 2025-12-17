import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { SlotDefinition } from '../utils/transform';

const Container = styled.div`
  /* width: 160px; Removed fixed width */
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 8px 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-top: 8px;
`;

const Title = styled.h3`
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FilterOption = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  input {
    margin-right: 6px;
  }
`;

const DropdownWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const DropdownButton = styled.div`
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  margin-top: 4px;
  background: white;
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  
  &:hover {
    border-color: #40a9ff;
  }
`;

const DropdownContent = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  margin-top: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  border: none;
  border-bottom: 1px solid #eee;
  outline: none;
  border-radius: 4px 4px 0 0;
  
  &:focus {
    background: #fafafa;
  }
`;

const OptionList = styled.div`
  overflow-y: auto;
  flex: 1;
  max-height: 160px;
`;

const OptionItem = styled.div<{ $selected?: boolean }>`
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  background: ${props => props.$selected ? '#e6f7ff' : 'transparent'};
  color: ${props => props.$selected ? '#1890ff' : '#333'};
  
  &:hover {
    background: #f5f5f5;
  }
`;

interface FilterPanelProps {
  filters: {
    rejections: boolean;
    selectedSlot: string;
  };
  onFilterChange: (key: 'rejections' | 'selectedSlot', value?: any) => void;
  slots: SlotDefinition[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange, slots }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredSlots = slots.filter(slot =>
    (slot.displayName || slot.name).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (slotName: string) => {
    onFilterChange('selectedSlot', slotName);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedSlot = slots.find(s => s.name === filters.selectedSlot);
  const displayValue = selectedSlot ? (selectedSlot.displayName || selectedSlot.name) : 'None';

  return (
    <Container>
      <Title>Filter Nodes</Title>
      <FilterOption>
        <input
          type="checkbox"
          checked={filters.rejections}
          onChange={() => onFilterChange('rejections')}
        />
        Has Rejections
      </FilterOption>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 2 }}>Highlight Slot:</div>
        <DropdownWrapper ref={dropdownRef}>
          <DropdownButton onClick={() => setIsOpen(!isOpen)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filters.selectedSlot ? displayValue : 'None'}
            </span>
            <span style={{ fontSize: '10px', marginLeft: 4, color: '#999' }}>▼</span>
          </DropdownButton>

          {isOpen && (
            <DropdownContent>
              <SearchInput
                ref={inputRef}
                placeholder="Search slots..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <OptionList>
                <OptionItem
                  $selected={filters.selectedSlot === ''}
                  onClick={() => handleSelect('')}
                >
                  None
                </OptionItem>
                {filteredSlots.map((slot) => (
                  <OptionItem
                    key={slot.name}
                    $selected={filters.selectedSlot === slot.name}
                    onClick={() => handleSelect(slot.name)}
                  >
                    {slot.displayName || slot.name}
                  </OptionItem>
                ))}
                {filteredSlots.length === 0 && (
                  <div style={{ padding: '8px', color: '#999', fontSize: '12px', textAlign: 'center' }}>
                    No slots found
                  </div>
                )}
              </OptionList>
            </DropdownContent>
          )}
        </DropdownWrapper>
      </div>
    </Container>
  );
};

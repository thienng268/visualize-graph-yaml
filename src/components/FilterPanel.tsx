import React from 'react';
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

const Select = styled.select`
  width: 100%;
  padding: 4px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  margin-top: 4px;
  
  &:focus {
    outline: none;
    border-color: #40a9ff;
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
        <Select
          value={filters.selectedSlot}
          onChange={(e) => onFilterChange('selectedSlot', e.target.value)}
        >
          <option value="">None</option>
          {slots.map((slot) => (
            <option key={slot.name} value={slot.name}>
              {slot.displayName || slot.name}
            </option>
          ))}
        </Select>
      </div>
    </Container>
  );
};

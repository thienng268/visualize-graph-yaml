import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  width: 250px; /* Reduced width */
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  z-index: 5;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
`;

const FilterOption = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 14px;
  
  input {
    margin-right: 8px;
  }
`;

interface FilterPanelProps {
    filters: {
        rejections: boolean;
        sets_slot: boolean;
        clear_slots: boolean;
    };
    onFilterChange: (key: 'rejections' | 'sets_slot' | 'clear_slots') => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange }) => {
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
            <FilterOption>
                <input
                    type="checkbox"
                    checked={filters.sets_slot}
                    onChange={() => onFilterChange('sets_slot')}
                />
                Sets Slot
            </FilterOption>
            <FilterOption>
                <input
                    type="checkbox"
                    checked={filters.clear_slots}
                    onChange={() => onFilterChange('clear_slots')}
                />
                Clears Slot
            </FilterOption>
        </Container>
    );
};

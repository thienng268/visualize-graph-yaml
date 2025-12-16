import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  width: 250px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 10px 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-top: 8px;
`;

const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
`;

const FilterOption = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  cursor: pointer;
  font-size: 13px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  input {
    margin-right: 6px;
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

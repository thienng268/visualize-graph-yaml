import React from 'react';
import styled from 'styled-components';
import type { SlotDefinition } from '../utils/transform';

const PanelContainer = styled.div`
  position: fixed;
  left: 20px;
  top: 20px;
  bottom: 20px;
  width: 320px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  z-index: 900;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.2);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
`;

const AddButton = styled.button`
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255,255,255,0.3);
  }
`;

const SlotsContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
`;

const SlotCard = styled.div`
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  position: relative;
  transition: all 0.2s;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border-color: #667eea;
  }
`;

const SlotHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const SlotName = styled.input`
  font-weight: 600;
  font-size: 14px;
  color: #333;
  border: none;
  background: transparent;
  padding: 4px;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
  flex: 1;
  
  &:focus {
    outline: none;
    border-bottom-color: #667eea;
  }
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: #ff4d4f;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 1;
  }
`;

const FieldGroup = styled.div`
  margin-bottom: 6px;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 11px;
  color: #666;
  margin-bottom: 2px;
  text-transform: uppercase;
  font-weight: 500;
`;

const FieldInput = styled.input`
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #999;
`;

interface SlotsPanelProps {
  slots: SlotDefinition[];
  onUpdate: (index: number, updatedSlot: SlotDefinition) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onSlotFocus: (slotName: string | null) => void;
}

const SearchBarContainer = styled.div`
  padding: 8px 12px;
  background: #f0f2f5;
  border-bottom: 1px solid rgba(0,0,0,0.06);
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

export const SlotsPanel: React.FC<SlotsPanelProps> = ({ slots, onUpdate, onAdd, onDelete, onSlotFocus }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleFieldChange = (index: number, field: keyof SlotDefinition, value: string) => {
    const updatedSlot = { ...slots[index], [field]: value };
    onUpdate(index, updatedSlot);
  };

  const filteredSlots = slots.filter(slot =>
    slot.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PanelContainer>
      <Header>
        <Title>Slots</Title>
        <AddButton onClick={onAdd}>
          + Add
        </AddButton>
      </Header>
      <SearchBarContainer>
        <SearchInput
          placeholder="Search slots..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchBarContainer>
      <SlotsContainer>
        {filteredSlots.length === 0 ? (
          <EmptyState>
            {searchTerm ? (
              <>No slots found matching "{searchTerm}"</>
            ) : (
              <>
                No slots defined.<br />
                Click "Add" to create one.
              </>
            )}
          </EmptyState>
        ) : (
          filteredSlots.map((slot) => {
            // Find original index to pass correct index to callbacks
            const originalIndex = slots.findIndex(s => s === slot);
            return (
              <SlotCard
                key={originalIndex}
                onFocus={() => onSlotFocus(slot.name)}
                onBlur={(e) => {
                  // If the new focus target is not within this card, clear the focus
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    onSlotFocus(null);
                  }
                }}
              >
                <SlotHeader>
                  <SlotName
                    value={slot.name}
                    onChange={(e) => handleFieldChange(originalIndex, 'name', e.target.value)}
                    placeholder="Slot name"
                  />
                  <DeleteButton onClick={() => onDelete(originalIndex)}>
                    ×
                  </DeleteButton>
                </SlotHeader>
                <FieldGroup>
                  <FieldLabel>Type</FieldLabel>
                  <FieldInput
                    value={slot.type}
                    onChange={(e) => handleFieldChange(originalIndex, 'type', e.target.value)}
                    placeholder="e.g., text, list, integer"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Display Name</FieldLabel>
                  <FieldInput
                    value={slot.displayName || ''}
                    onChange={(e) => handleFieldChange(originalIndex, 'displayName', e.target.value)}
                    placeholder="UI display label"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Description</FieldLabel>
                  <FieldInput
                    value={slot.description}
                    onChange={(e) => handleFieldChange(originalIndex, 'description', e.target.value)}
                    placeholder="Describe this slot"
                  />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>Source</FieldLabel>
                  <FieldInput
                    value={slot.source}
                    onChange={(e) => handleFieldChange(originalIndex, 'source', e.target.value)}
                    placeholder="e.g., session, action, user"
                  />
                </FieldGroup>
              </SlotCard>
            );
          })
        )}
      </SlotsContainer>
    </PanelContainer>
  );
};

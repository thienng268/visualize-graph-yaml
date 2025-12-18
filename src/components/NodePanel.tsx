import React, { useEffect, useState, useMemo, useRef } from 'react';
import styled from 'styled-components';
import type { SlotDefinition } from '../utils/transform';
const SidePanel = styled.div`
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  height: 100vh;
  width: 500px;
  background: white;
  border-left: 1px solid #e8e8e8;
  padding: 24px;
  box-shadow: -4px 0 8px rgba(0,0,0,0.05);
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  display: flex;
  flex-direction: column;
  /* padding-bottom: 80px; Removed padding, using Spacer instead */
`;
const Spacer = styled.div`
  height: 100px;
  flex-shrink: 0;
`;
const CheckboxGroup = styled.div`
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const FormGroup = styled.div`
  margin-bottom: 15px;
`;
const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
`;
const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;
const TextArea = styled.textarea`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 80px;
`;
const Title = styled.h3`
  margin-top: 0;
`;
const CloseButton = styled.button`
  float: right;
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
`;

const AutocompleteList = styled.ul`
  position: absolute;
  z-index: 1001;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 200px;
  overflow-y: auto;
  min-width: 200px;
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
`;

const AutocompleteItem = styled.li<{ active?: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  background: ${props => props.active ? '#e6f7ff' : 'transparent'};
  font-size: 0.9em;
  border-bottom: 1px solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #f5f5f5;
  }
  
  strong {
    color: #1890ff;
  }
`;
interface PropertiesPanelProps {
    selectedItem: any | null;
    itemType: 'node' | 'edge' | null;
    onUpdate: (id: string, newData: any, type: 'node' | 'edge') => void;
    onDelete: () => void;
    onClose: () => void;
    flowMetadata?: {
        name: string;
        description: string;
        id?: string;
    };
    onMetadataUpdate?: (meta: { name?: string; description?: string; id?: string }) => void;
    isFlowInfoOpen?: boolean;
    nodes?: any[];
    edges?: any[];
    slots?: SlotDefinition[];
}
const DeleteButton = styled.button`
    background-color: #ff4d4f;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    margin-top: 20px;
    &:hover {
        background-color: #ff7875;
    }
`;

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedItem, itemType, onUpdate, onDelete, onClose, flowMetadata, onMetadataUpdate, isFlowInfoOpen, nodes = [], edges = [], slots = [] }) => {
    const [formData, setFormData] = useState<any>(null);
    const [showCollectSection, setShowCollectSection] = useState(false);
    const [showActionSection, setShowActionSection] = useState(false);
    const utterRef = useRef<HTMLTextAreaElement>(null);
    const actionUtterRef = useRef<HTMLTextAreaElement>(null);
    const lastCursorPos = useRef<number | null>(null);

    // Autocomplete State
    const [autocomplete, setAutocomplete] = useState<{
        show: boolean;
        query: string;
        field: 'utter' | 'action_utter';
        cursorPos: number; // Position where '/' was typed
    } | null>(null);
    useEffect(() => {
        if (selectedItem) {
            if (itemType === 'node') {
                setFormData(selectedItem.data);

                // Initialize toggles based on content
                const data = selectedItem.data;
                const hasAction = !!(data.action?.id || data.action?.description || data.action?.utter || data.action?.sets_slot);
                const hasCollect = !!(data.collect || data.clear_slots);

                setShowCollectSection(hasCollect);
                setShowActionSection(hasAction);

                lastCursorPos.current = null; // Reset cursor tracking on node change
            } else {
                setFormData({
                    id: selectedItem.id,
                    label: selectedItem.label || '',
                    source: selectedItem.source,
                    target: selectedItem.target,
                    style: selectedItem.style,
                    markerEnd: selectedItem.markerEnd,
                    data: selectedItem.data || {} // Include data for edges
                });
            }
        } else {
            setFormData(null); // Reset when nothing selected
        }
    }, [selectedItem, itemType]);

    const trackCursor = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        lastCursorPos.current = target.selectionStart;
    };


    // Autocomplete Logic
    const handleUtteranceChange = (field: 'utter' | 'action_utter', value: string) => {
        // Update form data first
        if (field === 'utter') {
            handleNodeChange('utter', value);
        } else {
            handleActionChange('utter', value);
        }

        // Check for Autocomplete Trigger '/'
        const targetRef = field === 'utter' ? utterRef.current : actionUtterRef.current;
        if (!targetRef) return;

        const cursorPos = targetRef.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);

        // Match '/' followed by non-space characters at the end of textBeforeCursor
        const match = textBeforeCursor.match(/\/([a-zA-Z0-9_]*)$/);

        if (match) {
            setAutocomplete({
                show: true,
                query: match[1],
                field: field,
                cursorPos: cursorPos
            });
        } else {
            setAutocomplete(null);
        }
    };

    const insertSlot = (slotName: string) => {
        if (!autocomplete || !formData) return;

        const field = autocomplete.field;
        const currentText = field === 'utter' ? (formData.utter || '') : (formData.action?.utter || '');
        const targetRef = field === 'utter' ? utterRef.current : actionUtterRef.current;

        // Calculate substitution range
        // We know the pattern ends at the cursor. 
        // We need to find where '/' is relative to cursor.
        // The query length tells us how far back '/' is.
        // query = "ab" -> length 2. "/" is at cursor - 2 - 1.

        // Actually, we captured regex match.
        // let's rely on valid substitution: regex match means .../{query} is just before cursor

        const replaceLength = autocomplete.query.length + 1; // +1 for '/'
        const insertPos = targetRef?.selectionStart || currentText.length;
        const startPos = insertPos - replaceLength;

        const newText = currentText.slice(0, startPos) + `{${slotName}}` + currentText.slice(insertPos);

        if (field === 'utter') {
            handleNodeChange('utter', newText);
        } else {
            handleActionChange('utter', newText);
        }

        setAutocomplete(null);

        // Restore focus and move cursor
        requestAnimationFrame(() => {
            if (targetRef) {
                targetRef.focus();
                const newCursorPos = startPos + slotName.length + 2; // {} length = 2
                targetRef.setSelectionRange(newCursorPos, newCursorPos);
            }
        });
    };

    const filteredSlots = useMemo(() => {
        if (!autocomplete || !autocomplete.show) return [];
        return slots.filter(s => s.name.toLowerCase().includes(autocomplete.query.toLowerCase()));
    }, [slots, autocomplete]);
    // If no item selected, show Flow Details if metadata provided
    if (!selectedItem) {
        if (!isFlowInfoOpen || !flowMetadata || !onMetadataUpdate) return null;
        return (
            <SidePanel>
                <CloseButton onClick={onClose}>&times;</CloseButton>
                <Title>Flow Details</Title>
                <FormGroup>
                    <Label>Flow ID</Label>
                    <Input
                        value={flowMetadata.id || ''}
                        onChange={(e) => onMetadataUpdate({ id: e.target.value })}
                        placeholder="e.g. flow_id"
                    />
                </FormGroup>
                <FormGroup>
                    <Label>Flow Name</Label>
                    <Input
                        value={flowMetadata.name}
                        onChange={(e) => onMetadataUpdate({ name: e.target.value })}
                    />
                </FormGroup>
                <FormGroup>
                    <Label>Description</Label>
                    <TextArea
                        value={flowMetadata.description}
                        onChange={(e) => onMetadataUpdate({ description: e.target.value })}
                    />
                </FormGroup>
            </SidePanel>
        );
    }
    if (!formData) return null;
    const handleChange = (field: string, value: any) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);
        // Propagate update
        if (itemType === 'node') {
            onUpdate(selectedItem.id, updated, 'node');
        } else {
            // For edges, we need to separate structural props vs data props
            // ID, source, target are immutable here usually. Label is top level.
            // clear_slots is in 'data'.
            // If field is 'clear_slots', update nested data
            if (field === 'clear_slots') {
                const newData = { ...formData.data, clear_slots: value };
                const updatedForm = { ...formData, data: newData };
                setFormData(updatedForm); // Update UI state
                onUpdate(selectedItem.id, { label: updatedForm.label, data: newData }, 'edge');
            } else {
                // Root property update (label)
                onUpdate(selectedItem.id, { label: value, data: formData.data }, 'edge');
            }
        }
    };
    // Existing node handlers...
    const handleNodeChange = (field: string, value: string) => {
        const updated = { ...formData, [field]: value };
        if (field.startsWith('action.')) {
            const actionField = field.split('.')[1];
            updated.action = { ...formData.action, [actionField]: value };
            delete updated[field];
        }
        setFormData(updated);
        onUpdate(selectedItem.id, updated, 'node');
    };
    const handleActionChange = (field: string, value: string) => {
        const updatedAction = { ...formData.action, [field]: value };
        const updated = { ...formData, action: updatedAction };
        setFormData(updated);
        onUpdate(selectedItem.id, updated, 'node');
    }

    // Determine visibility
    // const hasAction = ... (removed auto-logic)
    // const hasCollect = ... (removed auto-logic)


    return (
        <SidePanel>
            <CloseButton onClick={onClose}>&times;</CloseButton>
            <Title>{itemType === 'node' ? 'Node Details' : 'Edge Details'}</Title>
            {itemType === 'node' ? (
                // Node Form
                <>
                    <FormGroup>
                        <Label>ID</Label>
                        <Input
                            value={formData.id || ''}
                            onChange={(e) => handleNodeChange('id', e.target.value)}
                        />
                    </FormGroup>
                    {/* Top-level Utterance */}
                    <FormGroup style={{ position: 'relative' }}>
                        <Label>Utterance (Main)</Label>
                        <TextArea
                            ref={utterRef}
                            value={formData.utter || ''}
                            onChange={(e) => handleUtteranceChange('utter', e.target.value)}
                            onSelect={trackCursor}
                            onClick={trackCursor}
                            onKeyUp={trackCursor}
                            onBlur={trackCursor}
                            placeholder="User says... (Type / for autofill slot)"
                        />
                        {autocomplete?.show && autocomplete.field === 'utter' && (
                            <AutocompleteList>
                                {filteredSlots.length > 0 ? filteredSlots.map(slot => (
                                    <AutocompleteItem key={slot.name} onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent blur
                                        insertSlot(slot.name);
                                    }}>
                                        {slot.name}
                                    </AutocompleteItem>
                                )) : (
                                    <AutocompleteItem style={{ color: '#999', cursor: 'default' }}>No slots found</AutocompleteItem>
                                )}
                            </AutocompleteList>
                        )}
                    </FormGroup>

                    <FormGroup>
                        <Label>Description</Label>
                        <TextArea
                            value={formData.description || ''}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Node description"
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>Rejections (JSON)</Label>
                        <TextArea
                            value={typeof formData.rejections === 'string' ? formData.rejections : JSON.stringify(formData.rejections || [], null, 2)}
                            onChange={(e) => {
                                const val = e.target.value;
                                try {
                                    const parsed = JSON.parse(val);
                                    handleChange('rejections', parsed);
                                } catch {
                                    handleChange('rejections', val);
                                }
                            }}
                        />
                    </FormGroup>

                    <CheckboxGroup>
                        <input
                            type="checkbox"
                            id="showCollect"
                            checked={showCollectSection}
                            onChange={(e) => setShowCollectSection(e.target.checked)}
                        />
                        <Label htmlFor="showCollect" style={{ marginBottom: 0 }}>Collect & Clear Slots</Label>
                    </CheckboxGroup>

                    {showCollectSection && (
                        <div style={{ paddingLeft: '10px', borderLeft: '2px solid #eee', marginBottom: '15px' }}>
                            <FormGroup>
                                <Label>Collect</Label>
                                <Input value={formData.collect || ''} onChange={(e) => handleChange('collect', e.target.value)} />
                            </FormGroup>
                            <FormGroup>
                                <Label>Clear Slots</Label>
                                <Input
                                    value={formData.clear_slots || ''}
                                    onChange={(e) => handleChange('clear_slots', e.target.value)}
                                    placeholder="e.g. [slot1, slot2]"
                                />
                            </FormGroup>
                        </div>
                    )}

                    <CheckboxGroup>
                        <input
                            type="checkbox"
                            id="showAction"
                            checked={showActionSection}
                            onChange={(e) => setShowActionSection(e.target.checked)}
                        />
                        <Label htmlFor="showAction" style={{ marginBottom: 0 }}>Action Details</Label>
                    </CheckboxGroup>

                    {showActionSection && (
                        <div style={{ paddingLeft: '10px', borderLeft: '2px solid #eee' }}>
                            <FormGroup>
                                <Label>Action ID</Label>
                                <Input
                                    value={formData.action?.id || ''}
                                    onChange={(e) => handleActionChange('id', e.target.value)}
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label>Action Description</Label>
                                <TextArea
                                    value={formData.action?.description || ''}
                                    onChange={(e) => handleActionChange('description', e.target.value)}
                                />
                            </FormGroup>
                            <FormGroup style={{ position: 'relative' }}>
                                <Label>Action Utterance</Label>
                                <TextArea
                                    ref={actionUtterRef}
                                    value={formData.action?.utter || ''}
                                    onChange={(e) => handleUtteranceChange('action_utter', e.target.value)}
                                    placeholder="Type / for autocomplete"
                                />
                                {autocomplete?.show && autocomplete.field === 'action_utter' && (
                                    <AutocompleteList>
                                        {filteredSlots.length > 0 ? filteredSlots.map(slot => (
                                            <AutocompleteItem key={slot.name} onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent blur
                                                insertSlot(slot.name);
                                            }}>
                                                {slot.name}
                                            </AutocompleteItem>
                                        )) : (
                                            <AutocompleteItem style={{ color: '#999', cursor: 'default' }}>No slots found</AutocompleteItem>
                                        )}
                                    </AutocompleteList>
                                )}
                            </FormGroup>
                            <FormGroup>
                                <Label>Set Slot</Label>
                                <Input
                                    value={formData.action?.sets_slot || ''}
                                    onChange={(e) => handleActionChange('sets_slot', e.target.value)}
                                />
                            </FormGroup>
                        </div>
                    )}
                </>
            ) : (
                // Edge Form
                <>
                    <FormGroup>
                        <Label>Edge ID</Label>
                        <Input value={formData.id} disabled />
                    </FormGroup>
                    <FormGroup>
                        <Label>Source Node</Label>
                        <Input value={formData.source} disabled />
                    </FormGroup>
                    <FormGroup>
                        <Label>Target Node</Label>
                        <Input value={formData.target} disabled />
                    </FormGroup>
                    <FormGroup>
                        <Label>Label / Condition</Label>
                        <Input
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Clear Slots</Label>
                        <Input
                            value={formData.data?.clear_slots || ''}
                            onChange={(e) => handleChange('clear_slots', e.target.value)}
                            placeholder="e.g. [slot1, slot2]"
                        />
                    </FormGroup>
                </>
            )}
            {/* Common Delete Button */}
            <DeleteButton onClick={onDelete}>
                Delete {itemType === 'node' ? 'Node' : 'Edge'}
            </DeleteButton>
            <Spacer />
        </SidePanel>
    );
};
import React, { useEffect, useState, useMemo, useRef } from 'react';
import styled from 'styled-components';
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
interface PropertiesPanelProps {
    selectedItem: any | null;
    itemType: 'node' | 'edge' | null;
    onUpdate: (id: string, newData: any, type: 'node' | 'edge') => void;
    onDelete: () => void;
    onClose: () => void;
    flowMetadata?: {
        name: string;
        description: string;
        rootKey: string;
    };
    onMetadataUpdate?: (meta: { name?: string; description?: string; rootKey?: string }) => void;
    isFlowInfoOpen?: boolean;
    nodes?: any[];
    edges?: any[];
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
const InsertSelect = styled.select`
    margin-left: 10px;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid #ddd;
    font-size: 0.9em;
    width: 200px;
`;
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedItem, itemType, onUpdate, onDelete, onClose, flowMetadata, onMetadataUpdate, isFlowInfoOpen, nodes = [], edges = [] }) => {
    const [formData, setFormData] = useState<any>(null);
    const utterRef = useRef<HTMLTextAreaElement>(null);
    const lastCursorPos = useRef<number | null>(null);
    useEffect(() => {
        if (selectedItem) {
            if (itemType === 'node') {
                setFormData(selectedItem.data);
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
    // Calculate available variables from ancestors
    const availableVariables = useMemo(() => {
        if (!selectedItem || itemType !== 'node' || !nodes.length) return [];
        const ancestors = new Set<string>();
        const queue = [selectedItem.id];
        const visited = new Set<string>();
        const variables = new Set<string>();
        // BFS backwards to find all ancestors
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            // Find incoming edges to current node
            const incomingEdges = edges.filter(e => e.target === currentId);
            for (const edge of incomingEdges) {
                if (!visited.has(edge.source)) {
                    queue.push(edge.source);
                    ancestors.add(edge.source);
                }
            }
        }
        // Collect variables from ancestors
        ancestors.forEach(ancestorId => {
            const node = nodes.find(n => n.id === ancestorId);
            if (node && node.data && node.data.collect) {
                variables.add(node.data.collect);
            }
        });
        return Array.from(variables);
    }, [selectedItem, itemType, nodes, edges]);
    const trackCursor = () => {
        if (utterRef.current) {
            lastCursorPos.current = utterRef.current.selectionStart;
        }
    };
    const handleInsertVariable = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const variable = e.target.value;
        if (!variable) return;

        // Do nothing if user hasn't clicked in the textarea
        if (lastCursorPos.current === null) {
            e.target.value = '';
            return;
        }

        if (formData) {
            const text = formData.utter || '';
            const insertion = `{${variable}}`;
            const pos = lastCursorPos.current;
            const newText = text.substring(0, pos) + insertion + text.substring(pos);
            const updated = { ...formData, utter: newText };
            setFormData(updated);
            onUpdate(selectedItem.id, updated, 'node');
            // Update cursor position
            lastCursorPos.current = pos + insertion.length;
            // Focus and set cursor
            requestAnimationFrame(() => {
                if (utterRef.current) {
                    utterRef.current.focus();
                    utterRef.current.setSelectionRange(lastCursorPos.current!, lastCursorPos.current!);
                }
            });
        }
        e.target.value = '';
    };
    // If no item selected, show Flow Details if metadata provided
    if (!selectedItem) {
        if (!isFlowInfoOpen || !flowMetadata || !onMetadataUpdate) return null;
        return (
            <SidePanel>
                <CloseButton onClick={onClose}>&times;</CloseButton>
                <Title>Flow Details</Title>
                <FormGroup>
                    <Label>Root Key</Label>
                    <Input
                        value={flowMetadata.rootKey}
                        onChange={(e) => onMetadataUpdate({ rootKey: e.target.value })}
                        placeholder="e.g. flow_khoa_the"
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
                    <FormGroup>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <Label style={{ marginBottom: 0 }}>Utterance (Main)</Label>
                            {availableVariables.length > 0 && (
                                <InsertSelect onChange={handleInsertVariable} defaultValue="">
                                    <option value="" disabled>Insert Variable...</option>
                                    {availableVariables.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </InsertSelect>
                            )}
                        </div>
                        <TextArea
                            ref={utterRef}
                            value={formData.utter || ''}
                            onChange={(e) => handleNodeChange('utter', e.target.value)}
                            onSelect={trackCursor}
                            onClick={trackCursor}
                            onKeyUp={trackCursor}
                            onBlur={trackCursor}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Collect</Label>
                        <Input value={formData.collect || ''} onChange={(e) => handleChange('collect', e.target.value)} />
                    </FormGroup>
                    <h4 style={{ marginBottom: '5px', borderTop: '1px solid #eee', paddingTop: '10px' }}>Action Details</h4>
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
                    <FormGroup>
                        <Label>Sets Slot</Label>
                        <Input
                            value={formData.action?.sets_slot || ''}
                            onChange={(e) => handleActionChange('sets_slot', e.target.value)}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Clear Slots</Label>
                        <Input
                            value={formData.action?.clear_slots || ''}
                            onChange={(e) => handleActionChange('clear_slots', e.target.value)}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Action Utterance</Label>
                        <TextArea
                            value={formData.action?.utter || ''}
                            onChange={(e) => handleActionChange('utter', e.target.value)}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Rejections (JSON)</Label>
                        <TextArea
                            value={typeof formData.rejections === 'string' ? formData.rejections : JSON.stringify(formData.rejections || [], null, 2)}
                            onChange={(e) => {
                                const val = e.target.value;
                                // Try to parse to object if possible, otherwise keep as string until valid
                                try {
                                    const parsed = JSON.parse(val);
                                    handleChange('rejections', parsed);
                                } catch {
                                    handleChange('rejections', val);
                                }
                            }}
                        />
                    </FormGroup>
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
        </SidePanel>
    );
};
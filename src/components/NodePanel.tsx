import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const SidePanel = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: white;
  border-left: 1px solid #ddd;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0,0,0,0.1);
  overflow-y: auto;
  z-index: 10;
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

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedItem, itemType, onUpdate, onDelete, onClose }) => {
    const [formData, setFormData] = useState<any>(null);

    useEffect(() => {
        if (selectedItem) {
            // If it's a node, use data. If edge, use root properties like label or data if generic
            if (itemType === 'node') {
                setFormData(selectedItem.data);
            } else {
                setFormData({
                    id: selectedItem.id,
                    label: selectedItem.label || '',
                    source: selectedItem.source,
                    target: selectedItem.target,
                    style: selectedItem.style,
                    markerEnd: selectedItem.markerEnd
                });
            }
        }
    }, [selectedItem, itemType]);

    if (!selectedItem || !formData) return null;

    const handleChange = (field: string, value: any) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);

        // Propagate update
        // For edge, we pass the structural properties directly back
        // For node, we pass the 'data' object back
        if (itemType === 'node') {
            // ... existing node logic ...
            if (field.startsWith('action.')) {
                // handle nested
            }
            onUpdate(selectedItem.id, updated, 'node');
        } else {
            // For edges, we update the edge object structure
            onUpdate(selectedItem.id, { ...updated }, 'edge');
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
                            disabled
                        />
                    </FormGroup>

                    {/* Top-level Utterance */}
                    <FormGroup>
                        <Label>Utterance (Main)</Label>
                        <TextArea
                            value={formData.utter || ''}
                            onChange={(e) => handleNodeChange('utter', e.target.value)}
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
                                    // If invalid JSON, we might need a way to store the raw string in local state 
                                    // separate from the actual node data, or just update it as string 
                                    // and let the backend/transformer handle it. 
                                    // For now, let's update it as a raw string to allow typing
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
                </>
            )}
            {/* Common Delete Button */}
            <DeleteButton onClick={onDelete}>
                Delete {itemType === 'node' ? 'Node' : 'Edge'}
            </DeleteButton>
        </SidePanel>
    );
};

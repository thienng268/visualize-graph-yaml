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

interface NodePanelProps {
    selectedNode: any | null;
    onUpdate: (nodeId: string, newData: any) => void;
    onClose: () => void;
}

export const NodePanel: React.FC<NodePanelProps> = ({ selectedNode, onUpdate, onClose }) => {
    const [formData, setFormData] = useState<any>(null);

    useEffect(() => {
        if (selectedNode) {
            setFormData(selectedNode.data);
        }
    }, [selectedNode]);

    if (!selectedNode || !formData) return null;

    const handleChange = (field: string, value: string) => {
        const updated = { ...formData, [field]: value };
        // If nested action field
        if (field.startsWith('action.')) {
            const actionField = field.split('.')[1];
            updated.action = { ...formData.action, [actionField]: value };
            delete updated[field]; // cleanup flat key if accidental
        }

        setFormData(updated);
        onUpdate(selectedNode.id, updated);
    };

    const handleActionChange = (field: string, value: string) => {
        const updatedAction = { ...formData.action, [field]: value };
        const updated = { ...formData, action: updatedAction };
        setFormData(updated);
        onUpdate(selectedNode.id, updated);
    }

    return (
        <SidePanel>
            <CloseButton onClick={onClose}>&times;</CloseButton>
            <Title>Node Details</Title>

            <FormGroup>
                <Label>ID</Label>
                <Input
                    value={formData.id || ''}
                    onChange={(e) => handleChange('id', e.target.value)}
                    disabled // ID changes are complex due to edges, kept read-only for now
                />
            </FormGroup>

            {formData.action && (
                <>
                    <FormGroup>
                        <Label>Action ID</Label>
                        <Input
                            value={formData.action.id || ''}
                            onChange={(e) => handleActionChange('id', e.target.value)}
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>Description</Label>
                        <TextArea
                            value={formData.action.description || ''}
                            onChange={(e) => handleActionChange('description', e.target.value)}
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>Utterance</Label>
                        <TextArea
                            value={formData.action.utter || ''}
                            onChange={(e) => handleActionChange('utter', e.target.value)}
                        />
                    </FormGroup>
                </>
            )}

            <p style={{ fontSize: '0.8em', color: '#666' }}>
                * Graph structure (Edges) is managed via the canvas provided by ReactFlow.
            </p>

        </SidePanel>
    );
};

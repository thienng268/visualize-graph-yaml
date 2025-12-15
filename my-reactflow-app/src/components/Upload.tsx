import React, { ChangeEvent } from 'react';
import yaml from 'js-yaml';
import styled from 'styled-components';

const Container = styled.div`
  margin-bottom: 20px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: center;
`;

const FileInput = styled.input`
  display: none;
`;

const UploadButton = styled.label`
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: #0056b3;
  }
`;

interface UploadProps {
    onLoad: (data: any) => void;
}

export const Upload: React.FC<UploadProps> = ({ onLoad }) => {
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    // Clean up the input string if needed or parse directly
                    // The user provided example implies a list of nodes
                    const parsed = yaml.load(content);
                    onLoad(parsed);
                } catch (error) {
                    console.error('Error parsing YAML:', error);
                    alert('Invalid YAML file');
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <Container>
            <h3>Upload Workflow YAML</h3>
            <UploadButton>
                Select File
                <FileInput type="file" accept=".yaml,.yml" onChange={handleFileChange} />
            </UploadButton>
        </Container>
    );
};

import React, { type ChangeEvent } from 'react';
import yaml from 'js-yaml';
import styled from 'styled-components';

const UploadButton = styled.label`
    background-color: #1890ff; /* Blue to match Download or distinct? User said 'similar to two buttons'. Download is blue, Add is Green. Let's make this default Blue or maybe orange? Let's stick to Blue like the old one but styled like ControlButton */
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    box-sizing: border-box; /* Ensure padding is included in width */
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    width: 160px; /* Fixed width for uniformity */
    text-align: center;
    display: inline-block; /* label needs this to behave like button */
    
    &:hover {
        background-color: #40a9ff;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.15);
    }

    &:active {
        transform: translateY(0);
    }
`;

const FileInput = styled.input`
  display: none;
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
        <UploadButton>
            Upload YAML
            <FileInput type="file" accept=".yaml,.yml" onChange={handleFileChange} />
        </UploadButton>
    );
};

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import styled from 'styled-components';

const NodeCard = styled.div`
  width: 180px;
  min-height: 40px;
  padding: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 12px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
  
  &:hover {
      box-shadow: 4px 4px 10px rgba(0,0,0,0.2);
  }
`;

const Header = styled.div`
  font-weight: bold;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  margin-bottom: 5px;
  font-size: 14px;
`;

export const CustomNode = memo(({ data, isConnectable }: NodeProps) => {
    return (
        <NodeCard>
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                style={{ background: '#555' }}
            />

            <Header style={{ borderBottom: 'none', marginBottom: 0, textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {data.label || data.id}
            </Header>

            {/* 
        User requested "Simply displaying the ID name". 
        Removing detailed content to keep it clean. 
      */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {data.label || data.id}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                style={{ background: '#555' }}
            />
        </NodeCard>
    );
});

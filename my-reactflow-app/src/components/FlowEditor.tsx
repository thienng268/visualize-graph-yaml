import React, { useState, useCallback } from 'react';
import ReactFlow, {
    addEdge,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Connection,
    Edge,
    Node,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';

import { Upload } from './Upload';
import { NodePanel } from './NodePanel';
import { transformYamlToFlow } from '../utils/transform';

const EditorContainer = styled.div`
  height: 80vh;
  width: 100%;
  border: 1px solid #ddd;
  position: relative;
`;

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  height: 100vh;
  box-sizing: border-box;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

export const FlowEditor: React.FC = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const handleYamlLoad = (data: any) => {
        // Assuming data is array
        if (Array.isArray(data)) {
            const { nodes: flowNodes, edges: flowEdges } = transformYamlToFlow(data);
            setNodes(flowNodes);
            setEdges(flowEdges);
        }
    };

    const onNodeClick = (_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    };

    const onPaneClick = () => {
        setSelectedNode(null);
    };

    // Callback to update node data from the panel
    const updateNodeData = (nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: newData };
                }
                return node;
            })
        );
        // Update selected node state as well to keep UI in sync
        setSelectedNode((prev) => prev ? { ...prev, data: newData } : null);
    };

    return (
        <Layout>
            <Header>
                <h1>Workflow Visualizer</h1>
                <Upload onLoad={handleYamlLoad} />
            </Header>

            <EditorContainer>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    fitView
                >
                    <Controls />
                    <MiniMap />
                    <Background gap={12} size={1} />
                </ReactFlow>

                <NodePanel
                    selectedNode={selectedNode}
                    onUpdate={updateNodeData}
                    onClose={() => setSelectedNode(null)}
                />
            </EditorContainer>
        </Layout>
    );
};

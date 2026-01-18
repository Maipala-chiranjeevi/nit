// src/components/SkillTree.jsx
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom Node for "Fog of War" feel
const SkillNode = ({ data }) => {
    const isLocked = data.status === 'locked';
    const isMastered = data.status === 'mastered';

    return (
        <div className={`px-4 py-2 rounded-lg shadow-lg border-2 min-w-[150px] text-center transition-all duration-300
      ${isLocked ? 'bg-slate-800 border-slate-700 opacity-50 blur-[1px]' :
                isMastered ? 'bg-primary/20 border-primary text-primary-light shadow-primary/20' :
                    'bg-surface-dark border-white/20 text-white'}`}>
            <Handle type="target" position={Position.Top} className="!bg-slate-500" />
            <div className="font-bold text-sm">{data.label}</div>
            {!isLocked && (
                <div className="text-xs mt-1 text-slate-400">
                    {data.progress}% Complete
                </div>
            )}
            {isLocked && <div className="text-xs mt-1 text-slate-600">Locked</div>}
            <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
        </div>
    );
};

const nodeTypes = {
    skill: SkillNode,
};

const initialNodes = [
    { id: '1', type: 'skill', position: { x: 250, y: 0 }, data: { label: 'Foundations', status: 'mastered', progress: 100 } },
    { id: '2', type: 'skill', position: { x: 100, y: 100 }, data: { label: 'Algorithms', status: 'available', progress: 45 } },
    { id: '3', type: 'skill', position: { x: 400, y: 100 }, data: { label: 'Data Structures', status: 'available', progress: 30 } },
    { id: '4', type: 'skill', position: { x: 100, y: 200 }, data: { label: 'Dynamic Programming', status: 'locked', progress: 0 } },
    { id: '5', type: 'skill', position: { x: 400, y: 200 }, data: { label: 'Graph Theory', status: 'locked', progress: 0 } },
];

const initialEdges = [
    { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#4facfe' } },
    { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#4facfe' } },
    { id: 'e2-4', source: '2', target: '4', style: { stroke: '#334155' } }, // Grey for locked
    { id: 'e3-5', source: '3', target: '5', style: { stroke: '#334155' } },
];

const SkillTree = () => {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    const proOptions = { hideAttribution: true };

    return (
        <div className="h-[500px] w-full glass-panel rounded-2xl overflow-hidden">
            <h3 className="absolute top-4 left-4 z-10 text-lg font-bold text-white/50 pointer-events-none">Knowledge Map</h3>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                proOptions={proOptions}
                className="bg-transparent"
            >
                <Background color="#fff" gap={16} size={1} className="opacity-5" />
                <Controls className="!bg-surface-dark !border-white/10 !fill-white" />
            </ReactFlow>
        </div>
    );
};

export default SkillTree;

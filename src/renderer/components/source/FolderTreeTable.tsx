import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Column } from 'primereact/column';
import { TreeTable } from 'primereact/treetable';
import type { TreeNode } from 'primereact/treenode';
import type {
  FolderTreeNode,
  FolderTreeSelectionKey,
  FolderTreeSelectionKeys
} from '../../../shared/types/folderTree';
import { formatBytes } from '../../helpers/fileSize';

interface FolderTreeTableProps {
  root: FolderTreeNode | null;
  selectionKeys: FolderTreeSelectionKeys;
  onSelectionKeysChange: (selectionKeys: FolderTreeSelectionKeys) => void;
  onSelectedFolderPathsChange?: (paths: string[]) => void;
  emptyMessage?: string;
  scrollHeight?: string;
  showDirectColumns?: boolean;
}

interface FolderTreeTableNodeData {
  folder: FolderTreeNode;
  name: string;
  path: string;
  relativePath: string;
  directVideoCount: number;
  totalVideoCount: number;
  directVideoSizeBytes: number;
  totalVideoSizeBytes: number;
}

type FolderTreePrimeNode = TreeNode & {
  key: string;
  data: FolderTreeTableNodeData;
  children: FolderTreePrimeNode[];
};

export function FolderTreeTable({
  root,
  selectionKeys,
  onSelectionKeysChange,
  onSelectedFolderPathsChange,
  emptyMessage = 'No folder tree loaded.',
  scrollHeight = '440px',
  showDirectColumns = false
}: FolderTreeTableProps): ReactElement {
  const nodes = useMemo(() => (root ? [toPrimeTreeNode(root)] : []), [root]);
  const nodePathByKey = useMemo(() => buildNodePathMap(nodes), [nodes]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedKeys(root ? { [root.key]: true } : {});
  }, [root]);

  const handleSelectionChange = (nextSelectionKeys: FolderTreeSelectionKeys): void => {
    onSelectionKeysChange(nextSelectionKeys);
    onSelectedFolderPathsChange?.(getCheckedFolderPaths(nextSelectionKeys, nodePathByKey));
  };

  return (
    <div className="folder-tree-table-shell">
      <TreeTable
        value={nodes}
        selectionMode="checkbox"
        selectionKeys={selectionKeys}
        expandedKeys={expandedKeys}
        onSelectionChange={(event) =>
          handleSelectionChange(normalizeSelectionKeys(event.value))
        }
        onToggle={(event) => setExpandedKeys(event.value ?? {})}
        className="folder-tree-table"
        tableStyle={{ minWidth: showDirectColumns ? '860px' : '680px' }}
        emptyMessage={emptyMessage}
        scrollable
        scrollHeight={scrollHeight}
      >
        <Column
          field="name"
          header="Folder"
          expander
          sortable
          body={(node: FolderTreePrimeNode) => <FolderNameCell node={node} />}
        />
        <Column
          field="totalVideoCount"
          header="Videos"
          sortable
          body={(node: FolderTreePrimeNode) => node.data.totalVideoCount.toLocaleString()}
          style={{ width: '8rem' }}
          bodyClassName="folder-tree-number-cell"
        />
        <Column
          field="totalVideoSizeBytes"
          header="Video Size"
          sortable
          body={(node: FolderTreePrimeNode) => formatBytes(node.data.totalVideoSizeBytes)}
          style={{ width: '9.5rem' }}
          bodyClassName="folder-tree-number-cell"
        />
        {showDirectColumns ? (
          <Column
            field="directVideoCount"
            header="Direct Videos"
            sortable
            body={(node: FolderTreePrimeNode) => node.data.directVideoCount.toLocaleString()}
            style={{ width: '9rem' }}
            bodyClassName="folder-tree-number-cell"
          />
        ) : null}
        {showDirectColumns ? (
          <Column
            field="directVideoSizeBytes"
            header="Direct Size"
            sortable
            body={(node: FolderTreePrimeNode) => formatBytes(node.data.directVideoSizeBytes)}
            style={{ width: '9rem' }}
            bodyClassName="folder-tree-number-cell"
          />
        ) : null}
      </TreeTable>
    </div>
  );
}

function FolderNameCell({ node }: { node: FolderTreePrimeNode }): ReactElement {
  const folder = node.data.folder;
  const detail = folder.relativePath || folder.path;

  return (
    <span className="folder-tree-name-cell" title={folder.path}>
      <i className={folder.status === 'error' ? 'pi pi-exclamation-triangle' : 'pi pi-folder'} />
      <span className="folder-tree-name-copy">
        <strong>{folder.name}</strong>
        <small>{detail}</small>
      </span>
    </span>
  );
}

function toPrimeTreeNode(node: FolderTreeNode): FolderTreePrimeNode {
  const children = node.children.map(toPrimeTreeNode);

  return {
    key: node.key,
    data: {
      folder: node,
      name: node.name,
      path: node.path,
      relativePath: node.relativePath,
      directVideoCount: node.directVideoCount,
      totalVideoCount: node.totalVideoCount,
      directVideoSizeBytes: node.directVideoSizeBytes,
      totalVideoSizeBytes: node.totalVideoSizeBytes
    },
    children,
    leaf: children.length === 0
  };
}

function buildNodePathMap(nodes: FolderTreePrimeNode[]): Map<string, string> {
  const nodePathByKey = new Map<string, string>();

  function visit(node: FolderTreePrimeNode): void {
    nodePathByKey.set(node.key, node.data.path);
    node.children.forEach(visit);
  }

  nodes.forEach(visit);
  return nodePathByKey;
}

function normalizeSelectionKeys(value: unknown): FolderTreeSelectionKeys {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as FolderTreeSelectionKeys;
}

function getCheckedFolderPaths(
  selectionKeys: FolderTreeSelectionKeys,
  nodePathByKey: Map<string, string>
): string[] {
  return Object.entries(selectionKeys)
    .filter(([, value]) => isCheckedSelectionKey(value))
    .map(([key]) => nodePathByKey.get(key))
    .filter((path): path is string => Boolean(path));
}

function isCheckedSelectionKey(value: FolderTreeSelectionKey | undefined): boolean {
  return Boolean(value && value.checked === true);
}

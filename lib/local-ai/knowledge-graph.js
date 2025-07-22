/**
 * Knowledge Graph for local project knowledge mapping
 * Builds and maintains a graph of project relationships and dependencies
 */
export class KnowledgeGraph {
  constructor() {
    // Node types in the graph
    this.nodeTypes = {
      FILE: 'file',
      FUNCTION: 'function',
      CLASS: 'class',
      MODULE: 'module',
      COMPONENT: 'component',
      DEPENDENCY: 'dependency',
      TEST: 'test',
      DOCUMENTATION: 'documentation',
    };

    // Edge types (relationships)
    this.edgeTypes = {
      IMPORTS: 'imports',
      EXPORTS: 'exports',
      CALLS: 'calls',
      EXTENDS: 'extends',
      IMPLEMENTS: 'implements',
      TESTS: 'tests',
      DOCUMENTS: 'documents',
      DEPENDS_ON: 'depends_on',
      SIMILAR_TO: 'similar_to',
    };

    // Graph storage
    this.nodes = new Map();
    this.edges = new Map();
    this.reverseEdges = new Map(); // For efficient reverse lookups
    
    // Indexing for fast queries
    this.typeIndex = new Map(); // Nodes by type
    this.nameIndex = new Map(); // Nodes by name
    
    // Graph metadata
    this.metadata = {
      created: Date.now(),
      lastUpdated: Date.now(),
      nodeCount: 0,
      edgeCount: 0,
    };
  }

  /**
   * Add a node to the graph
   */
  addNode(id, properties) {
    const node = {
      id,
      type: properties.type || this.nodeTypes.FILE,
      name: properties.name || id,
      path: properties.path,
      metadata: properties.metadata || {},
      created: Date.now(),
      updated: Date.now(),
    };

    this.nodes.set(id, node);
    
    // Update indexes
    this.indexNode(node);
    
    // Update metadata
    this.metadata.nodeCount++;
    this.metadata.lastUpdated = Date.now();

    return node;
  }

  /**
   * Add an edge between nodes
   */
  addEdge(fromId, toId, type, properties = {}) {
    // Ensure both nodes exist
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error(`Cannot create edge: nodes ${fromId} or ${toId} not found`);
    }

    const edgeId = `${fromId}-${type}-${toId}`;
    const edge = {
      id: edgeId,
      from: fromId,
      to: toId,
      type,
      weight: properties.weight || 1,
      metadata: properties.metadata || {},
      created: Date.now(),
    };

    // Store edge
    this.edges.set(edgeId, edge);
    
    // Update forward edges index
    if (!this.edges.has(fromId)) {
      this.edges.set(fromId, new Map());
    }
    this.edges.get(fromId).set(edgeId, edge);
    
    // Update reverse edges index
    if (!this.reverseEdges.has(toId)) {
      this.reverseEdges.set(toId, new Map());
    }
    this.reverseEdges.get(toId).set(edgeId, edge);
    
    // Update metadata
    this.metadata.edgeCount++;
    this.metadata.lastUpdated = Date.now();

    return edge;
  }

  /**
   * Build graph from project analysis
   */
  async buildFromProject(projectAnalysis) {
    // Add file nodes
    for (const file of projectAnalysis.files || []) {
      this.addNode(file.path, {
        type: this.nodeTypes.FILE,
        name: file.name,
        path: file.path,
        metadata: {
          size: file.size,
          language: file.language,
          lastModified: file.lastModified,
        },
      });
    }

    // Add function and class nodes
    for (const file of projectAnalysis.files || []) {
      if (file.analysis) {
        // Add functions
        for (const func of file.analysis.functions || []) {
          const funcId = `${file.path}:${func.name}`;
          this.addNode(funcId, {
            type: this.nodeTypes.FUNCTION,
            name: func.name,
            path: file.path,
            metadata: {
              lineNumber: func.line,
              complexity: func.complexity,
              parameters: func.parameters,
            },
          });
          
          // Connect function to file
          this.addEdge(file.path, funcId, this.edgeTypes.EXPORTS);
        }

        // Add classes
        for (const cls of file.analysis.classes || []) {
          const classId = `${file.path}:${cls.name}`;
          this.addNode(classId, {
            type: this.nodeTypes.CLASS,
            name: cls.name,
            path: file.path,
            metadata: {
              lineNumber: cls.line,
              methods: cls.methods,
              properties: cls.properties,
            },
          });
          
          // Connect class to file
          this.addEdge(file.path, classId, this.edgeTypes.EXPORTS);
        }

        // Add import relationships
        for (const imp of file.analysis.imports || []) {
          const targetFile = this.resolveImport(imp.source, file.path);
          if (targetFile && this.nodes.has(targetFile)) {
            this.addEdge(file.path, targetFile, this.edgeTypes.IMPORTS, {
              metadata: { importedSymbols: imp.symbols },
            });
          }
        }
      }
    }

    // Add test relationships
    this.connectTests(projectAnalysis);
    
    // Add similarity relationships
    await this.addSimilarityEdges(projectAnalysis);

    return this.getGraphSummary();
  }

  /**
   * Query the graph
   */
  query(queryType, parameters = {}) {
    switch (queryType) {
      case 'dependencies':
        return this.queryDependencies(parameters.nodeId, parameters.depth || 1);
      
      case 'dependents':
        return this.queryDependents(parameters.nodeId, parameters.depth || 1);
      
      case 'similar':
        return this.querySimilarNodes(parameters.nodeId, parameters.limit || 5);
      
      case 'path':
        return this.findPath(parameters.from, parameters.to, parameters.maxDepth || 5);
      
      case 'impact':
        return this.analyzeImpact(parameters.nodeId, parameters.changeType);
      
      case 'clusters':
        return this.findClusters(parameters.minSize || 3);
      
      case 'central':
        return this.findCentralNodes(parameters.limit || 10);
      
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }
  }

  /**
   * Query dependencies of a node
   */
  queryDependencies(nodeId, depth = 1) {
    const visited = new Set();
    const dependencies = [];
    
    const traverse = (id, currentDepth) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);
      
      const edges = this.edges.get(id);
      if (!edges) return;
      
      for (const [, edge] of edges) {
        if (edge.type === this.edgeTypes.IMPORTS || 
            edge.type === this.edgeTypes.DEPENDS_ON ||
            edge.type === this.edgeTypes.CALLS) {
          const targetNode = this.nodes.get(edge.to);
          if (targetNode) {
            dependencies.push({
              node: targetNode,
              relationship: edge.type,
              depth: currentDepth,
            });
            traverse(edge.to, currentDepth + 1);
          }
        }
      }
    };
    
    traverse(nodeId, 1);
    return dependencies;
  }

  /**
   * Query dependents of a node
   */
  queryDependents(nodeId, depth = 1) {
    const visited = new Set();
    const dependents = [];
    
    const traverse = (id, currentDepth) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);
      
      const edges = this.reverseEdges.get(id);
      if (!edges) return;
      
      for (const [, edge] of edges) {
        if (edge.type === this.edgeTypes.IMPORTS || 
            edge.type === this.edgeTypes.DEPENDS_ON ||
            edge.type === this.edgeTypes.CALLS) {
          const sourceNode = this.nodes.get(edge.from);
          if (sourceNode) {
            dependents.push({
              node: sourceNode,
              relationship: edge.type,
              depth: currentDepth,
            });
            traverse(edge.from, currentDepth + 1);
          }
        }
      }
    };
    
    traverse(nodeId, 1);
    return dependents;
  }

  /**
   * Find similar nodes
   */
  querySimilarNodes(nodeId, limit = 5) {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    
    const similar = [];
    
    // Get nodes connected by SIMILAR_TO edges
    const edges = this.edges.get(nodeId);
    if (edges) {
      for (const [, edge] of edges) {
        if (edge.type === this.edgeTypes.SIMILAR_TO) {
          const targetNode = this.nodes.get(edge.to);
          if (targetNode) {
            similar.push({
              node: targetNode,
              similarity: edge.weight,
            });
          }
        }
      }
    }
    
    // Sort by similarity and limit
    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Find path between nodes
   */
  findPath(fromId, toId, maxDepth = 5) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }
    
    // BFS to find shortest path
    const queue = [[fromId]];
    const visited = new Set([fromId]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      
      if (current === toId) {
        return this.constructPathDetails(path);
      }
      
      if (path.length >= maxDepth) continue;
      
      const edges = this.edges.get(current);
      if (edges) {
        for (const [, edge] of edges) {
          if (!visited.has(edge.to)) {
            visited.add(edge.to);
            queue.push([...path, edge.to]);
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Analyze impact of changes
   */
  analyzeImpact(nodeId, changeType = 'modify') {
    const impact = {
      direct: [],
      indirect: [],
      tests: [],
      risk: 'low',
    };
    
    // Get direct dependents
    const directDependents = this.queryDependents(nodeId, 1);
    impact.direct = directDependents.map(d => d.node);
    
    // Get indirect dependents (2-3 levels)
    const indirectDependents = this.queryDependents(nodeId, 3)
      .filter(d => d.depth > 1);
    impact.indirect = indirectDependents.map(d => d.node);
    
    // Find affected tests
    for (const dependent of [...directDependents, ...indirectDependents]) {
      if (dependent.node.type === this.nodeTypes.TEST) {
        impact.tests.push(dependent.node);
      }
    }
    
    // Calculate risk level
    const totalImpact = impact.direct.length + impact.indirect.length;
    if (totalImpact > 20) {
      impact.risk = 'high';
    } else if (totalImpact > 10) {
      impact.risk = 'medium';
    }
    
    // Add specific risks based on node type
    const node = this.nodes.get(nodeId);
    if (node) {
      if (node.type === this.nodeTypes.MODULE && node.name.includes('core')) {
        impact.risk = 'high';
        impact.warning = 'Core module change - extensive testing required';
      }
      if (node.metadata.isPublicAPI) {
        impact.risk = 'high';
        impact.warning = 'Public API change - may break external consumers';
      }
    }
    
    return impact;
  }

  /**
   * Find clusters of related nodes
   */
  findClusters(minSize = 3) {
    const clusters = [];
    const visited = new Set();
    
    // Find connected components
    for (const [nodeId] of this.nodes) {
      if (visited.has(nodeId)) continue;
      
      const cluster = this.expandCluster(nodeId, visited);
      if (cluster.size >= minSize) {
        clusters.push({
          nodes: Array.from(cluster),
          size: cluster.size,
          type: this.identifyClusterType(cluster),
        });
      }
    }
    
    return clusters.sort((a, b) => b.size - a.size);
  }

  /**
   * Find central/important nodes
   */
  findCentralNodes(limit = 10) {
    const centrality = new Map();
    
    // Calculate degree centrality
    for (const [nodeId, node] of this.nodes) {
      const outDegree = this.edges.get(nodeId)?.size || 0;
      const inDegree = this.reverseEdges.get(nodeId)?.size || 0;
      const totalDegree = outDegree + inDegree;
      
      centrality.set(nodeId, {
        node,
        inDegree,
        outDegree,
        totalDegree,
        score: totalDegree,
      });
    }
    
    // Sort by centrality score
    return Array.from(centrality.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get insights from the graph
   */
  getInsights() {
    const insights = {
      structure: this.analyzeStructure(),
      complexity: this.analyzeComplexity(),
      quality: this.analyzeQuality(),
      recommendations: [],
    };
    
    // Generate recommendations based on analysis
    if (insights.complexity.circularDependencies > 0) {
      insights.recommendations.push({
        type: 'refactor',
        priority: 'high',
        message: `Found ${insights.complexity.circularDependencies} circular dependencies that should be resolved`,
      });
    }
    
    if (insights.structure.isolatedNodes > 5) {
      insights.recommendations.push({
        type: 'cleanup',
        priority: 'medium',
        message: `${insights.structure.isolatedNodes} files appear to be unused and could be removed`,
      });
    }
    
    if (insights.quality.untested > 0.3) {
      insights.recommendations.push({
        type: 'testing',
        priority: 'high',
        message: `${Math.round(insights.quality.untested * 100)}% of code lacks test coverage`,
      });
    }
    
    return insights;
  }

  /**
   * Helper methods
   */

  indexNode(node) {
    // Index by type
    if (!this.typeIndex.has(node.type)) {
      this.typeIndex.set(node.type, new Set());
    }
    this.typeIndex.get(node.type).add(node.id);
    
    // Index by name
    this.nameIndex.set(node.name, node.id);
  }

  resolveImport(importPath, fromFile) {
    // Simplified import resolution
    if (importPath.startsWith('.')) {
      // Relative import
      const basePath = fromFile.substring(0, fromFile.lastIndexOf('/'));
      return `${basePath}/${importPath}`.replace(/\/\//g, '/');
    }
    // Absolute or module import
    return importPath;
  }

  connectTests(projectAnalysis) {
    // Connect test files to their subjects
    for (const file of projectAnalysis.files || []) {
      if (file.path.includes('test') || file.path.includes('spec')) {
        const subjectPath = this.inferSubjectFromTest(file.path);
        if (subjectPath && this.nodes.has(subjectPath)) {
          this.addEdge(file.path, subjectPath, this.edgeTypes.TESTS);
        }
      }
    }
  }

  inferSubjectFromTest(testPath) {
    // Simple heuristic to find test subject
    return testPath
      .replace(/\.(test|spec)\./, '.')
      .replace('__tests__/', '')
      .replace('test/', '');
  }

  async addSimilarityEdges(projectAnalysis) {
    // Add edges between similar files based on embeddings
    // This would use the embedding system in a real implementation
    // For now, use simple name-based similarity
    
    const files = Array.from(this.nodes.values())
      .filter(n => n.type === this.nodeTypes.FILE);
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const similarity = this.calculateNameSimilarity(files[i].name, files[j].name);
        if (similarity > 0.7) {
          this.addEdge(files[i].id, files[j].id, this.edgeTypes.SIMILAR_TO, {
            weight: similarity,
          });
        }
      }
    }
  }

  calculateNameSimilarity(name1, name2) {
    // Simple similarity based on common substrings
    const parts1 = name1.toLowerCase().split(/[._-]/);
    const parts2 = name2.toLowerCase().split(/[._-]/);
    
    let common = 0;
    for (const part of parts1) {
      if (parts2.includes(part)) common++;
    }
    
    return common / Math.max(parts1.length, parts2.length);
  }

  constructPathDetails(pathIds) {
    const path = [];
    
    for (let i = 0; i < pathIds.length; i++) {
      const node = this.nodes.get(pathIds[i]);
      path.push(node);
      
      if (i < pathIds.length - 1) {
        // Find edge between this node and next
        const edges = this.edges.get(pathIds[i]);
        if (edges) {
          for (const [, edge] of edges) {
            if (edge.to === pathIds[i + 1]) {
              path.push({ type: 'edge', relationship: edge.type });
              break;
            }
          }
        }
      }
    }
    
    return path;
  }

  expandCluster(startId, visited) {
    const cluster = new Set();
    const queue = [startId];
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      cluster.add(nodeId);
      
      // Add connected nodes
      const edges = this.edges.get(nodeId);
      if (edges) {
        for (const [, edge] of edges) {
          if (!visited.has(edge.to)) {
            queue.push(edge.to);
          }
        }
      }
    }
    
    return cluster;
  }

  identifyClusterType(cluster) {
    const types = new Map();
    
    for (const nodeId of cluster) {
      const node = this.nodes.get(nodeId);
      if (node) {
        const count = types.get(node.type) || 0;
        types.set(node.type, count + 1);
      }
    }
    
    // Find dominant type
    let maxCount = 0;
    let dominantType = 'mixed';
    
    for (const [type, count] of types) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }
    
    return dominantType;
  }

  analyzeStructure() {
    const structure = {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByType: {},
      edgesByType: {},
      isolatedNodes: 0,
      clusters: this.findClusters().length,
    };
    
    // Count nodes by type
    for (const [type, nodeIds] of this.typeIndex) {
      structure.nodesByType[type] = nodeIds.size;
    }
    
    // Count edges by type
    for (const [, edge] of this.edges) {
      structure.edgesByType[edge.type] = (structure.edgesByType[edge.type] || 0) + 1;
    }
    
    // Count isolated nodes
    for (const [nodeId] of this.nodes) {
      const hasOutgoing = this.edges.has(nodeId);
      const hasIncoming = this.reverseEdges.has(nodeId);
      if (!hasOutgoing && !hasIncoming) {
        structure.isolatedNodes++;
      }
    }
    
    return structure;
  }

  analyzeComplexity() {
    return {
      avgDependencies: this.calculateAvgDependencies(),
      maxDependencyDepth: this.calculateMaxDependencyDepth(),
      circularDependencies: this.findCircularDependencies().length,
      centralityScore: this.calculateGraphCentrality(),
    };
  }

  analyzeQuality() {
    let tested = 0;
    let documented = 0;
    let total = 0;
    
    for (const [nodeId, node] of this.nodes) {
      if (node.type === this.nodeTypes.FILE || 
          node.type === this.nodeTypes.FUNCTION ||
          node.type === this.nodeTypes.CLASS) {
        total++;
        
        // Check if tested
        const edges = this.reverseEdges.get(nodeId);
        if (edges) {
          for (const [, edge] of edges) {
            if (edge.type === this.edgeTypes.TESTS) {
              tested++;
              break;
            }
          }
        }
        
        // Check if documented
        if (node.metadata.hasDocumentation) {
          documented++;
        }
      }
    }
    
    return {
      tested: total > 0 ? tested / total : 0,
      untested: total > 0 ? 1 - (tested / total) : 0,
      documented: total > 0 ? documented / total : 0,
    };
  }

  calculateAvgDependencies() {
    let totalDeps = 0;
    let nodeCount = 0;
    
    for (const [nodeId] of this.nodes) {
      const deps = this.queryDependencies(nodeId, 1);
      totalDeps += deps.length;
      nodeCount++;
    }
    
    return nodeCount > 0 ? totalDeps / nodeCount : 0;
  }

  calculateMaxDependencyDepth() {
    let maxDepth = 0;
    
    for (const [nodeId] of this.nodes) {
      const depth = this.calculateDependencyDepth(nodeId);
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }

  calculateDependencyDepth(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    
    const edges = this.edges.get(nodeId);
    if (!edges) return 0;
    
    let maxChildDepth = 0;
    for (const [, edge] of edges) {
      if (edge.type === this.edgeTypes.IMPORTS || 
          edge.type === this.edgeTypes.DEPENDS_ON) {
        const childDepth = this.calculateDependencyDepth(edge.to, visited);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }
    
    return 1 + maxChildDepth;
  }

  findCircularDependencies() {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    
    const dfs = (nodeId, path = []) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const edges = this.edges.get(nodeId);
      if (edges) {
        for (const [, edge] of edges) {
          if (edge.type === this.edgeTypes.IMPORTS || 
              edge.type === this.edgeTypes.DEPENDS_ON) {
            if (recursionStack.has(edge.to)) {
              // Found cycle
              const cycleStart = path.indexOf(edge.to);
              cycles.push(path.slice(cycleStart));
            } else if (!visited.has(edge.to)) {
              dfs(edge.to, [...path]);
            }
          }
        }
      }
      
      recursionStack.delete(nodeId);
    };
    
    for (const [nodeId] of this.nodes) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }
    
    return cycles;
  }

  calculateGraphCentrality() {
    const centralNodes = this.findCentralNodes(5);
    if (centralNodes.length === 0) return 0;
    
    const avgCentrality = centralNodes.reduce((sum, node) => sum + node.score, 0) / centralNodes.length;
    const maxPossible = this.nodes.size * 2; // Each node could connect to all others
    
    return avgCentrality / maxPossible;
  }

  getGraphSummary() {
    return {
      nodes: this.metadata.nodeCount,
      edges: this.metadata.edgeCount,
      structure: this.analyzeStructure(),
      insights: this.getInsights(),
    };
  }

  /**
   * Export graph for visualization
   */
  exportForVisualization() {
    const nodes = [];
    const edges = [];
    
    // Export nodes
    for (const [id, node] of this.nodes) {
      nodes.push({
        id,
        label: node.name,
        type: node.type,
        group: node.type,
        size: this.calculateNodeSize(node),
      });
    }
    
    // Export edges
    for (const [id, edge] of this.edges) {
      edges.push({
        id,
        source: edge.from,
        target: edge.to,
        type: edge.type,
        weight: edge.weight,
      });
    }
    
    return { nodes, edges };
  }

  calculateNodeSize(node) {
    // Size based on connections
    const outDegree = this.edges.get(node.id)?.size || 0;
    const inDegree = this.reverseEdges.get(node.id)?.size || 0;
    return 5 + Math.min(20, (outDegree + inDegree) * 2);
  }
}
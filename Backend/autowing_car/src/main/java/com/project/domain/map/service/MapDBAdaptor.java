package com.project.domain.map.service;

import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.map.repository.EdgeRepository;
import com.project.domain.map.repository.NodeRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
@Transactional
public class MapDBAdaptor {
    private final EdgeRepository edgeRepository;
    private final NodeRepository nodeRepository;

    public Edge getEdgeByCode(String edgeCode) {
        return edgeRepository.findByEdgeCode(edgeCode)
                .orElseThrow(() -> new IllegalArgumentException("No Edge: " + edgeCode));
    }

    public Node getNodeByCode(String nodeCode) {
        return nodeRepository.findByNodeCode(nodeCode)
                .orElseThrow(() -> new IllegalArgumentException("No Node: " + nodeCode));
    }

    // [Pathfinding] 인접 간선 조회
    public List<Edge> getEdgesBySrcNode(Node srcNode) {
        return edgeRepository.findBySrcNode(srcNode);
    }

    public Edge registerEdge(Edge edge) {
        return edgeRepository.save(edge);
    }

    public Node registerNode(Node node) {
        return nodeRepository.save(node);
    }

    // [GraphCache] 전체 간선 조회
    public List<Edge> findAllEdges() {
        return edgeRepository.findAllWithNodes();
    }

    public List<Node> findAllNodes() {
        return nodeRepository.findAll();
    }
}

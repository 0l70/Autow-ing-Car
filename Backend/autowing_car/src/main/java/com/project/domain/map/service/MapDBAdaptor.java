package com.project.domain.map.service;

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

}

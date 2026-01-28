package com.project.domain.map.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;

@Repository
public interface EdgeRepository extends JpaRepository<Edge, Long> {

    Optional<Edge> findByEdgeCode(String edgeCode);

    // [Pathfinding] 특정 노드에서 출발하는 모든 간선 조회
    java.util.List<Edge> findBySrcNode(Node srcNode);
}

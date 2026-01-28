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

    // [GraphCache] 모든 엣지 + 노드 패치 조인 (LazyInitException 방지)
    @org.springframework.data.jpa.repository.Query("SELECT e FROM Edge e JOIN FETCH e.srcNode JOIN FETCH e.dstNode")
    java.util.List<Edge> findAllWithNodes();
}

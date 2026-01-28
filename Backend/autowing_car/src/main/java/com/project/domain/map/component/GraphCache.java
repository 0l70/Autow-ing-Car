package com.project.domain.map.component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.annotation.PostConstruct;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.project.domain.map.entity.Edge;
import com.project.domain.map.entity.Node;
import com.project.domain.map.service.MapDBAdaptor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class GraphCache {

    private final MapDBAdaptor mapDBAdaptor;

    // srcNodeId -> outgoing edges
    private Map<Long, List<Edge>> adjacencyMap = new HashMap<>();

    @Scheduled(fixedRate = 60 * 1000) // 1분마다 실행
    public void load() {
        log.info("[GraphCache] Loading edges from DB...");
        List<Edge> allEdges = mapDBAdaptor.findAllEdges();

        for (Edge edge : allEdges) {
            adjacencyMap
                    .computeIfAbsent(edge.getSrcNode().getId(), k -> new ArrayList<>())
                    .add(edge);
        }
        log.info("[GraphCache] Loaded {} edges.", allEdges.size());
    }

    public List<Edge> getEdges(Node node) {
        return adjacencyMap.getOrDefault(node.getId(), List.of());
    }

    // 맵 변경 시 캐시 갱신용 메서드 (추후 구현)
    public void reload() {
        adjacencyMap.clear();
        load();
    }
}

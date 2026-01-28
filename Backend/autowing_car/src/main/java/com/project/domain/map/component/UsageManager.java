package com.project.domain.map.component;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import org.springframework.stereotype.Component;

@Component
public class UsageManager {

    // Thread-safe storage for locks
    private final Set<Long> lockedEdges = Collections.synchronizedSet(new HashSet<>());
    private final Set<Long> lockedNodes = Collections.synchronizedSet(new HashSet<>());

    // --- Edge Lock ---
    public boolean isEdgeLocked(Long edgeId) {
        return lockedEdges.contains(edgeId);
    }

    public void lockEdge(Long edgeId) {
        lockedEdges.add(edgeId);
    }

    public void unlockEdge(Long edgeId) {
        lockedEdges.remove(edgeId);
    }

    // --- Node Lock ---
    public boolean isNodeLocked(Long nodeId) {
        return lockedNodes.contains(nodeId);
    }

    public void lockNode(Long nodeId) {
        lockedNodes.add(nodeId);
    }

    public void unlockNode(Long nodeId) {
        lockedNodes.remove(nodeId);
    }
}

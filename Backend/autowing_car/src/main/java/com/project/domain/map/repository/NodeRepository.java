package com.project.domain.map.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.project.domain.map.entity.Node;

@Repository
public interface NodeRepository extends JpaRepository<Node, Long> {
    Optional<Node> findByNodeCode(String nodeCode);
}
